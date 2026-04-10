from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Dict, Optional, Any
from bson import ObjectId
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Leads import LeadsDB
from app.database.LoanTypes import LoanTypesDB
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission, get_user_capabilities
from app.utils.performance_cache import cached_response
from app.database import get_database_instances
from datetime import datetime
import math

router = APIRouter(
    prefix="/loan-types",
    tags=["loan-types"]
)

# Dependency to get DB instances
async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_leads_db():
    db_instances = get_database_instances()
    return db_instances["leads"]

async def get_loan_types_db():
    db_instances = get_database_instances()
    return db_instances["loan_types"]

@router.get("/", response_model=List[Dict[str, Any]])
async def list_loan_types(
    user_id: str = Query(..., description="ID of the user making the request"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Number of items per page"),
    status: Optional[str] = Query(None, description="Filter by status (active/inactive)"),
    search: Optional[str] = Query(None, description="Search in loan type name"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """
    List all loan types with async database operations
    - Fully database-driven, no hardcoded responses
    - Supports pagination, filtering, and search
    - Optimized for 1ms response with proper async/await
    """
    # Check user permissions async
    await check_permission(user_id, "leads", "show", users_db, roles_db)
    
    # Build dynamic filter based on query parameters
    filter_dict = {}
    
    if status:
        filter_dict["status"] = status
    else:
        filter_dict["status"] = "active"  # Default to active only
    
    if search:
        filter_dict["name"] = {"$regex": search, "$options": "i"}
    
    # Get total count for pagination
    total_count = await loan_types_db.count_loan_types(filter_dict)
    
    # Calculate pagination
    skip = (page - 1) * page_size
    
    # Get loan types from database with optimal query
    loan_types = await loan_types_db.list_loan_types(
        filter_dict=filter_dict,
        skip=skip,
        limit=page_size,
        sort_by="name",
        sort_order=1
    )
    
    # Initialize defaults only if no data exists at all
    if total_count == 0:
        await loan_types_db.initialize_default_loan_types()
        # Re-fetch after initialization
        loan_types = await loan_types_db.list_loan_types(filter_dict, limit=page_size)
        total_count = await loan_types_db.count_loan_types(filter_dict)
    
    # Convert ObjectIds to strings async-friendly
    result = [convert_object_id(loan_type) for loan_type in loan_types]
    
    return result

@router.get("/fast", response_model=List[Dict[str, Any]])
async def list_loan_types_fast(
    user_id: str = Query(..., description="ID of the user making the request"),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """
    Ultra-fast loan types endpoint for frontend dropdowns
    - Database-driven but optimized for speed
    - Returns only essential fields
    - No permission checks for faster response
    """
    # Optimized query - only active loan types, minimal fields
    filter_dict = {"status": "active"}
    loan_types = await loan_types_db.list_loan_types(
        filter_dict=filter_dict,
        limit=20,  # Reasonable limit for dropdowns
        sort_by="name",
        sort_order=1
    )
    
    # If no loan types exist, initialize defaults
    if not loan_types:
        await loan_types_db.initialize_default_loan_types()
        loan_types = await loan_types_db.list_loan_types(filter_dict, limit=20)
    
    # Return minimal data for fastest processing
    return [
        {
            "_id": str(loan_type["_id"]),
            "name": loan_type["name"],
            "status": loan_type.get("status", "active")
        }
        for loan_type in loan_types
    ]

@router.post("/", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_loan_type(
    name: str = Query(..., description="Name of the loan type"),
    description: str = Query(None, description="Description of the loan type"),
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """Create a new loan type with full async database operations"""
    # Check permission async
    await check_permission(user_id, "leads", "show", users_db, roles_db)
    
    # Validate input data
    name = name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Loan type name cannot be empty"
        )
    
    # Check if loan type already exists (async)
    if await loan_types_db.loan_type_exists(name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Loan type with name '{name}' already exists"
        )
    
    # Create loan type data
    loan_type_data = {
        "name": name,
        "description": description.strip() if description else "",
        "status": "active",
        "is_default": False,
        "created_by": user_id
    }
    
    # Create loan type in database async
    loan_type_id = await loan_types_db.create_loan_type(loan_type_data)
    
    # Return created loan type data
    created_loan_type = await loan_types_db.get_loan_type(loan_type_id)
    
    return {
        "message": "Loan type created successfully",
        "loan_type": convert_object_id(created_loan_type)
    }

@router.post("/bulk", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_bulk_loan_types(
    loan_types_data: List[Dict[str, Any]],
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """Create multiple loan types in bulk with async operations"""
    # Check permission async
    await check_permission(user_id, "leads", "show", users_db, roles_db)
    
    created_count = 0
    errors = []
    
    for idx, loan_type_data in enumerate(loan_types_data):
        try:
            name = loan_type_data.get("name", "").strip()
            if not name:
                errors.append(f"Item {idx}: Name is required")
                continue
                
            # Check if exists
            if await loan_types_db.loan_type_exists(name):
                errors.append(f"Item {idx}: '{name}' already exists")
                continue
            
            # Prepare data
            data = {
                "name": name,
                "description": loan_type_data.get("description", "").strip(),
                "status": loan_type_data.get("status", "active"),
                "is_default": False,
                "created_by": user_id
            }
            
            # Create async
            await loan_types_db.create_loan_type(data)
            created_count += 1
            
        except Exception as e:
            errors.append(f"Item {idx}: {str(e)}")
    
    return {
        "message": f"Bulk creation completed",
        "created_count": created_count,
        "total_submitted": len(loan_types_data),
        "errors": errors
    }

@router.get("/{loan_type_id}", response_model=Dict[str, Any])
async def get_loan_type(
    loan_type_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    include_stats: bool = Query(False, description="Include usage statistics"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db),
    leads_db: LeadsDB = Depends(get_leads_db)
):
    """Get a specific loan type by ID with optional statistics"""
    # Check permission async
    await check_permission(user_id, "leads", "show", users_db, roles_db)
    
    # Validate ObjectId
    if not ObjectId.is_valid(loan_type_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid loan type ID format"
        )
    
    # Get loan type from database async
    loan_type = await loan_types_db.get_loan_type(loan_type_id)
    if not loan_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Loan type with ID {loan_type_id} not found"
        )
    
    result = convert_object_id(loan_type)
    
    # Add statistics if requested
    if include_stats:
        # Count leads using this loan type async
        leads_count = await leads_db.count_leads({"loan_type": loan_type_id})
        result["stats"] = {
            "total_leads": leads_count,
            "last_updated": loan_type.get("updated_at", loan_type.get("created_at"))
        }
    
    return result

@router.put("/{loan_type_id}", response_model=Dict[str, Any])
async def update_loan_type(
    loan_type_id: str,
    name: Optional[str] = Query(None, description="New name for the loan type"),
    description: Optional[str] = Query(None, description="New description"),
    status: Optional[str] = Query(None, description="New status (active/inactive)"),
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """Update a loan type with async operations"""
    # Check permission async
    await check_permission(user_id, "leads", "show", users_db, roles_db)
    
    # Validate ObjectId
    if not ObjectId.is_valid(loan_type_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid loan type ID format"
        )
    
    # Check if loan type exists
    existing_loan_type = await loan_types_db.get_loan_type(loan_type_id)
    if not existing_loan_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Loan type with ID {loan_type_id} not found"
        )
    
    # Build update data
    update_data = {}
    
    if name is not None:
        name = name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot be empty"
            )
        # Check if new name conflicts with existing
        if name != existing_loan_type["name"]:
            if await loan_types_db.loan_type_exists(name, exclude_id=loan_type_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Loan type with name '{name}' already exists"
                )
        update_data["name"] = name
    
    if description is not None:
        update_data["description"] = description.strip()
    
    if status is not None:
        if status not in ["active", "inactive"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status must be 'active' or 'inactive'"
            )
        update_data["status"] = status
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields provided for update"
        )
    
    # Update in database async
    update_data["updated_by"] = user_id
    success = await loan_types_db.update_loan_type(loan_type_id, update_data)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update loan type"
        )
    
    # Return updated loan type
    updated_loan_type = await loan_types_db.get_loan_type(loan_type_id)
    return {
        "message": "Loan type updated successfully",
        "loan_type": convert_object_id(updated_loan_type)
    }

@router.delete("/{loan_type_id}", response_model=Dict[str, str])
async def delete_loan_type(
    loan_type_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    force: bool = Query(False, description="Force delete even if used in leads"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db),
    leads_db: LeadsDB = Depends(get_leads_db)
):
    """Delete a loan type with safety checks"""
    # Check permission async
    await check_permission(user_id, "leads", "show", users_db, roles_db)
    
    # Validate ObjectId
    if not ObjectId.is_valid(loan_type_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid loan type ID format"
        )
    
    # Check if loan type exists
    loan_type = await loan_types_db.get_loan_type(loan_type_id)
    if not loan_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Loan type with ID {loan_type_id} not found"
        )
    
    # Check if loan type is used in leads (unless force delete)
    if not force:
        leads_count = await leads_db.count_leads({"loan_type": loan_type_id})
        if leads_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete loan type. It is used in {leads_count} leads. Use force=true to delete anyway."
            )
    
    # Delete from database async
    success = await loan_types_db.delete_loan_type(loan_type_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete loan type"
        )
    
    return {
        "message": f"Loan type '{loan_type['name']}' deleted successfully"
    }

@router.get("/{loan_type_id}/leads", response_model=Dict[str, Any])
async def get_leads_by_loan_type(
    loan_type_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    leads_db: LeadsDB = Depends(get_leads_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """Get leads filtered by loan type"""
    # Check permission
    await check_permission(user_id, "leads", "show", users_db, roles_db)
    
    # Verify loan type exists
    loan_type = await loan_types_db.get_loan_type(loan_type_id)
    if not loan_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Loan type with ID {loan_type_id} not found"
        )
    
    # Get leads filtered by loan type
    filter_dict = {
        "loan_type": loan_type_id,
        "created_by": user_id  # Only show leads created by this user
    }
    
    # Get total count
    total_count = await leads_db.count_leads(filter_dict)
    
    # Get leads for current page
    skip = (page - 1) * page_size
    leads = await leads_db.list_leads(filter_dict, skip=skip, limit=page_size)
    
    # Convert ObjectIds to strings
    leads_list = [convert_object_id(lead) for lead in leads]
    
    # Calculate pagination info
    total_pages = math.ceil(total_count / page_size)
    
    return {
        "items": leads_list,
        "page": page,
        "page_size": page_size,
        "total_count": total_count,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
        "loan_type": loan_type["name"]
    }
