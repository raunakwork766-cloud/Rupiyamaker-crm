from fastapi import APIRouter, HTTPException, Query, Request, Depends
from typing import Optional, List, Dict, Any
from bson import ObjectId
from datetime import datetime, timedelta
import os
from app.utils.permission_helpers import is_super_admin_permission

from ..database.Warnings import WarningDB
from ..database.Users import UsersDB
from ..database.Departments import DepartmentsDB
from ..database.Roles import RolesDB
from ..database.Notifications import NotificationsDB
from app.database import get_database_instances
from ..schemas.warning_schemas import (
    WarningCreate, WarningUpdate, WarningResponse, WarningStats,
    WarningRanking, WarningFilterRequest, WarningListResponse,
    WarningRankingResponse, DuplicateWarningResponse, WarningPermissions,
    WarningRemovalRequest, WarningRemovalRequestResponse
)

router = APIRouter(prefix="/warnings", tags=["warnings"])

# Dependency to get DB instances
async def get_warnings_db():
    db_instances = get_database_instances()
    return db_instances["warnings"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_departments_db():
    db_instances = get_database_instances()
    return db_instances["departments"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_notifications_db():
    db_instances = get_database_instances()
    return db_instances["notifications"]

# Database instances are obtained using centralized get_database_instances()
# within each function to avoid dependency injection issues

async def get_local_user_permissions(user_id: str) -> List[Dict[str, Any]]:
    """Get user permissions for warnings - local implementation to avoid import issues"""
    try:
        # Get database instances from centralized source
        from app.database import get_database_instances
        db_instances = get_database_instances()
        user_db = db_instances['users']
        roles_db = db_instances['roles']
        
        user = await user_db.get_user(user_id)
        if not user:
            return []
            
        role_id = user.get('role_id')
        if not role_id:
            return []
            
        role = await roles_db.get_role(role_id)
        if not role:
            return []
            
        return role.get("permissions", [])
    except Exception as e:
        print(f"Error getting user permissions: {e}")
        return []

from app.utils.permission_helpers import is_super_admin_permission
from app.database import get_database_instances

async def get_subordinate_users_for_warnings(user_id: str) -> List[str]:
    """Get subordinate users for hierarchical warnings access"""
    try:
        # Get database instances from centralized source
        from app.database import get_database_instances
        db_instances = get_database_instances()
        user_db = db_instances['users']
        roles_db = db_instances['roles']
        
        user = await user_db.get_user(user_id)
        if not user or not user.get("role_id"):
            return []
            
        user_role_id = user["role_id"]
        
        # Get all subordinate roles
        subordinate_roles = await roles_db.get_all_subordinate_roles(user_role_id)
        
        if not subordinate_roles:
            return []
            
        subordinate_role_ids = [str(role["_id"]) for role in subordinate_roles]
        
        # Get all users with these subordinate roles
        subordinate_users = await user_db.get_users_by_roles(subordinate_role_ids)
        
        if not subordinate_users:
            return []
            
        user_ids = [str(user["_id"]) for user in subordinate_users]
        return user_ids
    except Exception as e:
        print(f"Error getting subordinate users: {e}")
        return []

async def get_hierarchical_permissions(user_id: str, module: str) -> Dict[str, str]:
    """
    Get hierarchical permissions for a user in a specific module.
    Returns permission level: "own", "junior", or "all"
    
    Args:
        user_id: User ID
        module: Module name ('warnings', 'attendance', 'leaves', 'users')
    
    Returns:
        Dict with:
        - permission_level: "own" | "junior" | "all"
        - is_super_admin: Super admin status
    """
    try:
        permissions = await get_local_user_permissions(user_id)
        
        # Check if user is super admin
        is_super_admin = any(
            is_super_admin_permission(perm)
            for perm in permissions
        )
        
        # Super admin gets "all" permission
        if is_super_admin:
            return {
                "permission_level": "all",
                "is_super_admin": True
            }
        
        # Check module-specific "all" permission (page="module" with actions="all" or "*")
        has_all_permission = any(
            perm.get("page") == module and 
            (perm.get("actions") == "all" or 
             perm.get("actions") == "*" or 
             (isinstance(perm.get("actions"), list) and ("all" in perm.get("actions", []) or "*" in perm.get("actions", []))))
            for perm in permissions
        )
        
        if has_all_permission:
            return {
                "permission_level": "all",
                "is_super_admin": False
            }
        
        # Check module-specific "junior" permission (page="module" with actions="junior")
        has_junior_permission = any(
            perm.get("page") == module and 
            (perm.get("actions") == "junior" or
             (isinstance(perm.get("actions"), list) and "junior" in perm.get("actions", [])))
            for perm in permissions
        )
        
        if has_junior_permission:
            return {
                "permission_level": "junior",
                "is_super_admin": False
            }
        
        # Default: users can only see their own records
        return {
            "permission_level": "own",
            "is_super_admin": False
        }
        
    except Exception as e:
        print(f"Error getting hierarchical permissions for {user_id} in {module}: {e}")
        return {
            "permission_level": "own",
            "is_super_admin": False
        }

# Removed JWT authentication - using Query parameter instead

async def get_user_warning_permissions(user_id: str) -> WarningPermissions:
    """Get warning-specific permissions for a user"""
    try:
        # Get database instances from centralized source
        from app.database import get_database_instances
        db_instances = get_database_instances()
        user_db = db_instances['users']
        
        user = await user_db.get_user(user_id)  # Changed from get_user_by_id
        if not user:
            return WarningPermissions()
        
        role_id = user.get('role_id')
        if not role_id:
            return WarningPermissions()

        permissions = await get_local_user_permissions(user_id)

        # Check if user is super admin (wildcard permissions)
        is_super_admin = any(
            (is_super_admin_permission(perm)) or
            (perm.get("page") == "global" and perm.get("actions") == "*")
            for perm in permissions
        )
        
        # Super admin gets all permissions
        if is_super_admin:
            return WarningPermissions(
                can_view_own=True,
                can_view_all=True,
                can_add=True,
                can_edit=True,
                can_delete=True,
                can_export=True
            )
        
        # Check for warnings admin permissions
        has_warnings_admin = any(
            perm.get("page") == "warnings" and ("warnings_admin" in str(perm.get("actions", "")) or perm.get("actions") == "*")
            for perm in permissions
        )
        
        # Define permission mapping for warnings - updated to new permission structure
        warning_permissions = WarningPermissions(
            can_view_own=True,  # All users can view their own warnings
            can_view_all=has_warnings_admin,  # Only admin can view all warnings
            can_add=has_warnings_admin,  # Only admin can add warnings
            can_edit=has_warnings_admin,  # Only admin can edit warnings
            can_delete=has_warnings_admin,  # Only admin can delete warnings
            can_export=has_warnings_admin  # Only admin can export warnings
        )
        
        return warning_permissions
    except Exception:
        return WarningPermissions()

@router.get("/permissions")
async def get_warning_permissions(user_id: str = Query(..., description="User _id making the request")):
    """Get warning permissions for current user"""
    try:
        permissions = await get_user_warning_permissions(user_id)
        return {"success": True, "permissions": permissions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get permissions: {str(e)}")

@router.post("/", response_model=dict)
async def create_warning(
    warning_data: WarningCreate,
    user_id: str = Query(..., description="User _id making the request"),
    warnings_db: WarningDB = Depends(get_warnings_db),
    user_db: UsersDB = Depends(get_users_db),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Create a new warning with hierarchical permission checking"""
    try:
        # Get hierarchical permissions for warnings
        permissions = await get_hierarchical_permissions(user_id, "warnings")
        permission_level = permissions["permission_level"]
        
        # Check if user can create warnings at all
        if permission_level == "own":
            raise HTTPException(status_code=403, detail="Not authorized to create warnings")
        
        # Check if user can issue warning to the target employee
        target_user_id = warning_data.issued_to
        can_issue_to_target = False
        
        if permission_level == "all":
            # Users with "all" permission can issue to anyone
            can_issue_to_target = True
        elif permission_level == "junior":
            # Users with "junior" permission can issue to subordinates only
            subordinate_user_ids = await get_subordinate_users_for_warnings(user_id)
            if target_user_id in subordinate_user_ids:
                can_issue_to_target = True
        
        if not can_issue_to_target:
            raise HTTPException(
                status_code=403, 
                detail="You can only issue warnings to your subordinates. Contact admin for other employees."
            )
        
        # Check for duplicate warning
        duplicate_check = await warnings_db.check_duplicate_warning(
            warning_data.issued_to,
            warning_data.warning_type.value
        )
        
        if duplicate_check["has_duplicate"]:
            return {
                "success": False,
                "message": f"Duplicate warning found. Employee already has a {warning_data.warning_type.value} warning today.",
                "duplicate_warning": duplicate_check["existing_warning"]
            }
        
        # Get employee info to determine department
        employee = await user_db.get_user(warning_data.issued_to)
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Create warning
        warning_dict = {
            "warning_type": warning_data.warning_type.value,
            "issued_to": warning_data.issued_to,
            "issued_by": user_id,
            "department_id": employee.get('department_id'),
            "penalty_amount": warning_data.penalty_amount,
            "warning_message": warning_data.warning_message
        }
        
        created_warning = await warnings_db.create_warning(warning_dict)
        
        # Create notification for the user who received the warning
        try:
            # Get issuer name
            issuer = await user_db.get_user(user_id)
            issuer_name = "Unknown"
            if issuer:
                first_name = issuer.get('first_name', '')
                last_name = issuer.get('last_name', '')
                issuer_name = f"{first_name} {last_name}".strip()
                if not issuer_name:
                    issuer_name = issuer.get('username', 'Unknown')
            
            # Add a notification for the employee
            warning_with_id = {**warning_dict, "_id": created_warning["id"], "reason": warning_dict.get("warning_message", "")}
            await notifications_db.create_warning_notification(
                user_id=warning_data.issued_to,
                warning_data=warning_with_id,
                created_by=user_id,
                created_by_name=issuer_name
            )
            print(f"[DEBUG] Created warning notification for user {warning_data.issued_to}")
        except Exception as e:
            print(f"[ERROR] Failed to create notification: {e}")
        
        return {
            "success": True,
            "message": "Warning created successfully",
            "warning_id": created_warning["id"]  # Changed from _id to id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create warning: {str(e)}")

@router.get("/user/{user_id}", response_model=WarningListResponse)
async def get_user_warnings(
    user_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    requesting_user_id: str = Query(..., description="User _id making the request", alias="user_id"),
    warnings_db: WarningDB = Depends(get_warnings_db),
    user_db: UsersDB = Depends(get_users_db),
    department_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get warnings issued to a specific user - permission-based visibility"""
    try:
        # Check user permissions
        permissions = await get_local_user_permissions(requesting_user_id)

        # Check if requesting user is super admin
        is_super_admin = any(
            is_super_admin_permission(perm)
            for perm in permissions
        )
        
        # Check if requesting user has warnings_admin permission
        has_warnings_admin = any(
            perm.get("page") == "warnings" and 
            (perm.get("actions") == "*" or 
             (isinstance(perm.get("actions"), list) and "*" in perm.get("actions", [])))
            for perm in permissions
        )
        
        # Check if requesting user has junior permission for hierarchical access
        has_view_junior = any(
            perm.get("page") == "warnings" and 
            (perm.get("actions") == "junior" or
             (isinstance(perm.get("actions"), list) and "junior" in perm.get("actions", [])))
            for perm in permissions
        )
        
        # Hierarchical permission check
        can_view_user = False
        if user_id == requesting_user_id:
            # Users can always view their own warnings
            can_view_user = True
        elif is_super_admin or has_warnings_admin:
            # Super admin and warnings admin can view any user's warnings
            can_view_user = True
        elif has_view_junior:
            # Users with junior can view subordinate warnings
            subordinate_user_ids = await get_subordinate_users_for_warnings(requesting_user_id)
            if user_id in subordinate_user_ids:
                can_view_user = True
        
        if not can_view_user:
            raise HTTPException(
                status_code=403, 
                detail="You can only view your own warnings or subordinate warnings with proper permissions."
            )
        
        # Build filter to get warnings issued to this specific user
        # Convert user_id to ObjectId for database comparison
        from bson import ObjectId
        try:
            user_object_id = ObjectId(user_id)
        except:
            user_object_id = user_id  # Fallback to string if conversion fails
            
        filter_dict = {"issued_to": user_object_id}
        
        # Get warnings
        skip = (page - 1) * per_page
        warnings = await warnings_db.get_all_warnings(filter_dict, per_page, skip)
        
        # Get total count
        total = await warnings_db.get_warning_count(filter_dict)
        
        # Format response
        warning_list = []
        for warning in warnings:
            # Extract user IDs from the warning
            issued_to_id = warning.get("issued_to")
            issued_by_id = warning.get("issued_by")
            
            # Ensure IDs are strings for user lookup
            if issued_to_id:
                issued_to_id = str(issued_to_id)
            if issued_by_id:
                issued_by_id = str(issued_by_id)
            
            # Look up user names
            issued_to_name = "Unknown"
            issued_by_name = "Unknown"
            
            if issued_to_id:
                user = await user_db.get_user(issued_to_id)
                if user:
                    first_name = user.get("first_name", "")
                    last_name = user.get("last_name", "")
                    if first_name or last_name:
                        issued_to_name = f"{first_name} {last_name}".strip()
                    else:
                        issued_to_name = user.get("name", user.get("username", "Unknown"))
            
            if issued_by_id:
                user = await user_db.get_user(issued_by_id)
                if user:
                    first_name = user.get("first_name", "")
                    last_name = user.get("last_name", "")
                    if first_name or last_name:
                        issued_by_name = f"{first_name} {last_name}".strip()
                    else:
                        issued_by_name = user.get("name", user.get("username", "Unknown"))
            
            # Get department name
            department_name = "Unknown Department"
            department_id = warning.get("department_id")
            if department_id:
                department_id = str(department_id)
                department = await department_db.get_department(department_id)
                if department:
                    department_name = department.get("name", "Unknown Department")
            
            warning_response = WarningResponse(
                id=warning["id"],
                warning_type=warning["warning_type"],
                issued_to=issued_to_id or "",
                issued_to_name=issued_to_name,
                issued_by=issued_by_id or "",
                issued_by_name=issued_by_name,
                department_id=str(warning.get("department_id")) if warning.get("department_id") else None,
                department_name=department_name,
                penalty_amount=warning["penalty_amount"],
                warning_message=warning["warning_message"],
                issued_date=warning.get("issued_date", warning["created_at"]),
                created_at=warning["created_at"],
                updated_at=warning["updated_at"]
            )
            warning_list.append(warning_response)
        
        total_pages = (total + per_page - 1) // per_page
        
        return WarningListResponse(
            warnings=warning_list,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
            stats=WarningStats(
                total_warnings=total,
                most_frequent_warning_type="N/A",
                most_frequent_warning_count=0,
                total_penalties=sum(w.penalty_amount for w in warning_list),
                employee_with_most_warnings="N/A",
                employee_with_most_warnings_count=0
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user warnings: {str(e)}")

@router.get("/", response_model=WarningListResponse)
async def get_warnings(
    department_id: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    warning_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    user_id: str = Query(..., description="User _id making the request"),
    my_warnings: Optional[bool] = Query(False, description="Filter to show only warnings issued to the requesting user"),
    warnings_db: WarningDB = Depends(get_warnings_db),
    user_db: UsersDB = Depends(get_users_db),
    department_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get warnings with filtering and pagination - permission-based visibility"""
    try:
        # Get hierarchical permissions for warnings
        permissions = await get_hierarchical_permissions(user_id, "warnings")
        permission_level = permissions["permission_level"]
        
        # Build filter based on hierarchical permissions
        filter_dict = {}
        
        # Convert user_id to ObjectId for database comparison
        from bson import ObjectId
        try:
            user_object_id = ObjectId(user_id)
        except:
            user_object_id = user_id  # Fallback to string if conversion fails
        
        # Apply permission-based filtering
        if permission_level == "all":
            # Users with "all" permission can see all warnings
            pass  # No filter restriction
        elif permission_level == "junior":
            # Users with "junior" permission can see their own warnings + subordinate warnings
            subordinate_user_ids = await get_subordinate_users_for_warnings(user_id)
            
            # Include user's own warnings and subordinate warnings
            allowed_user_ids = [user_object_id] + subordinate_user_ids
            
            # Convert string IDs to ObjectIds for subordinates
            allowed_object_ids = []
            for uid in allowed_user_ids:
                try:
                    if isinstance(uid, str):
                        allowed_object_ids.append(ObjectId(uid))
                    else:
                        allowed_object_ids.append(uid)
                except:
                    allowed_object_ids.append(uid)
            
            filter_dict["issued_to"] = {"$in": allowed_object_ids}
        else:  # permission_level == "own"
            # Users with "own" permission can only see their own warnings
            filter_dict["issued_to"] = user_object_id
        
        # Special case: if my_warnings is True, always show warnings issued to the requesting user only
        if my_warnings:
            filter_dict["issued_to"] = user_object_id
        
        # Apply additional filters
        if department_id:
            filter_dict["department_id"] = department_id
        if employee_id and not my_warnings:
            # Only allow filtering by other employees if user has "all" or "junior" permissions
            if permission_level in ["all", "junior"]:
                # Convert employee_id to ObjectId for database comparison
                try:
                    employee_object_id = ObjectId(employee_id)
                except:
                    employee_object_id = employee_id  # Fallback to string if conversion fails
                
                # If we already have issued_to filter from permission logic, we need to intersect
                existing_issued_to = filter_dict.get("issued_to")
                if existing_issued_to:
                    # If we have hierarchical permissions, check if requested employee_id is in allowed list
                    if isinstance(existing_issued_to, dict) and "$in" in existing_issued_to:
                        # Check if the requested employee is in the allowed list
                        if employee_object_id in existing_issued_to["$in"]:
                            filter_dict["issued_to"] = employee_object_id
                        # If not in allowed list, keep the existing filter (ignore the employee_id request)
                    else:
                        # Simple case: only replace if it's the same user or admin
                        if existing_issued_to == employee_object_id or permission_level == "all":
                            filter_dict["issued_to"] = employee_object_id
                else:
                    # No existing filter, safe to add
                    filter_dict["issued_to"] = employee_object_id
        if warning_type:
            filter_dict["warning_type"] = warning_type
        if start_date:
            filter_dict["start_date"] = start_date
        if end_date:
            filter_dict["end_date"] = end_date
        
        # Get warnings
        skip = (page - 1) * per_page
        warnings = await warnings_db.get_all_warnings(filter_dict, per_page, skip)
        
        # Get total count
        total = await warnings_db.get_warning_count(filter_dict)
        
        # Get statistics
        stats = await warnings_db.get_warning_statistics(filter_dict)
        
        # Get employee name for the employee with most warnings
        employee_with_most_warnings_name = None
        if stats.get("employee_with_most_warnings_id"):
            employee = await user_db.get_user(stats["employee_with_most_warnings_id"])
            if employee:
                # Construct employee name from first_name and last_name
                first_name = employee.get("first_name", "").strip()
                last_name = employee.get("last_name", "").strip()
                
                if first_name and last_name:
                    employee_with_most_warnings_name = f"{first_name} {last_name}"
                elif first_name:
                    employee_with_most_warnings_name = first_name
                elif last_name:
                    employee_with_most_warnings_name = last_name
                else:
                    # Fallback to username if no name fields available
                    employee_with_most_warnings_name = employee.get("username", "Unknown")
        
        # Format stats for response
        formatted_stats = {
            "total_warnings": stats.get("total_warnings", 0),
            "most_frequent_warning_type": stats.get("most_frequent_warning_type", "None"),
            "most_frequent_warning_count": stats.get("most_frequent_warning_count", 0),
            "total_penalties": stats.get("total_penalties", 0),
            "employee_with_most_warnings": employee_with_most_warnings_name,
            "employee_with_most_warnings_count": stats.get("employee_with_most_warnings_count", 0)
        }
        
        # Format response
        warning_list = []
        for warning in warnings:
            # Extract user IDs from the warning - they should be strings after conversion
            issued_to_id = warning.get("issued_to")
            issued_by_id = warning.get("issued_by")
            
            # Ensure IDs are strings for user lookup
            if issued_to_id:
                issued_to_id = str(issued_to_id)
            if issued_by_id:
                issued_by_id = str(issued_by_id)
            
            # Look up user names
            issued_to_name = "Unknown"
            issued_by_name = "Unknown"
            
            if issued_to_id:
                user = await user_db.get_user(issued_to_id)
                if user:
                    # Construct full name from first_name and last_name
                    first_name = user.get("first_name", "")
                    last_name = user.get("last_name", "")
                    if first_name or last_name:
                        issued_to_name = f"{first_name} {last_name}".strip()
                    else:
                        # Fallback to name or username if first/last names not available
                        issued_to_name = user.get("name", user.get("username", "Unknown"))
                else:
                    # User not found for issued_to_id
                    pass
            
            if issued_by_id:
                user = await user_db.get_user(issued_by_id)
                if user:
                    # Construct full name from first_name and last_name
                    first_name = user.get("first_name", "")
                    last_name = user.get("last_name", "")
                    if first_name or last_name:
                        issued_by_name = f"{first_name} {last_name}".strip()
                    else:
                        # Fallback to name or username if first/last names not available
                        issued_by_name = user.get("name", user.get("username", "Unknown"))
                else:
                    # User not found for issued_by_id
                    pass
            
            # Get department name
            department_name = "Unknown Department"
            department_id = warning.get("department_id")
            if department_id:
                department_id = str(department_id)
                department = await department_db.get_department(department_id)
                if department:
                    department_name = department.get("name", "Unknown Department")
            
            warning_response = WarningResponse(
                id=warning["id"],
                warning_type=warning["warning_type"],
                issued_to=issued_to_id or "",
                issued_to_name=issued_to_name,
                issued_by=issued_by_id or "",
                issued_by_name=issued_by_name,
                department_id=str(warning.get("department_id")) if warning.get("department_id") else None,
                department_name=department_name,
                penalty_amount=warning["penalty_amount"],
                warning_message=warning["warning_message"],
                issued_date=warning.get("issued_date", warning["created_at"]),
                created_at=warning["created_at"],
                updated_at=warning["updated_at"]
            )
            warning_list.append(warning_response)
        
        total_pages = (total + per_page - 1) // per_page
        
        return WarningListResponse(
            warnings=warning_list,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
            stats=WarningStats(**formatted_stats)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get warnings: {str(e)}")

@router.get("/{warning_id}", response_model=WarningResponse)
async def get_warning(
    warning_id: str,
    user_id: str = Query(..., description="User _id making the request"),
    warnings_db: WarningDB = Depends(get_warnings_db),
    user_db: UsersDB = Depends(get_users_db),
    department_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get a specific warning by ID"""
    try:
        permissions = await get_user_warning_permissions(user_id)
        
        warning = await warnings_db.get_warning_by_id(warning_id)
        if not warning:
            raise HTTPException(status_code=404, detail="Warning not found")
        
        # Check permissions
        if not permissions.can_view_all and warning["issued_to"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this warning")
        
        # Get user names with first_name and last_name
        issued_to_name = "Unknown"
        issued_by_name = "Unknown"
        
        issued_to_user = await user_db.get_user(warning["issued_to"])
        if issued_to_user:
            first_name = issued_to_user.get("first_name", "")
            last_name = issued_to_user.get("last_name", "")
            if first_name or last_name:
                issued_to_name = f"{first_name} {last_name}".strip()
            else:
                issued_to_name = issued_to_user.get("name", issued_to_user.get("username", "Unknown"))
        
        issued_by_user = await user_db.get_user(warning["issued_by"])
        if issued_by_user:
            first_name = issued_by_user.get("first_name", "")
            last_name = issued_by_user.get("last_name", "")
            if first_name or last_name:
                issued_by_name = f"{first_name} {last_name}".strip()
            else:
                issued_by_name = issued_by_user.get("name", issued_by_user.get("username", "Unknown"))
        
        # Get department name
        department_name = "Unknown Department"
        if warning.get("department_id"):
            department = await department_db.get_department(warning["department_id"])
            if department:
                department_name = department["name"]
        
        return WarningResponse(
            id=warning["id"],
            warning_type=warning["warning_type"],
            issued_to=warning["issued_to"],
            issued_to_name=issued_to_name,
            issued_by=warning["issued_by"],
            issued_by_name=issued_by_name,
            department_id=warning.get("department_id"),
            department_name=department_name,
            penalty_amount=warning["penalty_amount"],
            warning_message=warning["warning_message"],
            issued_date=warning.get("issued_date", warning["created_at"]),  # Use created_at as fallback
            created_at=warning["created_at"],
            updated_at=warning["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get warning: {str(e)}")

@router.put("/{warning_id}", response_model=dict)
async def update_warning(
    warning_id: str,
    warning_data: WarningUpdate,
    user_id: str = Query(..., description="User _id making the request"),
    warnings_db: WarningDB = Depends(get_warnings_db)
):
    """Update a warning"""
    try:
        permissions = await get_user_warning_permissions(user_id)
        if not permissions.can_edit:
            raise HTTPException(status_code=403, detail="Not authorized to edit warnings")
        
        # Get existing warning
        existing_warning = await warnings_db.get_warning_by_id(warning_id)
        if not existing_warning:
            raise HTTPException(status_code=404, detail="Warning not found")
        
        # Prepare update data
        update_data = {}
        if warning_data.warning_type is not None:
            update_data["warning_type"] = warning_data.warning_type.value
        if warning_data.penalty_amount is not None:
            update_data["penalty_amount"] = warning_data.penalty_amount
        if warning_data.warning_message is not None:
            update_data["warning_message"] = warning_data.warning_message
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No data provided for update")
        
        # Update warning
        success = await warnings_db.update_warning(warning_id, update_data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update warning")
        
        return {
            "success": True,
            "message": "Warning updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update warning: {str(e)}")

@router.delete("/{warning_id}", response_model=dict)
async def delete_warning(
    warning_id: str,
    user_id: str = Query(..., description="User _id making the request"),
    warnings_db: WarningDB = Depends(get_warnings_db)
):
    """Delete a warning"""
    try:
        permissions = await get_user_warning_permissions(user_id)
        if not permissions.can_delete:
            raise HTTPException(status_code=403, detail="Not authorized to delete warnings")
        
        # Check if warning exists
        warning = await warnings_db.get_warning_by_id(warning_id)
        if not warning:
            raise HTTPException(status_code=404, detail="Warning not found")
        
        # Delete warning
        success = await warnings_db.delete_warning(warning_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete warning")
        
        return {
            "success": True,
            "message": "Warning deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete warning: {str(e)}")

@router.get("/stats/summary")
async def get_warning_statistics(
    department_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user_id: str = Query(..., description="User _id making the request"),
    warnings_db: WarningDB = Depends(get_warnings_db),
    user_db: UsersDB = Depends(get_users_db)
):
    """Get warning statistics"""
    try:
        permissions = await get_user_warning_permissions(user_id)
        
        # Allow if user has view permission OR if user is super admin OR if user exists
        user = await user_db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=403, detail="User not found")
            
        # Check if user has warning view permission or is super admin
        if not permissions.can_view_all:
            # Allow if user exists but check if they have general permissions
            user_permissions = await get_local_user_permissions(user_id)
            is_super_admin = any(
                is_super_admin_permission(perm)
                for perm in user_permissions
            )
            
            if not is_super_admin:
                raise HTTPException(status_code=403, detail="Not authorized to view statistics")
        
        filter_dict = {}
        if department_id:
            filter_dict["department_id"] = department_id
        if start_date:
            filter_dict["start_date"] = start_date
        if end_date:
            filter_dict["end_date"] = end_date
        
        stats = await warnings_db.get_warning_statistics(filter_dict)
        
        # Get employee name for the employee with most warnings
        employee_with_most_warnings_name = None
        if stats.get("employee_with_most_warnings_id"):
            employee = await user_db.get_user(stats["employee_with_most_warnings_id"])
            if employee:
                employee_with_most_warnings_name = employee.get("name", "Unknown")
        
        # Format stats for response
        formatted_stats = {
            "total_warnings": stats.get("total_warnings", 0),
            "most_frequent_warning_type": stats.get("most_frequent_warning_type", "None"),
            "most_frequent_warning_count": stats.get("most_frequent_warning_count", 0),
            "total_penalties": stats.get("total_penalties", 0),
            "employee_with_most_warnings": employee_with_most_warnings_name,
            "employee_with_most_warnings_count": stats.get("employee_with_most_warnings_count", 0)
        }
        
        return {
            "success": True,
            "stats": WarningStats(**formatted_stats)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")

@router.get("/ranking/employees", response_model=WarningRankingResponse)
async def get_employee_warning_ranking(
    department_id: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    user_id: str = Query(..., description="User _id making the request"),
    warnings_db: WarningDB = Depends(get_warnings_db),
    user_db: UsersDB = Depends(get_users_db),
    department_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get employee warning ranking with permission-based filtering"""
    try:
        # Get user permissions
        permissions = await get_user_warning_permissions(user_id)
        user_permissions = await get_local_user_permissions(user_id)
        
        # Check if user is super admin
        is_super_admin = any(
            is_super_admin_permission(perm)
            for perm in user_permissions
        )
        
        # Check if user has warnings_admin permission
        has_warnings_admin = permissions.can_view_all
        
        # Check if requesting user has junior permission for hierarchical access
        has_view_junior = any(
            perm.get("page") == "warnings" and 
            (perm.get("actions") == "junior" or
             (isinstance(perm.get("actions"), list) and "junior" in perm.get("actions", [])))
            for perm in user_permissions
        )
        
        # Apply permission-based filtering
        filter_dict = {}
        if department_id:
            filter_dict["department_id"] = department_id
            
        # Apply hierarchical permission filtering
        if is_super_admin or has_warnings_admin:
            # Super admin and warnings admin can see all rankings - no additional filter needed
            pass
        elif has_view_junior:
            # Users with junior can see their own + subordinate rankings
            subordinate_user_ids = await get_subordinate_users_for_warnings(user_id)
            allowed_user_ids = [user_id] + subordinate_user_ids
            
            # Convert to ObjectIds for database query
            from bson import ObjectId
            allowed_object_ids = [ObjectId(uid) for uid in allowed_user_ids if ObjectId.is_valid(uid)]
            filter_dict["employee_id"] = {"$in": allowed_object_ids}
        else:
            # Regular users can only see their own ranking
            from bson import ObjectId
            try:
                user_object_id = ObjectId(user_id)
            except:
                user_object_id = user_id  # Fallback to string if conversion fails
                
            filter_dict["employee_id"] = user_object_id  # Only show this user's ranking
            limit = 1  # Only need to return one ranking
        
        rankings = await warnings_db.get_employee_warning_ranking(limit, filter_dict)
        
        # Format rankings with user and department names
        formatted_rankings = []
        for i, ranking in enumerate(rankings):
            employee_id = str(ranking["employee_id"])
            user = await user_db.get_user(employee_id)
            department_name = "Unknown Department"
            
            # Construct employee name from first_name and last_name
            employee_name = "Unknown"
            if user:
                first_name = user.get("first_name", "").strip()
                last_name = user.get("last_name", "").strip()
                
                if first_name and last_name:
                    employee_name = f"{first_name} {last_name}"
                elif first_name:
                    employee_name = first_name
                elif last_name:
                    employee_name = last_name
                else:
                    # Fallback to username if no name fields available
                    employee_name = user.get("username", "Unknown")
            
            if user and user.get("department_id"):
                department_id = str(user["department_id"])
                department = await department_db.get_department(department_id)
                if department:
                    department_name = department.get("name", "Unknown Department")
            
            formatted_ranking = WarningRanking(
                rank=i + 1,
                employee_id=employee_id,
                employee_name=employee_name,
                department_name=department_name,
                total_warnings=ranking["total_warnings"],
                total_penalty=ranking["total_penalty"]
            )
            formatted_rankings.append(formatted_ranking)
        
        return WarningRankingResponse(rankings=formatted_rankings)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get rankings: {str(e)}")

@router.post("/check-duplicate", response_model=DuplicateWarningResponse)
async def check_duplicate_warning(
    employee_id: str = Query(...),
    warning_type: str = Query(...),
    user_id: str = Query(..., description="User _id making the request"),
    warnings_db: WarningDB = Depends(get_warnings_db),
    user_db: UsersDB = Depends(get_users_db),
    department_db: DepartmentsDB = Depends(get_departments_db)
):
    """Check if a duplicate warning exists for an employee"""
    try:
        permissions = await get_user_warning_permissions(user_id)
        if not permissions.can_add:
            raise HTTPException(status_code=403, detail="Not authorized to check duplicates")
        
        duplicate_check = await warnings_db.check_duplicate_warning(employee_id, warning_type)
        
        if duplicate_check["has_duplicate"]:
            existing_warning = duplicate_check["existing_warning"]
            
            # Get user names for the existing warning - convert ObjectId to string if needed
            issued_to_id = str(existing_warning["issued_to"]) if existing_warning["issued_to"] else None
            issued_by_id = str(existing_warning["issued_by"]) if existing_warning["issued_by"] else None
            
            # Construct user names from first_name and last_name
            issued_to_name = "Unknown"
            issued_by_name = "Unknown"
            
            if issued_to_id:
                issued_to_user = await user_db.get_user(issued_to_id)
                if issued_to_user:
                    first_name = issued_to_user.get("first_name", "")
                    last_name = issued_to_user.get("last_name", "")
                    if first_name or last_name:
                        issued_to_name = f"{first_name} {last_name}".strip()
                    else:
                        issued_to_name = issued_to_user.get("name", issued_to_user.get("username", "Unknown"))
            
            if issued_by_id:
                issued_by_user = await user_db.get_user(issued_by_id)
                if issued_by_user:
                    first_name = issued_by_user.get("first_name", "")
                    last_name = issued_by_user.get("last_name", "")
                    if first_name or last_name:
                        issued_by_name = f"{first_name} {last_name}".strip()
                    else:
                        issued_by_name = issued_by_user.get("name", issued_by_user.get("username", "Unknown"))
            
            # Get department name - convert ObjectId to string if needed
            department_name = "Unknown Department"
            if existing_warning.get("department_id"):
                department_id = str(existing_warning["department_id"])
                department = await department_db.get_department(department_id)
                if department:
                    department_name = department.get("name", "Unknown Department")
            
            warning_response = WarningResponse(
                id=existing_warning["id"],  # Use id instead of _id
                warning_type=existing_warning["warning_type"],
                issued_to=issued_to_id,
                issued_to_name=issued_to_user.get("name", "Unknown") if issued_to_user else "Unknown",
                issued_by=issued_by_id,
                issued_by_name=issued_by_user.get("name", "Unknown") if issued_by_user else "Unknown",
                department_id=str(existing_warning["department_id"]) if existing_warning.get("department_id") else None,
                department_name=department_name,
                penalty_amount=existing_warning["penalty_amount"],
                warning_message=existing_warning["warning_message"],
                issued_date=existing_warning.get("issued_date", existing_warning["created_at"]),  # Use created_at as fallback
                created_at=existing_warning["created_at"],
                updated_at=existing_warning["updated_at"]
            )
            
            return DuplicateWarningResponse(
                has_duplicate=True,
                existing_warning=warning_response,
                message=f"Employee already has a {warning_type} warning today."
            )
        else:
            return DuplicateWarningResponse(
                has_duplicate=False,
                existing_warning=None,
                message="No duplicate warning found."
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check duplicate: {str(e)}")

@router.get("/similar-warnings/{employee_id}/{warning_type}")
async def get_similar_warnings(
    employee_id: str,
    warning_type: str,
    user_id: str = Query(..., description="User _id making the request"),
    warnings_db: WarningDB = Depends(get_warnings_db),
    user_db: UsersDB = Depends(get_users_db),
    department_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get all warnings for the same employee with the same warning type"""
    try:
        permissions = await get_user_warning_permissions(user_id)
        if not permissions.can_view_all and not permissions.can_view_own:
            raise HTTPException(status_code=403, detail="Not authorized to view warnings")
        
        # Get all warnings for this employee with this warning type
        warnings_list = await warnings_db.get_warnings_by_employee_and_type(employee_id, warning_type)
        
        # Process warnings to add user and department names
        processed_warnings = []
        for warning in warnings_list:
            # Get user names
            issued_to_id = str(warning["issued_to"]) if warning["issued_to"] else None
            issued_by_id = str(warning["issued_by"]) if warning["issued_by"] else None
            
            issued_to_name = "Unknown"
            issued_by_name = "Unknown"
            
            if issued_to_id:
                issued_to_user = await user_db.get_user(issued_to_id)
                if issued_to_user:
                    first_name = issued_to_user.get("first_name", "")
                    last_name = issued_to_user.get("last_name", "")
                    if first_name or last_name:
                        issued_to_name = f"{first_name} {last_name}".strip()
                    else:
                        issued_to_name = issued_to_user.get("name", issued_to_user.get("username", "Unknown"))
            
            if issued_by_id:
                issued_by_user = await user_db.get_user(issued_by_id)
                if issued_by_user:
                    first_name = issued_by_user.get("first_name", "")
                    last_name = issued_by_user.get("last_name", "")
                    if first_name or last_name:
                        issued_by_name = f"{first_name} {last_name}".strip()
                    else:
                        issued_by_name = issued_by_user.get("name", issued_by_user.get("username", "Unknown"))
            
            # Get department name
            department_name = "Unknown Department"
            if warning.get("department_id"):
                department_id = str(warning["department_id"])
                department = await department_db.get_department(department_id)
                if department:
                    department_name = department.get("name", "Unknown Department")
            
            processed_warning = {
                "id": warning["id"],
                "warning_type": warning["warning_type"],
                "issued_to": issued_to_id,
                "issued_to_name": issued_to_name,
                "issued_by": issued_by_id,
                "issued_by_name": issued_by_name,
                "department_id": str(warning["department_id"]) if warning.get("department_id") else None,
                "department_name": department_name,
                "penalty_amount": warning["penalty_amount"],
                "warning_message": warning.get("warning_message", ""),
                "issued_date": warning["created_at"],
                "created_at": warning["created_at"],
                "updated_at": warning.get("updated_at")
            }
            processed_warnings.append(processed_warning)
        
        return {
            "success": True,
            "warnings": processed_warnings,
            "total": len(processed_warnings),
            "message": f"Found {len(processed_warnings)} warnings for {warning_type}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get similar warnings: {str(e)}")

@router.get("/export/csv")
async def export_warnings_csv(
    department_id: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    warning_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user_id: str = Query(..., description="User _id making the request"),
    warnings_db: WarningDB = Depends(get_warnings_db),
    user_db: UsersDB = Depends(get_users_db),
    department_db: DepartmentsDB = Depends(get_departments_db)
):
    """Export warnings to CSV"""
    try:
        permissions = await get_user_warning_permissions(user_id)
        
        # Allow if user has export permission OR is super admin
        user = await user_db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=403, detail="User not found")
            
        if not permissions.can_export:
            # Check if user is super admin
            user_permissions = await get_local_user_permissions(user_id)
            is_super_admin = any(
                is_super_admin_permission(perm)
                for perm in user_permissions
            )
            
            if not is_super_admin:
                raise HTTPException(status_code=403, detail="Not authorized to export warnings")
        
        filter_dict = {}
        if department_id:
            filter_dict["department_id"] = department_id
        if employee_id:
            filter_dict["issued_to"] = employee_id
        if warning_type:
            filter_dict["warning_type"] = warning_type
        if start_date:
            filter_dict["start_date"] = start_date
        if end_date:
            filter_dict["end_date"] = end_date
        
        csv_data = await warnings_db.export_warnings_csv(filter_dict)
        
        # Enhance CSV data with employee and department names
        enhanced_csv_data = []
        for row in csv_data:
            # Create enhanced row with better column order
            enhanced_row = {}
            
            # Basic warning info
            enhanced_row['Warning ID'] = row.get('Warning ID', '')
            enhanced_row['Warning Type'] = row.get('Warning Type', '')
            enhanced_row['Warning Message'] = row.get('Warning Message', '')
            enhanced_row['Penalty Amount'] = row.get('Penalty Amount', 0)
            
            # Employee information
            enhanced_row['Employee ID'] = row.get('Employee ID', '')
            if row.get('Employee ID'):
                employee = await user_db.get_user(row['Employee ID'])
                if employee:
                    first_name = employee.get("first_name", "").strip()
                    last_name = employee.get("last_name", "").strip()
                    
                    if first_name and last_name:
                        enhanced_row['Employee Name'] = f"{first_name} {last_name}"
                    elif first_name:
                        enhanced_row['Employee Name'] = first_name
                    elif last_name:
                        enhanced_row['Employee Name'] = last_name
                    else:
                        enhanced_row['Employee Name'] = employee.get("username", "Unknown")
                else:
                    enhanced_row['Employee Name'] = "Unknown"
            else:
                enhanced_row['Employee Name'] = "Unknown"
            
            # Department information
            enhanced_row['Department ID'] = row.get('Department ID', '')
            if row.get('Department ID'):
                department = await department_db.get_department(row['Department ID'])
                if department:
                    enhanced_row['Department Name'] = department.get("name", "Unknown Department")
                else:
                    enhanced_row['Department Name'] = "Unknown Department"
            else:
                enhanced_row['Department Name'] = "Unknown Department"
            
            # Issued by information
            enhanced_row['Issued By ID'] = row.get('Issued By ID', '')
            if row.get('Issued By ID'):
                issued_by = await user_db.get_user(row['Issued By ID'])
                if issued_by:
                    first_name = issued_by.get("first_name", "").strip()
                    last_name = issued_by.get("last_name", "").strip()
                    
                    if first_name and last_name:
                        enhanced_row['Issued By Name'] = f"{first_name} {last_name}"
                    elif first_name:
                        enhanced_row['Issued By Name'] = first_name
                    elif last_name:
                        enhanced_row['Issued By Name'] = last_name
                    else:
                        enhanced_row['Issued By Name'] = issued_by.get("username", "Unknown")
                else:
                    enhanced_row['Issued By Name'] = "Unknown"
            else:
                enhanced_row['Issued By Name'] = "Unknown"
            
            # Date information
            enhanced_row['Issued Date'] = row.get('Issued Date', '')
            enhanced_row['Created At'] = row.get('Created At', '')
            enhanced_row['Updated At'] = row.get('Updated At', '')
            
            enhanced_csv_data.append(enhanced_row)
        
        return {
            "success": True,
            "csv_data": enhanced_csv_data,
            "total_records": len(enhanced_csv_data),
            "message": "Warnings exported successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export warnings: {str(e)}")

# Additional utility endpoints

@router.get("/types/list")
async def get_warning_types():
    """Get list of available warning types"""
    try:
        warning_types = [
            {"value": "Late Arrival", "label": "Late Arrival"},
            {"value": "Late Lunch", "label": "Late Lunch"},
            {"value": "Abuse", "label": "Abuse"},
            {"value": "Early Leave", "label": "Early Leave"}
        ]
        
        return {
            "success": True,
            "warning_types": warning_types
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get warning types: {str(e)}")

@router.get("/employees/list")
async def get_employees_for_warnings(
    department_id: Optional[str] = Query(None),
    user_id: str = Query(..., description="User _id making the request"),
    user_db: UsersDB = Depends(get_users_db),
    department_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get list of employees for warning assignment"""
    try:
        # permissions = get_user_warning_permissions(user_id)
        
        # # Allow if user has add permission OR if user is super admin OR if no specific permissions but user exists
        # user = await user_db.get_user(user_id)
        # if not user:
        #     raise HTTPException(status_code=403, detail="User not found")
            
        # # Check if user has warning add permission or is super admin
        # if not permissions.can_add:
        #     # Allow if user exists but check if they have general permissions
        #     user_permissions = get_local_user_permissions(user_id)
        #     is_super_admin = any(
        #         is_super_admin_permission(perm)
        #         for perm in user_permissions
        #     )
            
            # if not is_super_admin:
            #     raise HTTPException(status_code=403, detail="Not authorized to access employee list")
        
        # Get all users (employees) - use list_users to get all users
        users = await user_db.list_users()
        
        # Alternative: try get_employees first and fallback to list_users if empty
        employees_only = await user_db.get_employees()
        
        # Use all users if no employees found with the flag
        users_to_process = employees_only if employees_only else users
        
        if not users_to_process:
            return {
                "success": True,
                "employees": []
            }
        
        employees = []
        for user in users_to_process:
            # Filter by department if specified
            if department_id and user.get("department_id") != department_id:
                continue
            
            # Construct full name from first_name and last_name
            first_name = user.get("first_name", "").strip()
            last_name = user.get("last_name", "").strip()
            
            if first_name and last_name:
                full_name = f"{first_name} {last_name}"
            elif first_name:
                full_name = first_name
            elif last_name:
                full_name = last_name
            else:
                # Fallback to username if no name fields available
                full_name = user.get("username", "Unknown")
            
            # Get department name - convert ObjectId to string if needed
            department_name = "Unknown Department"
            if user.get("department_id"):
                try:
                    department_id_str = str(user["department_id"])
                    department = await department_db.get_department(department_id_str)
                    if department:
                        department_name = department.get("name", "Unknown Department")
                except Exception as e:
                    # Handle any ObjectId conversion errors
                    pass
            
            employees.append({
                "id": str(user["_id"]),
                "name": full_name,
                "email": user.get("email", ""),
                "department_id": str(user["department_id"]) if user.get("department_id") else None,
                "department_name": department_name
            })
        
        return {
            "success": True,
            "employees": employees
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get employees: {str(e)}")