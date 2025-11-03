from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime
from app.utils.timezone import get_ist_now
import time
import asyncio
from app.database import get_database_instances
from app.database.Leads import LeadsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.schemas.lead_schemas import LeadBase, LeadCreate, LeadUpdate, LeadInDB
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission, get_user_capabilities, get_user_permissions, get_user_role
from app.utils.permission_helpers import is_super_admin_permission
from app.utils.performance_cache import (
    cached_response, cache_user_permissions, get_cached_user_permissions,
    performance_monitor, invalidate_cache_pattern, cache_response, get_cached_response
)

router = APIRouter(
    prefix="/lead-login",
    tags=["Lead Login Operations"]
)

# ⚡ OPTIMIZED: Cache subordinates lookup for better performance
_subordinates_cache = {}
_cache_timestamps = {}
CACHE_TTL = 300  # 5 minutes

async def get_all_subordinates_cached(user_id: str, all_users: List[Dict]) -> List[str]:
    """Get all subordinate user IDs with caching for performance"""
    current_time = time.time()
    
    # Check cache first
    if (user_id in _subordinates_cache and 
        user_id in _cache_timestamps and 
        current_time - _cache_timestamps[user_id] < CACHE_TTL):
        return _subordinates_cache[user_id]
    
    # Calculate subordinates
    subordinates = get_all_subordinates(user_id, all_users)
    
    # Cache the result
    _subordinates_cache[user_id] = subordinates
    _cache_timestamps[user_id] = current_time
    
    return subordinates

def get_all_subordinates(user_id: str, all_users: List[Dict]) -> List[str]:
    """⚡ OPTIMIZED: Get all subordinate user IDs for a given user (recursive)"""
    subordinates = set()  # Use set for O(1) lookups and automatic deduplication
    
    # Create a mapping for faster lookups
    user_reporting_map = {
        user.get("_id"): user.get("reporting_id") 
        for user in all_users 
        if user.get("_id")
    }
    
    # Find direct subordinates (users who report to this user)
    direct_subordinates = [
        uid for uid, reporting_id in user_reporting_map.items() 
        if reporting_id == user_id
    ]
    
    subordinates.update(direct_subordinates)
    
    # Recursively find subordinates of subordinates (optimized with queue)
    queue = direct_subordinates.copy()
    processed = set()
    
    while queue:
        current_user = queue.pop(0)
        if current_user in processed:
            continue
        processed.add(current_user)
        
        # Find subordinates of current user
        current_subordinates = [
            uid for uid, reporting_id in user_reporting_map.items() 
            if reporting_id == current_user and uid not in processed
        ]
        
        subordinates.update(current_subordinates)
        queue.extend(current_subordinates)
    
    return list(filter(None, subordinates))  # Remove None values

# ⚡ OPTIMIZED: Fast dependency injection with caching
async def get_leads_db():
    db_instances = get_database_instances()
    return db_instances["leads"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]
    
async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

@router.post("/send-to-login-department/{lead_id}")
@router.post("/{lead_id}/send-to-login")  # Add alias route for frontend compatibility
async def send_lead_to_login_department(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Send a lead to login department for processing"""
    # Check permission - user should be able to edit leads (check both leads and login permissions)
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Verify lead exists and has FILE COMPLETED sub-status
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Removed strict FILE COMPLETED sub-status requirement to allow any lead to be sent to login
    # Also removed important_questions_validated check to simplify the flow
    
    # Save current assigned users to history before resetting
    current_assigned_to = lead.get("assigned_to", [])
    if isinstance(current_assigned_to, str):
        current_assigned_to = [current_assigned_to]
    
    # Get or create assignment history array
    assignment_history = lead.get("assignment_history", [])
    
    # Add current assignment to history with timestamp
    if current_assigned_to:
        history_entry = {
            "users": current_assigned_to,
            "department_id": lead.get("department_id"),
            "assigned_date": lead.get("last_assigned_date"),
            "transferred_date": get_ist_now().isoformat(),
            "transferred_by": user_id,
            "transferred_to": "Login Department"
        }
        assignment_history.append(history_entry)
    
    # Update lead with login department data
    update_data = {
        "file_sent_to_login": True,
        "login_department_sent_date": get_ist_now().isoformat(),
        "login_department_sent_by": user_id,
        "status": "Active Login",  # Default status for login department
        "sub_status": "Pending Assignment",
        "previous_assigned_to": current_assigned_to,  # Store previous assignment
        "assigned_to": [],  # Reset assignments for login department
        "assignment_history": assignment_history,  # Update assignment history
        "updated_at": get_ist_now().isoformat()
    }
    
    # Update the lead using correct method signature
    success = await leads_db.update_lead(lead_id, update_data, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update lead"
        )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after sending lead to login department
    try:
        await invalidate_cache_pattern("login-department-leads*")
        print(f"🔄 Cache invalidated for login leads after sending lead {lead_id} to login department")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after sending to login: {cache_error}")
    
    return {"message": "Lead successfully sent to login department", "lead_id": lead_id}
@router.patch("/assign-multiple-users/{lead_id}")
async def assign_lead_to_multiple_users(
    lead_id: str,
    request_data: Dict[str, Any],  # Accept a dictionary with assigned_user_ids and activity data
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Assign a lead to multiple users"""
    # Check permission - check both leads and login permissions
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Extract the assigned_user_ids from the request_data
    # Support both formats - array directly or inside assigned_user_ids field
    if isinstance(request_data, list):
        assigned_user_ids = request_data
    else:
        assigned_user_ids = request_data.get("assigned_user_ids", [])
        
    # Extract activity data if provided
    activity_data = request_data.get("activity")
    
    # Verify lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Verify all assigned users exist
    for assigned_id in assigned_user_ids:
        user = await users_db.get_user(assigned_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {assigned_id} not found"
            )
    
    # Update lead assignments
    current_assigned = lead.get("assigned_to", [])
    if isinstance(current_assigned, str):
        current_assigned = [current_assigned]
    
    # Check if we have new users that weren't previously assigned
    new_users = [user_id for user_id in assigned_user_ids if user_id not in current_assigned]
    
    # Add new assignments without duplicates
    updated_assigned = list(set(current_assigned + assigned_user_ids))
    
    # Get or create assignment history array
    assignment_history = lead.get("assignment_history", [])
    
    # Add assignment history entry if there are new users
    if new_users:
        history_entry = {
            "users": new_users,
            "department_id": lead.get("department_id"),
            "assigned_date": get_ist_now().isoformat(),
            "assigned_by": user_id,
            "assignment_type": "login_department"
        }
        assignment_history.append(history_entry)
    
    update_data = {
        "assigned_to": updated_assigned,
        "last_assigned_by": user_id,
        "last_assigned_date": get_ist_now().isoformat(),
        "assignment_history": assignment_history,
        "updated_at": get_ist_now().isoformat()
    }
    
    # If activity data was provided, include it in the update
    if activity_data:
        update_data["activity"] = activity_data
    
    # Update the lead using correct method signature
    success = await leads_db.update_lead(lead_id, update_data, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update lead assignments"
        )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after assignment update
    try:
        await invalidate_cache_pattern("login-department-leads*")
        print(f"🔄 Cache invalidated for login leads after assignment update for lead {lead_id}")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after assignment: {cache_error}")
    
    return {"message": "Lead assigned to multiple users successfully", "assigned_to": updated_assigned}

@router.patch("/update-operations/{lead_id}")
async def update_lead_operations(
    lead_id: str,
    request_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update operations section data for a lead"""
    # Check permission - check both leads and login permissions
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Verify lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Extract activity data if provided
    activity_data = None
    operations_data = request_data
    
    if "activity" in request_data:
        activity_data = request_data.pop("activity")
        operations_data = request_data
        
    # Prepare operations update data - Updated field names
    allowed_operations_fields = [
        "login_sent_date", "login_person", "channel_name", "los_number",
        "amount_approved", "amount_disbursed", "internal_top", 
        "cashback_to_customer", "net_disbursement_amount", "rate_percentage",
        "tenure_given", "pf_and_insurance", "disbursement_date"
    ]
    
    operations_update = {}
    for field in allowed_operations_fields:
        if field in operations_data:
            # Store with new field names (no operations_ prefix)
            operations_update[field] = operations_data[field]
    
    if operations_update:
        operations_update["updated_at"] = get_ist_now().isoformat()
        operations_update["operations_updated_by"] = user_id
        
        # Include activity data if provided
        if activity_data:
            operations_update["activity"] = activity_data
        
        # Update the lead using correct method signature
        success = await leads_db.update_lead(lead_id, operations_update, user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update operations data"
            )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after operations update
    try:
        await invalidate_cache_pattern("login-department-leads*")
        print(f"🔄 Cache invalidated for login leads after operations update for lead {lead_id}")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after operations update: {cache_error}")
    
    return {"message": "Operations data updated successfully", "updated_fields": list(operations_update.keys())}

async def get_hierarchical_permissions(user_id: str, module: str = "login") -> Dict[str, Any]:
    """Get simplified hierarchical permissions for login module"""
    try:
        from app.database.Users import UsersDB
        from app.database.Roles import RolesDB
        
        users_db = UsersDB()
        roles_db = RolesDB()
        
        # Get user data
        user = await users_db.get_user(user_id)
        if not user:
            return {"permission_level": "own", "is_super_admin": False}
        
        # Check if user is super admin
        is_super_admin = user.get("is_super_admin", False)
        if is_super_admin:
            return {"permission_level": "all", "is_super_admin": True}
        
        # Get user's role permissions
        role_id = user.get("role_id")
        if not role_id:
            return {"permission_level": "own", "is_super_admin": False}
        
        role = await roles_db.get_role(role_id)
        if not role:
            return {"permission_level": "own", "is_super_admin": False}
        
        permissions = role.get("permissions", [])
        
        # Check for super admin permission in role
        for perm in permissions:
            if is_super_admin_permission(perm):
                return {"permission_level": "all", "is_super_admin": True}
        
        # Check for module-specific permissions (login) and fallback to leads
        has_all = False
        has_junior = False
        
        for perm in permissions:
            # Check both login and leads modules
            if perm.get("page") in [module, "leads"]:
                actions = perm.get("actions", [])
                if isinstance(actions, str):
                    actions = [actions]
                
                if "all" in actions or "*" in actions:
                    has_all = True
                elif "junior" in actions:
                    has_junior = True
        
        # Determine permission level
        if has_all:
            return {"permission_level": "all", "is_super_admin": False}
        elif has_junior:
            return {"permission_level": "junior", "is_super_admin": False}
        else:
            return {"permission_level": "own", "is_super_admin": False}
            
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting hierarchical permissions for {user_id}: {e}")
        return {"permission_level": "own", "is_super_admin": False}

@router.get("/login-department-leads")
@cached_response(ttl=5)  # ⚡ Reduced cache to 5 seconds for real-time updates
async def get_login_department_leads(
    user_id: str = Query(..., description="ID of the user making the request"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    loan_type: Optional[str] = Query(None, description="Filter by loan type"),
    no_activity_date: Optional[str] = Query(None, description="Filter leads with no activity since this date"),
    _cache_bust: Optional[str] = Query(None, description="Cache busting parameter"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """⚡ OPTIMIZED: Get leads for login department view with caching and fast permissions"""
    start_time = time.time()
    
    print(f"🚀 Login department leads called with no_activity_date: {no_activity_date}")
    
    try:
        # ⚡ STEP 1: Fast permission check with caching
        cached_permissions = await get_cached_user_permissions(user_id)
        if not cached_permissions:
            await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
            # Cache permissions for future requests
            user_permissions = await get_user_permissions(user_id, users_db, roles_db)
            await cache_user_permissions(user_id, user_permissions)
        
        # ⚡ STEP 2: Fast hierarchical permissions lookup
        permission_data = await get_hierarchical_permissions(user_id, "login")
        permission_level = permission_data["permission_level"]
        is_super_admin = permission_data["is_super_admin"]
        
        # ⚡ STEP 3: Build optimized filters with PROPER permission-based visibility
        # 🔒 SECURITY FIX: Use LOGIN-specific visibility filter (not leads filter)
        # This ensures LOGIN section permissions are separate from LEADS section permissions
        from app.utils.permissions import PermissionManager
        
        # Get the proper LOGIN visibility filter based on user's LOGIN permissions
        visibility_filter = await PermissionManager.get_login_visibility_filter(user_id, users_db, roles_db)
        
        print(f"🔒 SECURITY: Applying LOGIN-specific lead visibility filter for user {user_id}")
        print(f"📊 LOGIN Visibility filter: {visibility_filter}")
        print(f"🔍 Permission level from hierarchical check: {permission_level}")
        print(f"✅ FIXED: Now using LOGIN permissions instead of LEADS permissions")
        
        # Combine visibility filter with login department filter
        extra_filters = {"file_sent_to_login": True}
        
        # Add status filter if provided
        if status_filter:
            extra_filters["status"] = status_filter
        
        # ⚡ STEP 4: Combine visibility filter with login department filters
        # CRITICAL: visibility_filter should NEVER be empty for Team Leaders!
        # Only Super Admins with page: "*", actions: "*" should have empty filter
        if not visibility_filter or visibility_filter == {}:
            print(f"⚠️ CRITICAL: Empty visibility filter for user {user_id} - treating as Super Admin")
            print(f"⚠️ If this is a Team Leader, there's a BUG in get_lead_visibility_filter!")
            filters = extra_filters
        else:
            print(f"✅ Applying strict visibility filter for user {user_id}")
            # Combine both filters - user must match visibility AND be in login department
            filters = {
                "$and": [
                    visibility_filter,
                    extra_filters
                ]
            }
        
        print(f"📊 Final combined filter: {filters}")
        
        # ⚡ STEP 5: Optimized database query with caching
        # Disable cache when no_activity_date filter is active to ensure real-time filtering
        cache_key = f"login_department_leads:{user_id}:{permission_level}:{status_filter or 'all'}:{no_activity_date or 'none'}"
        cached_result = None
        if not no_activity_date:
            cached_result = await get_cached_response(cache_key)
        
        if cached_result:
            print(f"⚡ Cache HIT for login department leads: {time.time() - start_time:.3f}s")
            return cached_result
        
        # ⚡ STEP 6: Database query with performance optimization
        leads = await leads_db.list_leads(filter_dict=filters, limit=1000)
        
        # Import DepartmentsDB for department name lookup
        from app.database.Departments import DepartmentsDB
        departments_db = DepartmentsDB()
        
        # ⚡ STEP 7: Fast result processing with minimal data transformation
        formatted_leads = []
        for lead in leads:
            lead_dict = convert_object_id(lead)
            
            # Get creator details efficiently
            if lead_dict.get("created_by"):
                creator = await users_db.get_user(lead_dict["created_by"])
                if creator:
                    lead_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
            
            # Add essential login department fields
            lead_dict["login_date"] = lead_dict.get("login_department_sent_date", "")
            
            # Add team/department name efficiently
            department_id = lead_dict.get("department_id")
            if department_id:
                department = await departments_db.get_department(department_id)
                lead_dict["team_name"] = department.get("name", "") if department else "Unknown"
            else:
                lead_dict["team_name"] = "Not Assigned"
            
            # Customer name from lead details
            customer_name = f"{lead_dict.get('first_name', '')} {lead_dict.get('last_name', '')}".strip()
            lead_dict["customer_name"] = customer_name
            
            # Process dynamic fields efficiently
            if lead_dict.get("dynamic_fields"):
                dynamic_fields = lead_dict["dynamic_fields"]
                financial_details = dynamic_fields.get("financial_details", {}) or {}
                address = dynamic_fields.get("address", {}) or {}
                eligibility_details = dynamic_fields.get("eligibility_details", {}) or {}
                personal_details = dynamic_fields.get("personal_details", {}) or {}
                
                lead_dict["salary"] = financial_details.get('monthly_income', "")
                lead_dict["pincode"] = address.get("pincode", "")
                lead_dict["city"] = address.get("city", "")
                lead_dict["loan_eligibility"] = eligibility_details.get("finalEligibility", "")
                lead_dict["cibil_score"] = financial_details.get("cibil_score", "")
                
                # Extract company details efficiently
                company_name_value = personal_details.get("company_name")
                company_category_value = personal_details.get("company_category")
                
                lead_dict["company_name"] = (company_name_value[0] if isinstance(company_name_value, list) and company_name_value 
                                           else company_name_value if isinstance(company_name_value, str) else 'NONE')
                lead_dict["company_category"] = (company_category_value[0] if isinstance(company_category_value, list) and company_category_value 
                                               else company_category_value if isinstance(company_category_value, str) else 'NONE')
                
                # Include question responses
                lead_dict["question_responses"] = lead_dict.get("question_responses", {})
                lead_dict["important_questions_validated"] = lead_dict.get("important_questions_validated", False)
            
            # Add operations info
            lead_dict["amount_approved"] = lead_dict.get("operations_amount_approved", "")
            
            # Get assigned users details efficiently
            assigned_users = []
            assigned_to = lead_dict.get("assigned_to", [])
            if isinstance(assigned_to, str):
                assigned_to = [assigned_to]
            
            for assigned_id in assigned_to:
                user = await users_db.get_user(assigned_id)
                if user:
                    assigned_users.append({
                        "user_id": assigned_id,
                        "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                        "email": user.get("email", "")
                    })
            
            lead_dict["assigned_users"] = assigned_users
            formatted_leads.append(lead_dict)
        
        # ⚡ STEP 7.5: Apply no activity date filtering if specified
        if no_activity_date:
            print(f"🔍 Applying no activity filter for date: {no_activity_date}")
            print(f"📊 Total leads before filtering: {len(formatted_leads)}")
            try:
                # Parse the no activity date
                from datetime import datetime
                cutoff_date = datetime.fromisoformat(no_activity_date.replace('Z', '+00:00'))
                print(f"📅 Parsed cutoff date: {cutoff_date}")
                
                # Filter leads that have no activity since the cutoff date
                filtered_leads = []
                for lead in formatted_leads:
                    lead_id = str(lead["_id"])
                    
                    # Check if lead has any activity since the cutoff date
                    try:
                        # Use the existing get_lead_activities method from LeadsDB
                        activities = await leads_db.get_lead_activities(lead_id)
                        
                        # Check if any activity exists after the cutoff date
                        has_recent_activity = False
                        if activities:
                            for activity in activities:
                                activity_date = activity.get("created_at")
                                if activity_date:
                                    # Handle different date formats
                                    if isinstance(activity_date, str):
                                        try:
                                            activity_datetime = datetime.fromisoformat(activity_date.replace('Z', '+00:00'))
                                        except:
                                            # Try parsing as timestamp
                                            activity_datetime = datetime.fromtimestamp(float(activity_date))
                                    elif isinstance(activity_date, datetime):
                                        activity_datetime = activity_date
                                    else:
                                        continue
                                    
                                    if activity_datetime > cutoff_date:
                                        has_recent_activity = True
                                        break
                        
                        # Only include leads with no recent activity
                        if not has_recent_activity:
                            filtered_leads.append(lead)
                            
                    except Exception as activity_error:
                        # If error checking activities, include the lead (fail-safe)
                        print(f"⚠️ Error checking activities for lead {lead_id}: {activity_error}")
                        filtered_leads.append(lead)
                
                original_count = len(formatted_leads)
                formatted_leads = filtered_leads
                print(f"🔍 No activity filter applied: {len(formatted_leads)} leads without activity since {no_activity_date}")
                print(f"📊 Filtered out {original_count - len(filtered_leads)} leads with recent activity")
                
            except Exception as date_error:
                print(f"⚠️ Error parsing no_activity_date '{no_activity_date}': {date_error}")
                # Continue with unfiltered results if date parsing fails
        
        # ⚡ STEP 8: Prepare optimized response
        result = {
            "leads": formatted_leads, 
            "total": len(formatted_leads),
            "metadata": {
                "permission_level": permission_level,
                "user_id": user_id,
                "response_time": f"{time.time() - start_time:.3f}s"
            }
        }
        
        # ⚡ STEP 9: Cache the result for future requests
        await cache_response(cache_key, result, ttl=30)
        
        print(f"⚡ Login department leads processed in {time.time() - start_time:.3f}s")
        return result
        
    except Exception as e:
        print(f"❌ Login department leads error: {e} - Time: {time.time() - start_time:.3f}s")
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads: {e}")

@router.get("/important-questions")
@cached_response(ttl=300)  # ⚡ Cache for 5 minutes - questions rarely change
async def get_important_questions(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """⚡ OPTIMIZED: Get dynamic important questions with caching"""
    start_time = time.time()
    
    try:
        # ⚡ STEP 1: Fast permission check with caching
        cached_permissions = await get_cached_user_permissions(user_id)
        if not cached_permissions:
            await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
            # Cache permissions for future requests
            user_permissions = await get_user_permissions(user_id, users_db, roles_db)
            await cache_user_permissions(user_id, user_permissions)
        
        # ⚡ STEP 2: Check cache first
        cache_key = "important_questions:active"
        cached_result = await get_cached_response(cache_key)
        if cached_result:
            print(f"⚡ Cache HIT for important questions: {time.time() - start_time:.3f}s")
            return cached_result
        
        # ⚡ STEP 3: Database query with fallback
        from app.database.ImportantQuestions import ImportantQuestionsDB
        questions_db = ImportantQuestionsDB()
        
        # Get active questions efficiently
        questions = await questions_db.get_questions(is_active=True)
        
        # ⚡ STEP 4: Use default questions if none configured
        if not questions:
            questions = [
                {"id": "default_1", "question": "Has customer provided all required documents?", "mandatory": True, "type": "checkbox", "is_active": True, "display_order": 1},
                {"id": "default_2", "question": "Is customer's CIBIL score verified?", "mandatory": True, "type": "checkbox", "is_active": True, "display_order": 2},
                {"id": "default_3", "question": "Has income verification been completed?", "mandatory": True, "type": "checkbox", "is_active": True, "display_order": 3},
                {"id": "default_4", "question": "Are bank statements validated?", "mandatory": True, "type": "checkbox", "is_active": True, "display_order": 4},
                {"id": "default_5", "question": "Has reference verification been done?", "mandatory": True, "type": "checkbox", "is_active": True, "display_order": 5}
            ]
        
        # ⚡ STEP 5: Fast result formatting
        formatted_questions = [
            {
                "id": str(question.get("_id", question.get("id"))),
                "question": question["question"],
                "mandatory": question.get("mandatory", True),
                "type": question.get("type", "checkbox")
            }
            for question in questions
        ]
        
        # ⚡ STEP 6: Prepare response
        result = {
            "questions": formatted_questions,
            "metadata": {
                "response_time": f"{time.time() - start_time:.3f}s",
                "count": len(formatted_questions)
            }
        }
        
        # ⚡ STEP 7: Cache for future requests
        await cache_response(cache_key, result, ttl=300)
        
        print(f"⚡ Important questions fetched in {time.time() - start_time:.3f}s")
        return result
        
    except Exception as e:
        print(f"❌ Important questions error: {e} - Time: {time.time() - start_time:.3f}s")
        
        # ⚡ Fast fallback without database
        fallback_questions = [
            {"id": "fallback_1", "question": "Has customer provided all required documents?", "mandatory": True, "type": "checkbox"},
            {"id": "fallback_2", "question": "Is customer's CIBIL score verified?", "mandatory": True, "type": "checkbox"},
            {"id": "fallback_3", "question": "Has income verification been completed?", "mandatory": True, "type": "checkbox"},
            {"id": "fallback_4", "question": "Are bank statements validated?", "mandatory": True, "type": "checkbox"},
            {"id": "fallback_5", "question": "Has reference verification been done?", "mandatory": True, "type": "checkbox"}
        ]
        return {"questions": fallback_questions}

@router.patch("/validate-questions/{lead_id}")
async def validate_important_questions(
    lead_id: str,
    request_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Validate that all mandatory questions are answered"""
    # Check permission - check both leads and login permissions
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Extract responses from request data
    if "responses" in request_data:
        # New format with activity
        question_responses = request_data["responses"]
        # Extract activity if present
        activity_data = request_data.get("activity")
    else:
        # Old format - direct responses object
        question_responses = request_data
        activity_data = None
    
    # Get all questions to check mandatory ones
    questions_response = await get_important_questions(user_id, users_db, roles_db)
    questions = questions_response["questions"]
    
    # Check all mandatory questions are answered positively
    missing_questions = []
    for question in questions:
        if question["mandatory"]:
            question_id = question["id"]
            if question_id not in question_responses or not question_responses[question_id]:
                missing_questions.append(question["question"])
    
    if missing_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Please complete all mandatory questions: {', '.join(missing_questions)}"
        )
    
    # Update lead with question responses
    update_data = {
        "important_questions_validated": True,
        "question_responses": question_responses,
        "questions_validated_by": user_id,
        "questions_validated_date": get_ist_now().isoformat(),
        "updated_at": get_ist_now().isoformat()
    }
    
    # Include activity data if provided
    if activity_data:
        update_data["activity"] = activity_data
    
    # Update the lead using correct method signature
    success = await leads_db.update_lead(lead_id, update_data, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update question responses"
        )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after questions validation
    try:
        await invalidate_cache_pattern("login-department-leads*")
        print(f"🔄 Cache invalidated for login leads after questions validation for lead {lead_id}")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after questions update: {cache_error}")
    
    return {"message": "All important questions validated successfully"}

@router.get("/junior-users")
@cached_response(ttl=120)  # ⚡ Cache for 2 minutes - user hierarchy changes rarely
async def get_junior_users(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """⚡ OPTIMIZED: Get users under current user's hierarchy with caching"""
    start_time = time.time()
    
    try:
        # ⚡ STEP 1: Fast permission check with caching
        cached_permissions = await get_cached_user_permissions(user_id)
        if not cached_permissions:
            await check_permission(user_id, ["users", "leads", "login"], "show", users_db, roles_db)
            # Cache permissions for future requests
            user_permissions = await get_user_permissions(user_id, users_db, roles_db)
            await cache_user_permissions(user_id, user_permissions)
        
        # ⚡ STEP 2: Check cache first
        cache_key = f"junior_users:{user_id}"
        cached_result = await get_cached_response(cache_key)
        if cached_result:
            print(f"⚡ Cache HIT for junior users: {time.time() - start_time:.3f}s")
            return cached_result
        
        # ⚡ STEP 3: Get current user efficiently
        current_user = await users_db.get_user(user_id)
        if not current_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Current user not found")
        
        # ⚡ STEP 4: Get current user's role efficiently
        current_user_role = None
        if current_user.get("role_id"):
            current_user_role = await roles_db.get_role(current_user["role_id"])
        
        # ⚡ STEP 5: Get all users and filter efficiently
        all_users = await users_db.list_users()
        junior_users = []
        
        for user in all_users:
            # Skip the current user
            if str(user.get("_id")) == user_id:
                continue
            
            # Get user's role efficiently
            user_role = None
            if user.get("role_id"):
                user_role = await roles_db.get_role(user["role_id"])
            
            # Include user based on role hierarchy
            if user_role:
                user_dict = convert_object_id(user)
                user_dict["role"] = {
                    "name": user_role.get("name", ""),
                    "level": user_role.get("level", 0)
                }
                junior_users.append(user_dict)
        
        # ⚡ STEP 6: Prepare optimized response
        result = {
            "users": junior_users,
            "metadata": {
                "count": len(junior_users),
                "current_user_id": user_id,
                "response_time": f"{time.time() - start_time:.3f}s"
            }
        }
        
        # ⚡ STEP 7: Cache for future requests
        await cache_response(cache_key, result, ttl=120)
        
        print(f"⚡ Junior users fetched in {time.time() - start_time:.3f}s")
        return result
        
    except Exception as e:
        print(f"❌ Junior users error: {e} - Time: {time.time() - start_time:.3f}s")
        raise HTTPException(status_code=500, detail=f"Failed to fetch junior users: {e}")

@router.patch("/update-login-fields/{lead_id}")
async def update_login_fields(
    lead_id: str,
    login_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update login form fields for a lead"""
    
    # Check permission - check both leads and login permissions
    try:
        await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    except Exception as e:
        raise
    
    # Verify lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Prepare login update data
    # Initialize dynamic_fields if not present
    dynamic_fields = lead.get("dynamic_fields", {})
    
    # Track any direct fields to update
    direct_update = {}
    
    # Check if we're receiving a complete login form submission
    if 'login_form' in login_data:
        # Initialize login_form in dynamic_fields if it doesn't exist
        if 'login_form' not in dynamic_fields:
            dynamic_fields['login_form'] = {}
            
        # Store the complete login form submission
        login_form_data = login_data['login_form']
        dynamic_fields['login_form'] = login_form_data
        
        # Handle special fields to maintain compatibility with existing code
        # Handle CIBIL Score
        if 'cibil_score' in login_form_data:
            if 'financial_details' not in dynamic_fields:
                dynamic_fields['financial_details'] = {}
            dynamic_fields['financial_details']['cibil_score'] = login_form_data['cibil_score']
            dynamic_fields['cibil_score'] = login_form_data['cibil_score']
            
        # Handle company name and category
        if 'company_name' in login_form_data:
            if 'personal_details' not in dynamic_fields:
                dynamic_fields['personal_details'] = {}
            dynamic_fields['personal_details']['company_name'] = login_form_data['company_name']
            dynamic_fields['company_name'] = login_form_data['company_name']
            
        if 'company_category' in login_form_data:
            if 'personal_details' not in dynamic_fields:
                dynamic_fields['personal_details'] = {}
            dynamic_fields['personal_details']['company_category'] = login_form_data['company_category']
            dynamic_fields['company_category'] = login_form_data['company_category']
            
        # Handle identity fields
        if 'pan_number' in login_form_data:
            if 'identity_details' not in dynamic_fields:
                dynamic_fields['identity_details'] = {}
            dynamic_fields['identity_details']['pan_number'] = login_form_data['pan_number']
            
        if 'aadhar_number' in login_form_data:
            if 'identity_details' not in dynamic_fields:
                dynamic_fields['identity_details'] = {}
            dynamic_fields['identity_details']['aadhar_number'] = login_form_data['aadhar_number']
    else:
        # Process individual fields from the request (backward compatibility)
        for field, value in login_data.items():
            # Special handling for CIBIL score - ensure it's stored in financial_details
            if field == 'cibil_score':
                # Initialize financial_details if not present
                if 'financial_details' not in dynamic_fields:
                    dynamic_fields['financial_details'] = {}
                # Store in both places for backward compatibility
                dynamic_fields[field] = value
                dynamic_fields['financial_details']['cibil_score'] = value
            # Check if this field should be stored in dynamic_fields
            elif field in ['loan_eligibility', 'company_name', 'company_category', 'salary', 
                        'pincode', 'city', 'customer_name']:
                dynamic_fields[field] = value
            else:
                # Store other fields directly in the lead document
                direct_update[field] = value
    
    # Combine updates
    update_data = {
        "dynamic_fields": dynamic_fields,
        "updated_at": get_ist_now().isoformat(),
        "login_form_updated_by": user_id,
        "login_form_updated_at": get_ist_now().isoformat()
    }
    
    # Add any direct fields
    update_data.update(direct_update)
    
    # Update the lead using correct method signature
    success = await leads_db.update_lead(lead_id, update_data, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update login form data"
        )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after login fields update
    try:
        await invalidate_cache_pattern("login-department-leads*")
        print(f"🔄 Cache invalidated for login leads after login fields update for lead {lead_id}")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after login fields update: {cache_error}")
    
    return {
        "message": "Login form data updated successfully", 
        "updated_fields": list(login_data.keys()),
        "timestamp": get_ist_now().isoformat()
    }

@router.get("/debug/test-lead/{lead_id}")
async def debug_test_lead(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db)
):
    """Debug endpoint to test lead retrieval and database connection"""
    
    try:
        # Test database connection
        collection_name = leads_db.collection.name
        
        # Test lead retrieval
        lead = await leads_db.get_lead(lead_id)
        if not lead:
            return {
                "status": "error",
                "message": f"Lead {lead_id} not found",
                "database_collection": collection_name
            }
        
        # Get basic lead info
        lead_info = {
            "id": str(lead.get('_id')),
            "name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
            "phone": lead.get('phone'),
            "email": lead.get('email'),
            "status": lead.get('status'),
            "has_dynamic_fields": bool(lead.get('dynamic_fields')),
            "dynamic_fields_keys": list(lead.get('dynamic_fields', {}).keys()),
            "has_login_form": bool(lead.get('dynamic_fields', {}).get('login_form')),
            "login_form_keys": list(lead.get('dynamic_fields', {}).get('login_form', {}).keys())
        }
        
        return {
            "status": "success",
            "lead": lead_info,
            "database_collection": collection_name
        }
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Debug test failed: {e}")
        return {
            "status": "error",
            "message": str(e),
            "database_collection": getattr(leads_db.collection, 'name', 'unknown')
        }

@router.delete("/{lead_id}")
async def delete_login_lead(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Delete a login department lead
    
    Permission rule: Only lead creator, users with all/junior permissions can delete
    """
    
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check if this is actually a login department lead
    if not lead.get("file_sent_to_login", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This lead is not in the login department"
        )
    
    # Get hierarchical permissions for login module
    permission_data = await get_hierarchical_permissions(user_id, "login")
    permission_level = permission_data["permission_level"]
    is_super_admin = permission_data["is_super_admin"]
    
    # Check if user is the creator of the lead
    is_creator = lead.get("created_by") == user_id
    
    # Apply delete permission rule: Only creator or users with junior/all permissions can delete
    has_delete_permission = (
        is_super_admin or 
        permission_level in ["all", "junior"] or 
        is_creator
    )
    
    # Additional hierarchical check for junior level users
    if permission_level == "junior" and not is_creator and not is_super_admin:
        # Check if lead was created by a subordinate
        from app.utils.permissions import PermissionManager
        try:
            subordinate_ids = await PermissionManager.get_subordinate_users(user_id, users_db, roles_db)
            if lead.get("created_by") not in subordinate_ids:
                has_delete_permission = False
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error checking subordinates for delete permission: {e}")
            has_delete_permission = False
    
    if not has_delete_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this login department lead"
        )
    
    # Delete the lead
    success = await leads_db.delete_lead(lead_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete login department lead"
        )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after deletion
    try:
        await invalidate_cache_pattern("login-department-leads*")
        await invalidate_cache_pattern(f"*{user_id}*")  # Clear user-specific caches
        print(f"🔄 Cache invalidated for login leads after deleting lead {lead_id}")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after deletion: {cache_error}")
        # Don't fail the operation if cache invalidation fails
    
    return {"message": "Login department lead deleted successfully"}

@router.get("/channel-names")
async def get_channel_names_for_operations(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get channel names for operations dropdown in LoginCRM"""
    try:
        # Check permission - user should be able to view login operations
        await check_permission(user_id, "login", "show", users_db, roles_db)
        
        # Import SettingsDB here to avoid circular imports
        from app.database.Settings import SettingsDB
        settings_db = SettingsDB()
        
        # Get only active channel names
        channels = await settings_db.get_channel_names(is_active=True)
        
        # Extract just the names for dropdown
        channel_names = [channel['name'] for channel in channels]
        
        return {
            "success": True,
            "channel_names": channel_names,
            "count": len(channel_names)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch channel names: {str(e)}"
        )
