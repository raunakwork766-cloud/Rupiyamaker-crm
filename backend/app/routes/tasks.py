from fastapi import APIRouter, HTTPException, Depends, status, Query, UploadFile, File, Form, Body, Request
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime, timedelta
from pathlib import Path
import json

from app.database.Tasks import TasksDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Leads import LeadsDB
from app.database.LoanTypes import LoanTypesDB
from app.database.TaskComments import TaskCommentsDB
from app.database.TaskHistory import TaskHistoryDB
from app.database.Notifications import NotificationsDB
from app.database import (
    get_tasks_db, get_users_db, get_roles_db, get_leads_db, 
    get_notifications_db, get_loan_types_db, get_task_comments_db,
    get_task_history_db
)
from app.schemas.task_schemas import (
    TaskCreate, TaskUpdate, TaskResponse, TaskInDB, TaskFilterRequest,
    PaginatedTaskResponse, TaskStatsResponse, TaskBulkUpdateRequest,
    TaskAttachmentCreate, TaskType, TaskStatus, TaskPriority
)
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission
from app.utils.lead_utils import save_upload_file, get_file_type

router = APIRouter(
    prefix="/tasks",
    tags=["Task Management"]
)

async def enhance_task_details(
    task: Dict[str, Any], 
    users_db: UsersDB, 
    leads_db: LeadsDB, 
    loan_types_db: LoanTypesDB,
    current_user_id: Optional[str] = None,
    users_cache: Optional[Dict[str, Any]] = None,
    leads_cache: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Enhance task details with additional information like creator details,
    assigned user details, lead information, etc.
    
    Optimized with optional caching to reduce database queries.
    """
    task_dict = convert_object_id(task)
    
    # Ensure we have an 'id' field for the response model
    if '_id' in task_dict and 'id' not in task_dict:
        task_dict['id'] = str(task_dict['_id'])
    elif 'id' not in task_dict and '_id' not in task_dict:
        task_dict['id'] = ""
    
    # Get creator details (use cache if provided)
    if task_dict.get("created_by"):
        creator = None
        if users_cache and str(task_dict["created_by"]) in users_cache:
            creator = users_cache[str(task_dict["created_by"])]
        else:
            creator = await users_db.get_user(task_dict["created_by"])
        
        if creator:
            task_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
        else:
            task_dict["creator_name"] = "Unknown User"
    
    # Get assigned users details (use cache if provided)
    assigned_users = []
    assigned_to = task_dict.get("assigned_to", [])
    if not isinstance(assigned_to, list):
        assigned_to = [assigned_to] if assigned_to else []
    
    for assigned_id in assigned_to:
        user_details = None
        if users_cache and str(assigned_id) in users_cache:
            user_details = users_cache[str(assigned_id)]
        else:
            user_details = await users_db.get_user(str(assigned_id))
        
        if user_details:
            assigned_users.append({
                "user_id": str(assigned_id),
                "name": f"{user_details.get('first_name', '')} {user_details.get('last_name', '')}".strip(),
                "email": user_details.get("email", "")
            })
    task_dict["assigned_users"] = assigned_users
    
    # Get lead info if available (use cache if provided)
    if task_dict.get("lead_id"):
        lead = None
        if leads_cache and str(task_dict["lead_id"]) in leads_cache:
            lead = leads_cache[str(task_dict["lead_id"])]
        else:
            lead = await leads_db.get_lead(task_dict["lead_id"])
        
        if lead:
            task_dict["lead_info"] = {
                "id": str(lead["_id"]),
                "customer_name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
                "phone": lead.get("phone", ""),
                "status": lead.get("status", ""),
                "loan_type": lead.get("loan_type", "")
            }
    
    # Get attachments - initialize empty list for now
    task_dict["attachments"] = []
    
    return task_dict

@router.post("/", response_model=Dict[str, Any])
async def create_task(
    request: Request,
    task: TaskCreate,
    user_id: str = Query(..., description="ID of the user creating the task"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    task_history_db: TaskHistoryDB = Depends(get_task_history_db),
    leads_db: LeadsDB = Depends(get_leads_db),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Create a new task"""
    # Check permission - anyone who can view tasks can create them (business rule: "Anyone can create tasks")
    # Changed from "create" to "show" action to allow all task users to create tasks
    await check_permission(user_id, "tasks", "show", users_db, roles_db)
    
    # Get user details to check if they can assign to others
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user_role = await roles_db.get_role(user.get("role_id"))
    user_permissions = user_role.get("permissions", []) if user_role else []
    
    # Check if user can change created_by field (only super admin can)
    is_super_admin = any(
        (perm.get("page") in ["*", "any"] and perm.get("actions") == "*")
        for perm in user_permissions
    )
    
    # If not super admin, force created_by to be the current user
    if not is_super_admin:
        task.created_by = user_id
    
    # Ensure the creator is in assigned_to list by default
    if user_id not in task.assigned_to:
        task.assigned_to.append(user_id)
    
    # Validate assigned users exist
    for assigned_user_id in task.assigned_to:
        assigned_user = await users_db.get_user(assigned_user_id)
        if not assigned_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assigned user with ID {assigned_user_id} not found"
            )
    
    # Validate lead exists if provided
    if task.lead_id:
        lead = await leads_db.get_lead(task.lead_id)
        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lead with ID {task.lead_id} not found"
            )
    
    # Create task
    task_data = task.dict()
    
    # Check if this is a recurring task
    is_recurring = task_data.get("is_recurring", False)
    recurring_config = task_data.get("recurring_config", None)
    
    if is_recurring and recurring_config:
        print(f"[DEBUG] Creating recurring task with config: {recurring_config}")
        # Use the recurring task creation method
        task_id = await tasks_db.create_recurring_task(task_data, recurring_config)
    else:
        # Regular task creation
        task_id = await tasks_db.create_task(task_data)
    
    if not task_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create task"
        )
    
    # Add task creation history
    try:
        print(f"[DEBUG] Adding task creation history for task {task_id}")
        # Get user's name for history
        user = await users_db.get_user(user_id)
        user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else "Unknown User"
        if not user_name:
            user_name = user.get('username', 'Unknown User')
        
        print(f"[DEBUG] User name for history: {user_name}")
        
        # Get task title for history
        task_title = task_data.get('subject', 'Untitled Task')
        
        print(f"[DEBUG] Calling add_task_created with: task_id={task_id}, user_id={user_id}, user_name={user_name}, task_title={task_title}")
        result = await task_history_db.add_task_created(task_id, user_id, user_name, task_title)
        print(f"[DEBUG] History result: {result}")
        
        # Create notifications for assigned users
        # Fetch complete task data from the database to ensure we have all fields
        complete_task_data = await tasks_db.get_task(task_id)
        
        for assigned_user_id in task.assigned_to:
            # Skip notification for the creator
            if assigned_user_id != user_id:
                try:
                    await notifications_db.create_task_notification(
                        user_id=assigned_user_id,
                        task_data=complete_task_data,
                        created_by=user_id,
                        created_by_name=user_name
                    )
                    print(f"[DEBUG] Created task notification for user {assigned_user_id}")
                except Exception as ne:
                    print(f"[ERROR] Failed to create notification for user {assigned_user_id}: {ne}")
        
    except Exception as e:
        print(f"[ERROR] Failed to add task creation history: {e}")
        import traceback
        traceback.print_exc()
    
    return {"message": "Task created successfully", "task_id": task_id}

@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    request: Request,
    filter: Optional[str] = Query(None, description="Quick filter: due_today, upcoming, overdue, completed, failed"),
    task_type: Optional[TaskType] = Query(None, description="Filter by task type"),
    task_status: Optional[TaskStatus] = Query(None, description="Filter by status"),
    priority: Optional[TaskPriority] = Query(None, description="Filter by priority"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned user ID"),
    created_by: Optional[str] = Query(None, description="Filter by creator user ID"),
    loan_type: Optional[str] = Query(None, description="Filter by loan type"),
    is_urgent: Optional[bool] = Query(None, description="Filter by urgent tasks"),
    search: Optional[str] = Query(None, description="Search in subject and details"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: int = Query(-1, description="Sort order (1 for asc, -1 for desc)"),
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    leads_db: LeadsDB = Depends(get_leads_db)
):
    """List all tasks with filtering (no pagination)"""
    # Check permission to view tasks - explicit check first
    await check_permission(user_id, "tasks", "show", users_db, roles_db)
    
    # Get user role and permissions for visibility filtering
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    user_role = await roles_db.get_role(user.get("role_id"))
    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User role not found"
        )
    
    user_permissions = user_role.get("permissions", [])
    
    # Build filter based on permissions
    extra_filters = {}
    
    # Handle quick filter parameter (due_today, upcoming, overdue, completed, failed)
    if filter:
        today = datetime.now().date()
        
        if filter == "due_today":
            # Tasks due today
            extra_filters["due_date"] = {
                "$gte": datetime.combine(today, datetime.min.time()),
                "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
            }
            extra_filters["status"] = {"$nin": ["Completed", "Cancelled"]}
        elif filter == "upcoming":
            # Tasks due in the future (after today)
            extra_filters["due_date"] = {"$gt": datetime.combine(today + timedelta(days=1), datetime.min.time())}
            extra_filters["status"] = {"$nin": ["Completed", "Cancelled"]}
        elif filter == "overdue":
            # Tasks due before today and not completed
            extra_filters["due_date"] = {"$lt": datetime.combine(today, datetime.min.time())}
            extra_filters["status"] = {"$nin": ["Completed", "Cancelled"]}
        elif filter == "completed":
            # Completed tasks
            extra_filters["status"] = "Completed"
        elif filter == "failed":
            # Failed tasks
            extra_filters["status"] = "Failed"
    
    # Add user-specified filters
    if task_type:
        extra_filters["task_type"] = task_type
    if task_status:
        extra_filters["status"] = task_status
    if priority:
        extra_filters["priority"] = priority
    if loan_type:
        extra_filters["loan_type"] = loan_type
    if is_urgent is not None:
        extra_filters["is_urgent"] = is_urgent
    if assigned_to:
        # Handle assigned_to filter - check both string and array
        assigned_object_id = ObjectId(assigned_to) if ObjectId.is_valid(assigned_to) else assigned_to
        extra_filters["$or"] = [
            {"assigned_to": assigned_object_id},
            {"assigned_to": {"$in": [assigned_object_id]}}
        ]
    if created_by:
        created_by_object_id = ObjectId(created_by) if ObjectId.is_valid(created_by) else created_by
        extra_filters["created_by"] = created_by_object_id
    if search:
        extra_filters["$or"] = [
            {"subject": {"$regex": search, "$options": "i"}},
            {"task_details": {"$regex": search, "$options": "i"}},
            {"notes": {"$regex": search, "$options": "i"}}
        ]
    
    # Get visibility filter
    visibility_filter = await tasks_db.get_visible_tasks_filter(
        user_id=user_id,
        user_role=user_role,
        user_permissions=user_permissions,
        roles_db=roles_db,
        extra_filters=extra_filters
    )
    
    # Get all tasks (no pagination)
    tasks = await tasks_db.list_tasks(
        filter_dict=visibility_filter,
        skip=0,
        limit=0,  # 0 means no limit, get all tasks
        sort_by=sort_by,
        sort_order=sort_order
    )
    
    # **PERFORMANCE OPTIMIZATION: Batch fetch related data**
    # Collect all unique user IDs and lead IDs from tasks
    user_ids_set = set()
    lead_ids_set = set()
    
    for task in tasks:
        # Collect creator IDs
        if task.get("created_by"):
            user_ids_set.add(str(task["created_by"]))
        
        # Collect assigned user IDs
        assigned_to = task.get("assigned_to", [])
        if not isinstance(assigned_to, list):
            assigned_to = [assigned_to] if assigned_to else []
        for user_id in assigned_to:
            user_ids_set.add(str(user_id))
        
        # Collect lead IDs
        if task.get("lead_id"):
            lead_ids_set.add(str(task["lead_id"]))
    
    # Batch fetch all users at once
    users_cache = {}
    if user_ids_set:
        user_object_ids = [ObjectId(uid) for uid in user_ids_set if ObjectId.is_valid(uid)]
        users_cursor = users_db.collection.find({"_id": {"$in": user_object_ids}})
        users_list = await users_cursor.to_list(None)
        for user in users_list:
            users_cache[str(user["_id"])] = user
    
    # Batch fetch all leads at once
    leads_cache = {}
    if lead_ids_set:
        lead_object_ids = [ObjectId(lid) for lid in lead_ids_set if ObjectId.is_valid(lid)]
        leads_cursor = leads_db.collection.find({"_id": {"$in": lead_object_ids}})
        leads_list = await leads_cursor.to_list(None)
        for lead in leads_list:
            leads_cache[str(lead["_id"])] = lead
    
    # Format tasks with additional info using cached data
    formatted_tasks = []
    
    for task in tasks:
        task_dict = convert_object_id(task)
        
        # Ensure we have an 'id' field for the response model
        if '_id' in task_dict and 'id' not in task_dict:
            task_dict['id'] = str(task_dict['_id'])
        elif 'id' not in task_dict and '_id' not in task_dict:
            task_dict['id'] = ""
        
        # Ensure all required fields have default values for backward compatibility
        if 'is_urgent' not in task_dict:
            task_dict['is_urgent'] = False
        if 'due_time' not in task_dict:
            task_dict['due_time'] = None
        if 'notes' not in task_dict:
            task_dict['notes'] = None
        
        # Get creator details from cache
        if task_dict.get("created_by"):
            creator = users_cache.get(str(task_dict["created_by"]))
            if creator:
                task_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
        
        # Get assigned users details from cache
        assigned_users = []
        assigned_to = task_dict.get("assigned_to", [])
        if not isinstance(assigned_to, list):
            assigned_to = [assigned_to] if assigned_to else []
        
        for assigned_id in assigned_to:
            user_details = users_cache.get(str(assigned_id))
            if user_details:
                assigned_users.append({
                    "user_id": str(assigned_id),
                    "name": f"{user_details.get('first_name', '')} {user_details.get('last_name', '')}".strip(),
                    "email": user_details.get("email", "")
                })
        task_dict["assigned_users"] = assigned_users
        
        # Get lead info from cache
        if task_dict.get("lead_id"):
            lead = leads_cache.get(str(task_dict["lead_id"]))
            
            # Check if lead exists
            if lead:
                # Access lead properties
                lead_login = "Login" if lead.get("file_sent_to_login", False) == True else "Lead"
                
                task_dict["lead_info"] = {
                    "id": str(lead["_id"]),
                    "lead_login": lead_login,
                    "customer_name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
                    "phone": lead.get("phone", ""),
                    "status": lead.get("status", ""),
                    "loan_type": lead.get("loan_type", "")
                }
        
        # Get attachments count and basic info (now embedded in task)
        attachments = task_dict.get("attachments", [])
        task_dict["attachments_count"] = len(attachments)
        # Include basic attachment info for table display
        task_dict["attachments"] = [
            {
                "id": str(att.get("_id", "")),
                "file_name": att.get("file_name", ""),
                "file_size": att.get("file_size", 0)
            } for att in attachments
        ]
        
        formatted_tasks.append(task_dict)
    
    return formatted_tasks

@router.get("/with-stats")
async def list_tasks_with_stats(
    request: Request,
    filter: Optional[str] = Query(None, description="Quick filter: due_today, upcoming, overdue, completed, failed"),
    task_type: Optional[TaskType] = Query(None, description="Filter by task type"),
    task_status: Optional[TaskStatus] = Query(None, description="Filter by status"),
    priority: Optional[TaskPriority] = Query(None, description="Filter by priority"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned user ID"),
    created_by: Optional[str] = Query(None, description="Filter by creator user ID"),
    loan_type: Optional[str] = Query(None, description="Filter by loan type"),
    is_urgent: Optional[bool] = Query(None, description="Filter by urgent tasks"),
    search: Optional[str] = Query(None, description="Search in subject and details"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: int = Query(-1, description="Sort order (1 for asc, -1 for desc)"),
    limit: Optional[int] = Query(None, description="PERFORMANCE: Limit number of tasks returned (0 or None = all)"),
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    leads_db: LeadsDB = Depends(get_leads_db)
):
    """
    OPTIMIZED COMBINED ENDPOINT: Get tasks and stats in a single API call
    This reduces network round-trips from 2 to 1 for faster page load
    PERFORMANCE: Supports optional limit parameter to reduce initial payload
    """
    # Check permission to view tasks - explicit check first
    await check_permission(user_id, "tasks", "show", users_db, roles_db)
    
    # Get user and role info
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    user_role = await roles_db.get_role(user.get("role_id"))
    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User role not found"
        )
    
    user_permissions = user_role.get("permissions", [])
    
    # Build filter based on permissions
    extra_filters = {}
    
    # Handle quick filter parameter
    if filter:
        today = datetime.now().date()
        
        if filter == "due_today":
            extra_filters["due_date"] = {
                "$gte": datetime.combine(today, datetime.min.time()),
                "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
            }
            extra_filters["status"] = {"$nin": ["Completed", "Cancelled"]}
        elif filter == "upcoming":
            extra_filters["due_date"] = {"$gt": datetime.combine(today + timedelta(days=1), datetime.min.time())}
            extra_filters["status"] = {"$nin": ["Completed", "Cancelled"]}
        elif filter == "overdue":
            extra_filters["due_date"] = {"$lt": datetime.combine(today, datetime.min.time())}
            extra_filters["status"] = {"$nin": ["Completed", "Cancelled"]}
        elif filter == "completed":
            extra_filters["status"] = "Completed"
        elif filter == "failed":
            extra_filters["status"] = "Failed"
    
    # Add user-specified filters
    if task_type:
        extra_filters["task_type"] = task_type
    if task_status:
        extra_filters["status"] = task_status
    if priority:
        extra_filters["priority"] = priority
    if loan_type:
        extra_filters["loan_type"] = loan_type
    if is_urgent is not None:
        extra_filters["is_urgent"] = is_urgent
    if assigned_to:
        assigned_object_id = ObjectId(assigned_to) if ObjectId.is_valid(assigned_to) else assigned_to
        extra_filters["$or"] = [
            {"assigned_to": assigned_object_id},
            {"assigned_to": {"$in": [assigned_object_id]}}
        ]
    if created_by:
        created_by_object_id = ObjectId(created_by) if ObjectId.is_valid(created_by) else created_by
        extra_filters["created_by"] = created_by_object_id
    if search:
        extra_filters["$or"] = [
            {"subject": {"$regex": search, "$options": "i"}},
            {"task_details": {"$regex": search, "$options": "i"}},
            {"notes": {"$regex": search, "$options": "i"}}
        ]
    
    # Get visibility filter
    visibility_filter = await tasks_db.get_visible_tasks_filter(
        user_id=user_id,
        user_role=user_role,
        user_permissions=user_permissions,
        roles_db=roles_db,
        extra_filters=extra_filters
    )
    
    # **PARALLEL EXECUTION: Fetch tasks and stats simultaneously**
    import asyncio
    
    # PERFORMANCE: Apply limit if provided for faster initial load
    task_limit = limit if limit and limit > 0 else 0  # 0 means no limit
    
    # Fetch tasks
    tasks_future = tasks_db.list_tasks(
        filter_dict=visibility_filter,
        skip=0,
        limit=task_limit,
        sort_by=sort_by,
        sort_order=sort_order
    )
    
    # Get base visibility filter without extra filters for stats
    base_visibility_filter = await tasks_db.get_visible_tasks_filter(
        user_id=user_id,
        user_role=user_role,
        user_permissions=user_permissions,
        roles_db=roles_db
    )
    
    # Fetch stats (multiple counts in parallel)
    today = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)
    user_object_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    stats_futures = [
        tasks_db.collection.count_documents(base_visibility_filter),  # total
        tasks_db.collection.count_documents({**base_visibility_filter, "status": TaskStatus.PENDING}),  # pending
        tasks_db.collection.count_documents({**base_visibility_filter, "status": TaskStatus.IN_PROGRESS}),  # in_progress
        tasks_db.collection.count_documents({**base_visibility_filter, "status": TaskStatus.COMPLETED}),  # completed
        tasks_db.collection.count_documents({**base_visibility_filter, "is_urgent": True, "status": {"$ne": TaskStatus.COMPLETED}}),  # urgent
        tasks_db.collection.count_documents({**base_visibility_filter, "due_date": {"$lt": today}, "status": {"$ne": TaskStatus.COMPLETED}}),  # overdue
        tasks_db.collection.count_documents({**base_visibility_filter, "created_by": user_object_id}),  # my_tasks
        tasks_db.collection.count_documents({**base_visibility_filter, "$or": [{"assigned_to": user_object_id}, {"assigned_to": {"$in": [user_object_id]}}]}),  # assigned_to_me
    ]
    
    # Execute all queries in parallel
    tasks, *stats_results = await asyncio.gather(tasks_future, *stats_futures)
    
    # Unpack stats results
    (total_tasks, pending_tasks, in_progress_tasks, completed_tasks, 
     urgent_tasks, overdue_tasks, my_tasks, assigned_to_me) = stats_results
    
    # **BATCH FETCH RELATED DATA**
    user_ids_set = set()
    lead_ids_set = set()
    
    for task in tasks:
        if task.get("created_by"):
            user_ids_set.add(str(task["created_by"]))
        
        assigned_to_list = task.get("assigned_to", [])
        if not isinstance(assigned_to_list, list):
            assigned_to_list = [assigned_to_list] if assigned_to_list else []
        for uid in assigned_to_list:
            user_ids_set.add(str(uid))
        
        if task.get("lead_id"):
            lead_ids_set.add(str(task["lead_id"]))
    
    # Batch fetch users and leads in parallel
    users_future = None
    leads_future = None
    
    if user_ids_set:
        user_object_ids = [ObjectId(uid) for uid in user_ids_set if ObjectId.is_valid(uid)]
        users_future = users_db.collection.find({"_id": {"$in": user_object_ids}}).to_list(None)
    
    if lead_ids_set:
        lead_object_ids = [ObjectId(lid) for lid in lead_ids_set if ObjectId.is_valid(lid)]
        leads_future = leads_db.collection.find({"_id": {"$in": lead_object_ids}}).to_list(None)
    
    # Wait for batch fetches
    batch_results = await asyncio.gather(
        users_future if users_future else asyncio.sleep(0, result=[]),
        leads_future if leads_future else asyncio.sleep(0, result=[])
    )
    users_list, leads_list = batch_results
    
    # Build caches
    users_cache = {str(user["_id"]): user for user in users_list}
    leads_cache = {str(lead["_id"]): lead for lead in leads_list}
    
    # Format tasks
    formatted_tasks = []
    for task in tasks:
        task_dict = convert_object_id(task)
        
        if '_id' in task_dict and 'id' not in task_dict:
            task_dict['id'] = str(task_dict['_id'])
        elif 'id' not in task_dict and '_id' not in task_dict:
            task_dict['id'] = ""
        
        if 'is_urgent' not in task_dict:
            task_dict['is_urgent'] = False
        if 'due_time' not in task_dict:
            task_dict['due_time'] = None
        if 'notes' not in task_dict:
            task_dict['notes'] = None
        
        # Get creator details from cache
        if task_dict.get("created_by"):
            creator = users_cache.get(str(task_dict["created_by"]))
            if creator:
                task_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
        
        # Get assigned users from cache
        assigned_users = []
        assigned_to_list = task_dict.get("assigned_to", [])
        if not isinstance(assigned_to_list, list):
            assigned_to_list = [assigned_to_list] if assigned_to_list else []
        
        for assigned_id in assigned_to_list:
            user_details = users_cache.get(str(assigned_id))
            if user_details:
                assigned_users.append({
                    "user_id": str(assigned_id),
                    "name": f"{user_details.get('first_name', '')} {user_details.get('last_name', '')}".strip(),
                    "email": user_details.get("email", "")
                })
        task_dict["assigned_users"] = assigned_users
        
        # Get lead info from cache
        if task_dict.get("lead_id"):
            lead = leads_cache.get(str(task_dict["lead_id"]))
            if lead:
                lead_login = "Login" if lead.get("file_sent_to_login", False) == True else "Lead"
                task_dict["lead_info"] = {
                    "id": str(lead["_id"]),
                    "lead_login": lead_login,
                    "customer_name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
                    "phone": lead.get("phone", ""),
                    "status": lead.get("status", ""),
                    "loan_type": lead.get("loan_type", "")
                }
        
        # Get attachments info
        attachments = task_dict.get("attachments", [])
        task_dict["attachments_count"] = len(attachments)
        task_dict["attachments"] = [
            {
                "id": str(att.get("_id", "")),
                "file_name": att.get("file_name", ""),
                "file_size": att.get("file_size", 0)
            } for att in attachments
        ]
        
        formatted_tasks.append(task_dict)
    
    # Return combined response
    return {
        "tasks": formatted_tasks,
        "stats": {
            "total_tasks": total_tasks,
            "pending_tasks": pending_tasks,
            "in_progress_tasks": in_progress_tasks,
            "completed_tasks": completed_tasks,
            "overdue_tasks": overdue_tasks,
            "urgent_tasks": urgent_tasks,
            "my_tasks": my_tasks,
            "assigned_to_me": assigned_to_me,
            # Add extra stats for frontend tabs
            "due_today_tasks": 0,  # Frontend will calculate
            "upcoming_tasks": 0,   # Frontend will calculate
            "failed_tasks": 0      # Frontend will calculate
        }
    }

@router.get("/stats", response_model=TaskStatsResponse)
async def get_task_stats(
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get task statistics for dashboard"""
    # No permission check needed - users can view their own task stats
    
    # Get user role and permissions
    user = await users_db.get_user(user_id)
    user_role = await roles_db.get_role(user.get("role_id") if user else None)
    user_permissions = user_role.get("permissions", []) if user_role else []
    
    # Get visibility filter
    visibility_filter = await tasks_db.get_visible_tasks_filter(
        user_id=user_id,
        user_role=user_role,
        user_permissions=user_permissions,
        roles_db=roles_db
    )
    
    # Get various counts
    total_tasks = await tasks_db.collection.count_documents(visibility_filter)
    
    pending_tasks = await tasks_db.collection.count_documents({
        **visibility_filter,
        "status": TaskStatus.PENDING
    })
    
    in_progress_tasks = await tasks_db.collection.count_documents({
        **visibility_filter,
        "status": TaskStatus.IN_PROGRESS
    })
    
    completed_tasks = await tasks_db.collection.count_documents({
        **visibility_filter,
        "status": TaskStatus.COMPLETED
    })
    
    urgent_tasks = await tasks_db.collection.count_documents({
        **visibility_filter,
        "is_urgent": True,
        "status": {"$ne": TaskStatus.COMPLETED}
    })
    
    # Overdue tasks (due_date < today and not completed)
    today = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)
    overdue_tasks = await tasks_db.collection.count_documents({
        **visibility_filter,
        "due_date": {"$lt": today},
        "status": {"$ne": TaskStatus.COMPLETED}
    })
    
    # Tasks created by current user
    user_object_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    my_tasks = await tasks_db.collection.count_documents({
        **visibility_filter,
        "created_by": user_object_id
    })
    
    # Tasks assigned to current user
    assigned_to_me = await tasks_db.collection.count_documents({
        **visibility_filter,
        "$or": [
            {"assigned_to": user_object_id},
            {"assigned_to": {"$in": [user_object_id]}}
        ]
    })
    
    return TaskStatsResponse(
        total_tasks=total_tasks,
        pending_tasks=pending_tasks,
        in_progress_tasks=in_progress_tasks,
        completed_tasks=completed_tasks,
        overdue_tasks=overdue_tasks,
        urgent_tasks=urgent_tasks,
        my_tasks=my_tasks,
        assigned_to_me=assigned_to_me
    )

@router.get("/users-for-assignment")
async def get_users_for_assignment(
    user_id: str = Query(..., description="ID of the user making the request"),
    search: Optional[str] = Query(None, description="Search users by name or email"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get users available for task assignment"""
    # No permission check needed - users can assign tasks to others
    
    # Get current user to check if they're super admin
    user = await users_db.get_user(user_id)
    user_role = await roles_db.get_role(user.get("role_id")) if user else None
    user_permissions = user_role.get("permissions", []) if user_role else []
    
    is_super_admin = any(
        (perm.get("page") in ["*", "any"] and perm.get("actions") == "*")
        for perm in user_permissions
    )
    
    # Get all users
    all_users = await users_db.list_users()
    available_users = []
    
    for user_obj in all_users:
        # Get user's role
        user_role_obj = None
        if user_obj.get("role_id"):
            user_role_obj = await roles_db.get_role(user_obj["role_id"])
        
        user_dict = convert_object_id(user_obj)
        user_dict["role_name"] = user_role_obj.get("name", "No Role") if user_role_obj else "No Role"
        user_dict["full_name"] = f"{user_dict.get('first_name', '')} {user_dict.get('last_name', '')}".strip()
        
        # Apply search filter if provided
        if search:
            search_text = search.lower()
            if (search_text not in user_dict["full_name"].lower() and 
                search_text not in user_dict.get("email", "").lower() and
                search_text not in user_dict["role_name"].lower()):
                continue
        
        available_users.append({
            "user_id": user_dict["_id"],
            "name": user_dict["full_name"],
            "email": user_dict.get("email", ""),
            "role": user_dict["role_name"]
        })
    
    return {"users": available_users}

@router.get("/loan-types-with-leads")
async def get_loan_types_with_leads(
    user_id: str = Query(..., description="ID of the user making the request"),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get loan types and count of leads/logins for each type"""
    # Check if user has leads view permission for all leads, otherwise show assigned only
    try:
        await check_permission(user_id, "leads", "show", users_db, roles_db)
        show_all_leads = True
    except:
        show_all_leads = False
    
    # Get all loan types
    loan_types = await loan_types_db.list_loan_types()
    
    # Convert user_id to ObjectId for querying
    user_object_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    loan_types_with_counts = []
    for loan_type in loan_types:
        loan_type_dict = convert_object_id(loan_type)
        
        # Base filter for loan type
        base_filter = {"loan_type": loan_type_dict["name"]}
        
        # Assignment filter if user doesn't have view all permission
        assignment_filter = None
        if not show_all_leads:
            assignment_filter = {
                "$or": [
                    {"assigned_to": user_object_id},
                    {"assigned_to": {"$in": [user_object_id]}}
                ]
            }
        
        # Count leads (file_sent_to_login != True or field doesn't exist)
        lead_filter = {
            **base_filter,
            "$or": [
                {"file_sent_to_login": {"$ne": True}},
                {"file_sent_to_login": {"$exists": False}}
            ]
        }
        if assignment_filter:
            lead_filter = {
                **base_filter,
                "$and": [
                    assignment_filter,
                    {
                        "$or": [
                            {"file_sent_to_login": {"$ne": True}},
                            {"file_sent_to_login": {"$exists": False}}
                        ]
                    }
                ]
            }
        
        lead_count = await leads_db.collection.count_documents(lead_filter)
        
        # Count logins (file_sent_to_login = True)
        login_filter = {
            **base_filter,
            "file_sent_to_login": True
        }
        if assignment_filter:
            login_filter = {
                **base_filter,
                "$and": [
                    assignment_filter,
                    {"file_sent_to_login": True}
                ]
            }
        
        login_count = await leads_db.collection.count_documents(login_filter)
        
        # Total count for this loan type
        total_count = lead_count + login_count
        
        loan_type_dict["lead_count"] = lead_count
        loan_type_dict["login_count"] = login_count
        loan_type_dict["total_count"] = total_count
        loan_type_dict["assigned_lead_count"] = total_count  # For backward compatibility
        
        loan_types_with_counts.append(loan_type_dict)
    
    return {"loan_types": loan_types_with_counts}

@router.get("/leads-by-loan-type")
async def get_leads_by_loan_type(
    loan_type: str = Query(..., description="Loan type to filter leads"),
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get leads assigned to user filtered by loan type"""
    # No permission check needed - users can view their assigned leads
    
    # Convert user_id to ObjectId for querying
    user_object_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    
    # Get leads assigned to this user for the specified loan type
    leads_cursor = leads_db.collection.find({
        "$or": [
            {"assigned_to": user_object_id},
            {"assigned_to": {"$in": [user_object_id]}}
        ],
        "loan_type": loan_type
    }).sort("created_at", -1).limit(100)  # Limit to 100 recent leads
    
    formatted_leads = []
    async for lead in leads_cursor:
        lead_dict = convert_object_id(lead)
        formatted_leads.append({
            "id": lead_dict["id"],
            "customer_name": f"{lead_dict.get('first_name', '')} {lead_dict.get('last_name', '')}".strip(),
            "phone": lead_dict.get("phone", ""),
            "email": lead_dict.get("email", ""),
            "status": lead_dict.get("status", ""),
            "created_at": lead_dict.get("created_at")
        })
    
    return {"leads": formatted_leads}

@router.get("/leads-logins-by-type")
async def get_leads_logins_by_type(
    loan_type: str = Query(..., description="Loan type to filter leads/logins"),
    record_type: str = Query(..., description="Record type: 'leads' or 'login'"),
    user_id: str = Query(..., description="ID of the user making the request"),
    search: Optional[str] = Query(None, description="Search term for filtering leads"),
    limit: int = Query(5, description="Maximum number of leads to return (default: 5)"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get leads or logins filtered by loan type and record type in hierarchical format"""
    from app.utils.permissions import check_permission, get_lead_visibility_filter
    
    # Check basic view permission for leads
    await check_permission(user_id, "leads", "show", users_db, roles_db)
    
    # Get hierarchical visibility filter for leads (includes manager's juniors)
    visibility_filter = await get_lead_visibility_filter(user_id, users_db, roles_db)
    
    # Start with visibility filter as base
    base_filter = visibility_filter.copy()
    
    # Add loan type filter
    base_filter["loan_type"] = loan_type
    
    # Add filter based on record type
    if record_type.lower() == "login":
        # Show only records where file_sent_to_login = True
        base_filter["file_sent_to_login"] = True
    elif record_type.lower() == "leads":
        # Show only records where file_sent_to_login != True or field doesn't exist
        base_filter["$or"] = [
            {"file_sent_to_login": {"$ne": True}},
            {"file_sent_to_login": {"$exists": False}}
        ]
    else:
        # Invalid record type
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid record_type. Must be 'leads' or 'login'"
        )
    
    # Add search functionality if search term is provided
    if search:
        search_conditions = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"status": {"$regex": search, "$options": "i"}}
        ]
        
        # Combine search with existing filters
        if "$or" in base_filter:
            # If we already have $or conditions (for record_type), combine them with $and
            base_filter = {
                "$and": [
                    base_filter,
                    {"$or": search_conditions}
                ]
            }
        else:
            # Add search conditions directly
            base_filter["$or"] = search_conditions
    
    # Get filtered leads/logins with limit (default 5, can be increased via search)
    raw_leads_cursor = leads_db.collection.find(base_filter).sort("created_at", -1).limit(limit)
    
    # Group data by status for hierarchical structure
    hierarchy = {}
    total_count = 0
    
    async for lead in raw_leads_cursor:
        lead_dict = convert_object_id(lead)
        
        # Determine the actual type based on file_sent_to_login
        actual_type = "Login" if lead.get("file_sent_to_login", False) else "Lead"
        
        # Get status for grouping (use status or default to "No Status")
        status = lead_dict.get("status", "No Status")
        
        # Initialize status group if not exists
        if status not in hierarchy:
            hierarchy[status] = {
                "status_name": status,
                "leads": [],
                "count": 0
            }
        
        # Format lead data
        formatted_lead = {
            "id": lead_dict["_id"],
            "customer_name": f"{lead_dict.get('first_name', '')} {lead_dict.get('last_name', '')}".strip(),
            "phone": lead_dict.get("phone", ""),
            "email": lead_dict.get("email", ""),
            "status": lead_dict.get("status", ""),
            "loan_type": lead_dict.get("loan_type", ""),
            "lead_login": actual_type,
            "file_sent_to_login": lead.get("file_sent_to_login", False),
            "created_at": lead_dict.get("created_at"),
            "assigned_to": lead_dict.get("assigned_to", ""),
            "department_name": lead_dict.get("department_name", "")
        }
        
        # Add to status group
        hierarchy[status]["leads"].append(formatted_lead)
        hierarchy[status]["count"] += 1
        total_count += 1
    
    # Convert hierarchy dict to list for consistent ordering
    status_groups = []
    for status_name, group_data in hierarchy.items():
        status_groups.append(group_data)
    
    # Sort status groups by count (descending) then by name
    status_groups.sort(key=lambda x: (-x["count"], x["status_name"]))
    
    return {
        "hierarchy": status_groups,
        "record_type": record_type,
        "loan_type": loan_type,
        "total": total_count,
        "status_groups_count": len(status_groups),
        "limit": limit,
        "search": search,
        "has_search": search is not None and search.strip() != "",
        # Also include flat leads array for backward compatibility
        "leads": [lead for group in status_groups for lead in group["leads"]]
    }

@router.get("/all-leads-by-loan-type")
async def get_all_leads_by_loan_type(
    loan_type: str = Query(..., description="Loan type to filter leads"),
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all accessible leads filtered by loan type (not just assigned ones)"""
    from app.utils.permissions import check_permission
    
    # Check basic view permission for leads
    try:
        await check_permission(user_id, "leads", "show", users_db, roles_db)
    except:
        # If no leads permission, fall back to assigned leads only
        return await get_leads_by_loan_type(loan_type, user_id, leads_db, users_db, roles_db)
    
    # Get all leads for the specified loan type that user can access
    leads_cursor = leads_db.collection.find({
        "loan_type": loan_type
    }).sort("created_at", -1).limit(200)  # Increased limit for all leads
    
    formatted_leads = []
    async for lead in leads_cursor:
        lead_dict = convert_object_id(lead)
        
        # Check if lead has login info to distinguish between Lead and Login
        lead_login = "Login" if lead.get("file_sent_to_login", False) else "Lead"
        
        formatted_leads.append({
            "id": lead_dict["_id"],
            "customer_name": f"{lead_dict.get('first_name', '')} {lead_dict.get('last_name', '')}".strip(),
            "phone": lead_dict.get("phone", ""),
            "email": lead_dict.get("email", ""),
            "status": lead_dict.get("status", ""),
            "loan_type": lead_dict.get("loan_type", ""),
            "lead_login": lead_login,
            "created_at": lead_dict.get("created_at")
        })
    
    return {"leads": formatted_leads}

# ========= Filter Options Endpoints =========

@router.get("/filter-options/users", response_model=List[Dict[str, Any]])
async def get_users_for_filter(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get list of users that can be assigned to tasks"""
    try:
        # Get all users for dropdown
        all_users = await users_db.list_users()
        
        user_options = []
        for user in all_users:
            user_dict = convert_object_id(user)
            
            # Get user's role name
            role_name = "No Role"
            if user.get("role_id"):
                role = await roles_db.get_role(user["role_id"])
                if role:
                    role_name = role.get("name", "No Role")
            
            user_options.append({
                "user_id": user_dict.get("id") or str(user_dict.get("_id", "")),
                "id": user_dict.get("id") or str(user_dict.get("_id", "")),
                "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "email": user.get("email", ""),
                "role": role_name,
                "display_name": f"{user.get('first_name', '')} {user.get('last_name', '')} ({role_name})".strip()
            })
        
        # Sort by name
        user_options.sort(key=lambda x: x["name"])
        
        return user_options
        
    except Exception as e:
        print(f"Error getting users for filter: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get users list"
        )

@router.get("/filter-options/loan-types", response_model=List[Dict[str, Any]])
async def get_loan_types_for_filter(
    user_id: str = Query(..., description="ID of the user making the request"),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """Get list of loan types for filtering"""
    try:
        loan_types = await loan_types_db.list_loan_types()
        
        loan_type_options = []
        for loan_type in loan_types:
            loan_type_dict = convert_object_id(loan_type)
            loan_type_options.append({
                "id": loan_type_dict.get("id") or str(loan_type_dict.get("_id", "")),
                "name": loan_type.get("name", ""),
                "description": loan_type.get("description", "")
            })
        
        return loan_type_options
        
    except Exception as e:
        print(f"Error getting loan types for filter: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get loan types list"
        )

# ========= Lead-specific Task Endpoints =========

@router.get("/lead/{lead_id}", response_model=Dict[str, Any])
async def get_tasks_for_lead(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    leads_db: LeadsDB = Depends(get_leads_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """Get all tasks associated with a specific lead"""
    try:
        # Verify lead exists
        lead = await leads_db.get_lead(lead_id)
        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )
        
        print(f"Getting tasks for lead {lead_id}, user {user_id}")
        
        # Get tasks for this lead
        lead_filter = {"lead_id": ObjectId(lead_id)}
        tasks = await tasks_db.list_tasks(filter_dict=lead_filter)
        
        print(f"Found {len(tasks)} tasks for lead {lead_id}")
        
        # Convert to response format
        task_responses = []
        for task in tasks:
            task_dict = await enhance_task_details(task, users_db, leads_db, loan_types_db, user_id)
            task_responses.append(task_dict)
        
        return {
            "tasks": task_responses,
            "total": len(task_responses),
            "lead_id": lead_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting tasks for lead {lead_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get tasks for lead"
        )

@router.post("/lead/{lead_id}/create", response_model=Dict[str, Any])
async def create_task_for_lead(
    lead_id: str,
    task: TaskCreate,
    user_id: str = Query(..., description="ID of the user creating the task"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    leads_db: LeadsDB = Depends(get_leads_db)
):
    """Create a new task for a specific lead"""
    try:
        # Verify lead exists
        lead = await leads_db.get_lead(lead_id)
        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )
        
        # Set the lead_id in the task
        task.lead_id = lead_id
        task.created_by = user_id
        
        # Ensure the creator is in assigned_to list by default
        if user_id not in task.assigned_to:
            task.assigned_to.append(user_id)
        
        # Validate assigned users exist
        for assigned_user_id in task.assigned_to:
            assigned_user = await users_db.get_user(assigned_user_id)
            if not assigned_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Assigned user with ID {assigned_user_id} not found"
                )
        
        # Create task
        task_data = task.dict()
        task_id = await tasks_db.create_task(task_data)
        
        if not task_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create task"
            )
        
        return {"message": "Task created successfully for lead", "task_id": task_id, "lead_id": lead_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating task for lead {lead_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create task for lead"
        )

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    include_attachments: bool = Query(True, description="Whether to include attachments in the response"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    leads_db: LeadsDB = Depends(get_leads_db)
):
    """Get a specific task by ID"""
    try:
        print(f"GET /tasks/{task_id} - Getting task for user {user_id}")
        
        # Validate task_id format
        if not task_id or len(task_id) < 12:
            print(f"Invalid task_id format: {task_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid task ID format: {task_id}"
            )
        
        # Get task
        task = await tasks_db.get_task(task_id)
        if not task:
            print(f"Task {task_id} not found in database")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found with ID: {task_id}"
            )
        
        print(f"Found task {task_id}, checking permissions...")
        
        # Get user for permission check
        user = await users_db.get_user(user_id)
        if not user:
            print(f"User {user_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
            
        user_role = await roles_db.get_role(user.get("role_id")) if user else None
        user_permissions = user_role.get("permissions", []) if user_role else []
    
        # Use visibility filter to check access
        visibility_filter = await tasks_db.get_visible_tasks_filter(
            user_id=user_id,
            user_role=user_role,
            user_permissions=user_permissions,
            roles_db=roles_db
        )
    
        # Check if this specific task matches the visibility filter
        visibility_filter["_id"] = ObjectId(task_id)
        accessible_task = await tasks_db.collection.find_one(visibility_filter)
        
        if not accessible_task:
            print(f"User {user_id} does not have permission to view task {task_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this task"
            )
        
        # Format task with additional info
        task_dict = convert_object_id(task)
        
        # Ensure all required fields have default values for backward compatibility
        if 'is_urgent' not in task_dict:
            task_dict['is_urgent'] = False
        
        # Get creator details
        if task_dict.get("created_by"):
            creator = await users_db.get_user(task_dict["created_by"])
            if creator:
                task_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
        
        # Get assigned users details
        assigned_users = []
        assigned_to = task_dict.get("assigned_to", [])
        if not isinstance(assigned_to, list):
            assigned_to = [assigned_to] if assigned_to else []
        
        for assigned_id in assigned_to:
            user_details = await users_db.get_user(str(assigned_id))
            if user_details:
                assigned_users.append({
                    "user_id": str(assigned_id),
                    "name": f"{user_details.get('first_name', '')} {user_details.get('last_name', '')}".strip(),
                    "email": user_details.get("email", "")
                })
        task_dict["assigned_users"] = assigned_users
        
        # Get lead info if available
        if task_dict.get("lead_id"):
            lead = await leads_db.get_lead(task_dict["lead_id"])
            if lead:
                task_dict["lead_info"] = {
                    "id": str(lead["_id"]),
                    "customer_name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
                    "phone": lead.get("phone", ""),
                    "status": lead.get("status", ""),
                    "loan_type": lead.get("loan_type", "")
                }
        
        # Get attachments (now embedded in the task document) - only if requested
        if include_attachments:
            attachments = task_dict.get("attachments", [])
            # Convert any ObjectIds in attachments for JSON serialization
            for attachment in attachments:
                if "uploaded_by" in attachment and isinstance(attachment["uploaded_by"], ObjectId):
                    attachment["uploaded_by"] = str(attachment["uploaded_by"])
            task_dict["attachments"] = attachments
        else:
            # Remove attachments from response if not requested
            task_dict.pop("attachments", None)
        
        # Convert _id to id for response model compatibility
        if "_id" in task_dict:
            task_dict["id"] = task_dict.pop("_id")
        
        print(f"Successfully retrieved task {task_id}")
        return task_dict
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"Unexpected error in get_task for {task_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error while retrieving task: {str(e)}"
        )

@router.put("/{task_id}")
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    task_history_db: TaskHistoryDB = Depends(get_task_history_db)
):
    """Update a task"""
    try:
        print(f"PUT /tasks/{task_id} - Updating task for user {user_id}")
        print(f"Update data: {task_update.dict(exclude_unset=True)}")
        
        # Validate task_id format
        if not task_id or len(task_id) < 12:
            print(f"Invalid task_id format: {task_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid task ID format: {task_id}"
            )
        
        # Get existing task
        task = await tasks_db.get_task(task_id)
        if not task:
            print(f"Task {task_id} not found for update")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        print(f"Found task {task_id}, checking permissions...")
        
        # Check if user can edit this task (only creator or assigned users can edit)
        user_object_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        assigned_to = task.get("assigned_to", [])
        if not isinstance(assigned_to, list):
            assigned_to = [assigned_to] if assigned_to else []
        
        can_edit = (
            task.get("created_by") == user_object_id or  # Creator
            user_object_id in assigned_to  # Assigned user
        )
        
        if not can_edit:
            print(f"User {user_id} cannot edit task {task_id} - not creator or assignee")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit tasks you created or are assigned to"
            )
        
        # Validate assigned users if provided
        if task_update.assigned_to is not None:
            print(f"Validating assigned_to users: {task_update.assigned_to}")
            for assigned_user_id in task_update.assigned_to:
                print(f"Checking user ID: {assigned_user_id} (type: {type(assigned_user_id)})")
                
                # Skip invalid user IDs (like simple numbers)
                if not assigned_user_id or (isinstance(assigned_user_id, str) and len(assigned_user_id) < 12):
                    print(f"Skipping invalid user ID: {assigned_user_id}")
                    continue
                    
                # Only validate if it's a proper ObjectId format
                if not ObjectId.is_valid(assigned_user_id):
                    print(f"Invalid ObjectId format for user: {assigned_user_id}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid user ID format: {assigned_user_id}"
                    )
                
                assigned_user = await users_db.get_user(assigned_user_id)
                if not assigned_user:
                    print(f"Assigned user {assigned_user_id} not found")
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Assigned user with ID {assigned_user_id} not found"
                    )
            
            # Filter out invalid user IDs before saving
            task_update.assigned_to = [
                uid for uid in task_update.assigned_to 
                if uid and ObjectId.is_valid(uid) and len(str(uid)) >= 12
            ]
            print(f"Filtered assigned_to: {task_update.assigned_to}")
        
        # Handle status change to completed
        update_data = task_update.dict(exclude_unset=True)
        old_status = task.get("status")
        if task_update.status == TaskStatus.COMPLETED and task.get("status") != TaskStatus.COMPLETED:
            update_data["completed_at"] = datetime.now()
            update_data["completed_by"] = user_object_id
        
        print(f"Calling tasks_db.update_task with data: {update_data}")
        
        # Update task
        success = await tasks_db.update_task(task_id, update_data, user_id)
        if not success:
            print(f"Failed to update task {task_id} in database")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update task in database"
            )
        
        # Add task history entries
        try:
            # Get user's name for history
            user = await users_db.get_user(user_id)
            user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else "Unknown User"
            if not user_name:
                user_name = user.get('username', 'Unknown User')
            
            # Track detailed field changes
            changes_made = {}
            detailed_changes = []
            
            # Track status changes
            if task_update.status and task_update.status != old_status:
                changes_made["status"] = {"old": old_status.value if hasattr(old_status, 'value') else str(old_status), 
                                        "new": task_update.status.value if hasattr(task_update.status, 'value') else str(task_update.status)}
                detailed_changes.append(f"Status: {old_status} → {task_update.status}")
                await task_history_db.add_status_changed(task_id, user_id, user_name, 
                                                       old_status.value if hasattr(old_status, 'value') else str(old_status), 
                                                       task_update.status.value if hasattr(task_update.status, 'value') else str(task_update.status))
            
            # Track subject/title changes
            if task_update.subject and task_update.subject != task.get("subject"):
                changes_made["subject"] = {"old": task.get("subject"), "new": task_update.subject}
                detailed_changes.append(f"Title: '{task.get('subject')}' → '{task_update.subject}'")
            
            # Track task details changes
            if task_update.task_details and task_update.task_details != task.get("task_details"):
                old_details = task.get("task_details", "")[:50] + "..." if len(task.get("task_details", "")) > 50 else task.get("task_details", "")
                new_details = task_update.task_details[:50] + "..." if len(task_update.task_details) > 50 else task_update.task_details
                changes_made["task_details"] = {"old": task.get("task_details"), "new": task_update.task_details}
                detailed_changes.append(f"Description updated")
            
            # Track priority changes
            if task_update.priority and task_update.priority != task.get("priority"):
                changes_made["priority"] = {"old": task.get("priority"), "new": str(task_update.priority)}
                detailed_changes.append(f"Priority: {task.get('priority')} → {task_update.priority}")
            
            # Track due date changes
            if task_update.due_date and task_update.due_date != task.get("due_date"):
                changes_made["due_date"] = {"old": str(task.get("due_date")), "new": str(task_update.due_date)}
                detailed_changes.append(f"Due Date: {task.get('due_date')} → {task_update.due_date}")
            
            # Track assignment changes
            if task_update.assigned_to is not None:
                old_assigned = task.get("assigned_to", [])
                new_assigned = task_update.assigned_to
                if set(old_assigned) != set(new_assigned):
                    # Get user names for better display
                    old_names = []
                    new_names = []
                    try:
                        for user_id_item in old_assigned:
                            user_info = await users_db.get_user(str(user_id_item))
                            name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() if user_info else "Unknown"
                            if not name:
                                name = user_info.get('username', 'Unknown') if user_info else "Unknown"
                            old_names.append(name)
                        
                        for user_id_item in new_assigned:
                            user_info = await users_db.get_user(str(user_id_item))
                            name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() if user_info else "Unknown"
                            if not name:
                                name = user_info.get('username', 'Unknown') if user_info else "Unknown"
                            new_names.append(name)
                    except Exception as ne:
                        print(f"Error getting user names for assignment change: {ne}")
                        old_names = [str(uid) for uid in old_assigned]
                        new_names = [str(uid) for uid in new_assigned]
                    
                    changes_made["assigned_to"] = {"old": old_names, "new": new_names}
                    detailed_changes.append(f"Assigned to: {', '.join(old_names) or 'None'} → {', '.join(new_names) or 'None'}")
                    await task_history_db.add_assignment_changed(task_id, user_id, user_name, old_names, new_names)
            
            # Add general update history if there were changes
            if changes_made:
                change_summary = "; ".join(detailed_changes)
                await task_history_db.add_task_updated(task_id, user_id, user_name, changes_made)
                print(f"[DEBUG] Task update history added: {change_summary}")
            else:
                print(f"[DEBUG] No significant changes detected for task {task_id}")
            
        except Exception as e:
            print(f"[ERROR] Failed to add task update history: {e}")
            import traceback
            traceback.print_exc()
            
            # Track assignment changes
            if task_update.assigned_to is not None:
                old_assigned = task.get("assigned_to", [])
                if old_assigned != task_update.assigned_to:
                    task_history_db.add_assignment_changed(task_id, user_id, user_name, old_assigned, task_update.assigned_to)
            
            # Track general updates
            changes = {k: v for k, v in update_data.items() if k not in ['status', 'assigned_to']}
            if changes:
                task_history_db.add_task_updated(task_id, user_id, user_name, changes)
        except Exception as e:
            print(f"Failed to add task update history: {e}")
        
        print(f"Successfully updated task {task_id}")
        return {"message": "Task updated successfully"}
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"Unexpected error in update_task for {task_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error while updating task: {str(e)}"
        )

@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a task (soft delete)"""
    
    print(f"[DELETE TASK] Task ID: {task_id}, User ID: {user_id}")
    
    # Get existing task
    task = await tasks_db.get_task(task_id)
    if not task:
        print(f"[DELETE TASK] Task {task_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    print(f"[DELETE TASK] Task found. Created by: {task.get('created_by')}")
    
    # Get user for permission check
    user = await users_db.get_user(user_id)
    if not user:
        print(f"[DELETE TASK] User {user_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    user_role = await roles_db.get_role(user.get("role_id")) if user else None
    user_permissions = user_role.get("permissions", []) if user_role else []
    
    print(f"[DELETE TASK] User role: {user_role.get('name') if user_role else 'No role'}")
    print(f"[DELETE TASK] User permissions: {user_permissions}")

    # Use visibility filter to check if user can access this task
    visibility_filter = await tasks_db.get_visible_tasks_filter(
        user_id=user_id,
        user_role=user_role,
        user_permissions=user_permissions,
        roles_db=roles_db
    )
    
    print(f"[DELETE TASK] Visibility filter created: {list(visibility_filter.keys())}")

    # Check if this specific task matches the visibility filter
    visibility_filter["_id"] = ObjectId(task_id)
    accessible_task = await tasks_db.collection.find_one(visibility_filter)
    
    print(f"[DELETE TASK] Accessible task check result: {accessible_task is not None}")
    
    if not accessible_task:
        print(f"[DELETE TASK] Permission denied for user {user_id} to delete task {task_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this task"
        )
    
    print(f"[DELETE TASK] Permission granted. Proceeding with deletion.")
    
    # Delete task
    success = await tasks_db.delete_task(task_id, user_id)
    if not success:
        print(f"[DELETE TASK] Failed to delete task {task_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete task"
        )
    
    print(f"[DELETE TASK] Task {task_id} successfully deleted")
    return {"message": "Task deleted successfully"}

@router.post("/{task_id}/attachments")
async def upload_task_attachment(
    task_id: str,
    file: UploadFile = File(...),
    user_id: str = Query(..., description="ID of the user uploading the file"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    task_history_db: TaskHistoryDB = Depends(get_task_history_db)
):
    """Upload an attachment to a task"""
    # No permission check needed - ownership will be verified through task access
    
    # Verify task exists
    task = await tasks_db.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Check file type and size
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, GIF images and PDF files are allowed"
        )
    
    # Check file size (10MB limit)
    max_size = 10 * 1024 * 1024  # 10MB
    if file.size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 10MB limit"
        )
    
    try:
        print(f"[DEBUG] Uploading attachment for task {task_id}, user {user_id}")
        print(f"[DEBUG] File: {file.filename}, size: {file.size}, type: {file.content_type}")
        
        # Create task media directory
        task_media_path = Path(tasks_db.create_task_media_path(task_id))
        print(f"[DEBUG] Task media path: {task_media_path}")
        
        # Save file
        file_metadata = await save_upload_file(file, task_media_path)
        print(f"[DEBUG] File saved, metadata: {file_metadata}")
        
        # Add attachment record
        attachment_data = {
            "task_id": task_id,
            "file_name": file.filename,
            "file_path": str(file_metadata["file_path"]),
            "file_type": get_file_type(file.filename),
            "file_size": file.size,
            "mime_type": file.content_type,
            "uploaded_by": user_id
        }
        
        print(f"[DEBUG] Adding attachment to database: {attachment_data}")
        attachment_id = await tasks_db.add_attachment(attachment_data)
        if not attachment_id:
            print(f"[ERROR] Failed to save attachment to database")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save attachment"
            )
        
        print(f"[DEBUG] Attachment saved successfully with ID: {attachment_id}")
        
        # Add attachment to task history
        try:
            # Get user's name for history
            user = await users_db.get_user(user_id)
            user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else "Unknown User"
            if not user_name:
                user_name = user.get('username', 'Unknown User')
            
            task_history_db.add_attachment_added(task_id, user_id, user_name, file.filename)
        except Exception as e:
            print(f"Failed to add attachment history: {e}")
        
        return {
            "message": "Attachment uploaded successfully",
            "attachment_id": attachment_id,
            "file_name": file.filename
        }
        
    except Exception as e:
        print(f"Error uploading task attachment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload attachment"
        )

@router.get("/{task_id}/attachments")
async def get_task_attachments(
    task_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all attachments for a task"""
    # No permission check needed - visibility will be handled through task access
    
    # Verify task exists and user can view it
    task = await tasks_db.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Get attachments (now embedded in task document)
    attachments = task.get("attachments", [])
    formatted_attachments = []
    
    for attachment in attachments:
        attachment_dict = dict(attachment)  # Create a copy
        
        # Convert ObjectId to string for JSON serialization
        if "_id" in attachment_dict:
            attachment_dict["_id"] = str(attachment_dict["_id"])
        if "uploaded_by" in attachment_dict and isinstance(attachment_dict["uploaded_by"], ObjectId):
            attachment_dict["uploaded_by"] = str(attachment_dict["uploaded_by"])
        
        # Get uploader details
        if attachment_dict.get("uploaded_by"):
            uploader = await users_db.get_user(attachment_dict["uploaded_by"])
            if uploader:
                attachment_dict["uploader_name"] = f"{uploader.get('first_name', '')} {uploader.get('last_name', '')}".strip()
        
        formatted_attachments.append(attachment_dict)
    
    return {"attachments": formatted_attachments}

@router.delete("/attachments/{attachment_id}")
async def delete_task_attachment(
    attachment_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Delete a task attachment"""
    # Get attachment first to verify it exists and get task info
    attachment = await tasks_db.get_attachment(attachment_id)
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Get the task to verify permissions
    task_id = str(attachment.get("task_id"))
    task = await tasks_db.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Check if user has permission to delete attachment (creator or uploader)
    user_object_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    assigned_to = task.get("assigned_to", [])
    if not isinstance(assigned_to, list):
        assigned_to = [assigned_to] if assigned_to else []
    
    can_delete = (
        task.get("created_by") == user_object_id or  # Task creator
        attachment.get("uploaded_by") == user_object_id or  # Attachment uploader
        user_object_id in assigned_to  # Assigned user
    )
    
    if not can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete attachments you uploaded or from tasks you created/are assigned to"
        )
    
    # Delete attachment
    success = await tasks_db.delete_attachment(attachment_id, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete attachment"
        )
    
    return {"message": "Attachment deleted successfully"}

@router.post("/bulk-update")
async def bulk_update_tasks(
    bulk_update: TaskBulkUpdateRequest,
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Bulk update multiple tasks"""
    # No permission check needed - individual task ownership will be verified
    
    user_object_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    updated_tasks = []
    failed_tasks = []
    
    for task_id in bulk_update.task_ids:
        try:
            # Get task
            task = await tasks_db.get_task(task_id)
            if not task:
                failed_tasks.append({"task_id": task_id, "error": "Task not found"})
                continue
            
            # Check if user can edit this task
            assigned_to = task.get("assigned_to", [])
            if not isinstance(assigned_to, list):
                assigned_to = [assigned_to] if assigned_to else []
            
            can_edit = (
                task.get("created_by") == user_object_id or  # Creator
                user_object_id in assigned_to  # Assigned user
            )
            
            if not can_edit:
                failed_tasks.append({"task_id": task_id, "error": "You can only edit tasks you created or are assigned to"})
                continue
            
            # Prepare update data
            update_data = bulk_update.update_data.dict(exclude_unset=True)
            
            # Handle status change to completed
            if bulk_update.update_data.status == TaskStatus.COMPLETED and task.get("status") != TaskStatus.COMPLETED:
                update_data["completed_at"] = datetime.now()
                update_data["completed_by"] = user_object_id
            
            # Update task
            success = await tasks_db.update_task(task_id, update_data, user_id)
            if success:
                updated_tasks.append(task_id)
            else:
                failed_tasks.append({"task_id": task_id, "error": "Failed to update task"})
                
        except Exception as e:
            failed_tasks.append({"task_id": task_id, "error": str(e)})
    
    return {
        "message": f"Bulk update completed. {len(updated_tasks)} tasks updated, {len(failed_tasks)} failed.",
        "updated_tasks": updated_tasks,
        "failed_tasks": failed_tasks
    }

# ========= Lead Integration Endpoints =========

@router.get("/for-lead/{lead_id}", response_model=List[TaskResponse])
async def get_tasks_for_lead(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    leads_db: LeadsDB = Depends(get_leads_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """Get all tasks associated with a specific lead for lead details page"""
    try:
        # Validate lead exists and user can access it
        lead = await leads_db.get_lead(lead_id)
        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )

        # Check if user has permission to view this lead's tasks
        user_permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # Check if user is super admin
        is_super_admin = any(
            (perm.get("page") in ["*", "any"] and perm.get("actions") == "*")
            for perm in user_permissions
        )
        
        # Get tasks for this lead
        task_filter = {"lead_id": ObjectId(lead_id)}
        
        if not is_super_admin:
            # Add user visibility filter
            task_filter["$or"] = [
                {"created_by": ObjectId(user_id)},
                {"assigned_to": ObjectId(user_id)},
                {"assigned_to": {"$in": [ObjectId(user_id)]}}
            ]
        
        tasks = await tasks_db.list_tasks(filter_dict=task_filter, limit=100, sort_by="created_at", sort_order=-1)
        
        # Enhance tasks with user details
        enhanced_tasks = []
        for task in tasks:
            enhanced_task = await enhance_task_with_details(task, users_db, leads_db, loan_types_db, roles_db, user_id)
            enhanced_tasks.append(enhanced_task)
        
        return enhanced_tasks
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving tasks for lead: {str(e)}"
        )

@router.post("/for-lead/{lead_id}", response_model=Dict[str, Any])
async def create_task_for_lead(
    lead_id: str,
    task: TaskCreate,
    user_id: str = Query(..., description="ID of the user creating the task"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    leads_db: LeadsDB = Depends(get_leads_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """Create a new task specifically for a lead (from lead details page)"""
    try:
        # Validate lead exists
        lead = await leads_db.get_lead(lead_id)
        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )
        
        # Auto-populate lead_id and loan_type_id from lead context
        task.lead_id = lead_id
        
        # Try to get loan type from lead
        if lead.get("loan_type_id"):
            task.loan_type_id = str(lead["loan_type_id"])
        elif lead.get("loan_type"):
            # Find loan type by name
            loan_types = await loan_types_db.list_loan_types()
            for lt in loan_types:
                if lt.get("name") == lead["loan_type"]:
                    task.loan_type_id = str(lt["_id"])
                    break
        
        # Use the regular create task function
        return await create_task(task, user_id, tasks_db, users_db, roles_db)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating task for lead: {str(e)}"
        )

# ========= Enhanced Filtering Endpoints =========

@router.get("/filters/options", response_model=Dict[str, Any])
async def get_filter_options(
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    leads_db: LeadsDB = Depends(get_leads_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """Get all available filter options for tasks page"""
    try:
        user_permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # Check if user is super admin
        is_super_admin = any(
            (perm.get("page") in ["*", "any"] and perm.get("actions") == "*")
            for perm in user_permissions
        )
        
        # Check if user has junior permission
        has_view_junior = any(
            (perm.get("page") in ["tasks", "*", "any"] and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "junior" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "junior" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        filter_options = {
            "statuses": [
                {"value": "To-Do", "label": "To-Do"},
                {"value": "Call", "label": "Call"},
                {"value": "Pendency", "label": "Pendency"},
                {"value": "Processing", "label": "Processing"},
                {"value": "Completed", "label": "Completed"}
            ],
            "priorities": [
                {"value": "Low", "label": "Low"},
                {"value": "Medium", "label": "Medium"},
                {"value": "High", "label": "High"},
                {"value": "Urgent", "label": "Urgent"}
            ],
            "task_types": [
                {"value": "General", "label": "General Task"},
                {"value": "Lead-Specific", "label": "Lead-Specific Task"}
            ]
        }
        
        # Get loan types for filtering
        loan_types = await loan_types_db.list_loan_types()
        filter_options["loan_types"] = [
            {"value": str(lt["_id"]), "label": lt.get("name", "Unknown")}
            for lt in loan_types
        ]
        
        # Get users for assignment filtering (based on permissions)
        if is_super_admin or has_view_junior:
            # Super admin and junior users can see all users
            all_users = await users_db.list_users()
            users_list = []
            for user in all_users:
                user_role_name = "Unknown"
                if user.get("role_id"):
                    role = await roles_db.get_role(user["role_id"])
                    if role:
                        user_role_name = role.get("name", "Unknown")
                
                users_list.append({
                    "value": str(user["_id"]),
                    "label": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                    "role": user_role_name,
                    "email": user.get("email", "")
                })
            
            filter_options["users"] = users_list
            filter_options["can_filter_by_users"] = True
        else:
            # Regular users can only see themselves
            current_user = await users_db.get_user(user_id)
            user_role_name = "Unknown"
            if current_user and current_user.get("role_id"):
                role = await roles_db.get_role(current_user["role_id"])
                if role:
                    user_role_name = role.get("name", "Unknown")
            
            filter_options["users"] = [{
                "value": user_id,
                "label": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
                "role": user_role_name,
                "email": current_user.get("email", "")
            }] if current_user else []
            filter_options["can_filter_by_users"] = False
        
        # Add user capabilities
        filter_options["user_capabilities"] = {
            "is_super_admin": is_super_admin,
            "has_view_junior": has_view_junior,
            "can_see_all_tasks": is_super_admin or has_view_junior,
            "can_create_tasks": True,  # Anyone can create tasks
            "can_delete_any_task": True,  # Anyone can delete tasks (as per requirement)
            "can_edit_own_tasks_only": True  # Users can only edit their own tasks
        }
        
        return filter_options
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting filter options: {str(e)}"
        )

@router.post("/filtered", response_model=PaginatedTaskResponse)
async def get_filtered_tasks(
    filter_request: TaskFilterRequest,
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    leads_db: LeadsDB = Depends(get_leads_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """Get tasks with advanced filtering for tasks page"""
    # Check permission to view tasks - explicit check first
    await check_permission(user_id, "tasks", "show", users_db, roles_db)
    
    try:
        user_permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # Check user capabilities
        is_super_admin = any(
            (perm.get("page") in ["*", "any"] and perm.get("actions") == "*")
            for perm in user_permissions
        )
        
        has_view_junior = any(
            (perm.get("page") in ["tasks", "*", "any"] and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "junior" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "junior" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        # Build MongoDB filter
        mongo_filter = {}
        
        # Apply user-specific filters
        if filter_request.status:
            mongo_filter["status"] = filter_request.status
        
        if filter_request.priority:
            mongo_filter["priority"] = filter_request.priority
        
        if filter_request.loan_type_id:
            mongo_filter["loan_type_id"] = ObjectId(filter_request.loan_type_id)
        
        if filter_request.lead_id:
            mongo_filter["lead_id"] = ObjectId(filter_request.lead_id)
        
        # Task type filter
        if filter_request.task_type:
            if filter_request.task_type == "General":
                mongo_filter["lead_id"] = {"$exists": False}
            elif filter_request.task_type == "Lead-Specific":
                mongo_filter["lead_id"] = {"$exists": True}
        
        # Date range filters
        if filter_request.due_date_from or filter_request.due_date_to:
            date_filter = {}
            if filter_request.due_date_from:
                date_filter["$gte"] = filter_request.due_date_from
            if filter_request.due_date_to:
                date_filter["$lte"] = filter_request.due_date_to
            mongo_filter["due_date"] = date_filter
        
        if filter_request.created_date_from or filter_request.created_date_to:
            date_filter = {}
            if filter_request.created_date_from:
                date_filter["$gte"] = datetime.combine(filter_request.created_date_from, datetime.min.time())
            if filter_request.created_date_to:
                date_filter["$lte"] = datetime.combine(filter_request.created_date_to, datetime.max.time())
            mongo_filter["created_at"] = date_filter
        
        # User-based filters (only for admins)
        if filter_request.created_by and (is_super_admin or has_view_junior):
            mongo_filter["created_by"] = ObjectId(filter_request.created_by)
        
        if filter_request.assigned_to and (is_super_admin or has_view_junior):
            mongo_filter["assigned_to"] = ObjectId(filter_request.assigned_to)
        
        # Search filter
        if filter_request.search:
            mongo_filter["$or"] = [
                {"subject": {"$regex": filter_request.search, "$options": "i"}},
                {"task_details": {"$regex": filter_request.search, "$options": "i"}}
            ]
        
        # Overdue filter
        if filter_request.is_overdue:
            today = datetime.now().date()
            mongo_filter["due_date"] = {"$lt": today}
            mongo_filter["status"] = {"$ne": "Completed"}
        
        # Due today filter
        if filter_request.due_today:
            today = datetime.now().date()
            mongo_filter["due_date"] = today
            mongo_filter["status"] = {"$ne": "Completed"}
        
        # Apply visibility filter based on user permissions
        if not is_super_admin:
            # Build user visibility filter
            user_filter = {
                "$or": [
                    {"created_by": ObjectId(user_id)},
                    {"assigned_to": ObjectId(user_id)},
                    {"assigned_to": {"$in": [ObjectId(user_id)]}}
                ]
            }
            
            # Add subordinate visibility for junior users
            if has_view_junior:
                subordinate_ids = await tasks_db._get_all_subordinate_ids(user_id, roles_db, users_db)
                if subordinate_ids:
                    subordinate_oids = [ObjectId(sub_id) for sub_id in subordinate_ids]
                    user_filter["$or"].extend([
                        {"created_by": {"$in": subordinate_oids}},
                        {"assigned_to": {"$in": subordinate_oids}}
                    ])
            
            # Combine with existing filter
            if mongo_filter:
                mongo_filter = {"$and": [mongo_filter, user_filter]}
            else:
                mongo_filter = user_filter
        
        # Calculate pagination
        page = max(1, filter_request.page)
        page_size = min(100, max(1, filter_request.page_size))
        skip = (page - 1) * page_size
        
        # Get tasks with sorting
        sort_field = filter_request.sort_by or "created_at"
        sort_order = filter_request.sort_order or -1
        
        tasks = await tasks_db.list_tasks(
            filter_dict=mongo_filter,
            skip=skip,
            limit=page_size,
            sort_by=sort_field,
            sort_order=sort_order
        )
        
        # Get total count
        total_count = await tasks_db.count_tasks(mongo_filter)
        total_pages = (total_count + page_size - 1) // page_size
        
        # Enhance tasks with details
        enhanced_tasks = []
        for task in tasks:
            enhanced_task = await enhance_task_with_details(task, users_db, leads_db, loan_types_db, roles_db, user_id)
            enhanced_tasks.append(enhanced_task)
        
        return PaginatedTaskResponse(
            tasks=enhanced_tasks,
            total=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error filtering tasks: {str(e)}"
        )

# ========= Helper Functions =========

async def get_user_permissions(user_id: str, users_db: UsersDB, roles_db: RolesDB) -> List[Dict[str, Any]]:
    """Get user permissions for task access control"""
    user = await users_db.get_user(user_id)
    if not user or not user.get("role_id"):
        return []
    
    role = await roles_db.get_role(user["role_id"])
    if not role:
        return []
    
    return role.get("permissions", [])
    """Get user permissions for task access control"""
    user = await users_db.get_user(user_id)
    if not user or not user.get("role_id"):
        return []
    
    role = await roles_db.get_role(user["role_id"])
    if not role:
        return []
    
    return role.get("permissions", [])

async def enhance_task_with_details(
    task: Dict[str, Any], 
    users_db: UsersDB, 
    leads_db: LeadsDB, 
    loan_types_db: LoanTypesDB,
    roles_db: RolesDB,
    current_user_id: str
) -> Dict[str, Any]:
    """Enhance task with additional details for API response"""
    task_dict = convert_object_id(task)
    
    # Ensure all required fields have default values for backward compatibility
    if 'is_urgent' not in task_dict:
        task_dict['is_urgent'] = False
    
    # Get creator details
    if task_dict.get("created_by"):
        creator = await users_db.get_user(task_dict["created_by"])
        if creator:
            task_dict["created_by_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
            if creator.get("role_id"):
                role = await roles_db.get_role(creator["role_id"])
                if role:
                    task_dict["created_by_role"] = role.get("name", "")
    
    # Get assigned users details
    assigned_users = []
    assigned_to = task_dict.get("assigned_to", [])
    if not isinstance(assigned_to, list):
        assigned_to = [assigned_to] if assigned_to else []
    
    for assigned_id in assigned_to:
        if assigned_id:
            user = await users_db.get_user(str(assigned_id))
            if user:
                assigned_users.append({
                    "user_id": str(assigned_id),
                    "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                    "email": user.get("email", "")
                })
    
    task_dict["assigned_users"] = assigned_users
    
    # Get lead details if lead_id exists
    if task_dict.get("lead_id"):
        lead = await leads_db.get_lead(task_dict["lead_id"])
        if lead:
            task_dict["lead_details"] = {
                "id": str(lead["_id"]),
                "name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
                "phone": lead.get("phone", ""),
                "email": lead.get("email", ""),
                "status": lead.get("status", "")
            }
            task_dict["task_type"] = "Lead-Specific"
        else:
            task_dict["task_type"] = "General"
    else:
        task_dict["task_type"] = "General"
    
    # Get loan type details if loan_type_id exists
    if task_dict.get("loan_type_id"):
        loan_type = await loan_types_db.get_loan_type(task_dict["loan_type_id"])
        if loan_type:
            task_dict["loan_type_name"] = loan_type.get("name", "")
    
    # Check if task is overdue
    if task_dict.get("due_date") and task_dict.get("status") != "Completed":
        try:
            due_date = task_dict["due_date"]
            if isinstance(due_date, str):
                due_date = datetime.strptime(due_date, "%Y-%m-%d").date()
            elif isinstance(due_date, datetime):
                due_date = due_date.date()
            
            task_dict["is_overdue"] = due_date < datetime.now().date()
        except:
            task_dict["is_overdue"] = False
    else:
        task_dict["is_overdue"] = False
    
    # Add user permissions for this task
    task_dict["can_edit"] = str(task.get("created_by")) == current_user_id
    task_dict["can_delete"] = True  # Anyone can delete tasks as per requirement
    
    return task_dict

@router.get("/{task_id}/attachments/{attachment_id}/download")
async def download_task_attachment(
    task_id: str,
    attachment_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Download a specific attachment file"""
    # Verify task exists and user can view it
    task = await tasks_db.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Get attachment
    attachment = await tasks_db.get_attachment(attachment_id)
    if not attachment or attachment.get("task_id") != task_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Check if file exists
    file_path = Path(attachment.get("file_path", ""))
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on server"
        )
    
    # Return file response
    return FileResponse(
        path=str(file_path),
        filename=attachment.get("file_name", "attachment"),
        media_type=attachment.get("mime_type", "application/octet-stream")
    )

@router.get("/debug/test-attachments-db")
async def test_attachments_db(
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db)
):
    """Debug endpoint to test attachment database functionality"""
    try:
        # Test database connection
        total_attachments = await tasks_db.attachments_collection.count_documents({})
        total_tasks = await tasks_db.collection.count_documents({})
        
        # Get a sample of attachments
        sample_attachments = []
        async for att in tasks_db.attachments_collection.find({}).limit(5):
            sample_attachments.append(att)
        
        return {
            "message": "Database connectivity test successful",
            "total_tasks": total_tasks,
            "total_attachments": total_attachments,
            "sample_attachments": [
                {
                    "id": str(att.get("_id")),
                    "task_id": str(att.get("task_id")),
                    "file_name": att.get("file_name"),
                    "created_at": att.get("created_at")
                } for att in sample_attachments
            ]
        }
    except Exception as e:
        print(f"[ERROR] Database test failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database test failed: {str(e)}"
        )

# REMOVED: Duplicate static history endpoint - using the real TaskHistoryDB endpoint below
# This was returning hardcoded "Unknown" and "System" names instead of real user names

@router.get("/{task_id}/comments")
async def get_task_comments(
    task_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    comments_db: TaskCommentsDB = Depends(get_task_comments_db)
):
    """Get comments for a specific task"""
    try:
        print(f"GET /tasks/{task_id}/comments - Getting comments for user {user_id}")
        
        # Validate task_id format
        if not task_id or len(task_id) < 12:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid task ID format: {task_id}"
            )
        
        # Get task to verify it exists and user has access
        task = await tasks_db.get_task(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found with ID: {task_id}"
            )
        
        # Get comments from database
        comments = await comments_db.get_comments_by_task(task_id)
        
        # Ensure all datetime objects are properly serialized
        for comment in comments:
            if 'created_at' in comment and comment['created_at']:
                comment['created_at'] = comment['created_at'].isoformat() if hasattr(comment['created_at'], 'isoformat') else str(comment['created_at'])
            if 'updated_at' in comment and comment['updated_at']:
                comment['updated_at'] = comment['updated_at'].isoformat() if hasattr(comment['updated_at'], 'isoformat') else str(comment['updated_at'])
        
        print(f"Found {len(comments)} comments for task {task_id}")
        
        return {
            "comments": comments,
            "count": len(comments),
            "message": f"Successfully retrieved {len(comments)} comments"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting task comments: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving task comments: {str(e)}"
        )

@router.post("/{task_id}/comments")
async def add_task_comment(
    task_id: str,
    content: str = Body(..., embed=True),
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    comments_db: TaskCommentsDB = Depends(get_task_comments_db),
    task_history_db: TaskHistoryDB = Depends(get_task_history_db)
):
    """Add a comment to a specific task"""
    try:
        print(f"POST /tasks/{task_id}/comments - Adding comment for user {user_id}")
        print(f"Comment content: {content}")
        
        # Validate task_id format
        if not task_id or len(task_id) < 12:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid task ID format: {task_id}"
            )
        
        # Validate content
        if not content or not content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment content cannot be empty"
            )
        
        # Get task to verify it exists and user has access
        task = await tasks_db.get_task(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found with ID: {task_id}"
            )
        
        # Get user info for the comment
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get user's display name
        user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        if not user_name:
            user_name = user.get('username', 'Unknown User')
        
        # Store comment in database
        comment_id = await comments_db.add_comment(
            task_id=task_id,
            content=content.strip(),
            created_by=user_id,
            created_by_name=user_name
        )
        
        if not comment_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save comment"
            )
        
        print(f"Comment saved with ID: {comment_id}")
        
        # Add comment to task history
        try:
            await task_history_db.add_comment_added(task_id, user_id, user_name, content.strip())
        except Exception as e:
            print(f"Failed to add comment history: {e}")
        
        return {
            "id": comment_id,
            "content": content.strip(),
            "created_by": user_id,
            "created_by_name": user_name,
            "created_at": datetime.now().isoformat(),
            "message": "Comment added successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding task comment: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding task comment: {str(e)}"
        )

@router.get("/{task_id}/history")
async def get_task_history(
    task_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    task_history_db: TaskHistoryDB = Depends(get_task_history_db)
):
    """Get history for a specific task"""
    try:
        print(f"GET /tasks/{task_id}/history - Getting history for user {user_id}")
        
        # Validate task_id format
        if not task_id or len(task_id) < 12:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid task ID format: {task_id}"
            )
        
        # Verify task exists
        task = await tasks_db.get_task(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found with ID: {task_id}"
            )
        
        # Get task history
        history = await task_history_db.get_task_history(task_id)
        
        print(f"Retrieved {len(history)} history entries for task {task_id}")
        return {
            "success": True,
            "task_id": task_id,
            "history": history
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting task history: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting task history: {str(e)}"
        )

@router.post("/{task_id}/repeat")
async def repeat_task(
    task_id: str,
    user_id: str = Query(..., description="ID of the user repeating the task"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    task_history_db: TaskHistoryDB = Depends(get_task_history_db)
):
    """Create a repeat/copy of an existing task"""
    try:
        print(f"POST /tasks/{task_id}/repeat - Repeating task for user {user_id}")
        
        # Validate task_id format
        if not task_id or len(task_id) < 12:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid task ID format: {task_id}"
            )
        
        # Get the original task to verify it exists and user has access
        original_task = await tasks_db.get_task(task_id)
        if not original_task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found with ID: {task_id}"
            )
        
        # Check if user can repeat this task (must be creator or assigned)
        user_object_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        assigned_to = original_task.get("assigned_to", [])
        if not isinstance(assigned_to, list):
            assigned_to = [assigned_to] if assigned_to else []
        
        can_repeat = (
            original_task.get("created_by") == user_object_id or  # Creator
            user_object_id in assigned_to  # Assigned user
        )
        
        if not can_repeat:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only repeat tasks you created or are assigned to"
            )
        
        # Get user info
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Create the repeated task
        new_task_id = await tasks_db.repeat_task(task_id, user_id, task_history_db)
        
        if not new_task_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to repeat task"
            )
        
        print(f"Successfully repeated task {task_id} as new task {new_task_id}")
        return {
            "message": "Task repeated successfully",
            "original_task_id": task_id,
            "new_task_id": new_task_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error repeating task: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error repeating task: {str(e)}"
        )

# Recurring Task Endpoints

@router.post("/{task_id}/recurring")
async def create_recurring_task(
    task_id: str,
    recurring_config: Dict[str, Any] = Body(...),
    user_id: str = Query(..., description="ID of the user configuring recurring"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    task_history_db: TaskHistoryDB = Depends(get_task_history_db)
):
    """
    Convert a regular task to a recurring task
    
    Body should contain:
    {
        "pattern": "daily|weekly|monthly|yearly",
        "interval": 1,  // every N days/weeks/months
        "start_date": "2024-01-01T00:00:00Z",  // optional
        "end_date": "2024-12-31T23:59:59Z"     // optional
    }
    """
    try:
        # Check permission
        await check_permission(user_id, "tasks", "edit", users_db, roles_db)
        
        # Validate task exists
        task = await tasks_db.get_task_by_id(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        # Validate recurring config
        valid_patterns = ["daily", "weekly", "monthly", "yearly"]
        pattern = recurring_config.get("pattern", "daily")
        interval = recurring_config.get("interval", 1)
        
        if pattern not in valid_patterns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid pattern. Must be one of: {valid_patterns}"
            )
        
        if not isinstance(interval, int) or interval < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Interval must be a positive integer"
            )
        
        # Update task with recurring configuration
        success = await tasks_db.update_recurring_config(task_id, recurring_config, user_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update recurring configuration"
            )
        
        # Log history
        user_info = await users_db.get_user_by_id(user_id)
        user_name = user_info.get("name", "Unknown User") if user_info else "Unknown User"
        
        task_history_db.add_history_entry(
            task_id=task_id,
            action_type="recurring_enabled",
            action_description=f"Task configured as recurring: {pattern} every {interval} interval(s)",
            created_by=user_id,
            created_by_name=user_name,
            details=recurring_config
        )
        
        return {
            "message": "Task configured as recurring successfully",
            "task_id": task_id,
            "recurring_config": recurring_config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating recurring task: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating recurring task: {str(e)}"
        )

@router.put("/{task_id}/recurring")
async def update_recurring_task(
    task_id: str,
    recurring_config: Dict[str, Any] = Body(...),
    user_id: str = Query(..., description="ID of the user updating recurring"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    task_history_db: TaskHistoryDB = Depends(get_task_history_db)
):
    """Update recurring configuration for a task"""
    try:
        # Check permission
        await check_permission(user_id, "tasks", "edit", users_db, roles_db)
        
        # Validate task exists
        task = await tasks_db.get_task_by_id(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        # Validate recurring config
        valid_patterns = ["daily", "weekly", "monthly", "yearly"]
        pattern = recurring_config.get("pattern", "daily")
        interval = recurring_config.get("interval", 1)
        
        if pattern not in valid_patterns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid pattern. Must be one of: {valid_patterns}"
            )
        
        if not isinstance(interval, int) or interval < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Interval must be a positive integer"
            )
        
        # Update recurring configuration
        success = await tasks_db.update_recurring_config(task_id, recurring_config, user_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update recurring configuration"
            )
        
        # Log history
        user_info = await users_db.get_user_by_id(user_id)
        user_name = user_info.get("name", "Unknown User") if user_info else "Unknown User"
        
        task_history_db.add_history_entry(
            task_id=task_id,
            action_type="recurring_updated",
            action_description=f"Recurring configuration updated: {pattern} every {interval} interval(s)",
            created_by=user_id,
            created_by_name=user_name,
            details=recurring_config
        )
        
        return {
            "message": "Recurring configuration updated successfully",
            "task_id": task_id,
            "recurring_config": recurring_config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating recurring task: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating recurring task: {str(e)}"
        )

@router.delete("/{task_id}/recurring")
async def stop_recurring_task(
    task_id: str,
    user_id: str = Query(..., description="ID of the user stopping recurring"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    task_history_db: TaskHistoryDB = Depends(get_task_history_db)
):
    """Stop a recurring task from creating future instances"""
    try:
        # Check permission
        await check_permission(user_id, "tasks", "edit", users_db, roles_db)
        
        # Validate task exists
        task = await tasks_db.get_task_by_id(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        # Stop recurring
        success = await tasks_db.stop_recurring_task(task_id, user_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to stop recurring task"
            )
        
        # Log history
        user_info = await users_db.get_user_by_id(user_id)
        user_name = user_info.get("name", "Unknown User") if user_info else "Unknown User"
        
        task_history_db.add_history_entry(
            task_id=task_id,
            action_type="recurring_stopped",
            action_description="Recurring task stopped - no future instances will be created",
            created_by=user_id,
            created_by_name=user_name
        )
        
        return {
            "message": "Recurring task stopped successfully",
            "task_id": task_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error stopping recurring task: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error stopping recurring task: {str(e)}"
        )

@router.get("/{task_id}/recurring/instances")
async def get_recurring_task_instances(
    task_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    user_id: str = Query(..., description="ID of the user viewing instances"),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all instances created from a recurring task"""
    try:
        # Check permission
        await check_permission(user_id, "tasks", "show", users_db, roles_db)
        
        # Validate task exists
        task = await tasks_db.get_task_by_id(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        # Get all instances created from this recurring task
        instances = await tasks_db.get_tasks_by_filters({
            "parent_recurring_task_id": ObjectId(task_id),
            "is_deleted": {"$ne": True}
        }, skip=skip, limit=limit)
        
        # Convert ObjectIds to strings
        for instance in instances["tasks"]:
            instance["_id"] = str(instance["_id"])
            if instance.get("parent_recurring_task_id"):
                instance["parent_recurring_task_id"] = str(instance["parent_recurring_task_id"])
        
        return {
            "task_id": task_id,
            "instances": instances["tasks"],
            "total": instances["total"],
            "skip": skip,
            "limit": limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting recurring task instances: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting recurring task instances: {str(e)}"
        )

@router.get("/recurring/scheduler/status")
async def get_scheduler_status(
    user_id: str = Query(..., description="ID of the user checking scheduler status"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    tasks_db: TasksDB = Depends(get_tasks_db)
):
    """Get the status of the recurring task scheduler"""
    try:
        # Check permission
        await check_permission(user_id, "tasks", "show", users_db, roles_db)
        # Check permission
        await check_permission(user_id, "tasks", "show", users_db, roles_db)
        
        from app.utils.recurring_task_scheduler import get_scheduler
        
        scheduler = get_scheduler()
        status_info = scheduler.get_scheduler_status()
        
        # Get count of pending recurring tasks
        pending_tasks = await tasks_db.get_pending_recurring_tasks()
        
        return {
            "scheduler_status": status_info,
            "pending_tasks_count": len(pending_tasks),
            "last_checked": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Error getting scheduler status: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting scheduler status: {str(e)}"
        )

@router.post("/{task_id}/close")
async def close_task(
    task_id: str,
    user_id: str = Query(..., description="ID of the user closing the task"),
    reason: Optional[str] = Body(None, embed=True),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    task_history_db: TaskHistoryDB = Depends(get_task_history_db)
):
    """Close a task with optional reason"""
    try:
        print(f"POST /tasks/{task_id}/close - Closing task for user {user_id}")
        
        # Get existing task
        task = await tasks_db.get_task(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        # Check if task is already closed
        if task.get("status") == TaskStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task is already closed"
            )
        
        # Get user's name for history
        user = await users_db.get_user(user_id)
        user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else "Unknown User"
        if not user_name:
            user_name = user.get('username', 'Unknown User')
        
        # Update task status
        update_data = {
            "status": TaskStatus.COMPLETED,
            "completed_at": datetime.now(),
            "completed_by": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        }
        
        if reason:
            update_data["close_reason"] = reason.strip()
        
        success = await tasks_db.update_task(task_id, update_data, user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to close task"
            )
        
        # Add detailed history entry
        try:
            old_status = task.get("status", "Unknown")
            details_text = f"Task closed by {user_name}"
            if reason:
                details_text += f" - Reason: {reason.strip()}"
            
            await task_history_db.add_history_entry(
                task_id=task_id,
                action_type="task_closed",
                action_description=f"TASK CLOSED - {details_text}",
                created_by=user_id,
                created_by_name=user_name,
                details={
                    "old_status": str(old_status),
                    "new_status": "Completed",
                    "close_reason": reason.strip() if reason else None,
                    "closed_by": user_name
                }
            )
        except Exception as e:
            print(f"Failed to add task close history: {e}")
        
        return {
            "message": "Task closed successfully",
            "task_id": task_id,
            "closed_by": user_name,
            "closed_at": datetime.now().isoformat(),
            "reason": reason.strip() if reason else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error closing task {task_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to close task: {str(e)}"
        )

@router.post("/{task_id}/reopen")
async def reopen_task(
    task_id: str,
    user_id: str = Query(..., description="ID of the user reopening the task"),
    reason: Optional[str] = Body(None, embed=True),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    task_history_db: TaskHistoryDB = Depends(get_task_history_db)
):
    """Reopen a closed task with optional reason"""
    try:
        print(f"POST /tasks/{task_id}/reopen - Reopening task for user {user_id}")
        
        # Get existing task
        task = await tasks_db.get_task(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        # Check if task is already open
        if task.get("status") != TaskStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task is not closed"
            )
        
        # Get user's name for history
        user = await users_db.get_user(user_id)
        user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else "Unknown User"
        if not user_name:
            user_name = user.get('username', 'Unknown User')
        
        # Update task status
        update_data = {
            "status": TaskStatus.PENDING,
            "reopened_at": datetime.now(),
            "reopened_by": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        }
        
        if reason:
            update_data["reopen_reason"] = reason.strip()
        
        # Clear completion fields
        update_data["completed_at"] = None
        update_data["completed_by"] = None
        update_data["close_reason"] = None
        
        success = await tasks_db.update_task(task_id, update_data, user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reopen task"
            )
        
        # Add detailed history entry
        try:
            details_text = f"Task reopened by {user_name}"
            if reason:
                details_text += f" - Reason: {reason.strip()}"
            
            await task_history_db.add_history_entry(
                task_id=task_id,
                action_type="task_reopened",
                action_description=f"TASK REOPENED - {details_text}",
                created_by=user_id,
                created_by_name=user_name,
                details={
                    "old_status": "Completed",
                    "new_status": str(TaskStatus.PENDING),
                    "reopen_reason": reason.strip() if reason else None,
                    "reopened_by": user_name
                }
            )
        except Exception as e:
            print(f"Failed to add task reopen history: {e}")
        
        return {
            "message": "Task reopened successfully",
            "task_id": task_id,
            "reopened_by": user_name,
            "reopened_at": datetime.now().isoformat(),
            "reason": reason.strip() if reason else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error reopening task {task_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reopen task: {str(e)}"
        )