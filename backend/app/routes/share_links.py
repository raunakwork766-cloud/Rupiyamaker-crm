from fastapi import APIRouter, HTTPException, Depends, status as http_status, Query
from typing import Dict, Optional, Any, List
from datetime import datetime, timedelta
from bson import ObjectId

from app.database.Leads import LeadsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.ShareLinks import ShareLinksDB
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission
from app.schemas.lead_schemas import ShareLinkCreate, ShareLinkResponse, ShareLinkInDB, PublicLeadFormUpdate
from app.database import get_database_instances

router = APIRouter(
    prefix="/share-links",
    tags=["share-links"]
)

# Dependency to get DB instances
async def get_leads_db():
    db_instances = get_database_instances()
    return db_instances["leads"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_share_links_db():
    db_instances = get_database_instances()
    return db_instances.get("share_links") or ShareLinksDB(get_database_instances()["async_db"])

@router.post("/create", response_model=ShareLinkResponse)
async def create_share_link(
    share_link: ShareLinkCreate,
    user_id: str = Query(..., description="ID of the user creating the share link"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    share_links_db: ShareLinksDB = Depends(get_share_links_db)
):
    """Create a shareable link for a lead that can be sent to anyone"""
    
    # Check permission
    await check_permission(user_id, "leads", "share", users_db, roles_db)
    
    # Verify lead exists
    lead_id = share_link.lead_id
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Convert Pydantic model to dict for passing to the DB method
    share_link_data = {
        "expires_in_days": share_link.expires_in_days,
        "purpose": share_link.purpose,
        "recipient_email": share_link.recipient_email,
        "base_url": share_link.base_url,
        "allow_update": share_link.allow_update,
        "one_time_use": share_link.one_time_use
    }
    
    # Create share link using the ShareLinksDB class with expanded options
    share_link_result = share_links_db.create_share_link_v2(
        lead_id=lead_id, 
        created_by=user_id,
        data=share_link_data
    )
    
    if not share_link_result:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create share link"
        )
    
    # Update the lead to set form_share to True when share link is created
    await leads_db.update_lead(lead_id, {"form_share": True}, user_id)
    
    # Return the ShareLinkResponse directly
    return share_link_result

@router.get("/public/form/{share_token}")
async def get_public_lead_form(
    share_token: str,
    leads_db: LeadsDB = Depends(get_leads_db),
    share_links_db: ShareLinksDB = Depends(get_share_links_db)
):
    """Get lead data for a public form using a share token"""
    
    # Find the share link by token using ShareLinksDB
    share_link = await share_links_db.get_share_link_by_token(share_token)
    
    if not share_link:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired share link"
        )
    
    # Check if link is expired
    if share_link.get("expires_at", datetime.min) < datetime.now():
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="This share link has expired"
        )
    
    # Get the lead data
    lead_id = share_link.get("lead_id")
    lead = await leads_db.get_lead(lead_id)
    
    if not lead:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check if form sharing is enabled for this lead
    if not lead.get("form_share", True):  # Default to True for backward compatibility
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="This form has already been submitted and cannot be accessed again. Please contact support for assistance."
        )
    
    # Convert all ObjectId to string for JSON serialization
    lead = convert_object_id(lead)
    
    # Add share link information to the response
    lead["share_token"] = share_token
    lead["expires_at"] = share_link.get("expires_at")
    lead["allow_edit"] = share_link.get("allow_edit", False)
    lead["form_title"] = "Update Your Information"
    
    return lead

@router.put("/public/form/{share_token}")
async def update_public_lead_form(
    share_token: str,
    lead_update: PublicLeadFormUpdate,
    is_final_submission: bool = Query(False, description="Whether this is a final submission (true) or just a save (false)"),
    leads_db: LeadsDB = Depends(get_leads_db),
    share_links_db: ShareLinksDB = Depends(get_share_links_db)
):
    """Update lead data from a public form using a share token"""
    
    # Find the share link by token using ShareLinksDB
    share_link = await share_links_db.get_share_link_by_token(share_token)
    
    if not share_link:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired share link"
        )
    
    # Check if link is expired
    if share_link.get("expires_at", datetime.min) < datetime.now():
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="This share link has expired"
        )
    
    # Check if editing is allowed
    if not share_link.get("allow_edit", False):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Editing is not allowed with this share link"
        )
    
    # Get the lead data
    lead_id = share_link.get("lead_id")
    lead = await leads_db.get_lead(lead_id)
    
    if not lead:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check if form sharing is enabled for this lead
    if not lead.get("form_share", True):  # Default to True for backward compatibility
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="This form has already been submitted and cannot be accessed again. Please contact support for assistance."
        )
    
    # Prepare update data
    update_data = {}
    
    # Get all fields from the model and only update what's provided
    data_dict = lead_update.dict(exclude_unset=True)
    
    # Process basic fields that go directly to the lead document
    basic_fields = ["first_name", "last_name", "phone", "email"]
    for field in basic_fields:
        if field in data_dict and data_dict[field] is not None:
            update_data[field] = data_dict[field]
    
    # Process dynamic fields separately
    if "dynamic_fields" in data_dict and data_dict["dynamic_fields"] is not None:
        # Update dynamic fields without overwriting existing ones
        current_dynamic_fields = lead.get("dynamic_fields", {})
        for key, value in data_dict["dynamic_fields"].items():
            if isinstance(value, dict) and key in current_dynamic_fields and isinstance(current_dynamic_fields[key], dict):
                # For nested dictionaries, update them separately
                for nested_key, nested_value in value.items():
                    if nested_value is not None:
                        current_dynamic_fields[key][nested_key] = nested_value
            else:
                # For non-dictionary values, update directly
                if value is not None:
                    current_dynamic_fields[key] = value
        
        update_data["dynamic_fields"] = current_dynamic_fields
    
    # Process all other fields as additional fields in dynamic_fields
    # This makes all schema fields available for forms without having to update the schema each time
    additional_fields = {k: v for k, v in data_dict.items() 
                       if k not in basic_fields 
                       and k != "dynamic_fields" 
                       and v is not None}
    
    if additional_fields:
        if "dynamic_fields" not in update_data:
            update_data["dynamic_fields"] = lead.get("dynamic_fields", {})
        
        # Add each additional field to dynamic_fields
        for field, value in additional_fields.items():
            update_data["dynamic_fields"][field] = value
    
    # Check if there are any fields to update
    if not update_data:
        return {
            "status": "success",
            "message": "No fields were updated",
            "lead_id": lead_id
        }
    
    # Only set form_share to False when this is a final submission, not just a save
    if is_final_submission:
        update_data["form_share"] = False
    
    update_data["last_updated_via"] = "public_form"
    update_data["last_updated_at"] = datetime.now()
    
    # Update lead data using the update_lead_public method (doesn't require user_id)
    result = await leads_db.update_lead_public(lead_id, update_data)
    
    if not result:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update lead information"
        )
    
    return {
        "status": "success",
        "message": "Lead information updated successfully",
        "lead_id": lead_id
    }
