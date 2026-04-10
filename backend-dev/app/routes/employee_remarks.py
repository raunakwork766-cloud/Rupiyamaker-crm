from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime
from app.database.EmployeeRemarks import EmployeeRemarksDB
from app.database.EmployeeActivity import EmployeeActivityDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission, get_user_capabilities
from app.database import get_database_instances
from pydantic import BaseModel

router = APIRouter(
    prefix="/hrms/employees",
    tags=["Employee Remarks"]
)

# Dependency to get the DB instances
async def get_employee_remarks_db():
    db_instances = get_database_instances()
    return db_instances["employee_remarks"]

async def get_employee_activity_db():
    db_instances = get_database_instances()
    return db_instances["employee_activity"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

# Pydantic models for request/response
class EmployeeRemarkCreate(BaseModel):
    remark: str
    remark_type: Optional[str] = "general"  # general, performance, disciplinary, etc.

class EmployeeRemarkUpdate(BaseModel):
    remark: Optional[str] = None
    remark_type: Optional[str] = None

class EmployeeRemarkInDB(BaseModel):
    id: str
    employee_id: str
    remark: str
    remark_type: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

@router.post("/{employee_id}/remarks", response_model=Dict[str, str])
async def create_employee_remark(
    employee_id: str,
    remark_data: EmployeeRemarkCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    remarks_db: EmployeeRemarksDB = Depends(get_employee_remarks_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new remark for an employee"""
    try:
        # Check permission
        await check_permission(user_id, "employees", "edit", users_db, roles_db)
        
        # Verify employee exists
        employee = await users_db.get_user(employee_id)
        if not employee:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )
        
        # Get user info for the remark
        user = await users_db.get_user(user_id)
        user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}" if user else "Unknown User"
        
        # Create remark data
        remark_dict = {
            "employee_id": employee_id,
            "remark": remark_data.remark,
            "remark_type": remark_data.remark_type,
            "created_by": user_id,
            "created_by_name": user_name
        }
        
        # Create the remark
        remark_id = await remarks_db.create_remark(remark_dict)
        
        # Log activity
        activity_db.log_remark_added(employee_id, user_id, remark_data.remark)
        
        return {"message": "Remark created successfully", "id": remark_id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating remark: {str(e)}"
        )

@router.get("/{employee_id}/remarks", response_model=List[EmployeeRemarkInDB])
async def get_employee_remarks(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    limit: int = Query(100, description="Number of remarks to return"),
    offset: int = Query(0, description="Number of remarks to skip"),
    remarks_db: EmployeeRemarksDB = Depends(get_employee_remarks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all remarks for an employee"""
    try:
        # Check permission
        await check_permission(user_id, "employees", "show", users_db, roles_db)
        
        # Verify employee exists
        employee = await users_db.get_user(employee_id)
        if not employee:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )
        
        # Get remarks
        remarks = await remarks_db.get_employee_remarks(employee_id, limit, offset)
        
        # Convert to response format
        response_remarks = []
        for remark in remarks:
            response_remarks.append(EmployeeRemarkInDB(
                id=remark["_id"],
                employee_id=remark["employee_id"],
                remark=remark["remark"],
                remark_type=remark.get("remark_type", "general"),
                created_by=remark["created_by"],
                created_by_name=remark.get("created_by_name"),
                created_at=remark["created_at"],
                updated_at=remark["updated_at"]
            ))
        
        return response_remarks
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching remarks: {str(e)}"
        )

@router.put("/{employee_id}/remarks/{remark_id}", response_model=Dict[str, str])
async def update_employee_remark(
    employee_id: str,
    remark_id: str,
    remark_update: EmployeeRemarkUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    remarks_db: EmployeeRemarksDB = Depends(get_employee_remarks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update an employee remark"""
    try:
        # Check permission
        await check_permission(user_id, "employees", "edit", users_db, roles_db)
        
        # Verify remark exists
        remark = await remarks_db.get_remark_by_id(remark_id)
        if not remark:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Remark with ID {remark_id} not found"
            )
        
        # Verify remark belongs to the employee
        if remark["employee_id"] != employee_id:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Remark does not belong to the specified employee"
            )
        
        # Update remark
        update_data = remark_update.dict(exclude_unset=True)
        if update_data:
            success = await remarks_db.update_remark(remark_id, update_data)
            if not success:
                raise HTTPException(
                    status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update remark"
                )
        
        return {"message": "Remark updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating remark: {str(e)}"
        )

@router.delete("/{employee_id}/remarks/{remark_id}", response_model=Dict[str, str])
async def delete_employee_remark(
    employee_id: str,
    remark_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    remarks_db: EmployeeRemarksDB = Depends(get_employee_remarks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete an employee remark"""
    try:
        # Check permission
        await check_permission(user_id, "employees", "edit", users_db, roles_db)
        
        # Verify remark exists
        remark = await remarks_db.get_remark_by_id(remark_id)
        if not remark:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Remark with ID {remark_id} not found"
            )
        
        # Verify remark belongs to the employee
        if remark["employee_id"] != employee_id:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Remark does not belong to the specified employee"
            )
        
        # Delete remark
        success = await remarks_db.delete_remark(remark_id)
        if not success:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete remark"
            )
        
        return {"message": "Remark deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting remark: {str(e)}"
        )