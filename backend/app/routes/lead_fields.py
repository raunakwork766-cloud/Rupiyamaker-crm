from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Dict, Any, Optional
from bson import ObjectId
from datetime import datetime
from app.utils.timezone import get_ist_now
from app.database.Leads import LeadsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.utils.permissions import check_permission
from app.database import get_database_instances

router = APIRouter(
    prefix="/lead-fields",
    tags=["Lead Fields"]
)

async def get_leads_db():
    db_instances = get_database_instances()
    return db_instances["leads"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

@router.patch("/update-dynamic-field/{lead_id}")
async def update_dynamic_field(
    lead_id: str,
    field_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Update a specific dynamic field for a lead.
    field_data should be in format: {"field_name": "field_value"}
    Example: {"cibil_score": "750"}
    """
    # Check permission - allow either leads or login permission
    await check_permission(user_id, ["leads", "login"], "edit", users_db, roles_db)
    
    # Verify lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Prepare update data
    update_data = {}
    
    # Initialize dynamic_fields if not present
    dynamic_fields = lead.get("dynamic_fields", {}) or {}
    
    # Update dynamic_fields with new values
    for field_name, field_value in field_data.items():
        dynamic_fields[field_name] = field_value
    
    # Set the updated dynamic_fields
    update_data["dynamic_fields"] = dynamic_fields
    update_data["updated_at"] = get_ist_now().isoformat()
    update_data["updated_by"] = user_id
    
    # Update the lead
    success = await leads_db.update_lead(lead_id, update_data, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update lead"
        )
    
    return {
        "message": "Field updated successfully", 
        "updated_fields": list(field_data.keys()),
        "lead_id": lead_id
    }

@router.post("/generate-share-link/{lead_id}")
async def generate_share_link(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Generate a shareable link for a lead form"""
    # Check permission - allow either leads or login permission
    await check_permission(user_id, ["leads", "login"], "edit", users_db, roles_db)
    
    # Verify lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Generate a unique share token
    import secrets
    import string
    
    # Generate a random 16-character token
    token_chars = string.ascii_letters + string.digits
    share_token = ''.join(secrets.choice(token_chars) for _ in range(16))
    
    # Update lead with share token
    update_data = {
        "share_token": share_token,
        "share_token_created_at": get_ist_now().isoformat(),
        "share_token_created_by": user_id,
        "updated_at": get_ist_now().isoformat()
    }
    
    # Update the lead using correct method signature
    success = await leads_db.update_lead(lead_id, update_data, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate share link"
        )
    
    # Create the shareable URL
    # This should match the frontend URL pattern for shared lead forms
    # Example: http://your-domain.com/public/lead-form/{share_token}
    # For local development:
    share_url = f"https://raunakcrm.bhoomitechzone.us:4521/public/lead-form/{share_token}"
    
    return {
        "message": "Share link generated successfully",
        "share_token": share_token,
        "share_url": share_url,
        "lead_id": lead_id
    }
