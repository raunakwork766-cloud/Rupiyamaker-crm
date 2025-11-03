from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
from fastapi.responses import JSONResponse

from app.database.Leads import LeadsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.schemas.lead_schemas import StatusInDB, SubStatusInDB
from app.utils.common_utils import convert_object_id
from app.utils.permissions import check_permission
from app.database import get_database_instances

# Dependencies
async def get_leads_db():
    db_instances = get_database_instances()
    return db_instances["leads"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

router = APIRouter()

# ============= Status Configuration Routes =============

@router.get("/status", response_model=List[StatusInDB])
async def get_statuses(
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all lead statuses with reassignment periods"""
    # Check permission
    
    # Get all statuses
    statuses = await leads_db.list_statuses()
    
    # Convert ObjectIds to strings and ensure required fields
    result = []
    for status in statuses:
        status_dict = convert_object_id(status)
        
        # Get sub-statuses for this status
        if ObjectId.is_valid(str(status.get("_id"))):
            sub_statuses = await leads_db.list_sub_statuses(str(status.get("_id")))
            sub_statuses_list = [convert_object_id(sub) for sub in sub_statuses]
            status_dict["sub_statuses"] = sub_statuses_list
            
        # Ensure required fields
        if 'id' not in status_dict and '_id' in status_dict:
            status_dict['id'] = status_dict['_id']
            
        # Add default timestamps if not present
        now = datetime.now()
        if 'created_at' not in status_dict:
            status_dict['created_at'] = now
        
        if 'updated_at' not in status_dict:
            status_dict['updated_at'] = now
            
        # Ensure mongo_id field for Pydantic model
        status_dict['mongo_id'] = status_dict.get('_id', status_dict.get('id'))
        
        result.append(status_dict)
    
    return result

@router.put("/status/{status_id}/reassignment", response_model=Dict[str, str])
async def update_status_reassignment(
    status_id: str,
    reassignment_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update reassignment period for a status"""
    # Check permission
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    # Validate input data
    reassignment_period = reassignment_data.get("reassignment_period")
    is_manager_permission_required = reassignment_data.get("is_manager_permission_required", False)
    
    # Check if status exists
    status = await leads_db.get_status_by_id(status_id)
    if not status:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Status with ID {status_id} not found"
        )
    
    # Update status
    update_dict = {
        "reassignment_period": reassignment_period, 
        "is_manager_permission_required": is_manager_permission_required,
        "updated_at": datetime.now()
    }
    success = await leads_db.update_status(status_id, update_dict)
    
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update status reassignment period"
        )
    
    return {"message": "Status reassignment period updated successfully"}

@router.put("/sub-status/{sub_status_id}/reassignment", response_model=Dict[str, str])
async def update_sub_status_reassignment(
    sub_status_id: str,
    reassignment_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update reassignment period for a sub-status"""
    # Check permission
    await check_permission(user_id, "settings", "edit", users_db, roles_db)
    
    # Validate input data
    reassignment_period = reassignment_data.get("reassignment_period")
    is_manager_permission_required = reassignment_data.get("is_manager_permission_required", False)
    
    # Check if sub-status exists
    sub_status = await leads_db.get_sub_status(sub_status_id)
    if not sub_status:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Sub-status with ID {sub_status_id} not found"
        )
    
    # Update sub-status
    update_dict = {
        "reassignment_period": reassignment_period, 
        "is_manager_permission_required": is_manager_permission_required,
        "updated_at": datetime.now()
    }
    success = await leads_db.update_sub_status(sub_status_id, update_dict)
    
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update sub-status reassignment period"
        )
    
    return {"message": "Sub-status reassignment period updated successfully"}
