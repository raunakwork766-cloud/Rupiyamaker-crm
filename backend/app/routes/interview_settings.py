from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
from pydantic import BaseModel, Field
from ..database.InterviewSettings import (
    create_job_opening, get_job_openings, 
    update_job_opening, delete_job_opening,
    create_interview_type, get_interview_types,
    update_interview_type, delete_interview_type,
    create_source_portal, get_source_portals,
    update_source_portal, delete_source_portal,
    create_sub_status, get_sub_statuses_by_parent,
    get_sub_status, update_sub_status, delete_sub_status,
    create_interview_settings_indexes, create_async_indexes
)
from ..database.InterviewStatuses import InterviewStatuses, InterviewSubStatuses, create_interview_statuses_indexes, create_async_interview_statuses_indexes
from app.utils.common_utils import get_current_user_id
from app.utils.permission_helpers import is_super_admin_permission
from app.utils.permissions import get_user_permissions, get_user_role
from app.database import get_database_instances
import logging

# Setup logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Initialize indexes on module load
try:
    create_interview_settings_indexes()
    create_interview_statuses_indexes()
except Exception as e:
    logger.error(f"Error creating interview settings indexes: {e}")

# Async function to initialize indexes
async def init_interview_settings():
    """Initialize async indexes for interview settings"""
    try:
        await create_async_indexes()
        await create_async_interview_statuses_indexes()
        logger.info("Interview settings async indexes initialized")
    except Exception as e:
        logger.error(f"Error initializing interview settings async indexes: {e}")

# Pydantic models for request/response
class JobOpeningCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)

class JobOpeningUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)

class InterviewTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)

class InterviewTypeUpdate(BaseModel):
    name: str

class InterviewStatus(BaseModel):
    name: str
    statusType: Optional[str] = "Open"  # Add statusType field with default value

class InterviewStatusUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    statusType: Optional[str] = "Open"  # Add statusType field with default value

class InterviewSubStatus(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    parent_status_id: str
    description: Optional[str] = None
    order: int = 100
    is_active: bool = True

class SourcePortalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)

class SourcePortalUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    is_active: bool = True

class InterviewSubStatusUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None

# Job Openings Endpoints
@router.get("/interview-settings/job-openings")
async def get_job_openings_route(user_id: str = Query(...)):
    """Get all job openings for a user"""
    try:
        job_openings = await get_job_openings(user_id)
        return {
            "success": True,
            "data": job_openings,
            "message": f"Retrieved {len(job_openings)} job openings"
        }
    except Exception as e:
        logger.error(f"Error in get_job_openings_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/interview-settings/job-openings")
async def create_job_opening_route(
    job_opening: JobOpeningCreate,
    user_id: str = Query(...)
):
    """Create a new job opening"""
    try:
        job_opening_data = {
            "name": job_opening.name,
            "user_id": user_id
        }
        
        created_job_opening = await create_job_opening(job_opening_data)
        
        if created_job_opening:
            return {
                "success": True,
                "data": created_job_opening,
                "message": "Job opening created successfully"
            }
        else:
            return {
                "success": False,
                "message": "Job opening already exists or creation failed"
            }
    except Exception as e:
        logger.error(f"Error in create_job_opening_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/interview-settings/job-openings/{job_opening_id}")
async def update_job_opening_route(
    job_opening_id: str,
    job_opening: JobOpeningUpdate,
    user_id: str = Query(...)
):
    """Update a job opening"""
    try:
        job_opening_data = {
            "name": job_opening.name
        }
        
        success = await update_job_opening(job_opening_id, user_id, job_opening_data)
        
        if success:
            return {
                "success": True,
                "message": "Job opening updated successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Job opening not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_job_opening_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/interview-settings/job-openings/{job_opening_id}")
async def delete_job_opening_route(
    job_opening_id: str,
    user_id: str = Query(...)
):
    """Delete a job opening"""
    try:
        success = await delete_job_opening(job_opening_id, user_id)
        
        if success:
            return {
                "success": True,
                "message": "Job opening deleted successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Job opening not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_job_opening_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Interview Types Endpoints
@router.get("/interview-settings/interview-types")
async def get_interview_types_route(user_id: str = Query(...)):
    """Get all interview types for a user"""
    try:
        interview_types = await get_interview_types(user_id)
        return {
            "success": True,
            "data": interview_types,
            "message": f"Retrieved {len(interview_types)} interview types"
        }
    except Exception as e:
        logger.error(f"Error in get_interview_types_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/interview-settings/interview-types")
async def create_interview_type_route(
    interview_type: InterviewTypeCreate,
    user_id: str = Query(...)
):
    """Create a new interview type"""
    try:
        interview_type_data = {
            "name": interview_type.name,
            "user_id": user_id
        }
        
        created_interview_type = await create_interview_type(interview_type_data)
        
        if created_interview_type:
            return {
                "success": True,
                "data": created_interview_type,
                "message": "Interview type created successfully"
            }
        else:
            return {
                "success": False,
                "message": "Interview type already exists or creation failed"
            }
    except Exception as e:
        logger.error(f"Error in create_interview_type_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/interview-settings/interview-types/{interview_type_id}")
async def update_interview_type_route(
    interview_type_id: str,
    interview_type: InterviewTypeUpdate,
    user_id: str = Query(...)
):
    """Update an interview type"""
    try:
        interview_type_data = {
            "name": interview_type.name
        }
        
        success = await update_interview_type(interview_type_id, user_id, interview_type_data)
        
        if success:
            return {
                "success": True,
                "message": "Interview type updated successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Interview type not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_interview_type_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/interview-settings/interview-types/{interview_type_id}")
async def delete_interview_type(
    interview_type_id: str, 
    user_id: str = Query(...)
):
    """Delete an interview type"""
    
    try:
        # Get database instances
        db_instances = get_database_instances()
        users_db = db_instances["users"]
        roles_db = db_instances["roles"]
        
        # Get user permissions and role
        user_permissions = await get_user_permissions(user_id, users_db, roles_db)
        user_role = await get_user_role(user_id, users_db, roles_db)
        
        # Check if user is super admin
        is_admin = any(
            (is_super_admin_permission(perm))
            for perm in user_permissions
        )
        
        logger.info(f"🗑️ DELETE REQUEST: User {user_id} (Role: {user_role}, Admin: {is_admin}) attempting to delete interview type {interview_type_id}")
        
        # Import here to avoid circular import
        from app.database.InterviewSettings import delete_interview_type as db_delete_interview_type
        
        # Pass admin flag to database function
        success = await db_delete_interview_type(interview_type_id, user_id, is_admin=is_admin)
        
        if success:
            logger.info(f"✅ SUCCESS: Interview type {interview_type_id} deleted successfully")
            return {"message": "Interview type deleted successfully"}
        else:
            logger.error(f"❌ FAILED: Interview type {interview_type_id} not found or permission denied")
            raise HTTPException(status_code=404, detail="Interview type not found or permission denied")
    
    except Exception as e:
        logger.error(f"💥 ERROR deleting interview type: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting interview type: {str(e)}")

# Status Routes
@router.get("/interview-settings/statuses")
async def get_statuses_route(user_id: str = Query(...)):
    """Get all interview statuses for a user"""
    try:
        statuses = await InterviewStatuses.get_all(user_id)
        return {
            "success": True,
            "data": statuses,
            "message": f"Retrieved {len(statuses)} interview statuses"
        }
    except Exception as e:
        logger.error(f"Error in get_statuses_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/interview-settings/statuses")
async def create_status_route(
    status: InterviewStatus,
    user_id: str = Query(...)
):
    """Create a new interview status"""
    try:
        print(f"🔧 Backend: Creating status with name='{status.name}', statusType='{status.statusType}'")
        
        status_data = {
            "name": status.name,
            "statusType": status.statusType or "Open",  # Include statusType
            "user_id": user_id
        }
        
        print(f"🔧 Backend: Status data to save: {status_data}")
        
        created_status = await InterviewStatuses.create(status_data)
        
        print(f"🔧 Backend: Created status returned: {created_status}")
        
        return {
            "success": True,
            "data": created_status,
            "message": "Interview status created successfully"
        }
    except Exception as e:
        logger.error(f"Error in create_status_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/interview-settings/statuses/{status_id}")
async def update_status_route(
    status_id: str,
    status: InterviewStatusUpdate,
    user_id: str = Query(...)
):
    """Update an interview status"""
    try:
        status_data = {
            "name": status.name,
            "statusType": status.statusType or "Open"  # Include statusType
        }
        
        success = await InterviewStatuses.update(status_id, user_id, status_data)
        
        if success:
            # Get the updated status to return
            updated_status = await InterviewStatuses.get_by_id(status_id, user_id)
            return {
                "success": True,
                "data": updated_status,
                "message": "Interview status updated successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Interview status not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_status_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/interview-settings/statuses/{status_id}")
async def delete_status_route(
    status_id: str,
    user_id: str = Query(...)
):
    """Delete an interview status"""
    try:
        success = await InterviewStatuses.delete(status_id, user_id)
        
        if success:
            return {
                "success": True,
                "message": "Interview status deleted successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Interview status not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_status_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Sub-Status Routes
@router.get("/interview-settings/sub-statuses")
async def get_sub_statuses_route(
    user_id: str = Query(...),
    parent_status_id: Optional[str] = Query(None)
):
    """Get all interview sub-statuses for a user, optionally filtered by parent status"""
    try:
        sub_statuses = await InterviewSubStatuses.get_all(user_id, parent_status_id)
        return {
            "success": True,
            "data": sub_statuses,
            "message": f"Retrieved {len(sub_statuses)} interview sub-statuses"
        }
    except Exception as e:
        logger.error(f"Error in get_sub_statuses_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/interview-settings/sub-statuses")
async def create_sub_status_route(
    sub_status: InterviewSubStatus,
    user_id: str = Query(...)
):
    """Create a new interview sub-status"""
    try:
        # Validate parent status exists
        parent_status = await InterviewStatuses.get_by_id(sub_status.parent_status_id, user_id)
        if not parent_status:
            raise HTTPException(
                status_code=400, 
                detail=f"Parent status with ID {sub_status.parent_status_id} not found"
            )
        
        sub_status_data = {
            "name": sub_status.name,
            "parent_status_id": sub_status.parent_status_id,
            "user_id": user_id,
            "description": sub_status.description,
            "order": sub_status.order,
            "is_active": sub_status.is_active
        }
        
        created_sub_status = await create_sub_status(sub_status_data)
        
        return {
            "success": True,
            "data": created_sub_status,
            "message": "Interview sub-status created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error in create_sub_status_route: {e}")
        
        # Handle duplicate key error specifically
        if "E11000 duplicate key error" in error_message:
            raise HTTPException(
                status_code=400, 
                detail=f"Sub-status '{sub_status.name}' already exists for this status"
            )
        else:
            raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/interview-settings/sub-statuses/{sub_status_id}")
async def update_sub_status_route(
    sub_status_id: str,
    sub_status: InterviewSubStatusUpdate,
    user_id: str = Query(...)
):
    """Update an interview sub-status"""
    try:
        # Check if sub-status exists
        existing_sub_status = await InterviewSubStatuses.get_by_id(sub_status_id, user_id)
        if not existing_sub_status:
            raise HTTPException(status_code=404, detail="Interview sub-status not found")
        
        update_data = {k: v for k, v in sub_status.dict().items() if v is not None}
        success = await InterviewSubStatuses.update(sub_status_id, user_id, update_data)
        
        if success:
            return {
                "success": True,
                "message": "Interview sub-status updated successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Interview sub-status not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_sub_status_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/interview-settings/sub-statuses/{sub_status_id}")
async def delete_sub_status_route(
    sub_status_id: str,
    user_id: str = Query(...)
):
    """Delete an interview sub-status"""
    try:
        success = await InterviewSubStatuses.delete(sub_status_id, user_id)
        
        if success:
            return {
                "success": True,
                "message": "Interview sub-status deleted successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Interview sub-status not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_sub_status_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Sub-Status Routes
@router.get("/interview-settings/sub-statuses")
async def get_sub_statuses_route(
    user_id: str = Query(...),
    parent_status_id: Optional[str] = Query(None)
):
    """Get all interview sub-statuses for a user, optionally filtered by parent status"""
    try:
        sub_statuses = await InterviewSubStatuses.get_all(user_id, parent_status_id)
        return {
            "success": True,
            "data": sub_statuses,
            "message": f"Retrieved {len(sub_statuses)} interview sub-statuses"
        }
    except Exception as e:
        logger.error(f"Error in get_sub_statuses_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/interview-settings/sub-statuses")
async def create_sub_status_route(
    sub_status: InterviewSubStatus,
    user_id: str = Query(...)
):
    """Create a new interview sub-status"""
    try:
        # Validate parent status exists
        parent_status = await InterviewStatuses.get_by_id(sub_status.parent_status_id, user_id)
        if not parent_status:
            raise HTTPException(
                status_code=400, 
                detail=f"Parent status with ID {sub_status.parent_status_id} not found"
            )
        
        sub_status_data = {
            "name": sub_status.name,
            "parent_status_id": sub_status.parent_status_id,
            "description": sub_status.description,
            "order": sub_status.order,
            "is_active": sub_status.is_active,
            "user_id": user_id
        }
        
        created_sub_status = await InterviewSubStatuses.create(sub_status_data)
        
        return {
            "success": True,
            "data": created_sub_status,
            "message": "Interview sub-status created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_sub_status_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/interview-settings/sub-statuses/{sub_status_id}")
async def update_sub_status_route(
    sub_status_id: str,
    sub_status: InterviewSubStatusUpdate,
    user_id: str = Query(...)
):
    """Update an interview sub-status"""
    try:
        # Check if sub-status exists
        existing_sub_status = await InterviewSubStatuses.get_by_id(sub_status_id, user_id)
        if not existing_sub_status:
            raise HTTPException(status_code=404, detail="Interview sub-status not found")
        
        update_data = {k: v for k, v in sub_status.dict().items() if v is not None}
        
        success = await InterviewSubStatuses.update(sub_status_id, user_id, update_data)
        
        if success:
            return {
                "success": True,
                "message": "Interview sub-status updated successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Interview sub-status not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_sub_status_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/interview-settings/sub-statuses/{sub_status_id}")
async def delete_sub_status_route(
    sub_status_id: str,
    user_id: str = Query(...)
):
    """Delete an interview sub-status"""
    try:
        success = await InterviewSubStatuses.delete(sub_status_id, user_id)
        
        if success:
            return {
                "success": True,
                "message": "Interview sub-status deleted successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Interview sub-status not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_sub_status_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ======================== SOURCE/PORTAL ENDPOINTS ========================

@router.get("/interview-settings/source-portals")
async def get_source_portals_route(user_id: str = Query(...)):
    """Get all source/portals for a user"""
    try:
        logger.info(f"Getting source/portals for user: {user_id}")
        
        source_portals = await get_source_portals(user_id)
        
        return {
            "success": True,
            "data": source_portals,
            "message": f"Retrieved {len(source_portals)} source/portals"
        }
    except Exception as e:
        logger.error(f"Error in get_source_portals_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/interview-settings/source-portals")
async def create_source_portal_route(source_portal_data: SourcePortalCreate, user_id: str = Query(...)):
    """Create a new source/portal"""
    try:
        logger.info(f"Creating source/portal: {source_portal_data.name} for user: {user_id}")
        
        # Prepare data for database
        source_portal_dict = source_portal_data.dict()
        source_portal_dict["user_id"] = user_id
        
        # Create source/portal
        created_source_portal = await create_source_portal(source_portal_dict)
        
        if created_source_portal:
            return {
                "success": True,
                "data": created_source_portal,
                "message": "Source/Portal created successfully"
            }
        else:
            raise HTTPException(status_code=400, detail="Source/Portal already exists or creation failed")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_source_portal_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/interview-settings/source-portals/{source_portal_id}")
async def update_source_portal_route(source_portal_id: str, source_portal_data: SourcePortalUpdate, user_id: str = Query(...)):
    """Update a source/portal"""
    try:
        logger.info(f"Updating source/portal {source_portal_id} for user: {user_id}")
        
        # Update source/portal
        success = await update_source_portal(source_portal_id, user_id, source_portal_data.dict())
        
        if success:
            return {
                "success": True,
                "message": "Source/Portal updated successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Source/Portal not found or name already exists")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_source_portal_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/interview-settings/source-portals/{source_portal_id}")
async def delete_source_portal_route(source_portal_id: str, user_id: str = Query(...)):
    """Delete a source/portal"""
    try:
        logger.info(f"Deleting source/portal {source_portal_id} for user: {user_id}")
        
        # Get database instances
        db_instances = get_database_instances()
        users_db = db_instances["users"]
        roles_db = db_instances["roles"]
        
        # Get user permissions and role
        user_permissions = await get_user_permissions(user_id, users_db, roles_db)
        user_role = await get_user_role(user_id, users_db, roles_db)
        
        # Check if user is super admin
        is_admin = any(
            (is_super_admin_permission(perm))
            for perm in user_permissions
        )
        
        logger.info(f"User {user_id} admin status: {is_admin}")
        
        # Delete source/portal with admin override
        success = await delete_source_portal(source_portal_id, user_id, is_admin)
        
        if success:
            return {
                "success": True,
                "message": "Source/Portal deleted successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Source/Portal not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_source_portal_route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
