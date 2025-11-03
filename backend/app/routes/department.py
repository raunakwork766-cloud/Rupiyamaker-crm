from fastapi import APIRouter, HTTPException, Depends, status as http_status, Query
from typing import List, Dict, Any, Optional
from app.database.Departments import DepartmentsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.schemas.department_schemas import (
    DepartmentBase, DepartmentCreate, DepartmentUpdate, 
    DepartmentInDB, DepartmentWithChildren
)
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission, get_user_capabilities
from app.database import get_database_instances

router = APIRouter(
    prefix="/departments",
    tags=["departments"]
)

# Dependency to get the DB instances
async def get_departments_db():
    db_instances = get_database_instances()
    return db_instances["departments"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

@router.post("/", response_model=Dict[str, str], status_code=http_status.HTTP_201_CREATED)
async def create_department(
    department: DepartmentCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    departments_db: DepartmentsDB = Depends(get_departments_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new department"""
    # Check permissions
    await check_permission(user_id, "departments", "create", users_db, roles_db)
    # Check if department with same name exists
    if await departments_db.get_department_by_name(department.name):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Department with name '{department.name}' already exists"
        )
        
    # Validate parent_id if provided
    if department.parent_id:
        parent_dept = await departments_db.get_department(department.parent_id)
        if not parent_dept:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Parent department with ID {department.parent_id} not found"
            )
        # Ensure parent_id is stored as ObjectId
        department.parent_id = str(parent_dept['_id'])
        
    dept_id = await departments_db.create_department(department.dict())
    return {"id": dept_id}

@router.get("/", response_model=List[DepartmentInDB])
async def list_departments(
    user_id: Optional[str] = Query(..., description="ID of the user making the request"),
    is_active: Optional[bool] = None,
    parent_id: Optional[str] = None,
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """List all departments with optional filtering"""
    filter_dict = {}
    if is_active is not None:
        filter_dict["is_active"] = is_active
    if parent_id is not None:
        # None is a special case for root departments
        if parent_id.lower() == "null":
            filter_dict["parent_id"] = None
        else:
            if not ObjectIdStr.is_valid(parent_id):
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid parent_id format: {parent_id}"
                )
            filter_dict["parent_id"] = ObjectIdStr(parent_id)
        
    departments = await departments_db.list_departments(filter_dict)
    return [convert_object_id(dept) for dept in departments]

@router.get("/hierarchy", response_model=List[DepartmentWithChildren])
async def get_department_hierarchy(
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get all departments in hierarchical structure"""
    return await departments_db.get_department_hierarchy()

@router.get("/{dept_id}", response_model=DepartmentInDB)
async def get_department(
    dept_id: ObjectIdStr, 
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get a specific department by ID"""
    department = await departments_db.get_department(dept_id)
    if not department:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {dept_id} not found"
        )
    return convert_object_id(department)

@router.get("/{dept_id}/children", response_model=List[DepartmentInDB])
async def get_department_children(
    dept_id: ObjectIdStr, 
    recursive: bool = False,
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """
    Get child departments of the specified department
    
    - If recursive=False (default): returns only direct children
    - If recursive=True: returns all descendants (children, grandchildren, etc.)
    """
    # Validate department exists
    department = await departments_db.get_department(dept_id)
    if not department:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {dept_id} not found"
        )
        
    if recursive:
        children = await departments_db.get_all_descendant_departments(dept_id)
    else:
        children = await departments_db.get_child_departments(dept_id)
        
    return [convert_object_id(child) for child in children]

@router.put("/{dept_id}", response_model=Dict[str, str])
async def update_department(
    dept_id: ObjectIdStr, 
    department_update: DepartmentUpdate,
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Update an existing department"""
    # Check if department exists
    existing_dept = await departments_db.get_department(dept_id)
    if not existing_dept:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {dept_id} not found"
        )
        
    # Filter out None values
    update_data = {k: v for k, v in department_update.dict().items() if v is not None}
    
    # If name is being updated, check for duplication
    if "name" in update_data and update_data["name"] != existing_dept["name"]:
        if await departments_db.get_department_by_name(update_data["name"]):
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Department with name '{update_data['name']}' already exists"
            )
    
    # If parent_id is being updated, validate it
    if "parent_id" in update_data and update_data["parent_id"] != existing_dept.get("parent_id"):
        # Check for circular reference
        if update_data["parent_id"] == str(existing_dept["_id"]):
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Department cannot be its own parent"
            )
            
        # Check if parent exists
        if update_data["parent_id"] is not None:
            parent_dept = await departments_db.get_department(update_data["parent_id"])
            if not parent_dept:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=f"Parent department with ID {update_data['parent_id']} not found"
                )
    
    # Update the department
    success = await departments_db.update_department(dept_id, update_data)
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to update department"
        )
    
    return {"message": "Department updated successfully"}

@router.delete("/{dept_id}", response_model=Dict[str, str])
async def delete_department(
    dept_id: ObjectIdStr, 
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Delete a department"""
    # Check if department exists
    department = await departments_db.get_department(dept_id)
    if not department:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {dept_id} not found"
        )
    
    # Check if department has children
    children = await departments_db.get_child_departments(dept_id)
    if children:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete department that has child departments"
        )
    
    # Delete the department
    success = await departments_db.delete_department(dept_id)
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete department"
        )
    
    return {"message": "Department deleted successfully"}