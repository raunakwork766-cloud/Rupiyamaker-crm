from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Dict, Any, Optional
from app.database.Roles import RolesDB
from app.database.Users import UsersDB
from app.database.Departments import DepartmentsDB
from app.database import get_database_instances
from app.schemas.role_schemas import (
    RoleBase, RoleCreate, RoleUpdate, RoleInDB, RoleWithReports, RoleResponse,
    PermissionConfig, PermissionCheck
)
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission as verify_permission

router = APIRouter(
    prefix="/roles",
    tags=["roles"]
)

async def get_hierarchical_permissions(user_id: str, module: str = "roles") -> Dict[str, Any]:
    """Get simplified hierarchical permissions for roles module"""
    try:
        from app.utils.permission_helpers import is_super_admin_permission
        
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

# Dependency to get the DB instances
async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]
    
async def get_departments_db():
    db_instances = get_database_instances()
    return db_instances["departments"]

@router.post("/", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_role(
    role: RoleCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    roles_db: RolesDB = Depends(get_roles_db),
    users_db: UsersDB = Depends(get_users_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Create a new role"""
    # Check permissions
    await verify_permission(user_id, "settings", "show", users_db, roles_db)
    # Check if role with same name exists
    if await roles_db.get_role_by_name(role.name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role with name '{role.name}' already exists"
        )
    
    # Validate department_id if provided
    if role.department_id:
        department = await departments_db.get_department(role.department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department with ID {role.department_id} not found"
            )
    
    # Validate reporting_ids if provided (multiple reporting roles)
    if role.reporting_ids:
        for reporting_id in role.reporting_ids:
            # Check if reporting role exists
            reporting_role = await roles_db.get_role(reporting_id)
            if not reporting_role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Reporting role with ID {reporting_id} not found"
                )
            
            # Prevent circular reference - role cannot report to itself
            # This will be checked after creation as well
            
    role_id = await roles_db.create_role(role.dict())
    
    # Additional check for circular reference after creation
    if role.reporting_ids:
        for reporting_id in role.reporting_ids:
            if reporting_id == role_id:
                # Rollback - delete the created role
                await roles_db.delete_role(role_id)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A role cannot report to itself"
                )
    
    return {"id": role_id}

@router.get("/", response_model=List[RoleResponse])
async def list_roles(
    user_id: str = Query(..., description="ID of the user making the request"),
    department_id: Optional[str] = None,
    team_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    reporting_id: Optional[str] = None,
    roles_db: RolesDB = Depends(get_roles_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """List all roles with optional filtering"""
    # Check permissions
    # await verify_permission(user_id, "settings", "show", users_db, roles_db)
    
    filter_dict = {}
    if department_id:
        filter_dict["department_id"] = department_id
    if team_id:
        filter_dict["team_id"] = team_id
    if is_active is not None:
        filter_dict["is_active"] = is_active
        
    # Special handling for reporting_id filter (backward compatibility)
    # Now we support filtering by reporting_ids array
    if reporting_id:
        # None is a special case for top-level roles
        if reporting_id.lower() == "null":
            filter_dict["$or"] = [
                {"reporting_ids": {"$in": [None]}},
                {"reporting_ids": []},
                {"reporting_id": None}  # Backward compatibility
            ]
        else:
            if not ObjectIdStr.is_valid(reporting_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid reporting_id format: {reporting_id}"
                )
            # Filter roles that have this ID in their reporting_ids array
            filter_dict["$or"] = [
                {"reporting_ids": reporting_id},
                {"reporting_id": reporting_id}  # Backward compatibility
            ]
    
    roles = await roles_db.list_roles(filter_dict)
    
    # Convert to response format ensuring all fields are present
    response_roles = []
    for role in roles:
        # Convert ObjectId to string
        role_dict = convert_object_id(role)
        
        # Handle backward compatibility - convert reporting_id to reporting_ids
        reporting_ids = role_dict.get("reporting_ids", [])
        if not reporting_ids and role_dict.get("reporting_id"):
            reporting_ids = [role_dict.get("reporting_id")]
        
        # Create response object with all fields explicitly set
        role_response = {
            "id": str(role_dict.get("_id", role_dict.get("id", ""))),
            "name": role_dict.get("name", ""),
            "description": role_dict.get("description"),
            "department_id": role_dict.get("department_id"),
            "team_id": role_dict.get("team_id"),
            "reporting_ids": reporting_ids,  # Now returns array of role IDs this role reports to
            "is_active": role_dict.get("is_active", True),
            "permissions": role_dict.get("permissions", []),
            "created_at": role_dict.get("created_at"),
            "updated_at": role_dict.get("updated_at")
        }
        response_roles.append(role_response)
    
    return response_roles

@router.get("/hierarchy", response_model=List[RoleWithReports])
async def get_role_hierarchy(
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all roles in hierarchical structure"""
    return await roles_db.get_role_hierarchy()

@router.get("/{role_id}", response_model=RoleInDB)
async def get_role(
    role_id: ObjectIdStr, 
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a specific role by ID"""
    role = await roles_db.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID {role_id} not found"
        )
    return convert_object_id(role)

@router.get("/{role_id}/direct-reports", response_model=List[RoleInDB])
async def get_direct_reports(
    role_id: ObjectIdStr, 
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all roles that directly report to this role"""
    # Validate role exists
    role = await roles_db.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID {role_id} not found"
        )
        
    direct_reports = await roles_db.get_direct_reports(role_id)
    return [convert_object_id(r) for r in direct_reports]

@router.get("/{role_id}/all-subordinates", response_model=List[RoleInDB])
async def get_all_subordinate_roles(
    role_id: ObjectIdStr, 
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all roles that report to this role at any level (recursive)"""
    # Validate role exists
    role = await roles_db.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID {role_id} not found"
        )
        
    subordinates = await roles_db.get_all_subordinate_roles(role_id)
    return [convert_object_id(r) for r in subordinates]

@router.get("/{role_id}/reporting-chain", response_model=List[RoleInDB])
async def get_reporting_chain(
    role_id: ObjectIdStr, 
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get the chain of roles this role reports to (up the hierarchy)"""
    # Validate role exists
    role = await roles_db.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID {role_id} not found"
        )
        
    chain = await roles_db.get_reporting_chain(role_id)
    return [convert_object_id(r) for r in chain]

@router.put("/{role_id}", response_model=Dict[str, str])
async def update_role(
    role_id: ObjectIdStr, 
    role_update: RoleUpdate,
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Update an existing role"""
    # Check if role exists
    existing_role = await roles_db.get_role(role_id)
    if not existing_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID {role_id} not found"
        )
        
    # Filter out None values
    update_data = {k: v for k, v in role_update.dict().items() if v is not None}
    
    # If name is being updated, check for duplication
    if "name" in update_data and update_data["name"] != existing_role["name"]:
        if await roles_db.get_role_by_name(update_data["name"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role with name '{update_data['name']}' already exists"
            )
    
    # If department_id is being updated, validate it
    if "department_id" in update_data and update_data["department_id"] != existing_role.get("department_id"):
        if update_data["department_id"] is not None:
            dept = await departments_db.get_department(update_data["department_id"])
            if not dept:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Department with ID {update_data['department_id']} not found"
                )

    # If reporting_ids is being updated, validate them (multiple reporting roles)
    if "reporting_ids" in update_data:
        reporting_ids = update_data["reporting_ids"]
        if reporting_ids:  # If not empty array
            for reporting_id in reporting_ids:
                # Check for circular reference - role cannot report to itself
                if reporting_id == str(existing_role["_id"]):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="A role cannot report to itself"
                    )
                
                # Validate that reporting role exists
                reporting_role = await roles_db.get_role(reporting_id)
                if not reporting_role:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Reporting role with ID {reporting_id} not found"
                    )
                    
                # Check if the new manager reports to this role (would create a loop)
                reporting_chain = await roles_db.get_reporting_chain(reporting_id)
                for chain_role in reporting_chain:
                    if str(chain_role["_id"]) == str(existing_role["_id"]):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Cannot create circular reporting relationship with role '{reporting_role.get('name', 'Unknown')}'"
                        )
    
    # Update the role
    success = await roles_db.update_role(role_id, update_data)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to update role"
        )
    
    return {"message": "Role updated successfully"}

@router.delete("/{role_id}", response_model=Dict[str, str])
async def delete_role(
    role_id: ObjectIdStr, 
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a role"""
    # Check if role exists
    role = await roles_db.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID {role_id} not found"
        )
    
    # Check if any roles report to this role
    direct_reports = await roles_db.get_direct_reports(role_id)
    if direct_reports:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete role that has direct reports"
        )
    
    # Delete the role
    success = await roles_db.delete_role(role_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete role"
        )
    
    return {"message": "Role deleted successfully"}

@router.get("/config/permissions", response_model=List[PermissionConfig])
async def get_permissions_config(
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all available permissions configuration for UI rendering"""
    return await roles_db.get_permissions_config()

@router.post("/check-permission", response_model=PermissionCheck)
async def check_permission(
    role_id: ObjectIdStr,
    page: str,
    action: str,
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Check if a role has permission for a specific page and action"""
    role = await roles_db.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID {role_id} not found"
        )

    # Check permissions
    permissions = role.get("permissions", [])
    if permissions == "*":
        return PermissionCheck(allowed=True)

    for perm in permissions:
        if perm["page"] == "*" or perm["page"] == page:
            if "*" in perm["actions"]:
                return PermissionCheck(allowed=True, actions=["*"])
            elif action in perm["actions"]:
                return PermissionCheck(allowed=True, actions=perm["actions"])

    return PermissionCheck(allowed=False, actions=[])

@router.get("/users-one-level-above/{user_id}")
async def get_users_one_level_above(
    user_id: str,
    requesting_user_id: str = Query(..., description="ID of the user making the request"),
    roles_db: RolesDB = Depends(get_roles_db),
    users_db: UsersDB = Depends(get_users_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get all users from sales department and its child departments (no permission filters)"""
    # Sales department ID (hardcoded as requested)
    sales_department_id = "689df52469668ffb622b8489"
    
    # Helper function to get all users from a department recursively
    async def get_department_users_recursive(dept_id, visited=None):
        if visited is None:
            visited = set()
        
        if dept_id in visited:
            return []
        
        visited.add(dept_id)
        
        # Get users from current department
        dept_users = await users_db.list_users({"department_id": dept_id})
        users_list = list(dept_users)
        
        # Get child departments using correct field name
        child_departments = await departments_db.list_departments({"parent_id": dept_id})
        for child_dept in child_departments:
            child_dept_id = str(child_dept["_id"])
            child_users = await get_department_users_recursive(child_dept_id, visited)
            users_list.extend(child_users)
        
        return users_list
    
    # Get all users from sales department and its children
    all_sales_users = await get_department_users_recursive(sales_department_id)
    
    # Convert to result format
    result = []
    for user in all_sales_users:
        # Skip the requesting user themselves
        if str(user["_id"]) == user_id:
            continue
            
        result.append({
            "_id": str(user["_id"]),
            "name": user.get("first_name", "Unknown") + " " + user.get("last_name", "Unknown"),
            "email": user.get("email", ""),
            "designation": user.get("designation", "No Designation"),
            "role_id": user.get("role_id", ""),
            "department_id": user.get("department_id", "")
        })
    
    return result

@router.post("/migrate-reporting-ids", response_model=Dict[str, Any])
async def migrate_reporting_ids(
    user_id: str = Query(..., description="ID of the user making the request"),
    roles_db: RolesDB = Depends(get_roles_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """
    Migrate old reporting_id field to new reporting_ids array format.
    This is a one-time migration endpoint.
    Only super admins can run this.
    """
    # Check if user is super admin
    await verify_permission(user_id, "settings", "show", users_db, roles_db)
    
    # Run migration
    stats = await roles_db.migrate_reporting_id_to_ids()
    
    return {
        "message": "Migration completed",
        "stats": stats
    }
