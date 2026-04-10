from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import JSONResponse
from typing import List, Optional
from bson import ObjectId

from app.database.Designations import DesignationsDB, DesignationService
from app.schemas.designation_schemas import DesignationCreateSchema, DesignationUpdateSchema, DesignationResponse
from app.database import get_database_instances

router = APIRouter(
    prefix="/designations",
    tags=["designations"]
)

# Dependency to get the DB instances
async def get_designations_db():
    db_instances = get_database_instances()
    return db_instances["designations"]

@router.post("/", response_model=DesignationResponse)
async def create_designation(
    designation: DesignationCreateSchema,
    user_id: str = Query(..., description="ID of the user making the request"),
    designations_db: DesignationsDB = Depends(get_designations_db)
):
    """
    Create a new designation
    """
    designation_data = designation.model_dump(exclude_unset=True)
    
    try:
        result = await designations_db.create_designation(designation_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create designation: {str(e)}")

@router.get("/", response_model=List[DesignationResponse])
async def get_designations(
    user_id: str = Query(..., description="ID of the user making the request"),
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(100, description="Maximum number of records to return"),
    include_inactive: bool = Query(False, description="Include inactive designations"),
    designations_db: DesignationsDB = Depends(get_designations_db)
):
    """
    Get all designations with optional pagination
    """
    
    try:
        designations = await designations_db.get_designations(skip, limit, include_inactive)
        return designations
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve designations: {str(e)}")

@router.get("/{designation_id}", response_model=DesignationResponse)
async def get_designation(
    designation_id: str,
    designations_db: DesignationsDB = Depends(get_designations_db)
):
    """
    Get a specific designation by ID
    """
    
    try:
        designation = await designations_db.get_designation(designation_id)
        if not designation:
            raise HTTPException(status_code=404, detail="Designation not found")
        return designation
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve designation: {str(e)}")

@router.put("/{designation_id}", response_model=DesignationResponse)
async def update_designation(
    designation_id: str,
    designation: DesignationUpdateSchema,
    user_id: str = Query(..., description="ID of the user making the request"),
    designations_db: DesignationsDB = Depends(get_designations_db)
):
    """
    Update a designation
    """
    
    try:
        # Check if designation exists
        existing = await designations_db.get_designation(designation_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Designation not found")
        
        # Update the designation
        designation_data = designation.model_dump(exclude_unset=True)
        result = await designations_db.update_designation(designation_id, designation_data)
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update designation: {str(e)}")

@router.delete("/{designation_id}")
async def delete_designation(
    designation_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    hard_delete: bool = Query(False, description="Permanently delete the designation"),
    designations_db: DesignationsDB = Depends(get_designations_db)
):
    """
    Delete a designation (soft delete by default)
    """
    
    try:
        # Check if designation exists
        existing = await designations_db.get_designation(designation_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Designation not found")
        
        # Delete the designation
        if hard_delete:
            success = await designations_db.hard_delete_designation(designation_id)
        else:
            success = await designations_db.delete_designation(designation_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete designation")
        
        return JSONResponse(content={"message": "Designation deleted successfully"}, status_code=200)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete designation: {str(e)}")
