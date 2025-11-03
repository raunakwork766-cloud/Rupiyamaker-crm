"""
Leave Management Routes

This module handles all leave-related operations including:
- Creating, updating, and deleting leave applications
- Viewing leaves based on user permissions
- Approving and rejecting leaves
- Adding attachments to leaves
- Getting leave statistics and balances

Permission Rules:
- Users with "leave:all" permission can see all leaves
- Other users can only see leaves they created
- Only users with "leave:approve" permission or super admins can approve/reject leaves
- Anyone can create leaves for themselves
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime, date

from app.database import get_database_instances
from app.database.Leaves import LeavesDB
from app.database import get_database_instances
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Notifications import NotificationsDB
from app.schemas.leave_schemas import (
    LeaveCreateSchema, LeaveUpdateSchema, LeaveResponseSchema,
    LeaveListResponseSchema, LeaveApprovalSchema, LeaveStatsSchema,
    LeaveFilterSchema, EmployeeLeaveBalance, AttachmentSchema
)
from app.utils.permissions import PermissionManager
from app.utils.common_utils import get_current_user_id

router = APIRouter(prefix="/leaves", tags=["leaves"])
security = HTTPBearer()

# Dependency injection functions
def get_leaves_db():
    from app.database import get_leaves_db as get_leaves_db_instance
    return get_leaves_db_instance()

def get_users_db():
    from app.database import get_users_db as get_users_db_instance
    return get_users_db_instance()

def get_roles_db():
    from app.database import get_roles_db as get_roles_db_instance
    return get_roles_db_instance()

def get_notifications_db():
    from app.database import get_notifications_db as get_notifications_db_instance
    return get_notifications_db_instance()

async def get_hierarchical_permissions(
    user_id: str, 
    module: str = "leaves",
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
) -> Dict[str, Any]:
    """Get simplified hierarchical permissions for leaves module"""
    try:
        from app.utils.permission_helpers import is_super_admin_permission
        
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
        
        # Check for module-specific permissions
        has_all = False
        has_junior = False
        
        for perm in permissions:
            if perm.get("page") == module:
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
        print(f"Error getting hierarchical permissions for {user_id}: {e}")
        return {"permission_level": "own", "is_super_admin": False}

# File upload configuration
UPLOAD_BASE_DIR = "media/leaves"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {
    'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx'
}

def ensure_upload_dir(employee_id: str = None):
    """Create upload directory structure for organized file storage"""
    if employee_id:
        # Create employee-specific directory: media/leaves/{employee_id}
        upload_dir = os.path.join(UPLOAD_BASE_DIR, employee_id)
    else:
        # Create base directory: media/leaves
        upload_dir = UPLOAD_BASE_DIR
    
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir, exist_ok=True)
    return upload_dir

def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

async def get_user_details(user_id: str, users_db: UsersDB) -> Dict[str, Any]:
    """Get user details including name and department information"""
    user = await users_db.get_user(user_id)
    if not user:
        return {"user_id": user_id, "name": "Unknown User"}
    
    result = {
        "user_id": user_id,
        "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("username", "Unknown"),
        "email": user.get("email", ""),
        "employee_id": user.get("employee_id", user_id),
        "department_name": user.get("department_name", "")
    }
    
    return result

async def enrich_leave_data(leave: Dict[str, Any], users_db: UsersDB) -> Dict[str, Any]:
    """Enrich leave data with user details"""
    # Get employee details
    if leave.get("employee_id"):
        employee_details = await get_user_details(leave["employee_id"], users_db)
        leave["employee_name"] = employee_details.get("name")
        leave["employee_email"] = employee_details.get("email")
        leave["department_name"] = employee_details.get("department_name")
    
    # Get approver details
    if leave.get("approved_by"):
        approver_details = await get_user_details(leave["approved_by"], users_db)
        leave["approved_by_name"] = approver_details.get("name")
    
    # Get rejector details
    if leave.get("rejected_by"):
        rejector_details = await get_user_details(leave["rejected_by"], users_db)
        leave["rejected_by_name"] = rejector_details.get("name")
    
    return leave

@router.post("/", response_model=LeaveResponseSchema)
async def create_leave(
    leave_data: LeaveCreateSchema,
    current_user_id: str = Depends(get_current_user_id),
    leaves_db: LeavesDB = Depends(get_leaves_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """
    Create a new leave application
    
    Any authenticated user can create a leave application for themselves.
    """
    try:
        # Prepare leave data
        leave_dict = leave_data.dict()
        leave_dict["employee_id"] = current_user_id
        leave_dict["status"] = "pending"
        
        # Convert dates to datetime objects for storage
        leave_dict["from_date"] = datetime.combine(leave_data.from_date, datetime.min.time())
        leave_dict["to_date"] = datetime.combine(leave_data.to_date, datetime.min.time())
        
        # Create the leave
        leave_id = await leaves_db.create_leave(leave_dict)
        
        # Get the created leave
        leave = await leaves_db.get_leave(leave_id)
        if not leave:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create leave application"
            )
        
        # Enrich with user details
        leave = await enrich_leave_data(leave, users_db)
        
        # Normalize the response
        leave["id"] = leave["_id"]
        return leave
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create leave application: {str(e)}"
        )

@router.get("/permissions")
async def get_leave_permissions(
    current_user_id: str = Depends(get_current_user_id),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get current user's leave permissions
    
    Returns what actions the user can perform on leaves.
    """
    try:
        # Get user permissions
        permissions = await PermissionManager.get_user_permissions(
            current_user_id, users_db, roles_db
        )
        
        # Check permissions
        can_view_all = False
        can_edit = False
        is_super_admin = False
        
        for perm in permissions:
            # Super admin check - user with any:* or *:* permissions
            if (perm.get("page") in ["*", "any"] and perm.get("actions") == "*"):
                can_view_all = True
                can_edit = True
                is_super_admin = True
                break
            # Leave module specific permissions - updated to new permission structure
            elif (perm.get("page").lower() in ["leaves", "leave"]):
                actions = perm.get("actions", [])
                if actions == "*" or \
                   (isinstance(actions, list) and ("*" in actions or "leave_admin" in actions)) or \
                   actions == "leave_admin":
                    can_view_all = True
                    can_edit = True
                elif (isinstance(actions, list) and ("show" in actions or "leaves_show" in actions)) or \
                     actions in ["show", "leaves_show"]:
                    # User has show permission but not admin
                    pass
        
        return {
            "success": True,
            "permissions": {
                "can_view_own": True,  # All authenticated users can view their own leaves
                "can_view_all": can_view_all,  # Users with edit permission or super admin can view all
                "can_approve_reject": can_edit,  # Users with edit permission or super admin can approve/reject
                "can_create": True,  # All authenticated users can create leaves
                "is_super_admin": is_super_admin  # Flag to indicate super admin status
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch leave permissions: {str(e)}"
        )

@router.get("/", response_model=LeaveListResponseSchema)
async def list_leaves(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    leave_status: Optional[str] = Query(None, description="Filter by status"),
    leave_type: Optional[str] = Query(None, description="Filter by leave type"),
    employee_id: Optional[str] = Query(None, description="Filter by employee"),
    search: Optional[str] = Query(None, description="Search in employee name and reason"),
    user_id: str = Query(..., description="Current user ID"),
    permission_level: Optional[str] = Query(None, description="Permission level from frontend"),
    current_user_id: str = Depends(get_current_user_id),
    leaves_db: LeavesDB = Depends(get_leaves_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    List leaves based on hierarchical permissions
    
    Permission Levels:
    - superadmin: Can see all leaves
    - all: Can see all leaves and approve/reject
    - junior: Can see own + subordinate leaves and approve/reject (not own)
    - own: Can only see own leaves
    """
    try:
        # Use the same permission logic as the working overview endpoint
        permissions = await PermissionManager.get_user_permissions(
            current_user_id, users_db, roles_db
        )
        
        # Check if user can see all leaves (same logic as overview endpoint)
        can_see_all_leaves = False
        is_super_admin = False
        for perm in permissions:
            if (perm.get("page") in ["*", "any"] and perm.get("actions") == "*") or \
               (perm.get("page") == "leaves" and 
                (perm.get("actions") == "*" or 
                 (isinstance(perm.get("actions"), list) and ("*" in perm.get("actions") or "all" in perm.get("actions"))) or
                 perm.get("actions") == "all")):
                can_see_all_leaves = True
                if perm.get("page") in ["*", "any"] and perm.get("actions") == "*":
                    is_super_admin = True
                break
        
        # Convert to hierarchical permission format for compatibility
        if can_see_all_leaves:
            perm_level = "all"
        else:
            # Check for junior permissions (can see subordinates)
            has_junior = False
            for perm in permissions:
                if perm.get("page") == "leaves" and \
                   (isinstance(perm.get("actions"), list) and "junior" in perm.get("actions")) or \
                   perm.get("actions") == "junior":
                    has_junior = True
                    break
            perm_level = "junior" if has_junior else "own"
        
        print(f"🔍 Backend leaves API: User {current_user_id}, Permission level: {perm_level}, Super admin: {is_super_admin}")
        print(f"🔍 Backend leaves API: Can see all leaves: {can_see_all_leaves}")
        print(f"🔍 Backend leaves API: All permissions: {permissions}")
        
        # Build filter based on permissions
        filter_dict = {}
        
        if can_see_all_leaves:
            # User can see all leaves
            print(f"🔍 Backend leaves API: User has 'all' access - returning all leaves")
            pass  # No filter, see everything
        elif perm_level == "junior":
            # Junior permission - see own + subordinate leaves
            print(f"🔍 Backend leaves API: User has 'junior' access - getting subordinate leaves")
            subordinate_user_ids = await PermissionManager.get_subordinate_users(
                current_user_id, users_db, roles_db
            )
            # Include own leaves and subordinate leaves
            allowed_user_ids = [current_user_id] + subordinate_user_ids
            filter_dict["employee_id"] = {"$in": allowed_user_ids}
            print(f"🔍 Backend leaves API: Allowed user IDs: {allowed_user_ids}")
        else:
            # "own" permission - only own leaves
            print(f"🔍 Backend leaves API: User has 'own' access - returning only user's leaves")
            filter_dict["employee_id"] = current_user_id
        
        # Apply additional filters
        if leave_status:
            filter_dict["status"] = leave_status
        if leave_type:
            filter_dict["leave_type"] = leave_type
        if employee_id:
            # Check if the user can see this specific employee's leaves
            if can_see_all_leaves:
                # User can filter by any employee
                filter_dict["employee_id"] = employee_id
                print(f"🔍 Backend leaves API: Admin filtering by employee: {employee_id}")
            elif perm_level == "junior":
                # Check if the specified employee is a subordinate or self
                subordinate_user_ids = await PermissionManager.get_subordinate_users(
                    current_user_id, users_db, roles_db
                )
                if employee_id == current_user_id or employee_id in subordinate_user_ids:
                    filter_dict["employee_id"] = employee_id
                    print(f"🔍 Backend leaves API: Junior filtering by allowed employee: {employee_id}")
                else:
                    # Not authorized to see this employee's leaves - ignore filter and show what user is allowed to see
                    print(f"🔍 Backend leaves API: User not authorized to filter by employee {employee_id}, ignoring filter")
            else:
                # "own" permission can only filter to their own leaves
                if employee_id == current_user_id:
                    filter_dict["employee_id"] = current_user_id
                    print(f"🔍 Backend leaves API: Own filtering by self: {employee_id}")
                else:
                    # Not authorized - ignore filter and show own leaves
                    print(f"🔍 Backend leaves API: User not authorized to filter by employee {employee_id}, showing own leaves only")
        
        print(f"🔍 Backend leaves API: Final filter: {filter_dict}")
        
        # Get total count
        total = await leaves_db.count_leaves(filter_dict)
        print(f"🔍 Backend leaves API: Total count from database: {total}")
        
        # Calculate pagination
        skip = (page - 1) * per_page
        total_pages = (total + per_page - 1) // per_page
        
        # Get leaves
        leaves = await leaves_db.list_leaves(
            filter_dict=filter_dict,
            skip=skip,
            limit=per_page
        )
        print(f"🔍 Backend leaves API: Retrieved {len(leaves)} leaves from database")
        
        # Enrich leaves with user details and apply search filter
        enriched_leaves = []
        for leave in leaves:
            leave = await enrich_leave_data(leave, users_db)
            
            # Apply search filter after enrichment
            if search:
                search_lower = search.lower()
                if not (search_lower in leave.get("employee_name", "").lower() or 
                       search_lower in leave.get("reason", "").lower()):
                    continue
            
            # Normalize the response
            leave["id"] = leave["_id"]
            enriched_leaves.append(leave)
        
        return {
            "leaves": enriched_leaves,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch leaves: {str(e)}"
        )

@router.get("/{leave_id}", response_model=LeaveResponseSchema)
async def get_leave(
    leave_id: str,
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    leaves_db: LeavesDB = Depends(get_leaves_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get a specific leave application using hierarchical permissions
    
    Permission Levels:
    - superadmin: Can view any leave
    - all: Can view any leave 
    - junior: Can view own + subordinate leaves
    - own: Can only view own leaves
    """
    try:
        print(f"🔍 Backend get_leave: User {current_user_id} requesting leave {leave_id}")
        
        # Get the leave
        leave = await leaves_db.get_leave(leave_id)
        if not leave:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave application not found"
            )
        
        print(f"🔍 Backend get_leave: Found leave for employee {leave.get('employee_id')}")
        
        # Use hierarchical permissions instead of complex permission checks
        permissions = await get_hierarchical_permissions(current_user_id, "leaves")
        perm_level = permissions.get("permission_level", "own")
        is_super_admin = permissions.get("is_super_admin", False)
        
        print(f"🔍 Backend get_leave: User permission level: {perm_level}, Super admin: {is_super_admin}")
        
        # Check if user can view this leave based on hierarchical permissions
        can_view_leave = False
        
        if is_super_admin or perm_level == "all":
            # Super admin or "all" permission - can view any leave
            print(f"🔍 Backend get_leave: User has 'all' access - allowing view")
            can_view_leave = True
        elif perm_level == "junior":
            # Junior permission - can view own + subordinate leaves
            print(f"🔍 Backend get_leave: User has 'junior' access - checking subordinates")
            subordinate_user_ids = await PermissionManager.get_subordinate_users(
                current_user_id, users_db, roles_db
            )
            allowed_user_ids = [current_user_id] + subordinate_user_ids
            if leave.get("employee_id") in allowed_user_ids:
                can_view_leave = True
                print(f"🔍 Backend get_leave: Leave belongs to allowed user")
            else:
                print(f"🔍 Backend get_leave: Leave employee not in allowed list: {allowed_user_ids}")
        else:
            # "own" permission - only own leaves
            print(f"🔍 Backend get_leave: User has 'own' access - checking if own leave")
            if leave.get("employee_id") == current_user_id:
                can_view_leave = True
                print(f"🔍 Backend get_leave: User viewing own leave")
            else:
                print(f"🔍 Backend get_leave: Leave belongs to different user")
        
        # if not can_view_leave:
        #     print(f"🔍 Backend get_leave: Access denied - insufficient permissions")
        #     raise HTTPException(
        #         status_code=status.HTTP_403_FORBIDDEN,
        #         detail="You don't have permission to view this leave application"
        #     )
        
        print(f"🔍 Backend get_leave: Access granted - returning leave data")
        
        # Enrich with user details
        leave = await enrich_leave_data(leave, users_db)
        
        # Normalize the response
        leave["id"] = leave["_id"]
        return leave
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch leave details: {str(e)}"
        )

@router.put("/{leave_id}", response_model=LeaveResponseSchema)
async def update_leave(
    leave_id: str,
    leave_data: LeaveUpdateSchema,
    current_user_id: str = Depends(get_current_user_id),
    leaves_db: LeavesDB = Depends(get_leaves_db)
):
    """
    Update a leave application
    
    Users can only update their own pending leaves.
    """
    try:
        # Get the leave
        leave = await leaves_db.get_leave(leave_id)
        if not leave:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave application not found"
            )
        
        # Check if user owns this leave
        if leave.get("employee_id") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own leave applications"
            )
        
        # Check if leave is still pending
        if leave.get("status") != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can only update pending leave applications"
            )
        
        # Prepare update data
        update_data = leave_data.dict(exclude_unset=True)
        
        # Convert dates to datetime objects if provided
        if "from_date" in update_data:
            update_data["from_date"] = datetime.combine(leave_data.from_date, datetime.min.time())
        if "to_date" in update_data:
            update_data["to_date"] = datetime.combine(leave_data.to_date, datetime.min.time())
        
        # Update the leave
        success = await leaves_db.update_leave(leave_id, update_data)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update leave application"
            )
        
        # Get updated leave
        updated_leave = await leaves_db.get_leave(leave_id)
        updated_leave = await enrich_leave_data(updated_leave)
        
        # Normalize the response
        updated_leave["id"] = updated_leave["_id"]
        return updated_leave
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update leave application: {str(e)}"
        )

@router.post("/{leave_id}/approve", response_model=LeaveResponseSchema)
async def approve_reject_leave(
    leave_id: str,
    approval_data: LeaveApprovalSchema,
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    leaves_db: LeavesDB = Depends(get_leaves_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """
    Approve or reject a leave application using hierarchical permissions
    
    Permission Levels:
    - superadmin: Can approve/reject any leave
    - all: Can approve/reject any leave
    - junior: Can approve/reject subordinate leaves (but not own)
    - own: Cannot approve/reject (read-only)
    """
    try:
        print(f"🔍 Backend approve_reject_leave: User {current_user_id} trying to {approval_data.status} leave {leave_id}")
        
        # Get the leave first to check ownership
        leave = await leaves_db.get_leave(leave_id)
        if not leave:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave application not found"
            )
        
        leave_employee_id = leave.get("employee_id")
        print(f"🔍 Backend approve_reject_leave: Leave belongs to employee {leave_employee_id}")
        
        # Use hierarchical permissions instead of complex permission checks
        permissions = await get_hierarchical_permissions(current_user_id, "leaves")
        perm_level = permissions.get("permission_level", "own")
        is_super_admin = permissions.get("is_super_admin", False)
        
        print(f"🔍 Backend approve_reject_leave: User permission level: {perm_level}, Super admin: {is_super_admin}")
        
        # Check if user can approve/reject based on hierarchical permissions
        can_approve = False
        
        if is_super_admin or perm_level == "all":
            # Super admin or "all" permission - can approve/reject any leave
            print(f"🔍 Backend approve_reject_leave: User has 'all' access - allowing approval")
            can_approve = True
        elif perm_level == "junior":
            # Junior permission - can approve/reject subordinate leaves but not own
            print(f"🔍 Backend approve_reject_leave: User has 'junior' access - checking subordinates and own leave")
            
            if leave_employee_id == current_user_id:
                # Junior users cannot approve their own leaves
                print(f"🔍 Backend approve_reject_leave: Junior user cannot approve own leave")
                can_approve = False
            else:
                # Check if it's a subordinate's leave
                subordinate_user_ids = await PermissionManager.get_subordinate_users(
                    current_user_id, users_db, roles_db
                )
                if leave_employee_id in subordinate_user_ids:
                    can_approve = True
                    print(f"🔍 Backend approve_reject_leave: Leave belongs to subordinate - allowing approval")
                else:
                    print(f"🔍 Backend approve_reject_leave: Leave employee not a subordinate: {subordinate_user_ids}")
        else:
            # "own" permission - cannot approve/reject any leaves
            print(f"🔍 Backend approve_reject_leave: User has 'own' access - no approval permissions")
            can_approve = False
        
        if not can_approve:
            print(f"🔍 Backend approve_reject_leave: Access denied - insufficient permissions")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to approve/reject leave applications"
            )
        
        # Check if leave is still pending
        if leave.get("status") != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Leave has already been processed"
            )
        
        # Update leave status with comments
        success = await leaves_db.update_leave_status(
            leave_id, 
            approval_data.status, 
            approved_by=current_user_id,
            rejection_reason=approval_data.rejection_reason,
            comments=approval_data.comments
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update leave status"
            )
        
        # Get updated leave
        updated_leave = await leaves_db.get_leave(leave_id)
        
        # Send notification to the employee who requested the leave
        employee_id = leave.get("employee_id")
        print(f"🔍 Backend approve_reject_leave: Attempting to send notification to employee {employee_id}")
        
        if employee_id:
            try:
                # Get the name of the person who approved/rejected
                approver = await users_db.get_user(current_user_id)
                approver_name = "Manager"
                if approver:
                    first_name = approver.get("first_name", "")
                    last_name = approver.get("last_name", "")
                    if first_name or last_name:
                        approver_name = f"{first_name} {last_name}".strip()
                
                print(f"🔍 Backend approve_reject_leave: Approver name: {approver_name}")
                print(f"🔍 Backend approve_reject_leave: Creating notification with data:")
                print(f"  - Employee ID: {employee_id}")
                print(f"  - Leave status: {approval_data.status}")
                print(f"  - Approver ID: {current_user_id}")
                print(f"  - Approver name: {approver_name}")
                
                # Create notification using the notification database
                notification_result = await notifications_db.create_leave_status_notification(
                    employee_id, 
                    updated_leave, 
                    current_user_id, 
                    approver_name
                )
                
                print(f"🔍 Backend approve_reject_leave: Notification creation result: {notification_result}")
                
            except Exception as e:
                print(f"❌ Backend approve_reject_leave: Failed to create leave status notification: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"❌ Backend approve_reject_leave: No employee_id found in leave data")
        
        updated_leave = await enrich_leave_data(updated_leave)
        
        # Normalize the response
        updated_leave["id"] = updated_leave["_id"]
        return updated_leave
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process leave application: {str(e)}"
        )

@router.post("/{leave_id}/attachments")
async def upload_attachment(
    leave_id: str,
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_current_user_id),
    leaves_db: LeavesDB = Depends(get_leaves_db)
):
    """
    Upload an attachment to a leave application
    
    Users can only upload attachments to their own leaves.
    """
    try:
        # Get the leave
        leave = await leaves_db.get_leave(leave_id)
        if not leave:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave application not found"
            )
        
        # Check if user owns this leave
        if leave.get("employee_id") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only upload attachments to your own leave applications"
            )
        
        # Validate file
        if not allowed_file(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File type not allowed. Allowed types: pdf, png, jpg, jpeg, gif, doc, docx"
            )
        
        # Check file size
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size too large. Maximum size is 10MB"
            )
        
        # Ensure upload directory exists for this employee
        upload_dir = ensure_upload_dir(current_user_id)
        
        # Get leave dates for filename organization
        from_date = leave.get("from_date")
        if isinstance(from_date, datetime):
            leave_date_str = from_date.strftime("%Y-%m-%d")
        else:
            leave_date_str = datetime.now().strftime("%Y-%m-%d")
        
        # Generate organized filename: {leave_date}_{original_filename}
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        original_name = file.filename.rsplit('.', 1)[0]
        unique_filename = f"{leave_date_str}_{original_name}_{uuid.uuid4().hex[:8]}.{file_extension}"
        file_path = os.path.join(upload_dir, unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        # Create attachment data with organized structure
        attachment = {
            "attachment_id": str(uuid.uuid4()),
            "filename": file.filename,  # Original filename
            "stored_filename": unique_filename,  # Stored filename with date prefix
            "file_path": file_path,
            "relative_path": f"leaves/{current_user_id}/{unique_filename}",  # Path relative to media folder
            "file_size": len(file_content),
            "mime_type": file.content_type,
            "employee_id": current_user_id,
            "leave_date": leave_date_str,
            "uploaded_at": datetime.now()
        }
        
        # Update leave with new attachment
        existing_attachments = leave.get("attachments", [])
        existing_attachments.append(attachment)
        
        success = await leaves_db.update_leave(leave_id, {"attachments": existing_attachments})
        if not success:
            # Clean up file if database update failed
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save attachment"
            )
        
        return {
            "message": "Attachment uploaded successfully",
            "attachment": attachment
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload attachment: {str(e)}"
        )

@router.get("/stats/overview", response_model=LeaveStatsSchema)
async def get_leave_statistics(
    current_user_id: str = Depends(get_current_user_id),
    leaves_db: LeavesDB = Depends(get_leaves_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get leave statistics
    
    Returns statistics for the current user's leaves only unless they have "leave:all" permission.
    """
    try:
        # Get user permissions
        permissions = await PermissionManager.get_user_permissions(
            current_user_id, users_db, roles_db
        )
        
        # Check if user can see all leaves
        can_see_all_leaves = False
        for perm in permissions:
            if (perm.get("page") in ["*", "any"] and perm.get("actions") == "*") or \
               (perm.get("page") == "leaves" and 
                (perm.get("actions") == "*" or 
                 (isinstance(perm.get("actions"), list) and ("*" in perm.get("actions") or "all" in perm.get("actions"))) or
                 perm.get("actions") == "all")):
                can_see_all_leaves = True
                break
        
        # Get statistics
        if can_see_all_leaves:
            stats = await leaves_db.get_leave_statistics()
        else:
            stats = await leaves_db.get_leave_statistics(employee_id=current_user_id)
        
        return stats
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch leave statistics: {str(e)}"
        )

@router.delete("/{leave_id}")
async def delete_leave(
    leave_id: str,
    current_user_id: str = Depends(get_current_user_id),
    leaves_db: LeavesDB = Depends(get_leaves_db)
):
    """
    Delete a leave application
    
    Users can only delete their own pending leaves.
    """
    try:
        # Get the leave
        leave = await leaves_db.get_leave(leave_id)
        if not leave:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave application not found"
            )
        
        # Check if user owns this leave
        # if leave.get("employee_id") != current_user_id:
        #     raise HTTPException(
        #         status_code=status.HTTP_403_FORBIDDEN,
        #         detail="You can only delete your own leave applications"
        #     )
        
        # Check if leave is still pending
        # if leave.get("status") != "pending":
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="You can only delete pending leave applications"
        #     )
        
        # Delete associated files
        for attachment in leave.get("attachments", []):
            file_path = attachment.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Failed to delete file {file_path}: {e}")
        
        # Delete the leave
        success = await leaves_db.delete_leave(leave_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete leave application"
            )
        
        return {"message": "Leave application deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete leave application: {str(e)}"
        )

@router.get("/{leave_id}/attachments/{attachment_id}")
async def download_attachment(
    leave_id: str,
    attachment_id: str,
    current_user_id: str = Depends(get_current_user_id),
    leaves_db: LeavesDB = Depends(get_leaves_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Download a specific attachment from a leave application
    
    Users can only download attachments from leaves they can view.
    """
    try:
        from fastapi.responses import FileResponse
        
        # Get the leave
        leave = await leaves_db.get_leave(leave_id)
        if not leave:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave application not found"
            )
        
        # Check permissions - user can view their own leaves or all leaves if they have permission
        permissions = await PermissionManager.get_user_permissions(
            current_user_id, users_db, roles_db
        )
        
        can_see_all_leaves = False
        for perm in permissions:
            if (perm.get("page") in ["*", "any"] and perm.get("actions") == "*") or \
               (perm.get("page") == "leaves" and 
                (perm.get("actions") == "*" or 
                 (isinstance(perm.get("actions"), list) and ("*" in perm.get("actions") or "edit" in perm.get("actions"))) or
                 perm.get("actions") == "edit")):
                can_see_all_leaves = True
                break
        
        # Check if user can view this leave
        if not can_see_all_leaves and leave.get("employee_id") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to download attachments from this leave"
            )
        
        # Find the attachment
        attachments = leave.get("attachments", [])
        attachment = None
        for att in attachments:
            if att.get("attachment_id") == attachment_id:
                attachment = att
                break
        
        if not attachment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found"
            )
        
        # Get file path - try new structure first, fallback to old structure
        file_path = attachment.get("file_path")
        if not file_path or not os.path.exists(file_path):
            # Try relative path
            relative_path = attachment.get("relative_path")
            if relative_path:
                file_path = os.path.join("media", relative_path)
        
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment file not found on disk"
            )
        
        # Return file
        return FileResponse(
            path=file_path,
            filename=attachment.get("filename", "attachment"),
            media_type=attachment.get("mime_type", "application/octet-stream")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download attachment: {str(e)}"
        )

@router.delete("/{leave_id}/attachments/{attachment_id}")
async def delete_attachment(
    leave_id: str,
    attachment_id: str,
    current_user_id: str = Depends(get_current_user_id),
    leaves_db: LeavesDB = Depends(get_leaves_db)
):
    """
    Delete a specific attachment from a leave application
    
    Users can only delete attachments from their own leaves.
    """
    try:
        # Get the leave
        leave = await leaves_db.get_leave(leave_id)
        if not leave:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave application not found"
            )
        
        # Check if user owns this leave
        if leave.get("employee_id") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete attachments from your own leave applications"
            )
        
        # Find and remove the attachment
        attachments = leave.get("attachments", [])
        attachment_to_delete = None
        updated_attachments = []
        
        for att in attachments:
            if att.get("attachment_id") == attachment_id:
                attachment_to_delete = att
            else:
                updated_attachments.append(att)
        
        if not attachment_to_delete:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found"
            )
        
        # Update leave without the attachment
        success = await leaves_db.update_leave(leave_id, {"attachments": updated_attachments})
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete attachment from database"
            )
        
        # Delete file from disk
        file_path = attachment_to_delete.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Warning: Failed to delete file {file_path}: {e}")
        
        return {
            "message": "Attachment deleted successfully",
            "attachment_id": attachment_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete attachment: {str(e)}"
        )
