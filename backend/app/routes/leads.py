from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from typing import List, Dict, Optional, Any, Union, Set
from bson import ObjectId
import uuid
import secrets
import string
import os
import io
import zipfile
import tempfile
import shutil
import traceback
import time
import asyncio
import logging

# Set up logger
logger = logging.getLogger(__name__)
from app.database.Leads import LeadsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Departments import DepartmentsDB
from app.database.Notifications import NotificationsDB
from app.database import get_database_instances
from app.schemas.lead_schemas import (
    LeadCreate, LeadUpdate, LeadInDB, LeadAssign, LeadTransfer, LeadAddReporter,
    NoteCreate, NoteUpdate, NoteInDB,
    DocumentCreate, DocumentUpdate, DocumentInDB,
    ActivityInDB, TransferInDB,
    FormFieldCreate, FormFieldUpdate, FormFieldInDB,
    StatusCreate, StatusUpdate, StatusInDB,
    SubStatusCreate, SubStatusUpdate, SubStatusInDB,
    AssignmentConfigCreate, AssignmentConfigUpdate, AssignmentConfigInDB,
    AssignmentOptions, UserOption,
    ReportingOption,
    ShareLinkCreate, ShareLinkInDB, PublicLeadFormUpdate
)
from app.utils.permission_helpers import is_super_admin_permission
from app.utils.performance_cache import (
    cached_response, cache_user_permissions, get_cached_user_permissions,
    cache_leads_list, get_cached_leads_list, performance_monitor, invalidate_cache_pattern
)

from app.utils.common_utils import ObjectIdStr, convert_object_id, convert_object_ids_in_list
from app.utils.lead_utils import save_upload_file, get_file_type, get_relative_media_url
from app.utils.permissions import (
    check_permission, check_any_permission, get_user_capabilities, 
    is_admin, check_lead_view_permission, permission_manager,
    get_user_permissions, get_user_role, has_permission,
    get_lead_visibility_filter, can_view_lead, filter_leads_by_hierarchy,
    get_lead_user_capabilities
)
from datetime import datetime
from fastapi.responses import StreamingResponse

router = APIRouter(
    prefix="/leads",
    tags=["leads"]
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

async def get_departments_db():
    db_instances = get_database_instances()
    return db_instances["departments"]

async def get_notifications_db():
    db_instances = get_database_instances()
    return db_instances["notifications"]

# ========= Lead Management =========

@router.post("/", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_lead(
    lead: LeadCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Create a new lead"""
    # Check permission
    # await check_permission(user_id, "leads", "create", users_db, roles_db)
    
    # Validate department
    if lead.department_id:
        department = await departments_db.get_department(lead.department_id)
        if not department:
            department = "Unknown"
    
    # Validate assigned user
    if lead.assigned_to:
        assigned_user = await users_db.get_user(lead.assigned_to)
        if not assigned_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with ID {lead.assigned_to} not found"
            )
    
    # Validate reporting users
    if lead.assign_report_to:
        valid_reporters = []
        for reporter_id in lead.assign_report_to:
            reporter = await users_db.get_user(reporter_id)
            if reporter:
                valid_reporters.append(reporter_id)
        
        # Replace with only valid user IDs
        lead.assign_report_to = valid_reporters
    
    # Get user's full name and department
    user = await users_db.get_user(user_id)
    user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}" if user else "Unknown User"
    
    # Get user's role
    user_role_name = "Unknown Role"
    if user and user.get('role_id'):
        role = await roles_db.get_role(user.get('role_id'))
        if role:
            user_role_name = role.get('name', 'Unknown Role')
    
    # If department_id is not provided, use the user's department
    if not lead.department_id and user and user.get('department_id'):
        lead.department_id = str(user.get('department_id'))
    
    # Get department name (team name)
    department_name = "Unknown Department"
    department_id = lead.department_id
    
    if department_id:
        department = await departments_db.get_department(department_id)
        if department:
            # Use department name as team name
            department_name = department.get('name', 'Unknown Department')
            
            # Check if this is a child department - if it is, prefer it as the team name
            if department.get('parent_id'):
                pass  # Use the child department name directly
    # If department_id is not provided but user has a department, use it
    elif user and user.get('department_id'):
        department = await departments_db.get_department(user.get('department_id'))
        if department:
            department_name = department.get('name', 'Unknown Department')
            # Also update the lead's department_id
            lead.department_id = str(user.get('department_id'))
    
    # Department and user information set up, ready to create lead
    
    # Create the lead with additional fields
    lead_dict = lead.dict()
    
    # Handle mobile_number field mapping
    if hasattr(lead, 'mobile_number') and lead.mobile_number:
        # If mobile_number is provided, use it as the primary phone
        lead_dict["phone"] = lead.mobile_number
        # Keep mobile_number for backward compatibility
        lead_dict["mobile_number"] = lead.mobile_number
    elif "mobile_number" in lead_dict and lead_dict["mobile_number"]:
        # If mobile_number is in the dict, map it to phone
        lead_dict["phone"] = lead_dict["mobile_number"]
    
    # Ensure created_by is set to the current user_id (who is creating this lead)
    lead_dict["created_by"] = user_id
    lead_dict["created_by_name"] = user_name.strip()
    lead_dict["created_by_role"] = user_role_name
    lead_dict["department_name"] = department_name
    
    # If no assigned_to is specified, automatically assign to the creator
    if not lead_dict.get("assigned_to"):
        lead_dict["assigned_to"] = user_id
    
    # Handle created_date field - if provided in the payload, use it
    if hasattr(lead, 'created_date') and lead.created_date:
        lead_dict["created_date"] = lead.created_date
    elif "created_date" in lead_dict and lead_dict["created_date"]:
        # Keep the provided created_date
        pass  # It's already in lead_dict
    else:
        # If not provided, it will be set automatically in the database layer
        pass
    
    # Make sure alternative_phone is included if it was provided
    if hasattr(lead, 'alternative_phone') and lead.alternative_phone:
        lead_dict["alternative_phone"] = lead.alternative_phone
    
    # Make sure department_id is included, if it wasn't provided but was determined from user's department
    if lead.department_id and "department_id" not in lead_dict:
        lead_dict["department_id"] = lead.department_id
        
    # Handle loan_type attributes - ensure we store both ID and name
    from app.database.LoanTypes import LoanTypesDB
    loan_types_db = LoanTypesDB()
    
    # 1. First check if both loan_type_id and loan_type_name are already provided
    if hasattr(lead, 'loan_type_id') and lead.loan_type_id and hasattr(lead, 'loan_type_name') and lead.loan_type_name:
        if ObjectId.is_valid(lead.loan_type_id):
            lead_dict["loan_type_id"] = lead.loan_type_id
            lead_dict["loan_type_name"] = lead.loan_type_name
            # For backward compatibility
            lead_dict["loan_type"] = lead.loan_type_name
    
    # 2. If only loan_type_id is provided
    elif hasattr(lead, 'loan_type_id') and lead.loan_type_id:
        if ObjectId.is_valid(lead.loan_type_id):
            lead_dict["loan_type_id"] = lead.loan_type_id
            # Try to find the name
            try:
                loan_type = await loan_types_db.get_loan_type(lead.loan_type_id)
                if loan_type:
                    lead_dict["loan_type_name"] = loan_type.get("name", "")
                    # For backward compatibility
                    lead_dict["loan_type"] = loan_type.get("name", "")
            except Exception as e:
                print(f"Error looking up loan type name: {e}")
    
    # 3. If only loan_type_name is provided
    elif hasattr(lead, 'loan_type_name') and lead.loan_type_name:
        lead_dict["loan_type_name"] = lead.loan_type_name
        # For backward compatibility
        lead_dict["loan_type"] = lead.loan_type_name
        # Try to find the ID
        try:
            loan_type = await loan_types_db.get_loan_type_by_name(lead.loan_type_name)
            if loan_type:
                lead_dict["loan_type_id"] = str(loan_type.get("_id", ""))
        except Exception as e:
            print(f"Error looking up loan type ID: {e}")
    
    # 4. Fall back to legacy loan_type field (backward compatibility)
    elif lead.loan_type:
        # If loan_type looks like an ID (ObjectId), store it as loan_type_id
        if ObjectId.is_valid(lead.loan_type):
            lead_dict["loan_type_id"] = lead.loan_type
            # Try to find the name
            try:
                loan_type = await loan_types_db.get_loan_type(lead.loan_type)
                if loan_type:
                    lead_dict["loan_type_name"] = loan_type.get("name", "")
                    # Keep the original loan_type for backward compatibility
                    lead_dict["loan_type"] = loan_type.get("name", "")
            except Exception as e:
                print(f"Error looking up loan type name: {e}")
        # If it looks like a name, store it as loan_type_name
        else:
            lead_dict["loan_type_name"] = lead.loan_type
            lead_dict["loan_type"] = lead.loan_type
            # Try to find the ID
            try:
                loan_type = await loan_types_db.get_loan_type_by_name(lead.loan_type)
                if loan_type:
                    lead_dict["loan_type_id"] = str(loan_type.get("_id", ""))
            except Exception as e:
                print(f"Error looking up loan type ID: {e}")
        
    lead_id = await leads_db.create_lead(lead_dict)
    
    # Clear LoginCRM cache since new lead might appear in login department views
    from app.utils.performance_cache import invalidate_cache_pattern
    await invalidate_cache_pattern("login-department-leads*")
    
    return {"id": lead_id, "department_name": department_name}

@router.get("/check-phone/{phone_number}", response_model=Dict[str, Any])
async def check_phone_number(
    phone_number: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    loan_type_id: Optional[str] = Query(None, description="ID of the loan type for uniqueness check"),
    loan_type_name: Optional[str] = Query(None, description="Name of the loan type for uniqueness check"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Check if a combination of phone number and loan type exists in the leads database
    Searches in both main phone field and alternative_phone fields
    Optional loan_type_id or loan_type_name can be provided to check for the unique combination
    """
    # Check permission
    await check_permission(user_id, "leads", "show", users_db, roles_db)
    
    # Clean phone number - remove spaces, dashes, etc.
    clean_phone = phone_number.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    
    # Set up the phone number search filter
    phone_conditions = [
        {"phone": {"$regex": clean_phone, "$options": "i"}},
        {"alternative_phone": {"$regex": clean_phone, "$options": "i"}}
    ]
    
    # If loan type information is provided, add it to the search filter
    search_filter = {}
    if loan_type_id or loan_type_name:
        loan_type_conditions = []
        if loan_type_id and ObjectId.is_valid(loan_type_id):
            loan_type_conditions.append({"loan_type_id": loan_type_id})
        
        if loan_type_name:
            loan_type_conditions.append({"loan_type_name": loan_type_name})
            # For backward compatibility
            loan_type_conditions.append({"loan_type": loan_type_name})
        
        # Combine phone and loan type conditions
        search_filter = {
            "$and": [
                {"$or": phone_conditions},
                {"$or": loan_type_conditions}
            ]
        }
    else:
        # If no loan type provided, just use phone conditions
        search_filter = {
            "$or": [
                # Only search in these two fields
            {"phone": {"$regex": clean_phone, "$options": "i"}},
            {"alternative_phone": {"$regex": clean_phone, "$options": "i"}}
        ]
    }
    
    # Get leads matching the phone number and loan type (if provided)
    matching_leads = await leads_db.list_leads(
        filter_dict=search_filter,
        skip=0,
        limit=10,  # Limit to first 10 matches
        sort_by="created_at",
        sort_order=-1
    )
    
    if not matching_leads:
        # Construct message based on what was searched
        message = "Phone number"
        if loan_type_id or loan_type_name:
            message += " with the selected loan type"
        message += " not found in database"
        
        return {
            "found": False,
            "message": message,
            "can_create_new": True
        }
    
    # Check lead conditions for reassignment
    current_time = datetime.now()
    lead_results = []
    
    for lead in matching_leads:
        lead_age_days = 0
        if lead.get("created_at"):
            try:
                if isinstance(lead["created_at"], str):
                    created_at = datetime.fromisoformat(lead["created_at"].replace("Z", "+00:00"))
                else:
                    created_at = lead["created_at"]
                lead_age_days = (current_time - created_at).days
            except Exception as e:
                print(f"Error calculating lead age: {e}")
        
        lead_status = lead.get("status", "")
        assigned_to = lead.get("assigned_to")
        
        # Determine action based on conditions
        action = "processing"  # Default
        can_reassign = False
        
        # Define status groups for better readability
        active_statuses = ["active", "new", "pending"]
        closed_statuses = ["closed", "completed", "converted", "rejected", "cancelled"]
        processing_statuses = ["processing", "in_progress", "contacted", "under_review"]
        
        if lead_age_days > 15:
            # Lead is older than 15 days - can reassign regardless of status
            # This is the 15-day rule - any lead older than 15 days can be reassigned
            action = "can_reassign"
            can_reassign = True
        elif lead_status in active_statuses:
            if assigned_to != user_id:
                # Lead is active but assigned to someone else - can request reassignment
                action = "can_reassign" 
                can_reassign = True
            else:
                # Lead is active and already assigned to current user
                action = "processing"
        elif lead_status in closed_statuses:
            # Lead is closed/completed - can create new
            action = "can_create_new"
        elif lead_status in processing_statuses:
            # Lead is actively being processed - cannot reassign unless it's older than 15 days
            # (which is handled in the first condition)
            action = "processing"
        else:
            # Any other status - assume processing
            action = "processing"
        
        # Display loan type from either loan_type_name, loan_type, or loan_type_id
        loan_type_display = lead.get("loan_type_name") or lead.get("loan_type") or ""
        
        lead_info = {
            "id": str(lead.get("_id", "")),
            "name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
            "phone": lead.get("phone", ""),
            "email": lead.get("email", ""),
            "status": lead.get("status", ""),
            "sub_status": lead.get("sub_status", ""),
            "loan_type": loan_type_display,
            "loan_type_id": str(lead.get("loan_type_id", "")),
            "login_department_sent_date": lead.get("login_department_sent_date", ""),
            "created_at": lead.get("created_at", ""),
            "assigned_to": assigned_to,
            "created_by": str(lead.get("created_by", "")),
            "assign_report_to": lead.get("assign_report_to"),
            "age_days": lead_age_days,
            "action": action,
            "can_reassign": can_reassign
        }
        lead_results.append(lead_info)
    
    # Determine overall response
    can_create_new = all(lead.get("action") in ["can_create_new", "can_reassign"] for lead in lead_results)
    has_processing = any(lead.get("action") == "processing" for lead in lead_results)
    can_reassign_any = any(lead.get("can_reassign", False) for lead in lead_results)
    
    response = {
        "found": True,
        "total_leads": len(lead_results),
        "leads": lead_results,
        "can_create_new": can_create_new,
        "has_processing": has_processing,
        "can_reassign": can_reassign_any
    }
    
    # Create a message based on what was searched
    message_prefix = "Phone number"
    if loan_type_id or loan_type_name:
        message_prefix += " with the selected loan type"
    
    if has_processing:
        response["message"] = f"{message_prefix} found with leads currently in processing"
    elif can_reassign_any:
        response["message"] = f"{message_prefix} found with leads that can be reassigned"
    else:
        response["message"] = f"{message_prefix} found in database"
    
    return response

@router.post("/{lead_id}/reassign", response_model=Dict[str, str])
async def reassign_lead(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Reassign a lead to the current user"""
    # Check permission
    await check_permission(user_id, "leads", "show", users_db, roles_db)
    
    # Get the lead
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Update assignment
    update_data = {
        "assigned_to": user_id,
        "status": "active",
        "updated_at": datetime.now()
    }
    
    success = await leads_db.update_lead(lead_id, update_data, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reassign lead"
        )
    
    # Clear LoginCRM cache since reassignment might affect login department views  
    from app.utils.performance_cache import invalidate_cache_pattern
    await invalidate_cache_pattern("login-department-leads*")
    
    return {"message": "Lead reassigned successfully"}

@router.post("/{lead_id}/documents", response_model=Dict[str, List[str]])
async def upload_documents(
    lead_id: ObjectIdStr,
    files: List[UploadFile] = File(...),
    document_type: str = Form(...),
    category: str = Form(...),
    description: Optional[str] = Form(None),
    password: Optional[str] = Form(None),  # Password for protected files like PDFs
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Upload one or more documents to a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # # Check permission
    # has_view_permission = await check_lead_view_permission(
    #     lead_id, user_id, leads_db, users_db, roles_db
    # )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # # Check if user can upload attachments to this lead
    # user_capabilities = await get_lead_user_capabilities(
    #     user_id, lead, users_db, roles_db
    # )
    
    # if not user_capabilities.get("can_upload_attachments", False):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to upload attachments to this lead"
    #     )
    
    # Create directory for this lead's documents
    lead_media_dir = await leads_db.create_media_path(lead_id)
    document_ids = []
    
    for file in files:
        if not file.filename:
            continue
            
        # Save file
        file_data = await save_upload_file(file, lead_media_dir)
        
        # Convert path to URL for API usage
        relative_path = get_relative_media_url(file_data["file_path"])
        
        # Create document record
        document_data = {
            "lead_id": lead_id,
            "filename": file.filename,
            "file_path": relative_path,  # URL format for API
            "absolute_file_path": file_data["file_path"],  # Keep the actual file path as well
            "file_type": file_data["file_type"],
            "document_type": document_type,
            "category": category,
            "description": description,
            "password": password if password and password.strip() else None,  # Store password if provided
            "status": "received",
            "uploaded_by": user_id,
            "size": file_data["size"]
        }
        
        document_id = await leads_db.add_document(document_data)
        if document_id:
            document_ids.append(document_id)
    
    if not document_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files were uploaded successfully"
        )
    
    return {"document_ids": document_ids}

@router.get("/{lead_id}/documents", response_model=List[Dict[str, Any]])
async def get_lead_documents(
    lead_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all documents for a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    # has_view_permission = await check_lead_view_permission(
    #     lead_id, user_id, leads_db, users_db, roles_db
    # )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Get documents
    documents = await leads_db.get_lead_documents(lead_id)
    
    # Convert ObjectIds to strings and enhance with user info
    enhanced_documents = []
    for doc in documents:
        doc_dict = convert_object_id(doc)
        
        # Add uploader info
        if doc.get("uploaded_by"):
            uploader = await users_db.get_user(doc["uploaded_by"])
            if uploader:
                doc_dict["uploader_name"] = f"{uploader.get('first_name', '')} {uploader.get('last_name', '')}"
        
        # Check if user can edit/delete this document
        capabilities = await get_user_capabilities(user_id, "leads", users_db, roles_db)
        doc_dict["can_edit"] = capabilities["can_edit"]
        doc_dict["can_delete"] = capabilities["can_delete"]
        
        # Add has_password flag without exposing the actual password
        doc_dict["has_password"] = bool(doc.get("password"))
        
        enhanced_documents.append(doc_dict)
    
    return enhanced_documents

@router.put("/{lead_id}/documents/{document_id}", response_model=Dict[str, str])
async def update_document(
    lead_id: ObjectIdStr,
    document_id: ObjectIdStr,
    document_update: DocumentUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a document's metadata or status"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    # await check_permission(user_id, "leads", "create", users_db, roles_db)
    
    # Update document
    update_dict = {k: v for k, v in document_update.dict().items() if v is not None}
    success = await leads_db.update_document(document_id, update_dict, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update document"
        )
    
    return {"message": "Document updated successfully"}

@router.delete("/{lead_id}/documents/{document_id}", response_model=Dict[str, str])
async def delete_document(
    lead_id: ObjectIdStr,
    document_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a document"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    # await check_permission(user_id, "leads", "create", users_db, roles_db)
    
    # Delete document
    success = await leads_db.delete_document(document_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document"
        )
    
    return {"message": "Document deleted successfully"}

# Individual attachment endpoints for view, download and delete
@router.get("/{lead_id}/attachments/{attachment_id}/view")
async def view_attachment(
    lead_id: ObjectIdStr,
    attachment_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """View/preview an attachment file"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # # Check permission
    # has_view_permission = await check_lead_view_permission(
    #     lead_id, user_id, leads_db, users_db, roles_db
    # )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Get the document
    document = await leads_db.get_document(attachment_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Verify document belongs to this lead
    if document.get("lead_id") != lead_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attachment does not belong to this lead"
        )
    
    # First try to get the absolute file path if it exists (for newer documents)
    abs_file_path = document.get("absolute_file_path")
    
    # If absolute_file_path is not found, fall back to legacy path resolution
    if not abs_file_path:
        # Get file path and check if it exists
        file_path = document.get("file_path")
        if not file_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File path not found in document"
            )
        
        # Handle different path formats
        # 1. If the path is a URL format like "/leads/utils/lead-file/123/file.jpg"
        if file_path.startswith("/leads/utils/lead-file/"):
        # Convert back to file system path
            parts = file_path.split("/leads/utils/lead-file/")
            if len(parts) > 1:
                rel_path = f"media/leads/{parts[1]}"
                abs_file_path = os.path.join(os.getcwd(), rel_path)
            else:
                abs_file_path = file_path
        # 2. If already absolute path
        elif os.path.isabs(file_path):
            abs_file_path = file_path
        # 3. If it's a relative path
        else:
            abs_file_path = os.path.join(os.getcwd(), file_path)
        
        # Debug information for tracing path issues
        print(f"Document ID: {attachment_id}")
        print(f"Original path: {file_path}")
        print(f"Resolved path: {abs_file_path}")
    
    if not os.path.exists(abs_file_path):
        # Try to find the file in media directory as fallback
        filename = os.path.basename(abs_file_path)
        fallback_path = os.path.join(os.getcwd(), "media", "leads", str(lead_id), filename)
        
        if os.path.exists(fallback_path):
            abs_file_path = fallback_path
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found on disk. Tried paths: {abs_file_path}, {fallback_path}"
            )
    
    # Return file for viewing
    return FileResponse(
        path=abs_file_path,
        filename=document.get("filename", "attachment"),
        media_type=document.get("file_type", "application/octet-stream")
    )

@router.get("/{lead_id}/attachments/{attachment_id}/download")
async def download_attachment(
    lead_id: ObjectIdStr,
    attachment_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Download an attachment file"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    # has_view_permission = await check_lead_view_permission(
    #     lead_id, user_id, leads_db, users_db, roles_db
    # )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Get the document
    document = await leads_db.get_document(attachment_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Verify document belongs to this lead
    if document.get("lead_id") != lead_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attachment does not belong to this lead"
        )
    
    # First try to get the absolute file path if it exists (for newer documents)
    abs_file_path = document.get("absolute_file_path")
    
    # If absolute_file_path is not found, fall back to legacy path resolution
    if not abs_file_path:
        # Get file path and check if it exists
        file_path = document.get("file_path")
        if not file_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File path not found in document"
            )
        
        # Handle different path formats
        # 1. If the path is a URL format like "/leads/utils/lead-file/123/file.jpg"
        if file_path.startswith("/leads/utils/lead-file/"):
        # Convert back to file system path
            parts = file_path.split("/leads/utils/lead-file/")
            if len(parts) > 1:
                rel_path = f"media/leads/{parts[1]}"
                abs_file_path = os.path.join(os.getcwd(), rel_path)
            else:
                abs_file_path = file_path
        # 2. If already absolute path
        elif os.path.isabs(file_path):
            abs_file_path = file_path
        # 3. If it's a relative path
        else:
            abs_file_path = os.path.join(os.getcwd(), file_path)
        
        # Debug information for tracing path issues
        print(f"Document ID: {attachment_id}")
        print(f"Original path: {file_path}")
        print(f"Resolved path: {abs_file_path}")
    
    if not os.path.exists(abs_file_path):
        # Try to find the file in media directory as fallback
        filename = os.path.basename(abs_file_path)
        fallback_path = os.path.join(os.getcwd(), "media", "leads", str(lead_id), filename)
        
        if os.path.exists(fallback_path):
            abs_file_path = fallback_path
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found on disk. Tried paths: {abs_file_path}, {fallback_path}"
            )
    
    # Return file for download
    return FileResponse(
        path=abs_file_path,
        filename=document.get("filename", "attachment"),
        media_type="application/octet-stream"
    )

@router.delete("/{lead_id}/attachments/{attachment_id}")
async def delete_attachment(
    lead_id: ObjectIdStr,
    attachment_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete an attachment"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission using the proper permission utility
    # try:
    #     await check_permission(user_id, "leads", "create", users_db, roles_db)
    # except HTTPException:
    #     # If direct permission check fails, check for super admin
    #     permissions = await get_user_permissions(user_id, users_db, roles_db)
    #     is_super_admin = any(
    #         perm.get("page") == "*" and (
    #             perm.get("actions") == "*" or 
    #             (isinstance(perm.get("actions"), list) and "*" in perm.get("actions", []))
    #         )
    #         for perm in permissions
    #     )
        
    #     if not is_super_admin:
    #         raise HTTPException(
    #             status_code=status.HTTP_403_FORBIDDEN,
    #             detail="You don't have permission to delete attachments"
    #     )
    
    # Get the document to verify it belongs to this lead
    document = await leads_db.get_document(attachment_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Verify document belongs to this lead
    if document.get("lead_id") != lead_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attachment does not belong to this lead"
        )
    
    # Delete document from database
    success = await leads_db.delete_document(attachment_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete attachment"
        )
    
    # Optionally delete the physical file as well
    file_path = document.get("file_path")
    if file_path:
        # Convert relative path to absolute path if needed
        if not os.path.isabs(file_path):
            abs_file_path = os.path.join(os.getcwd(), file_path)
        else:
            abs_file_path = file_path
        
        # Try to delete the physical file (non-critical if it fails)
        try:
            if os.path.exists(abs_file_path):
                os.remove(abs_file_path)
        except Exception as e:
            # Log the error but don't fail the request
            print(f"Warning: Could not delete physical file {abs_file_path}: {e}")
    
    return {"message": "Attachment deleted successfully"}

@router.get("/", response_model=List[Dict[str, Any]])
async def list_leads(
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    loan_type: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: int = -1,
    no_activity_date: Optional[str] = None,
    page: int = Query(1, ge=1, description="Page number (starts from 1)"),
    page_size: int = Query(0, ge=0, le=50000, description="Number of items per page (0 = all items, max 50000)"),
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """
    ⚡ ULTRA HIGH-PERFORMANCE List leads with filtering and optimization
    
    Optimizations implemented:
    - Batch fetching for related data (users, departments) in single queries
    - Optimized field projection (excludes only heavy attachment/activity data)
    - Indexed database queries for fast filtering
    - Parallel async processing for related data
    - Response time monitoring
    - Default: Returns ALL leads (page_size=0) for best user experience
    
    Performance target: <2s for all leads with full data
    """
    start_time = time.time()
    
    try:
        # ⚡ STEP 1: Fast permission check (caching temporarily disabled)
        t1 = time.time()
        # cached_permissions = await get_cached_user_permissions(user_id)
        # if not cached_permissions:
        await check_permission(user_id, "leads", "show", users_db, roles_db)
        logger.info(f"⏱️ Permission check: {(time.time()-t1)*1000:.2f}ms")
            # Cache permissions for future requests
            # user_permissions = await get_user_permissions(user_id, users_db, roles_db)
            # await cache_user_permissions(user_id, user_permissions)
        
        # ⚡ STEP 2: Calculate pagination parameters
        t2 = time.time()
        # If page_size is 0, fetch all leads (no limit)
        if page_size == 0:
            skip = 0
            limit = 0  # 0 means no limit in database query
        else:
            skip = (page - 1) * page_size
            limit = page_size
        
        # ⚡ STEP 3: Generate cache key for this specific query (including pagination)
        # Note: Temporarily disabled caching to avoid hashable issues with complex filters
        # TODO: Re-enable with proper serialization of filter_dict
        # import json
        # filters_str = json.dumps({
        #     "status": status,
        #     "department_id": department_id,
        #     "assigned_to": assigned_to,
        #     "loan_type": loan_type,
        #     "search": search,
        #     "sort_by": sort_by,
        #     "sort_order": sort_order,
        #     "no_activity_date": no_activity_date,
        #     "page": page,
        #     "page_size": page_size
        # }, sort_keys=True)
        
        # ⚡ STEP 4: Try cache first for massive speed boost (5-second TTL)
        # cached_leads = await get_cached_leads_list(user_id, filters_str, ttl_seconds=5)
        # if cached_leads is not None:
        #     response_time = (time.time() - start_time) * 1000
        #     performance_monitor.record_request_time("GET /leads [CACHED]", response_time / 1000)
        #     return cached_leads
        
        # ⚡ STEP 5: Fast visibility filter (optimized query)
        t3 = time.time()
        visibility_filter = await get_lead_visibility_filter(user_id, users_db, roles_db)
        logger.info(f"⏱️ Visibility filter: {(time.time()-t3)*1000:.2f}ms")
        
        # ⚡ STEP 6: Build optimized filter with indexes in mind
        # Deep copy to avoid modifying the original
        import copy
        filter_dict = copy.deepcopy(visibility_filter) if visibility_filter else {}
        
        if status:
            filter_dict["status"] = status
        
        if department_id:
            filter_dict["department_id"] = department_id
        
        if assigned_to:
            filter_dict["assigned_to"] = assigned_to
            
        # Support both loan_type ID and loan_type name for compatibility
        if loan_type:
            filter_dict["$or"] = filter_dict.get("$or", [])
            filter_dict["$or"].extend([
                {"loan_type": loan_type},                   # Match exact loan_type (for both ID and name)
                {"loan_type_name": loan_type},              # Match exact loan_type_name field if it exists
                {"loan_type_id": loan_type},                # Match exact loan_type_id field if it exists
                {"loan_type": {"$regex": f"^{loan_type}$", "$options": "i"}}  # Case-insensitive exact match
            ])
        
        if search:
            # ⚡ OPTIMIZED: Search in indexed fields first
            search_conditions = [
                {"first_name": {"$regex": search, "$options": "i"}},
                {"last_name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}}
            ]
            
            # Add search conditions to existing $or if it exists, otherwise create new $or
            if "$or" in filter_dict:
                filter_dict["$or"].extend(search_conditions)
            else:
                filter_dict["$or"] = search_conditions

        # Handle no_activity_date filter
        if no_activity_date:
            try:
                from datetime import datetime
                # Parse the date string to datetime object
                since_date = datetime.fromisoformat(no_activity_date.replace('Z', '+00:00'))
                
                # First get all leads, then filter by activity
                # We'll do this in two phases: get leads, then check activities
                # Note: For no_activity_date filter, we need to fetch more than requested
                # to account for filtering, then slice to page size
                temp_leads = await leads_db.list_leads(
                    filter_dict=filter_dict,
                    skip=0,
                    limit=page_size * 3,  # Fetch 3x to ensure we have enough after filtering
                    sort_by=sort_by,
                    sort_order=sort_order
                )
                
                # Filter leads that have NO activity since the specified date
                leads_with_no_activity = []
                for lead in temp_leads:
                    lead_id = str(lead.get('_id'))
                    
                    # Check if lead has any activity since the specified date
                    # Get recent activities for this lead (limit to 100 to avoid memory issues)
                    activities = await leads_db.get_lead_activities(lead_id, skip=0, limit=100)
                    
                    # Check if any activity exists after the specified date
                    has_recent_activity = False
                    for activity in activities:
                        activity_date = activity.get('created_at') or activity.get('date') or activity.get('timestamp')
                        if activity_date and activity_date > since_date:
                            has_recent_activity = True
                            break
                    
                    # If no recent activities found after the date, include this lead
                    if not has_recent_activity:
                        leads_with_no_activity.append(lead)
                
                leads = leads_with_no_activity
                
            except ValueError as e:
                # If date parsing fails, ignore the filter
                print(f"Invalid no_activity_date format: {no_activity_date}, error: {e}")
                leads = await leads_db.list_leads(
                    filter_dict=filter_dict,
                    skip=skip,
                    limit=limit,
                    sort_by=sort_by,
                    sort_order=sort_order
                )
        else:
            # ⚡ STEP 7: Execute optimized database query with pagination
            t4 = time.time()
            leads = await leads_db.list_leads(
                filter_dict=filter_dict,
                skip=skip,
                limit=limit,
                sort_by=sort_by,
                sort_order=sort_order
            )
            logger.info(f"⏱️ Database query (returned {len(leads)} leads): {(time.time()-t4)*1000:.2f}ms")
        
        # ⚡ STEP 8: BATCH OPTIMIZATION - Collect all user and department IDs
        t5 = time.time()
        user_ids_to_fetch = set()
        dept_ids_to_fetch = set()
        
        for lead in leads:
            # Handle assigned_to which can be either a string or a list
            if lead.get("assigned_to"):
                assigned_to = lead["assigned_to"]
                if isinstance(assigned_to, list):
                    user_ids_to_fetch.update(assigned_to)
                else:
                    user_ids_to_fetch.add(assigned_to)
            
            if lead.get("created_by"):
                user_ids_to_fetch.add(lead["created_by"])
            if lead.get("department_id"):
                dept_ids_to_fetch.add(lead["department_id"])
        
        # ⚡ STEP 9: ULTRA-FAST Batch fetch all users and departments in ONE query each
        user_cache = {}
        dept_cache = {}
        
        # Use optimized batch methods for O(1) lookup instead of N queries
        async def fetch_users():
            if user_ids_to_fetch:
                try:
                    # Fetch all users in ONE database query
                    user_cache.update(await users_db.get_users_batch(list(user_ids_to_fetch)))
                except Exception as e:
                    logger.error(f"Error batch fetching users: {e}")
        
        async def fetch_departments():
            if dept_ids_to_fetch:
                try:
                    # Fetch all departments in ONE database query
                    dept_cache.update(await departments_db.get_departments_batch(list(dept_ids_to_fetch)))
                except Exception as e:
                    logger.error(f"Error batch fetching departments: {e}")
        
        # Run both fetches in parallel for maximum speed
        t6 = time.time()
        await asyncio.gather(fetch_users(), fetch_departments())
        logger.info(f"⏱️ Batch fetch users ({len(user_cache)}) & departments ({len(dept_cache)}): {(time.time()-t6)*1000:.2f}ms")
        logger.info(f"⏱️ ID collection: {(t6-t5)*1000:.2f}ms")
        
        # ⚡ STEP 10: Fast data transformation with cached lookups
        t7 = time.time()
        enhanced_leads = []
        for lead in leads:
            lead_dict = convert_object_id(lead)
            
            # ⚡ OPTIMIZED: Use cached user info
            # Handle assigned_to which can be either a string or a list
            if "assigned_to" in lead_dict and lead_dict["assigned_to"]:
                assigned_to = lead_dict["assigned_to"]
                
                # If it's a list, use the first assignee for display
                if isinstance(assigned_to, list):
                    if assigned_to:  # Non-empty list
                        user = user_cache.get(assigned_to[0])
                        if user:
                            lead_dict["assigned_to_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                            lead_dict["assigned_to_email"] = user.get('email', '')
                        else:
                            lead_dict["assigned_to_name"] = "Unknown User"
                            lead_dict["assigned_to_email"] = ""
                    else:
                        lead_dict["assigned_to_name"] = "Unassigned"
                        lead_dict["assigned_to_email"] = ""
                else:
                    # Single assignee (string)
                    user = user_cache.get(assigned_to)
                    if user:
                        lead_dict["assigned_to_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                        lead_dict["assigned_to_email"] = user.get('email', '')
                    else:
                        lead_dict["assigned_to_name"] = "Unknown User"
                        lead_dict["assigned_to_email"] = ""
            else:
                lead_dict["assigned_to_name"] = "Unassigned"
                lead_dict["assigned_to_email"] = ""
            
            # ⚡ OPTIMIZED: Use cached creator info
            if "created_by" in lead_dict and lead_dict["created_by"]:
                if not lead_dict.get("created_by_name"):
                    creator = user_cache.get(lead_dict["created_by"])
                    if creator:
                        lead_dict["created_by_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
                        if not lead_dict["created_by_name"]:
                            lead_dict["created_by_name"] = creator.get('username', 'Unknown User')
                    else:
                        lead_dict["created_by_name"] = "Unknown User"
            
            # ⚡ OPTIMIZED: Use cached department info
            if "department_id" in lead_dict and lead_dict["department_id"]:
                if not lead_dict.get("department_name") or (isinstance(lead_dict.get("department_name"), str) and not lead_dict["department_name"].strip()):
                    department = dept_cache.get(lead_dict["department_id"])
                    if department:
                        lead_dict["department_name"] = department.get('name', 'Unknown Department')
                    else:
                        lead_dict["department_name"] = "Unknown Department"
            elif not lead_dict.get("department_name"):
                # If no department_id, try to get from creator's department
                if "created_by" in lead_dict and lead_dict["created_by"]:
                    creator = user_cache.get(lead_dict["created_by"])
                    if creator and creator.get("department_id"):
                        department = dept_cache.get(creator["department_id"])
                        if department:
                            lead_dict["department_name"] = department.get('name', 'Unknown Department')
            
            enhanced_leads.append(lead_dict)
        
        logger.info(f"⏱️ Data transformation: {(time.time()-t7)*1000:.2f}ms")
        
        # ⚡ STEP 11: Cache the results for future requests (5-second TTL)
        # Temporarily disabled - see above
        # await cache_leads_list(user_id, filters_str, enhanced_leads, ttl_seconds=5)
        
        # ⚡ STEP 12: Performance monitoring
        response_time = (time.time() - start_time) * 1000
        performance_monitor.record_request_time("GET /leads", response_time / 1000)
        
        # Log performance metrics with detail
        total_leads = len(enhanced_leads)
        page_info = f"ALL LEADS" if page_size == 0 else f"page {page}, size {page_size}"
        logger.info(f"✅ GET /leads TOTAL TIME: {response_time:.2f}ms - returned {total_leads} leads ({page_info})")
        
        return enhanced_leads
        
    except Exception as e:
        # Log error and fallback to uncached response
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Error retrieving leads: {str(e)}\n{error_trace}")
        response_time = (time.time() - start_time) * 1000
        performance_monitor.record_request_time("GET /leads [ERROR]", response_time / 1000)
        raise HTTPException(status_code=500, detail=f"Error retrieving leads: {str(e)}")
        
        # Add assigned user info
        if lead.get("assigned_to"):
            assigned_user = await users_db.get_user(lead["assigned_to"])
            if assigned_user:
                lead_dict["assigned_user_name"] = f"{assigned_user.get('first_name', '')} {assigned_user.get('last_name', '')}"
        
        # Department name handling - prioritize in order:
        # 1. If department_id exists, use that department's name
        # 2. If created_by exists, fetch user's department
        # 3. If already has department_name, keep it
        # 4. Default to "Unknown Department"
        if lead.get("department_id"):
            department = await departments_db.get_department(lead["department_id"])
            if department:
                lead_dict["department_name"] = department.get("name", "Unknown Department")
        # Get department from creator if department info is missing
        elif lead.get("created_by"):
            creator = await users_db.get_user(lead.get("created_by"))
            if creator and creator.get("department_id"):
                department = await departments_db.get_department(creator.get("department_id"))
                if department:
                    lead_dict["department_name"] = department.get("name", "Unknown Department")
            # If we have a department name already, keep it
            elif lead.get("department_name"):
                # Keep existing department_name
                pass
            # Otherwise use default
            else:
                lead_dict["department_name"] = "Unknown Department"
        # If we have a department name already, keep it
        elif lead.get("department_name"):
            # Keep existing department_name
            pass
        # Set a default if neither department_id nor department_name is available
        else:
            lead_dict["department_name"] = "Unknown Department"
        
        # Add status name
        if lead.get("status"):
            status_obj = await leads_db.get_status_by_id(lead["status"])
            if status_obj:
                lead_dict["status_name"] = status_obj.get("name")
        
        # Add sub-status name
        if lead.get("sub_status"):
            sub_status_obj = await leads_db.get_sub_status_by_id(lead["sub_status"])
            if sub_status_obj:
                lead_dict["sub_status_name"] = sub_status_obj.get("name")
        
        # Add user capabilities for this lead
        user_capabilities = await get_lead_user_capabilities(
            user_id, lead, users_db, roles_db
        )
        lead_dict.update(user_capabilities)
        
        enhanced_leads.append(lead_dict)
    
    return enhanced_leads

@router.get("/assignment-options", response_model=AssignmentOptions)
async def get_assignment_options(
    department_id: Optional[str] = None,
    exclude_user_id: Optional[str] = None,
    show_all_users: bool = False,  # New parameter for transfer functionality
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get users who can be assigned leads and departments"""
    try:
        # Check view permission
        await check_permission(user_id, "leads", "show", users_db, roles_db)
        
        # Get eligible users
        users = []
        if department_id and department_id.strip():
            # Validate department_id is a valid ObjectId before using it
            if not ObjectId.is_valid(department_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid department ID format: {department_id}"
                )
            
            if show_all_users:
                # For transfer: show ALL users in the department
                all_users = await users_db.get_employees(department_id=department_id)
                assignees = [user for user in all_users if str(user.get("_id")) != exclude_user_id]
            else:
                # For assignment: show TL users (Team Leaders) in the department
                assignees = await leads_db.get_tl_users_in_department(department_id, exclude_user_id)
                
            for user in assignees:
                user_dict = convert_object_id(user)
                # Get role name
                if user.get("role_id"):
                    role = await roles_db.get_role(user["role_id"])
                    if role:
                        user_dict["role_name"] = role.get("name")
                
                users.append(UserOption(
                    id=user_dict["_id"],
                    name=f"{user.get('first_name', '')} {user.get('last_name', '')}",
                    username=user.get("username", ""),
                    role_name=user_dict.get("role_name"),
                    department_id=user.get("department_id"),
                    designation=user.get("designation", "")
                ))
        
        # Get departments
        all_departments = await departments_db.list_departments({"is_active": True})
        department_options = []
        
        for dept in all_departments:
            department_options.append({
                "id": str(dept["_id"]),
                "name": dept["name"]
            })
        
        return {
            "users": users,
            "departments": department_options
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching assignment options: {str(e)}"
        )

@router.get("/{lead_id}", response_model=Dict[str, Any])
async def get_lead(
    lead_id: ObjectIdStr,
    skip_auth: bool = False,
    user_id: Optional[str] = Query(None, description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a specific lead by ID"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # For public access (skip_auth=true), return limited data
    if skip_auth:
        # Only block access if form_share is explicitly False AND there are submission timestamps
        # This allows admin-regenerated links to work while still blocking truly submitted forms
        if lead.get("form_share") is False:
            dynamic_fields = lead.get("dynamic_fields", {})
            applicant_submitted = dynamic_fields.get("applicant_form", {}).get("formSubmittedAt")
            co_applicant_submitted = dynamic_fields.get("co_applicant_form", {}).get("formSubmittedAt")
            
            # Only block if there are actual submission timestamps
            if applicant_submitted or co_applicant_submitted:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This form has already been submitted and cannot be accessed again. Please contact support for assistance."
                )
        
        # Return public-safe lead data
        public_lead_data = {
            "_id": str(lead["_id"]),
            "first_name": lead.get("first_name", ""),
            "last_name": lead.get("last_name", ""),
            "email": lead.get("email", ""),
            "phone": lead.get("phone", ""),
            "mobile_number": lead.get("mobile_number", ""),
            "loan_type": lead.get("loan_type", ""),
            "loan_amount": lead.get("loan_amount"),
            "form_share": lead.get("form_share", True),  # Include form_share status - default to True for backward compatibility
            "dynamic_fields": lead.get("dynamic_fields", {})
        }
        return public_lead_data
    
    # For authenticated access, check permission if user_id is provided
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="user_id is required for authenticated access"
        )
        
    # Check permission
    has_view_permission = await check_lead_view_permission(
        lead_id, user_id, leads_db, users_db, roles_db
    )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Convert ObjectIds to strings
    lead_dict = convert_object_id(lead)
    
    # Add user capabilities for this lead
    user_capabilities = await get_lead_user_capabilities(
        user_id, lead, users_db, roles_db
    )
    lead_dict.update(user_capabilities)
    
    # Enhance with related information
    
    # Add assigned user info
    if lead.get("assigned_to"):
        assigned_user = await users_db.get_user(lead["assigned_to"])
        if assigned_user:
            lead_dict["assigned_user_name"] = f"{assigned_user.get('first_name', '')} {assigned_user.get('last_name', '')}"
    
    # Add creator info
    if lead.get("created_by"):
        creator = await users_db.get_user(lead["created_by"])
        if creator:
            lead_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}"
    
    # Add reporting users info
    if lead.get("assign_report_to"):
        reporters = []
        for reporter_id in lead["assign_report_to"]:
            reporter = await users_db.get_user(reporter_id)
            if reporter:
                reporters.append({
                    "id": reporter_id,
                    "name": f"{reporter.get('first_name', '')} {reporter.get('last_name', '')}"
                })
        lead_dict["reporters"] = reporters
    
    # Add user capabilities for this lead
    user_capabilities = await get_lead_user_capabilities(
        user_id, lead, users_db, roles_db
    )
    lead_dict.update(user_capabilities)
    
    # Add status name
    if lead.get("status"):
        status_obj = await leads_db.get_status_by_id(lead["status"])
        if status_obj:
            lead_dict["status_name"] = status_obj.get("name")
            lead_dict["status_color"] = status_obj.get("color")
    
    # Add sub-status name
    if lead.get("sub_status"):
        sub_status_obj = await leads_db.get_sub_status_by_id(lead["sub_status"])
        if sub_status_obj:
            lead_dict["sub_status_name"] = sub_status_obj.get("name")
    
    # Check permissions for actions
    capabilities = await get_user_capabilities(user_id, "leads", users_db, roles_db)
    lead_dict.update(capabilities)
    
    return lead_dict

@router.put("/{lead_id}", response_model=Dict[str, Any])
async def update_lead(
    lead_id: ObjectIdStr,
    lead_update: LeadUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Update a lead"""
    
    # Log the incoming data for debugging
    import logging
    logger = logging.getLogger(__name__)
    
    # Add detailed logging at the very start
    logger.info(f"========== UPDATE LEAD REQUEST START ==========")
    logger.info(f"Lead ID: {lead_id}")
    logger.info(f"User ID: {user_id}")
    logger.info(f"lead_update object: {lead_update}")
    logger.info(f"lead_update.__dict__: {lead_update.__dict__}")
    logger.info(f"lead_update.__fields_set__: {lead_update.__fields_set__}")
    
    try:
        logger.info(f"Lead update request for ID: {lead_id}")
        logger.info(f"Update data type: {type(lead_update)}")
        if hasattr(lead_update, 'dict'):
            update_dict = lead_update.dict(exclude_unset=True)
            logger.info(f"Lead update data: {update_dict}")
            
            # DEBUG: Check for pincode_city specifically
            if 'pincode_city' in update_dict:
                logger.info(f"✅ PINCODE_CITY FIELD DETECTED: {update_dict['pincode_city']}")
            else:
                logger.info(f"⚠️ pincode_city NOT in update_dict. Keys: {list(update_dict.keys())}")
            
            # CRITICAL: Reject completely empty updates to avoid 422/500 errors
            # Check both: empty dict and dict with only None values
            if not update_dict:
                logger.warning(f"⚠️ Completely empty update received for lead {lead_id}, returning success without changes")
                return {"message": "No changes to update"}
            
            # Also check if all values are None (which would result in empty update after filtering)
            non_none_values = {k: v for k, v in update_dict.items() if v is not None}
            if len(non_none_values) == 0:
                logger.warning(f"⚠️ Update with all None values received for lead {lead_id}, returning success without changes")
                return {"message": "No changes to update"}
        else:
            logger.info(f"Lead update data: {vars(lead_update)}")
    except Exception as e:
        logger.error(f"Error logging lead update data: {e}")
        # If logging fails, still try to continue but be cautious about empty updates
        try:
            update_dict = lead_update.dict(exclude_unset=True) if hasattr(lead_update, 'dict') else {}
            if not update_dict:
                logger.warning(f"⚠️ Empty update detected after logging error for lead {lead_id}, returning success")
                return {"message": "No changes to update"}
        except:
            pass
    
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Special case: Checking if this is a co_applicant_form update only
    is_form_update_only = False
    if (hasattr(lead_update, "dynamic_fields") and lead_update.dynamic_fields):
        # Convert Pydantic model to dict safely
        try:
            dynamic_fields_dict = lead_update.dynamic_fields.dict() if hasattr(lead_update.dynamic_fields, "dict") else vars(lead_update.dynamic_fields)
            # Check if it has only one key and that key is co_applicant_form
            if len(dynamic_fields_dict) == 1 and "co_applicant_form" in dynamic_fields_dict:
                is_form_update_only = True
        except Exception as e:
            print(f"Error processing dynamic_fields: {e}")
            # If error occurs, assume it's not a form update only
    
    # Get user permissions
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    
    # Special permission handling for co_applicant_form updates (similar to login-form endpoint)
    if is_form_update_only:
        # Check if user has direct edit permission
        has_edit_permission = any(
            perm["page"] == "leads" and ("create" in perm["actions"] or "*" in perm["actions"])
            for perm in permissions
        )
        
        # If no standard edit permission, check if this user is assigned to the lead and has view permission
        if not has_edit_permission:
            has_view_permission = any(
                perm["page"] == "leads" and ("show" in perm["actions"] or "*" in perm["actions"])
                for perm in permissions
            )
            
            # Check if user is assigned to this lead
            is_assigned_to_lead = lead.get('assigned_to') == user_id or user_id in lead.get('assigned_to', [])
            
            # Allow form updates for assigned users with view permission
            if has_view_permission and is_assigned_to_lead:
                has_edit_permission = True
                
            # if not has_edit_permission:
            #     raise HTTPException(
            #         status_code=status.HTTP_403_FORBIDDEN,
            #         detail="You don't have permission to edit this lead"
            #     )
    else:
        # Standard permission check for regular updates
        try:
            pass
            # await check_permission(user_id, "leads", "create", users_db, roles_db)
        except HTTPException:
            # If the user doesn't have direct lead edit permission, check if they're a super admin
            is_super_admin = any(
                (is_super_admin_permission(perm)) or
                (perm.get("page") == "*" and isinstance(perm.get("actions"), list) and "*" in perm.get("actions", [])) or
                (perm.get("page") == "any" and perm.get("actions") == "*") or
                (perm.get("page") == "admin" and perm.get("actions") == "*")
                for perm in permissions
            )
            
            # if not is_super_admin:
            #     raise HTTPException(
            #         status_code=status.HTTP_403_FORBIDDEN,
            #         detail="You don't have permission to edit leads"
            #     )
    
    # Validate department if changing
    if lead_update.department_id:
        department = await departments_db.get_department(lead_update.department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department with ID {lead_update.department_id} not found"
            )
    
    # Validate assigned user if changing
    if lead_update.assigned_to:
        # Clean up user ID if it has brackets or quotes
        if isinstance(lead_update.assigned_to, str):
            # Remove brackets, quotes, and spaces if present
            user_id = lead_update.assigned_to.replace('[', '').replace(']', '').replace("'", '').replace('"', '').strip()
            lead_update.assigned_to = user_id
            
        # Handle array of user IDs
        if isinstance(lead_update.assigned_to, list):
            valid_users = []
            for user_id in lead_update.assigned_to:
                # Clean up each user ID
                if isinstance(user_id, str):
                    user_id = user_id.replace('[', '').replace(']', '').replace("'", '').replace('"', '').strip()
                
                assigned_user = await users_db.get_user(user_id)
                if assigned_user:
                    valid_users.append(user_id)
            
            # Update with only valid users
            lead_update.assigned_to = valid_users if valid_users else None
            
        # For a single user ID
        else:
            assigned_user = await users_db.get_user(lead_update.assigned_to)
            if not assigned_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User with ID {lead_update.assigned_to} not found"
                )
    
    # Validate reporting users if changing
    if lead_update.assign_report_to is not None:
        valid_reporters = []
        
        if isinstance(lead_update.assign_report_to, list):
            for reporter_id in lead_update.assign_report_to:
                # Clean up user ID if it has brackets or quotes
                if isinstance(reporter_id, str):
                    reporter_id = reporter_id.replace('[', '').replace(']', '').replace("'", '').replace('"', '').strip()
                
                reporter = await users_db.get_user(reporter_id)
                if reporter:
                    valid_reporters.append(reporter_id)
        elif isinstance(lead_update.assign_report_to, str):
            # Handle single string that might be a reporter ID
            reporter_id = lead_update.assign_report_to.replace('[', '').replace(']', '').replace("'", '').replace('"', '').strip()
            reporter = await users_db.get_user(reporter_id)
            if reporter:
                valid_reporters.append(reporter_id)
                
        # Replace with only valid user IDs
        lead_update.assign_report_to = valid_reporters
    
    # Update the lead
    logger.info(f"🔍 lead_update.dict() BEFORE filtering: {lead_update.dict()}")
    update_dict = {k: v for k, v in lead_update.dict().items() if v is not None}
    logger.info(f"🔍 update_dict AFTER filtering None values: {update_dict}")
    
    # Special handling for assigned_to if it's a string representation of JSON array
    if "assigned_to" in update_dict and isinstance(update_dict["assigned_to"], str):
        import json
        try:
            # Try to parse as JSON
            parsed_data = json.loads(update_dict["assigned_to"])
            if isinstance(parsed_data, list):
                # Extract just the IDs from the array of objects
                user_ids = [item.get('id') for item in parsed_data if isinstance(item, dict) and 'id' in item]
                if user_ids:
                    # If we got valid IDs, use the first one as assigned_to
                    update_dict["assigned_to"] = user_ids[0]
                    print(f"Parsed assigned_to from JSON string to user ID: {update_dict['assigned_to']}")
        except json.JSONDecodeError:
            # If it's not valid JSON, leave as is
            print(f"Could not parse assigned_to as JSON: {update_dict['assigned_to']}")
    
    # Special handling for dynamic_fields to ensure proper merging of all fields
    if "dynamic_fields" in update_dict:
        print(f"⚠️ DYNAMIC_FIELDS RECEIVED IN UPDATE:")
        print(f"   Keys in update_dict.dynamic_fields: {list(update_dict['dynamic_fields'].keys())}")
        for key, value in update_dict["dynamic_fields"].items():
            if isinstance(value, dict):
                print(f"   - {key}: {list(value.keys())}")
            else:
                print(f"   - {key}: {value}")
        
        # Get current lead data to merge properly
        current_lead = await leads_db.get_lead(lead_id)
        current_dynamic_fields = current_lead.get("dynamic_fields", {}) or {}
        
        print(f"📋 CURRENT LEAD dynamic_fields keys from DB: {list(current_dynamic_fields.keys())}")
        
        # Create a new merged dynamic_fields object starting with CURRENT data
        merged_dynamic_fields = dict(current_dynamic_fields)
        
        # CRITICAL FIX: Preserve important fields that must never be lost
        important_fields = ["obligation_data", "eligibility_details", "financial_details", "identity_details", "process"]
        
        # Go through each key in the update and properly merge
        for key, value in update_dict["dynamic_fields"].items():
            if key in current_dynamic_fields and isinstance(value, dict) and isinstance(current_dynamic_fields[key], dict):
                # For dictionary fields (like forms), merge instead of replace
                # IMPORTANT: Merge both ways - keep existing fields not in update
                merged_dynamic_fields[key] = {**current_dynamic_fields[key], **value}
                print(f"✅ Merged dynamic_fields.{key} (preserved {len(current_dynamic_fields[key])} existing fields, added/updated {len(value)} fields)")
            else:
                # For other types, just replace
                merged_dynamic_fields[key] = value
                print(f"✅ Set dynamic_fields.{key}")
        
        # EXTRA SAFETY: Ensure all important fields from current lead are preserved if not in update
        for field in important_fields:
            if field not in update_dict["dynamic_fields"] and field in current_dynamic_fields:
                # Field exists in DB but NOT in update - preserve it!
                merged_dynamic_fields[field] = current_dynamic_fields[field]
                print(f"🔒 Preserved dynamic_fields.{field} from database (not in update)")
        
        # Replace with merged data
        update_dict["dynamic_fields"] = merged_dynamic_fields
        print(f"✅ Final merged dynamic_fields keys: {list(merged_dynamic_fields.keys())}")
    
    # Final safety check: ensure we have something to update after all processing
    final_update_data = {k: v for k, v in update_dict.items() if v is not None}
    if not final_update_data:
        logger.warning(f"⚠️ After processing, no data to update for lead {lead_id}, returning success")
        return {"message": "No changes to update"}
    
    try:
        success = await leads_db.update_lead(lead_id, final_update_data, user_id)
        
        if not success:
            logger.error(f"❌ Database update_lead returned False for lead {lead_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update lead in database"
            )
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        # Catch any unexpected errors during update
        logger.error(f"❌ Unexpected error updating lead {lead_id}: {str(e)}")
        logger.error(f"❌ Update data was: {final_update_data}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update lead: {str(e)}"
        )
    
    # Clear LoginCRM cache since lead updates might affect login department views
    from app.utils.performance_cache import invalidate_cache_pattern
    await invalidate_cache_pattern("login-department-leads*")
    
    # Fetch and return the updated lead so frontend can update its state
    updated_lead = await leads_db.get_lead(lead_id)
    if updated_lead:
        # Convert ObjectId to string for JSON serialization
        if "_id" in updated_lead:
            updated_lead["_id"] = str(updated_lead["_id"])
        # Convert other ObjectIds in nested fields
        for key, value in updated_lead.items():
            if isinstance(value, ObjectId):
                updated_lead[key] = str(value)
        
        logger.info(f"✅ Returning updated lead")
        return updated_lead
    
    return {"message": "Lead updated successfully"}

@router.delete("/{lead_id}", response_model=Dict[str, str])
async def delete_lead(
    lead_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Delete a lead
    
    Permission rule: Only lead creator, leads_admin or login_admin can delete
    """
    
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Get user permissions and role
    user_permissions = await get_user_permissions(user_id, users_db, roles_db)
    user_role = await get_user_role(user_id, users_db, roles_db)
    
    # Check if user is super admin
    is_super_admin = any(
        (is_super_admin_permission(perm))
        for perm in user_permissions
    )
    
    # Check if user is leads admin (multiple possible patterns)
    is_leads_admin = any(
        (perm.get("page") == "leads" and perm.get("actions") == "*") or
        (perm.get("page") == "Leads" and perm.get("actions") == "*") or
        (perm.get("page") == "leads" and isinstance(perm.get("actions"), list) and "*" in perm.get("actions")) or
        (perm.get("page") == "Leads" and isinstance(perm.get("actions"), list) and "*" in perm.get("actions"))
        for perm in user_permissions
    )
    
    # Check if user has explicit delete permission for leads
    has_leads_delete_permission = any(
        (perm.get("page") == "leads" and (
            perm.get("actions") == "*" or
            (isinstance(perm.get("actions"), list) and ("delete" in perm.get("actions") or "*" in perm.get("actions"))) or
            perm.get("actions") == "delete"
        )) or
        (perm.get("page") == "Leads" and (
            perm.get("actions") == "*" or
            (isinstance(perm.get("actions"), list) and ("delete" in perm.get("actions") or "*" in perm.get("actions"))) or
            perm.get("actions") == "delete"
        ))
        for perm in user_permissions
    )
    
    # Check if user is login admin
    is_login_admin = any(
        (perm.get("page") == "login" and perm.get("actions") == "*") or
        (perm.get("page") == "Login" and perm.get("actions") == "*") or
        (perm.get("page") == "login" and isinstance(perm.get("actions"), list) and "*" in perm.get("actions")) or
        (perm.get("page") == "Login" and isinstance(perm.get("actions"), list) and "*" in perm.get("actions"))
        for perm in user_permissions
    )
    
    # Check if user is the creator of the lead
    is_creator = lead.get("created_by") == user_id
    
    # Enhanced permission check with detailed logging
    has_delete_permission = (
        is_super_admin or 
        is_leads_admin or 
        has_leads_delete_permission or 
        is_login_admin or 
        is_creator
    )
    
    # Ultra-detailed logging for debugging
    print(f"\n🔍 ========== DELETE PERMISSION ANALYSIS ==========")
    print(f"📍 User ID: {user_id}")
    print(f"📍 Lead ID: {lead_id}")
    print(f"📍 Lead created_by: {lead.get('created_by')}")
    print(f"📍 User role: {user_role}")
    print(f"\n📋 Raw user permissions structure:")
    for i, perm in enumerate(user_permissions):
        print(f"   [{i}] {perm}")
        if isinstance(perm, dict):
            print(f"       page: {perm.get('page')} (type: {type(perm.get('page'))})")
            print(f"       actions: {perm.get('actions')} (type: {type(perm.get('actions'))})")
    
    print(f"\n🔍 Permission Check Results:")
    print(f"   ✓ is_super_admin: {is_super_admin}")
    print(f"   ✓ is_leads_admin: {is_leads_admin}")
    print(f"   ✓ has_leads_delete_permission: {has_leads_delete_permission}")
    print(f"   ✓ is_login_admin: {is_login_admin}")
    print(f"   ✓ is_creator: {is_creator}")
    print(f"   🎯 FINAL RESULT: {has_delete_permission}")
    
    # Let's also check each permission against our conditions manually
    print(f"\n🔍 Manual Permission Analysis:")
    for i, perm in enumerate(user_permissions):
        if isinstance(perm, dict):
            page = perm.get("page")
            actions = perm.get("actions")
            print(f"   Permission [{i}]:")
            print(f"     Page: '{page}'")
            print(f"     Actions: {actions}")
            
            # Check super admin
            if page == "*" and actions == "*":
                print(f"     → Matches SUPER ADMIN pattern")
            
            # Check leads admin
            if (page == "leads" or page == "Leads") and actions == "*":
                print(f"     → Matches LEADS ADMIN pattern")
            elif (page == "leads" or page == "Leads") and isinstance(actions, list) and "*" in actions:
                print(f"     → Matches LEADS ADMIN (array with *) pattern")
            
            # Check delete permission
            if (page == "leads" or page == "Leads"):
                if actions == "delete":
                    print(f"     → Matches DELETE (string) pattern")
                elif isinstance(actions, list) and "delete" in actions:
                    print(f"     → Matches DELETE (in array) pattern")
                elif isinstance(actions, list) and "*" in actions:
                    print(f"     → Matches DELETE (array with *) pattern")
                elif actions == "*":
                    print(f"     → Matches DELETE (wildcard) pattern")
    
    print(f"🔍 ================= END ANALYSIS =================\n")
    
    if not has_delete_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete leads"
        )
    
    # Now check if the user can see this lead (visibility check)
    is_visible = await leads_db.is_lead_visible_to_user(
        lead_id=lead_id,
        user_id=user_id,
        user_role=user_role,
        user_permissions=user_permissions,
        roles_db=roles_db
    )
    
    if not is_visible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this lead"
        )
    
    # Delete the lead
    success = await leads_db.delete_lead(lead_id, user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete lead"
        )

    # Clear LoginCRM cache since this lead might appear in login department views
    from app.utils.performance_cache import invalidate_cache_pattern
    await invalidate_cache_pattern("login-department-leads*")

    return {"message": "Lead deleted successfully"}# ========= Lead Assignment & Reporting =========

@router.get("/{lead_id}/reassignment-eligibility", response_model=Dict[str, Any])
async def get_lead_reassignment_eligibility(
    lead_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get reassignment eligibility information for a lead"""
    # Check permission - basic read permission is sufficient
    await check_permission(user_id, "leads", "show", users_db, roles_db)

    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check reassignment eligibility based on status settings
    eligibility = await leads_db.check_reassignment_eligibility(lead_id)
    
    # Check if user has manager/admin permission to override
    can_override = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    
    # If user has override permission, they can always reassign
    if can_override and not eligibility.get("assign"):
        eligibility["assign"] = True
        eligibility["override_reason"] = "User has manager/admin permission to override restrictions"
    
    # Enrich lead data with creator's name
    lead_data = convert_object_id(lead)
    if lead.get("created_by"):
        try:
            creator = await users_db.get_user(lead["created_by"])
            if creator:
                creator_name = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
                lead_data["created_by_name"] = creator_name or "Unknown User"
            else:
                lead_data["created_by_name"] = "Unknown User"
        except Exception:
            lead_data["created_by_name"] = "Unknown User"
    else:
        lead_data["created_by_name"] = "Unknown User"
    
    # Add additional context about the lead
    eligibility["lead_id"] = str(lead_id)
    eligibility["status"] = lead.get("status")
    eligibility["sub_status"] = lead.get("sub_status")
    eligibility["assigned_to"] = lead.get("assigned_to")
    eligibility["is_assigned_to_current_user"] = str(lead.get("assigned_to")) == user_id
    eligibility["can_override"] = can_override
    eligibility["file_sent_to_login"] = lead.get("file_sent_to_login", False)
    
    # Add the enriched lead data to the response
    eligibility["lead"] = lead_data
    
    return eligibility

@router.post("/{lead_id}/assign", response_model=Dict[str, str])
async def assign_lead(
    lead_id: ObjectIdStr,
    assignment: LeadAssign,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Assign a lead to another user"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # No permission check needed - anyone can assign leads
    
    # Validate target user
    target_user = await users_db.get_user(assignment.assigned_to)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with ID {assignment.assigned_to} not found"
        )
    
    # Assign the lead
    success = await leads_db.assign_lead(lead_id, assignment.assigned_to, user_id, assignment.notes)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign lead"
        )
    
    # Clear LoginCRM cache since assignment might affect login department views
    from app.utils.performance_cache import invalidate_cache_pattern
    await invalidate_cache_pattern("login-department-leads*")
    
    return {"message": "Lead assigned successfully"}

@router.post("/{lead_id}/add-reporter", response_model=Dict[str, str])
async def add_reporting_user(
    lead_id: ObjectIdStr,
    reporter: LeadAddReporter,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Add a user to the lead's reporting list"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    has_assign_permission = any(
        perm["page"] == "leads" and 
        (perm["actions"] == "*" or "assign" in perm["actions"])
        for perm in permissions
    )
    
    if not has_assign_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to modify lead reporting"
        )
    
    # Validate reporter user
    reporter_user = await users_db.get_user(reporter.user_id)
    if not reporter_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with ID {reporter.user_id} not found"
        )
    
    # Add reporter
    success = await leads_db.add_reporting_user(lead_id, reporter.user_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add reporting user"
        )
    
    return {"message": "Reporting user added successfully"}

@router.delete("/{lead_id}/remove-reporter/{reporter_id}", response_model=Dict[str, str])
async def remove_reporting_user(
    lead_id: ObjectIdStr,
    reporter_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Remove a user from the lead's reporting list"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    has_assign_permission = any(
        perm["page"] == "leads" and 
        (perm["actions"] == "*" or "assign" in perm["actions"])
        for perm in permissions
    )
    
    # if not has_assign_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to modify lead reporting"
    #     )
    
    # Remove reporter
    success = await leads_db.remove_reporting_user(lead_id, reporter_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove reporting user"
        )
    
    return {"message": "Reporting user removed successfully"}

@router.post("/{lead_id}/transfer", response_model=Dict[str, str])
async def transfer_lead(
    lead_id: ObjectIdStr,
    transfer: LeadTransfer,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Transfer a lead to another department and user"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # No permission check needed - anyone can transfer leads
    
    # Validate target department
    department = await departments_db.get_department(transfer.to_department_id)
    if not department:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with ID {transfer.to_department_id} not found"
        )
    
    # Validate target user
    target_user = await users_db.get_user(transfer.to_user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with ID {transfer.to_user_id} not found"
        )
    
    # Transfer the lead
    success = await leads_db.transfer_lead(
        lead_id, 
        transfer.to_user_id, 
        transfer.to_department_id, 
        user_id, 
        transfer.notes,
        str(transfer.reporting_option)
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to transfer lead"
        )
    
    # Clear LoginCRM cache since transfer might affect login department views
    from app.utils.performance_cache import invalidate_cache_pattern
    await invalidate_cache_pattern("login-department-leads*")
    
    return {"message": "Lead transferred successfully"}

@router.get("/{lead_id}/transfer-history", response_model=List[Dict[str, Any]])
async def get_transfer_history(
    lead_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Get transfer history for a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    has_view_permission = await check_lead_view_permission(
        lead_id, user_id, leads_db, users_db, roles_db
    )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Get transfer history
    transfers = await leads_db.get_transfer_history(lead_id)
    
    # Convert ObjectIds to strings and enhance with user/department info
    enhanced_transfers = []
    for transfer in transfers:
        transfer_dict = convert_object_id(transfer)
        
        # Add from user info
        if transfer.get("from_user_id"):
            from_user = await users_db.get_user(transfer["from_user_id"])
            if from_user:
                transfer_dict["from_user_name"] = f"{from_user.get('first_name', '')} {from_user.get('last_name', '')}"
        
        # Add to user info
        if transfer.get("to_user_id"):
            to_user = await users_db.get_user(transfer["to_user_id"])
            if to_user:
                transfer_dict["to_user_name"] = f"{to_user.get('first_name', '')} {to_user.get('last_name', '')}"
        
        # Add from department info
        if transfer.get("from_department_id"):
            from_dept = await departments_db.get_department(transfer["from_department_id"])
            if from_dept:
                transfer_dict["from_department_name"] = from_dept.get("name")
        
        # Add to department info
        if transfer.get("to_department_id"):
            to_dept = await departments_db.get_department(transfer["to_department_id"])
            if to_dept:
                transfer_dict["to_department_name"] = to_dept.get("name")
        
        # Add transferred by info
        if transfer.get("transferred_by"):
            transferred_by = await users_db.get_user(transfer["transferred_by"])
            if transferred_by:
                transfer_dict["transferred_by_name"] = f"{transferred_by.get('first_name', '')} {transferred_by.get('last_name', '')}"
        
        enhanced_transfers.append(transfer_dict)
    
    return enhanced_transfers

# ========= Activities =========

@router.get("/{lead_id}/activities", response_model=List[Dict[str, Any]])
async def get_lead_activities(
    lead_id: ObjectIdStr,
    skip: int = 0,
    limit: int = 50,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get activity timeline for a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # # Check permission
    # has_view_permission = await check_lead_view_permission(
    #     lead_id, user_id, leads_db, users_db, roles_db
    # )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Get activities
    activities = await leads_db.get_lead_activities(lead_id, skip, limit)
    
    # Convert ObjectIds to strings - names are now stored directly in activities
    enhanced_activities = []
    for activity in activities:
        activity_dict = convert_object_id(activity)
        
        # If user_name is not stored (for legacy activities), fetch it
        if activity.get("user_id") and not activity.get("user_name"):
            user = await users_db.get_user(activity["user_id"])
            if user:
                activity_dict["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}"
        
        enhanced_activities.append(activity_dict)
    
    return enhanced_activities

# ========= Notes Management =========

@router.post("/{lead_id}/notes", response_model=Dict[str, str])
async def add_note(
    lead_id: ObjectIdStr,
    note: NoteCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Add a note to a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    has_view_permission = await check_lead_view_permission(
        lead_id, user_id, leads_db, users_db, roles_db
    )

    
    # Ensure lead_id in body matches URL
    if note.lead_id != lead_id:
        note.lead_id = lead_id
    
    # Ensure created_by is the current user
    note.created_by = user_id
    
    # Add the note
    note_id = await leads_db.add_note(note.dict())
    
    if not note_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add note"
        )
    
    return {"id": note_id}

@router.get("/{lead_id}/notes", response_model=List[Dict[str, Any]])
async def get_lead_notes(
    lead_id: ObjectIdStr,
    skip: int = 0,
    limit: int = 20,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get notes for a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    

    # Get notes
    notes = await leads_db.get_lead_notes(lead_id, skip, limit)
    
    # Convert ObjectIds to strings and enhance with user info
    enhanced_notes = []
    for note in notes:
        note_dict = convert_object_id(note)
        
        # Add creator info
        if note.get("created_by"):
            creator = await users_db.get_user(note["created_by"])
            if creator:
                note_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}"
        
        # Check if user can edit/delete this note
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # User can edit if they created the note or have edit permission
        can_edit = note.get("created_by") == user_id or any(
            perm["page"] == "leads" and ("create" in perm["actions"] or "*" in perm["actions"])
            for perm in permissions
        )
        note_dict["can_edit"] = can_edit
        
        # User can delete if they created the note or have delete permission
        can_delete = note.get("created_by") == user_id or any(
            perm["page"] == "leads" and ("delete" in perm["actions"] or "*" in perm["actions"])
            for perm in permissions
        )
        note_dict["can_delete"] = can_delete
        
        enhanced_notes.append(note_dict)
    
    return enhanced_notes

@router.put("/{lead_id}/notes/{note_id}", response_model=Dict[str, str])
async def update_note(
    lead_id: ObjectIdStr,
    note_id: ObjectIdStr,
    note_update: NoteUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a note's metadata or status"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Get note to check permissions
    note = await leads_db.get_comment(note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note with ID {note_id} not found"
        )
    
    # Verify note belongs to this lead
    if note.get("lead_id") != lead_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Note does not belong to this lead"
        )
    
    # Check if user can edit this note (creator or has edit permission)
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    can_edit = note.get("created_by") == user_id or any(
        perm["page"] == "leads" and ("create" in perm["actions"] or "*" in perm["actions"])
        for perm in permissions
    )
    
    # if not can_edit:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to edit this note"
    #     )
    
    # Update note
    update_dict = {k: v for k, v in note_update.dict().items() if v is not None}
    update_dict["updated_by"] = user_id
    update_dict["updated_at"] = datetime.now()
    
    success = await leads_db.update_comment(note_id, update_dict)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update note"
        )
    
    return {"message": "Note updated successfully"}

@router.delete("/{lead_id}/notes/{note_id}", response_model=Dict[str, str])
async def delete_note(
    lead_id: ObjectIdStr,
    note_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a note"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Get note to check permissions
    note = await leads_db.get_comment(note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note with ID {note_id} not found"
        )
    
    # Verify note belongs to this lead
    if note.get("lead_id") != lead_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Note does not belong to this lead"
        )
    
    # Check if user can delete this note (creator or has delete permission)
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    can_delete = note.get("created_by") == user_id or any(
        perm["page"] == "leads" and ("delete" in perm["actions"] or "*" in perm["actions"])
        for perm in permissions
    )
    
    if not can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this note"
        )
    
    # Delete note
    success = await leads_db.delete_comment(note_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete note"
        )
    
    return {"message": "Note deleted successfully"}

# Remarks endpoints (alias for notes)
@router.get("/{lead_id}/remarks", response_model=List[Dict[str, Any]])
async def get_lead_remarks(
    lead_id: ObjectIdStr,
    skip: int = 0,
    limit: int = 20,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get remarks/notes for a lead"""
    return await get_lead_notes(lead_id, skip, limit, user_id, leads_db, users_db, roles_db)

@router.post("/{lead_id}/remarks", response_model=Dict[str, str])
async def add_remark(
    lead_id: ObjectIdStr,
    note: NoteCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Add a remark/note to a lead"""
    return await add_note(lead_id, note, user_id, leads_db, users_db, roles_db)

@router.put("/{lead_id}/remarks/{note_id}", response_model=Dict[str, str])
async def update_remark(
    lead_id: ObjectIdStr,
    note_id: ObjectIdStr,
    note_update: NoteUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a remark/note"""
    return await update_note(lead_id, note_id, note_update, user_id, leads_db, users_db, roles_db)

@router.delete("/{lead_id}/remarks/{note_id}", response_model=Dict[str, str])
async def delete_remark(
    lead_id: ObjectIdStr,
    note_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a remark/note"""
    return await delete_note(lead_id, note_id, user_id, leads_db, users_db, roles_db)

# ========= Tasks Management =========

@router.get("/{lead_id}/tasks", response_model=List[Dict[str, Any]])
async def get_lead_tasks(
    lead_id: ObjectIdStr,
    skip: int = 0,
    limit: int = 20,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get tasks for a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    has_view_permission = await check_lead_view_permission(
        lead_id, user_id, leads_db, users_db, roles_db
    )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Get tasks from lead's dynamic_fields or return empty list
    tasks = lead.get('dynamic_fields', {}).get('tasks', [])
    
    return tasks

@router.post("/{lead_id}/tasks", response_model=Dict[str, str])
async def create_lead_task(
    lead_id: ObjectIdStr,
    task_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a task for a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    has_view_permission = await check_lead_view_permission(
        lead_id, user_id, leads_db, users_db, roles_db
    )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Check if user can add tasks to this lead
    user_capabilities = await get_lead_user_capabilities(
        user_id, lead, users_db, roles_db
    )
    
    # if not user_capabilities.get("can_add_tasks", False):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to add tasks to this lead"
    #     )
    
    # For now, return a placeholder response
    return {"message": "Task creation not implemented yet"}

# ========= Attachments Management (alias for documents) =========

@router.get("/{lead_id}/attachments", response_model=List[Dict[str, Any]])
async def get_lead_attachments(
    lead_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get attachments/documents for a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    has_view_permission = await check_lead_view_permission(
        lead_id, user_id, leads_db, users_db, roles_db
    )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Get documents from database
    documents = await leads_db.get_lead_documents(lead_id)
    
    # Convert ObjectIds to strings and enhance with user info
    enhanced_documents = []
    for doc in documents:
        doc_dict = convert_object_id(doc)
        
        # Add uploader info
        if doc.get("uploaded_by"):
            uploader = await users_db.get_user(doc["uploaded_by"])
            if uploader:
                doc_dict["uploader_name"] = f"{uploader.get('first_name', '')} {uploader.get('last_name', '')}"
        
        enhanced_documents.append(doc_dict)
    
    return enhanced_documents

@router.post("/{lead_id}/attachments", response_model=Dict[str, List[str]])
async def upload_lead_attachment(
    lead_id: ObjectIdStr,
    files: List[UploadFile] = File(...),
    document_type: str = Form("attachment"),
    category: str = Form("general"),
    description: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Upload attachment/document for a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # # Check permission
    # has_view_permission = await check_lead_view_permission(
    #     lead_id, user_id, leads_db, users_db, roles_db
    # )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # # Check if user can upload attachments to this lead
    # user_capabilities = await get_lead_user_capabilities(
    #     user_id, lead, users_db, roles_db
    # )
    
    # if not user_capabilities.get("can_upload_attachments", False):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to upload attachments to this lead"
    #     )
    
    # Create directory for this lead's documents
    lead_media_dir = await leads_db.create_media_path(lead_id)
    document_ids = []
    
    for file in files:
        if not file.filename:
            continue
            
        # Save file
        file_data = await save_upload_file(file, lead_media_dir)
        
        # Convert path to URL
        relative_path = get_relative_media_url(file_data["file_path"])
        
        # Create document record with original filename
        document_data = {
            "lead_id": lead_id,
            "filename": file.filename,
            "original_filename": file.filename,  # Store original filename
            "file_path": relative_path,
            "file_type": file_data["file_type"],
            "document_type": document_type,
            "category": category,
            "description": description,
            "password": password if password and password.strip() else None,  # Store password if provided
            "status": "received",
            "uploaded_by": user_id,
            "size": file_data["size"],
            "created_at": datetime.now()
        }
        
        # Add document to database
        document_id = await leads_db.add_document(document_data)
        if document_id:
            document_ids.append(document_id)
    
    if not document_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to upload attachments"
        )
        
    return {"uploaded_files": [str(id) for id in document_ids]}

# ========= Login Form Management =========

@router.get("/{lead_id}/login-form", response_model=Dict[str, Any])
async def get_lead_login_form(
    lead_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get login form data for a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    has_view_permission = await check_lead_view_permission(
        lead_id, user_id, leads_db, users_db, roles_db
    )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Get login form data from lead's dynamic_fields
    login_form = lead.get('dynamic_fields', {}).get('login_form', {})
    
    return {
        "login_form": login_form,
        "lead_id": lead_id
    }

@router.post("/{lead_id}/login-form", response_model=Dict[str, str])
async def update_lead_login_form(
    lead_id: ObjectIdStr,
    login_form_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update login form data for a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    has_view_permission = await check_lead_view_permission(
        lead_id, user_id, leads_db, users_db, roles_db
    )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Check edit permission - Special handling for login forms
    # 1. Super admins can always edit the form
    # 2. Users with leads.edit permission can always edit the form
    # 3. Users with leads.view permission who are assigned to the lead can edit its login form
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    
    # First check if user is a super admin
    is_super_admin = any(
        (is_super_admin_permission(perm)) or
        (perm.get("page") == "*" and isinstance(perm.get("actions"), list) and "*" in perm.get("actions", [])) or
        (perm.get("page") == "any" and perm.get("actions") == "*") or
        (perm.get("page") == "admin" and perm.get("actions") == "*")
        for perm in permissions
    )
    
    if is_super_admin:
        has_edit_permission = True
    else:
        # Check for standard edit permission
        has_edit_permission = any(
            perm["page"] == "leads" and ("create" in perm["actions"] or "*" in perm["actions"])
            for perm in permissions
        )
    
    # If no standard edit permission, check if this user is assigned to the lead and has view permission
    if not has_edit_permission:
        has_view_only_permission = any(
            perm["page"] == "leads" and ("show" in perm["actions"] or "*" in perm["actions"])
            for perm in permissions
        )
        
        # Check if user is assigned to this lead
        is_assigned_to_lead = lead.get('assigned_to') == user_id or user_id in lead.get('assigned_to', [])
        
        # Special permission for login form - users assigned to the lead who have view permission
        if has_view_only_permission and is_assigned_to_lead:
            has_edit_permission = True
    
    # if not has_edit_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to edit this lead"
    #     )
    
    # Update lead with new login form data in a way that preserves other dynamic fields
    # Get existing dynamic fields
    dynamic_fields = lead.get('dynamic_fields', {}) or {}
    
    # Determine which fields to update based on what's in the login_form_data
    form_field_updated = False
    
    # Support for both legacy login_form and new applicant_form/co_applicant_form
    if 'applicant_form' in login_form_data:
        if 'applicant_form' not in dynamic_fields:
            dynamic_fields['applicant_form'] = {}
        # Merge the applicant form data instead of replacing it
        dynamic_fields['applicant_form'].update(login_form_data['applicant_form'])
        form_field_updated = True
    elif 'co_applicant_form' in login_form_data:
        if 'co_applicant_form' not in dynamic_fields:
            dynamic_fields['co_applicant_form'] = {}
        # Merge the co-applicant form data instead of replacing it
        dynamic_fields['co_applicant_form'].update(login_form_data['co_applicant_form'])
        form_field_updated = True
    
    # Handle legacy login_form - if nothing else was updated and login_form exists in data
    if not form_field_updated and login_form_data:
        # If we have a login_form directly in the data and no special form was processed
        dynamic_fields['login_form'] = login_form_data
    
    # Prepare update data
    update_data = {
        'dynamic_fields': dynamic_fields
    }
    
    success = await leads_db.update_lead(lead_id, update_data, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update login form"
        )
    
    return {"message": "Login form updated successfully"}

# ========= Admin Configuration Endpoints =========

# Form Fields Configuration
@router.get("/admin/form-fields", response_model=List[FormFieldInDB])
async def list_form_fields(
    department_id: Optional[str] = None,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    List all form field definitions
    If department_id is provided, includes department-specific fields plus global fields
    """
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("show" in perm["actions"] or "*" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to view form field configurations"
        )
    
    # Get form fields
    fields = await leads_db.list_form_fields(department_id)
    
    # Convert ObjectIds to strings
    return [convert_object_id(field) for field in fields]

@router.post("/admin/form-fields", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_form_field(
    field: FormFieldCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new form field definition"""
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("*" in perm["actions"] or "create" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to create form field configurations"
        )
    
    # Create field
    field_id = await leads_db.create_form_field(field.dict())
    
    return {"id": field_id}

@router.put("/admin/form-fields/{field_id}", response_model=Dict[str, str])
async def update_form_field(
    field_id: ObjectIdStr,
    field_update: FormFieldUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a form field definition"""
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("*" in perm["actions"] or "create" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to update form field configurations"
        )
    
    # Check if field exists
    field = await leads_db.get_form_field(field_id)
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form field with ID {field_id} not found"
        )
    
    # Update field
    update_dict = {k: v for k, v in field_update.dict().items() if v is not None}
    success = await leads_db.update_form_field(field_id, update_dict)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update form field"
        )
    
    return {"message": "Form field updated successfully"}

@router.delete("/admin/form-fields/{field_id}", response_model=Dict[str, str])
async def delete_form_field(
    field_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a form field definition"""
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("*" in perm["actions"] or "delete" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to delete form field configurations"
        )
    
    # Check if field exists
    field = await leads_db.get_form_field(field_id)
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form field with ID {field_id} not found"
        )
    
    # Delete field
    success = await leads_db.delete_form_field(field_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete form field"
        )
    
    return {"message": "Form field deleted successfully"}

# Status Configuration
@router.get("/admin/statuses")
async def list_statuses(
    department: Optional[str] = Query(None, description="Filter by department (leads/login)"),
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """List all status definitions, optionally filtered by department"""
    # Check admin permission (commented out for now)
    # permissions = await get_user_permissions(user_id, users_db, roles_db)
    # is_admin = any(
    #     perm["page"] == "admin" and ("show" in perm["actions"] or "*" in perm["actions"])
    #     for perm in permissions
    # )
    
    # if not is_admin:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Admin permission required to view status configurations"
    #     )
    
    # Get statuses, optionally filtered by department
    statuses = await leads_db.list_statuses(department)
    
    # Convert ObjectIds to strings and ensure required fields
    result = []
    for status in statuses:
        status_dict = convert_object_id(status)
        
        # Ensure required fields exist
        if 'id' not in status_dict and '_id' in status_dict:
            status_dict['id'] = status_dict['_id']
        
        # Add default timestamps if not present
        now = datetime.now()
        if 'created_at' not in status_dict:
            status_dict['created_at'] = now.isoformat()
        elif isinstance(status_dict['created_at'], datetime):
            status_dict['created_at'] = status_dict['created_at'].isoformat()
            
        if 'updated_at' not in status_dict:
            status_dict['updated_at'] = now.isoformat()
        elif isinstance(status_dict['updated_at'], datetime):
            status_dict['updated_at'] = status_dict['updated_at'].isoformat()
            
        # Ensure mongo_id field for Pydantic model
        status_dict['mongo_id'] = status_dict.get('_id', status_dict.get('id'))
        
        result.append(status_dict)
    
    return result

@router.get("/statuses/{department}")
async def get_statuses_for_department(
    department: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get statuses available for a specific department (leads/login)"""
    # Check basic permission
    await check_permission(user_id, "leads", "show", users_db, roles_db)
    
    # Validate department
    if department.lower() not in ['leads', 'login', 'sales', 'loan_processing']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department must be 'leads', 'login', 'sales', or 'loan_processing'"
        )
    
    # Get statuses for department
    statuses = await leads_db.get_statuses_for_department(department)
    
    # Convert ObjectIds to strings and return with sub-statuses
    result = []
    for status in statuses:
        status_dict = convert_object_id(status)
        
        # Get sub-statuses directly from the status document
        # The sub_statuses field contains the actual sub-status names
        sub_statuses_list = status.get("sub_statuses", [])
        
        # Convert sub-status names to the expected format
        status_dict["sub_statuses"] = [
            {"name": sub_status, "parent_status_id": str(status["_id"])}
            for sub_status in sub_statuses_list
        ]
        
        result.append(status_dict)
    
    return result

@router.post("/admin/statuses", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_status(
    status_data: StatusCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new status definition"""
    # Check admin permission (commented out for now)
    # permissions = await get_user_permissions(user_id, users_db, roles_db)
    # is_admin = any(
    #     perm["page"] == "admin" and ("*" in perm["actions"] or "create" in perm["actions"])
    #     for perm in permissions
    # )
    
    # if not is_admin:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Admin permission required to create status configurations"
    #     )
    
    # Add timestamps to status data
    status_dict = status_data.dict()
    now = datetime.now()
    status_dict['created_at'] = now
    status_dict['updated_at'] = now
    
    # Create status
    status_id = await leads_db.create_status(status_dict)
    
    return {"id": str(status_id)}

@router.put("/admin/statuses/{status_id}", response_model=Dict[str, str])
async def update_status(
    status_id: ObjectIdStr,
    status_update: StatusUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    print(status_update)
    """Update a status definition"""
    # Check admin permission
    # permissions = await get_user_permissions(user_id, users_db, roles_db)
    # is_admin = any(
    #     perm["page"] == "*" and ("*" in perm["actions"] or "create" in perm["actions"])
    #     for perm in permissions
    # )
    
    # if not is_admin:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Admin permission required to update status configurations"
    #     )
    
    # Check if status exists
    status = await leads_db.get_status_by_id(status_id)
    if not status:
        raise HTTPException(
            status_code=404,
            detail=f"Status with ID {status_id} not found"
        )
    
    # Update status
    update_dict = {k: v for k, v in status_update.dict().items() if v is not None}
    
    update_dict['updated_at'] = datetime.now()
    print(update_dict)
    success = await leads_db.update_status(status_id, update_dict)
    
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update status"
        )
    
    return {"message": "Status updated successfully"}

@router.delete("/admin/statuses/{status_id}", response_model=Dict[str, str])
async def delete_status(
    status_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a status definition"""
    # Check admin permission
    # permissions = await get_user_permissions(user_id, users_db, roles_db)
    # is_admin = any(
    #     perm["page"] == "*" and ("*" in perm["actions"] or "delete" in perm["actions"])
    #     for perm in permissions
    # )
    
    # if not is_admin:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Admin permission required to delete status configurations"
    #     )
    
    # Check if status exists
    status = await leads_db.get_status_by_id(status_id)
    if not status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Status with ID {status_id} not found"
        )
    
    # Delete status
    success = await leads_db.delete_status(status_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete status"
        )
    
    return {"message": "Status deleted successfully"}

# Sub-Status Configuration
@router.get("/admin/sub-statuses", response_model=List[SubStatusInDB])
async def list_sub_statuses(
    parent_status_id: Optional[str] = None,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    List all sub-status definitions
    If parent_status_id is provided, returns only sub-statuses for that parent
    """
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("show" in perm["actions"] or "*" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to view sub-status configurations"
        )
    
    # Get sub-statuses
    sub_statuses = await leads_db.list_sub_statuses(parent_status_id)
    
    # Convert ObjectIds to strings
    return [convert_object_id(sub_status) for sub_status in sub_statuses]

@router.post("/admin/sub-statuses", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_sub_status(
        sub_status: SubStatusCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
       roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new sub-status definition"""
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("*" in perm["actions"] or "create" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to create sub-status configurations"
        )
    
    # Validate parent status exists
    parent_status = await leads_db.get_status_by_id(sub_status.parent_status_id)
    if not parent_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parent status with ID {sub_status.parent_status_id} not found"
        )
    
    # Create sub-status
    sub_status_id = await leads_db.create_sub_status(sub_status.dict())
    
    return {"id": sub_status_id}

@router.put("/admin/sub-statuses/{sub_status_id}", response_model=Dict[str, str])
async def update_sub_status(
    sub_status_id: ObjectIdStr,
    sub_status_update: SubStatusUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a sub-status definition"""
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("*" in perm["actions"] or "create" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to update sub-status configurations"
        )
    
    # Check if sub-status exists
    sub_status = await leads_db.get_sub_status(sub_status_id)
    if not sub_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-status with ID {sub_status_id} not found"
        )
    
    # Update sub-status
    update_dict = {k: v for k, v in sub_status_update.dict().items() if v is not None}
    success = await leads_db.update_sub_status(sub_status_id, update_dict)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update sub-status"
        )
    
    return {"message": "Sub-status updated successfully"}

@router.delete("/admin/sub-statuses/{sub_status_id}", response_model=Dict[str, str])
async def delete_sub_status(
    sub_status_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a sub-status definition"""
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("*" in perm["actions"] or "delete" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to delete sub-status configurations"
        )
    
    # Check if sub-status exists
    sub_status = await leads_db.get_sub_status(sub_status_id)
    if not sub_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sub-status with ID {sub_status_id} not found"
        )
    
    # Delete sub-status
    success = await leads_db.delete_sub_status(sub_status_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete sub-status"
        )
    
    return {"message": "Sub-status deleted successfully"}

# Assignment Configuration
@router.get("/admin/assignment-config", response_model=List[AssignmentConfigInDB])
async def list_assignment_configs(
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """List all assignment configurations"""
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("show" in perm["actions"] or "*" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to view assignment configurations"
        )
    
    # Get assignment configs
    configs = await leads_db.list_assignment_configs()
    
    # Convert ObjectIds to strings
    return [convert_object_id(config) for config in configs]

@router.get("/admin/assignment-config/{department_id}", response_model=AssignmentConfigInDB)
async def get_department_assignment_config(
    department_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get assignment configuration for a specific department"""
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("show" in perm["actions"] or "*" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to view assignment configurations"
        )
    
    # Get config
    config = await leads_db.get_assignment_config(department_id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No assignment configuration found for department {department_id}"
        )
    
    return convert_object_id(config)

@router.post("/admin/assignment-config", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_assignment_config(
    config: AssignmentConfigCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Create assignment configuration for a department"""
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("*" in perm["actions"] or "create" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to create assignment configurations"
        )
    
    # Validate department exists
    department = await departments_db.get_department(config.department_id)
    if not department:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with ID {config.department_id} not found"
        )
    
    # Validate role IDs
    if config.assignable_role_ids:
        for role_id in config.assignable_role_ids:
            role = await roles_db.get_role(role_id)
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role with ID {role_id} not found"
                )
    
    # Validate reporter user IDs
    if config.default_reporters:
        for user_id in config.default_reporters:
            reporter = await users_db.get_user(user_id)
            if not reporter:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User with ID {user_id} not found"
                )
    
    # Create config
    config_id = await leads_db.create_assignment_config(config.dict())
    
    return {"id": config_id}

@router.put("/admin/assignment-config/{config_id}", response_model=Dict[str, str])
async def update_assignment_config(
    config_id: ObjectIdStr,
    config_update: AssignmentConfigUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update assignment configuration"""
    # Check admin permission
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    is_admin = any(
        perm["page"] == "admin" and ("*" in perm["actions"] or "create" in perm["actions"])
        for perm in permissions
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required to update assignment configurations"
        )
    
    # Validate role IDs if provided
    if config_update.assignable_role_ids:
        for role_id in config_update.assignable_role_ids:
            role = await roles_db.get_role(role_id)
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role with ID {role_id} not found"
                )
    
    # Validate reporter user IDs if provided
    if config_update.default_reporters:
        for reporter_id in config_update.default_reporters:
            reporter = await users_db.get_user(reporter_id)
            if not reporter:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User with ID {reporter_id} not found"
                )
    # Update config
    update_dict = {k: v for k, v in config_update.dict().items() if v is not None}
    success = await leads_db.update_assignment_config(config_id, update_dict)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update assignment configuration"
        )
    
    return {"message": "Assignment configuration updated successfully"}

# ========= Public Form Share Link Functionality =========

@router.post("/{lead_id}/share", response_model=Dict[str, str])
async def generate_public_form_link(
    lead_id: ObjectIdStr,
    share_data: ShareLinkCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Generate a public form share link for a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    user_permissions = await get_user_permissions(user_id, users_db, roles_db)
    
    # Check if user is a super admin
    is_super_admin = any(
        is_super_admin_permission(perm)
        for perm in user_permissions
    )
    
    # First check view permission
    has_view_permission = False
    
    if is_super_admin:
        has_view_permission = True
    else:
        # Check specific view permission 
        has_view_permission = await check_lead_view_permission(
            lead_id, user_id, leads_db, users_db, roles_db
        )
    
    # if not has_view_permission:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to view this lead"
    #     )
    
    # Then check if user has edit permission (required for generating share links)
    if not is_super_admin:
        has_edit_permission = any(
            (perm.get("page") == "leads" and 
            (perm.get("actions") == "*" or 
             (isinstance(perm.get("actions"), list) and "create" in perm.get("actions", []))))
            for perm in user_permissions
        )
        
        # if not has_edit_permission:
        #     raise HTTPException(
        #         status_code=status.HTTP_403_FORBIDDEN,
        #         detail="You don't have permission to create share links for this lead"
        #     )
    
    # Generate a unique token
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits
    share_token = ''.join(secrets.choice(alphabet) for _ in range(20))
    
    # Calculate expiration date if provided
    from datetime import datetime, timedelta
    expires_at = None
    if share_data.expires_in_days:
        expires_at = datetime.now() + timedelta(days=share_data.expires_in_days)
    
    # Create share link - only for public forms
    share_link_data = {
        "lead_id": lead_id,
        "share_token": share_token,
        "created_by": user_id,
        "expires_at": expires_at,
        "is_active": True,
        "purpose": "public_form", # Enforce purpose as public_form only
        "recipient_email": share_data.recipient_email,
        "allow_update": share_data.allow_update,
        "one_time_use": share_data.one_time_use
    }
    
    share_link_id = await leads_db.create_share_link(share_link_data)
    
    # Update the lead to set form_share to True when share link is created
    await leads_db.update_lead(lead_id, {"form_share": True}, user_id)
    
    # Generate full URL if base_url provided
    share_url = f"/public/lead-form/{share_token}"
    if share_data.base_url:
        share_url = f"{share_data.base_url.rstrip('/')}{share_url}"
    
    return {"share_url": share_url, "share_id": str(share_link_id)}

# ========= Public Form Endpoints (No Authentication Required) =========

@router.get("/public/lead-form/{share_token}", response_model=Dict[str, Any])
async def get_public_lead_form(
    share_token: str,
    leads_db: LeadsDB = Depends(get_leads_db)
):
    """Get lead data for public form using share token"""
    # Get and validate share link
    share_link = await leads_db.get_share_link_by_token(share_token)
    if not share_link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired share link"
        )
    
    # Convert ObjectIds to strings
    share_link = convert_object_id(share_link)
    
    # Check if link is still active and not expired
    from datetime import datetime
    if not share_link.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This link is no longer active"
        )
    
    if share_link.get("expires_at") and share_link.get("expires_at") < datetime.now():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This link has expired"
        )
    # Update access count
    await leads_db.share_links_collection.update_one(
        {"_id": ObjectId(share_link["_id"])},
        {
            "$inc": {"access_count": 1},
            "$set": {"last_accessed_at": datetime.now()}
        }
    )
    
    # Get lead
    lead_id = share_link["lead_id"]
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check if form sharing is enabled for this lead
    if not lead.get("form_share", True):  # Default to True for backward compatibility
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This form has already been submitted and cannot be accessed again. Please contact support for assistance."
        )
    
    # Prepare public-safe lead data
    public_lead_data = {
        "lead_id": str(lead["_id"]),
        "first_name": lead.get("first_name", ""),
        "last_name": lead.get("last_name", ""),
        "email": lead.get("email", ""),
        "phone": lead.get("phone", ""),
        "mobile_number": lead.get("mobile_number", ""),
        "loan_type": lead.get("loan_type", ""),
        "loan_amount": lead.get("loan_amount"),
        "source": lead.get("source", ""),
        "dynamic_fields": lead.get("dynamic_fields", {}),
        "share_token": share_token,
        "form_title": f"Update Information for {lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
        "expires_at": share_link.get("expires_at").isoformat() if share_link.get("expires_at") else None,
        "allow_update": share_link.get("allow_update", True)
    }
    
    return public_lead_data

@router.put("/public/lead-form/{share_token}", response_model=Dict[str, str])
async def update_lead_via_public_form(
    share_token: str,
    form_data: Dict[str, Any],
    is_final_submission: bool = Query(False, description="Whether this is a final submission (true) or just a save (false)"),
    leads_db: LeadsDB = Depends(get_leads_db)
):
    """Update lead information via public form (no authentication required)"""
    # Get and validate share link
    share_link = await leads_db.get_share_link_by_token(share_token)
    if not share_link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired share link"
        )
    
    # Convert ObjectIds to strings
    share_link = convert_object_id(share_link)
    
    # Check if link is still active and not expired
    from datetime import datetime
    if not share_link.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This link is no longer active"
        )
    
    if share_link.get("expires_at") and share_link.get("expires_at") < datetime.now():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This link has expired"
        )
    
    # Check if updates are allowed
    if not share_link.get("allow_update", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Updates are not allowed via this link"
        )
    
    # Get lead
    lead_id = share_link["lead_id"]
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check if form sharing is enabled for this lead
    if not lead.get("form_share", True):  # Default to True for backward compatibility
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This form has already been submitted and cannot be accessed again. Please contact support for assistance."
        )
    
    # Mark that this was updated via public form
    form_data["last_updated_via"] = "public_form"
    form_data["last_updated_at"] = datetime.now()
    
    # Only set form_share to False when this is a final submission, not just a save
    if is_final_submission:
        form_data["form_share"] = False
    
    # Remove None values
    cleaned_update_data = {k: v for k, v in form_data.items() if v is not None}
    
    # Update the lead
    success = await leads_db.update_lead_public(lead_id, cleaned_update_data)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update lead information"
        )
    
    # After successful update, deactivate the share link if it's meant for one-time use
    if share_link.get("one_time_use", False):
        leads_db.deactivate_share_link(share_token, None)  # No user ID for deactivation from public form
    
    return {"message": "Lead information updated successfully"}

@router.put("/{lead_id}/public-login-form", response_model=Dict[str, str])
async def update_lead_via_public_login_form(
    lead_id: str,
    form_data: Dict[str, Any],
    is_final_submission: bool = Query(False, description="Whether this is a final submission (true) or just a save (false)"),
    leads_db: LeadsDB = Depends(get_leads_db),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Update lead login form data via public form (no authentication required)"""
    if not ObjectId.is_valid(lead_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid lead ID format"
        )
    
    # Get lead
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Prepare update data
    dynamic_fields = form_data.get('dynamic_fields', {})
    
    # IMPORTANT: We only update the specific dynamic_fields without touching other lead data
    # Handle both applicant and co-applicant forms
    update_data = {
        "last_updated_via": "public_form",
        "last_updated_at": datetime.now()
    }
    
    # Update dynamic_fields
    lead_dynamic_fields = lead.get('dynamic_fields', {}) or {}
    form_field_updated = False
    form_type = None
    
    # Check for applicant_form update
    if 'applicant_form' in dynamic_fields:
        if 'applicant_form' not in lead_dynamic_fields:
            lead_dynamic_fields['applicant_form'] = {}
        # Merge the applicant form data instead of replacing it
        lead_dynamic_fields['applicant_form'].update(dynamic_fields['applicant_form'])
        form_field_updated = True
        form_type = "applicant_form"
    
    # Check for co_applicant_form update
    if 'co_applicant_form' in dynamic_fields:
        if 'co_applicant_form' not in lead_dynamic_fields:
            lead_dynamic_fields['co_applicant_form'] = {}
        # Merge the co-applicant form data instead of replacing it
        lead_dynamic_fields['co_applicant_form'].update(dynamic_fields['co_applicant_form'])
        form_field_updated = True
        form_type = "co_applicant_form"
    
    if not form_field_updated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid form data provided"
        )
    
    # Only update the dynamic_fields and nothing else
    update_data['dynamic_fields'] = lead_dynamic_fields
    
    # Include form type in activity log
    activity_details = {
        "form_type": form_type,
        "updated_via": "public_form"
    }
    
    # Only set form_share to False when this is a final submission, not just a save
    if is_final_submission:
        update_data['form_share'] = False
        activity_details["form_share_disabled"] = True
    else:
        activity_details["form_share_disabled"] = False
    
    # Update the lead with only the necessary fields
    success = await leads_db.update_lead_public(lead_id, update_data, activity_details)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update lead information"
        )
    
    # Send notifications to assigned users when form is submitted (only on final submission)
    if is_final_submission:
        try:
            # Get the updated lead to access assigned_to field
            updated_lead = await leads_db.get_lead(lead_id)
            assigned_to = updated_lead.get("assigned_to")
            
            if assigned_to:
                # Handle both string and list formats for assigned_to
                assigned_users = [assigned_to] if isinstance(assigned_to, str) else assigned_to
                for user_id in assigned_users:
                    try:
                        await notifications_db.create_lead_submission_notification(user_id, updated_lead)
                        print(f"Notification sent to user {user_id} for lead {lead_id}")
                    except Exception as e:
                        print(f"Failed to create notification for user {user_id}: {e}")
            else:
                print(f"No assigned users found for lead {lead_id}")
        except Exception as e:
            print(f"Error sending notifications for lead {lead_id}: {e}")
    
    return {"message": "Lead information updated successfully"}

@router.post("/public-form", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_lead_via_public_form(
    lead_data: Dict[str, Any],
    leads_db: LeadsDB = Depends(get_leads_db),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Create a new lead from public form without authentication"""
    # Validate required fields
    if not lead_data.get("phone") and not lead_data.get("mobile_number"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either phone or mobile_number is required"
        )

    # Check if lead with this phone number already exists
    phone = lead_data.get("phone") or lead_data.get("mobile_number")
    existing_leads = await leads_db.list_leads(
        filter_dict={
            "$or": [
                {"phone": phone},
                {"mobile_number": phone}
            ]
        },
        skip=0,
        limit=1
    )
    
    # If lead exists, update it instead of creating a new one
    if existing_leads:
        existing_lead = existing_leads[0]
        lead_id = str(existing_lead["_id"])
        
        # Update dynamic fields
        if "dynamic_fields" in lead_data:
            # Merge the applicant and co-applicant form data if available
            current_dynamic_fields = existing_lead.get("dynamic_fields", {})
            if "applicant_form" in lead_data.dynamic_fields:
                if "applicant_form" not in current_dynamic_fields:
                    current_dynamic_fields["applicant_form"] = {}
                current_dynamic_fields["applicant_form"].update(lead_data.dynamic_fields["applicant_form"])
            if "co_applicant_form" in lead_data.dynamic_fields:
                if "co_applicant_form" not in current_dynamic_fields:
                    current_dynamic_fields["co_applicant_form"] = {}
                current_dynamic_fields["co_applicant_form"].update(lead_data.dynamic_fields["co_applicant_form"])
            
            lead_data["dynamic_fields"] = current_dynamic_fields
        
        # Mark as updated via public form
        lead_data["last_updated_via"] = "public_form"
        lead_data["last_updated_at"] = datetime.now()
        
        # Set form_share to False when form is saved to prevent further access
        lead_data["form_share"] = False
        
        # Update the lead
        await leads_db.update_lead_public(lead_id, lead_data)
        
        # Get the updated lead
        updated_lead = await leads_db.get_lead(lead_id)
        
        # Send notifications to assigned users
        assigned_to = updated_lead.get("assigned_to")
        if assigned_to:
            # Handle both string and list formats for assigned_to
            assigned_users = [assigned_to] if isinstance(assigned_to, str) else assigned_to
            for user_id in assigned_users:
                try:
                    await notifications_db.create_lead_submission_notification(user_id, updated_lead)
                except Exception as e:
                    print(f"Failed to create notification for user {user_id}: {e}")
        
        return convert_object_id(updated_lead)
    
    # Create a new lead
    lead_data["created_at"] = datetime.now()
    lead_data["status"] = "New Lead"
    lead_data["created_via"] = "public_form"
    
    # Set form_share to False when form is saved to prevent further access
    lead_data["form_share"] = False
    
    # Create the lead
    lead_id = await leads_db.create_lead(lead_data)
    
    # Get the created lead
    created_lead = await leads_db.get_lead(lead_id)
    
    # Send notifications to assigned users
    assigned_to = created_lead.get("assigned_to")
    if assigned_to:
        # Handle both string and list formats for assigned_to
        assigned_users = [assigned_to] if isinstance(assigned_to, str) else assigned_to
        for user_id in assigned_users:
            try:
                await notifications_db.create_lead_submission_notification(user_id, created_lead)
            except Exception as e:
                print(f"Failed to create notification for user {user_id}: {e}")
    
    return convert_object_id(created_lead)

# ========= Obligations and Eligibility =========

@router.get("/{lead_id}/obligations", response_model=Dict[str, Any])
async def get_lead_obligations(
    lead_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get obligation and eligibility data for a specific lead
    This endpoint extracts the obligation-related fields from the lead's dynamic_fields
    and combines data from both legacy flat structure and new nested structure
    """
    try:
        # Check if lead exists
        lead = await leads_db.get_lead(lead_id)
        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lead with ID {lead_id} not found"
            )
        
        # Extract obligation data from various locations in the document
        # Use 'or {}' to handle None values safely
        # Extract obligation data from various locations in the document
        # Use 'or {}' to handle None values safely
        dynamic_fields = lead.get("dynamic_fields") or {}
        financial_details = dynamic_fields.get("financial_details") or {}
        personal_details = dynamic_fields.get("personal_details") or {}
        check_eligibility = dynamic_fields.get("check_eligibility") or {}
        eligibility_details = dynamic_fields.get("eligibility_details") or {}
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        import traceback
        print(f"❌ ERROR in get_lead_obligations: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )
    
    try:
        # Build obligation data with priority to the most specific data source
        import sys
        sys.stdout.flush()
        logger = logging.getLogger(__name__)
        logger.error(f"🔍 DEBUG: Building obligation data...")
        logger.error(f"  - dynamic_fields type: {type(dynamic_fields)}, is None: {dynamic_fields is None}")
        logger.error(f"  - financial_details type: {type(financial_details)}, is None: {financial_details is None}")
        logger.error(f"  - lead type: {type(lead)}, has loan_amount: {'loan_amount' in lead if lead else False}")
        
        obligation_data = {
            # First try flat structure, then nested structure
            "salary": dynamic_fields.get("salary", financial_details.get("monthly_income", "")),
            "partnerSalary": dynamic_fields.get("partnerSalary", financial_details.get("partner_salary", "")),
            "yearlyBonus": dynamic_fields.get("yearlyBonus", financial_details.get("yearly_bonus", "")),
            "bonusDivision": dynamic_fields.get("bonusDivision", financial_details.get("bonus_division", None)),
            "loanRequired": dynamic_fields.get("loanRequired", lead.get("loan_amount", "") if lead else ""),
            "companyName": dynamic_fields.get("companyName", personal_details.get("company_name", "")),
            "companyType": dynamic_fields.get("companyType", personal_details.get("company_type", [])),
            "companyCategory": dynamic_fields.get("companyCategory", personal_details.get("company_category", [])),
            "cibilScore": dynamic_fields.get("cibilScore", financial_details.get("cibil_score", "")),
            
            # Get obligations from either flat or nested structure
            "obligations": dynamic_fields.get("obligations", []),
            
            # Processing bank can be at root level or in dynamic_fields
            "processingBank": dynamic_fields.get("processingBank", lead.get("processing_bank", "") if lead else ""),
            
            # Totals can be in flat structure or eligibility_details
            "totalBtPos": dynamic_fields.get("totalBtPos", eligibility_details.get("totalBtPos", "0")),
            "totalObligation": dynamic_fields.get("totalObligation", eligibility_details.get("totalObligations", "0")),
        }
        
        logger.error(f"✅ Obligation data built successfully")
        
        # Extract eligibility data from flat structure or nested check_eligibility
        eligibility_data = {
            # Eligibility calculations - eligibility_details is already guaranteed to be a dict
            "eligibility": dynamic_fields.get("eligibility") or eligibility_details,
            
            # Check Eligibility section values - try flat structure first, then nested
            "loanEligibilityStatus": dynamic_fields.get("loanEligibilityStatus", 
                                    check_eligibility.get("loan_eligibility_status", "Not Eligible")),
            "ceCompanyCategory": dynamic_fields.get("ceCompanyCategory", 
                                    check_eligibility.get("company_category", "")),
            "ceFoirPercent": dynamic_fields.get("ceFoirPercent", 
                                    check_eligibility.get("foir_percent", 60)),
            "ceCustomFoirPercent": dynamic_fields.get("ceCustomFoirPercent", 
                                    check_eligibility.get("custom_foir_percent", "")),
            "ceMonthlyEmiCanPay": dynamic_fields.get("ceMonthlyEmiCanPay", 
                                    check_eligibility.get("monthly_emi_can_pay", 0)),
            "ceTenureMonths": dynamic_fields.get("ceTenureMonths", 
                                    check_eligibility.get("tenure_months", "")),
            "ceTenureYears": dynamic_fields.get("ceTenureYears", 
                                    check_eligibility.get("tenure_years", "")),
            "ceRoi": dynamic_fields.get("ceRoi", 
                                    check_eligibility.get("roi", "")),
            "ceMultiplier": dynamic_fields.get("ceMultiplier", 
                                    check_eligibility.get("multiplier", 0))
        }
        
        # Combine both data sets
        response_data = {
            **obligation_data,
            **eligibility_data
        }
        
        return response_data
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        import traceback
        logger.error(f"❌ ERROR building response in get_lead_obligations: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        logger.error(f"Lead ID: {lead_id}, User ID: {user_id}")
        logger.error(f"Lead exists: {lead is not None if 'lead' in locals() else 'Not fetched'}")
        logger.error(f"Dynamic fields: {dynamic_fields if 'dynamic_fields' in locals() else 'Not extracted'}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error building response: {str(e)}"
        )

@router.post("/{lead_id}/obligations", response_model=Dict[str, str])
async def update_lead_obligations(
    lead_id: ObjectIdStr,
    obligation_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Update obligation and eligibility data for a specific lead
    This endpoint specifically handles saving obligation-related fields to the lead's dynamic_fields
    """
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission
    # await check_permission(user_id, "leads", "create", users_db, roles_db)
    
    # Get existing dynamic_fields or initialize empty dict
    dynamic_fields = lead.get("dynamic_fields", {})
    
    # 🎯 CRITICAL FIX: Deep merge function to preserve nested data
    def deep_merge(base_dict, update_dict):
        """Deep merge update_dict into base_dict, preserving existing nested data"""
        result = base_dict.copy()
        for key, value in update_dict.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                # Recursively merge nested dictionaries
                result[key] = deep_merge(result[key], value)
            else:
                # Replace or add the value
                result[key] = value
        return result
    
    # Handle processing bank at root level since it's also used outside dynamic_fields
    if "processingBank" in obligation_data and obligation_data["processingBank"]:
        update_data = {
            "processing_bank": obligation_data["processingBank"],
        }
    
    # If the request contains nested dynamic_fields, update them properly
    if "dynamic_fields" in obligation_data and isinstance(obligation_data["dynamic_fields"], dict):
        # Deep merge the nested fields
        for key, value in obligation_data["dynamic_fields"].items():
            if isinstance(value, dict) and key in dynamic_fields and isinstance(dynamic_fields[key], dict):
                # Deep merge objects to preserve all nested fields
                dynamic_fields[key] = deep_merge(dynamic_fields[key], value)
            else:
                # Direct assignment for arrays or scalar values
                dynamic_fields[key] = value
    else:
        # If no nested dynamic_fields, update the top-level fields for backward compatibility
        for key, value in obligation_data.items():
            if key not in ["dynamic_fields", "processingBank"]:  # Skip these special cases
                # Deep merge for nested objects, direct assign for others
                if isinstance(value, dict) and key in dynamic_fields and isinstance(dynamic_fields[key], dict):
                    dynamic_fields[key] = deep_merge(dynamic_fields[key], value)
                else:
                    dynamic_fields[key] = value
    
    # Update the lead with the merged dynamic_fields
    update_data = {
        "dynamic_fields": dynamic_fields,
        "updated_at": datetime.now()
    }
    
    # Add processing_bank at root level if provided
    if "processingBank" in obligation_data and obligation_data["processingBank"]:
        update_data["processing_bank"] = obligation_data["processingBank"]
    
    success = await leads_db.update_lead(lead_id, update_data, user_id=user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update obligation data"
        )
    
    return {"message": "Obligation data updated successfully"}

@router.post("/{lead_id}/obligations/recover", response_model=Dict[str, Any])
async def recover_lead_obligations(
    lead_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Attempt to recover obligation data from alternate locations in the lead document
    This is useful for leads where obligation data was filled but not saved to dynamic_fields
    before being sent to login department
    """
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Get existing dynamic_fields or initialize empty dict
    dynamic_fields = lead.get("dynamic_fields", {})
    
    # Check if obligation data already exists
    has_existing_data = (
        dynamic_fields.get("salary") or 
        dynamic_fields.get("obligations") or 
        dynamic_fields.get("loanRequired")
    )
    
    if has_existing_data:
        return {
            "message": "Obligation data already exists in dynamic_fields",
            "recovered": False,
            "existing_data": True
        }
    
    # Try to recover from alternate locations
    recovered_data = {}
    recovery_sources = []
    
    # Check root level fields
    if lead.get("salary") or lead.get("monthly_income"):
        recovered_data["salary"] = lead.get("salary") or lead.get("monthly_income")
        recovery_sources.append("root.salary or root.monthly_income")
    
    if lead.get("partner_salary"):
        recovered_data["partnerSalary"] = lead.get("partner_salary")
        recovery_sources.append("root.partner_salary")
    
    if lead.get("loan_amount") or lead.get("loan_required"):
        recovered_data["loanRequired"] = lead.get("loan_amount") or lead.get("loan_required")
        recovery_sources.append("root.loan_amount or root.loan_required")
    
    if lead.get("company_name"):
        recovered_data["companyName"] = lead.get("company_name")
        recovery_sources.append("root.company_name")
    
    if lead.get("cibil_score"):
        recovered_data["cibilScore"] = lead.get("cibil_score")
        recovery_sources.append("root.cibil_score")
    
    # Check dynamic_details if it exists (alternate storage location)
    dynamic_details = lead.get("dynamic_details", {})
    if dynamic_details:
        financial = dynamic_details.get("financial_details", {})
        personal = dynamic_details.get("personal_details", {})
        
        if financial.get("monthly_income") and not recovered_data.get("salary"):
            recovered_data["salary"] = financial["monthly_income"]
            recovery_sources.append("dynamic_details.financial_details.monthly_income")
        
        if financial.get("partner_salary") and not recovered_data.get("partnerSalary"):
            recovered_data["partnerSalary"] = financial["partner_salary"]
            recovery_sources.append("dynamic_details.financial_details.partner_salary")
        
        if financial.get("loan_required") and not recovered_data.get("loanRequired"):
            recovered_data["loanRequired"] = financial["loan_required"]
            recovery_sources.append("dynamic_details.financial_details.loan_required")
        
        if personal.get("company_name") and not recovered_data.get("companyName"):
            recovered_data["companyName"] = personal["company_name"]
            recovery_sources.append("dynamic_details.personal_details.company_name")
    
    # If we found any data, save it to dynamic_fields
    if recovered_data:
        # Merge recovered data into dynamic_fields
        for key, value in recovered_data.items():
            dynamic_fields[key] = value
        
        # Update the lead
        update_data = {
            "dynamic_fields": dynamic_fields,
            "updated_at": datetime.now(),
            "data_recovered": True,
            "data_recovery_date": datetime.now(),
            "data_recovery_sources": recovery_sources
        }
        
        success = await leads_db.update_lead(lead_id, update_data, user_id=user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to save recovered obligation data"
            )
        
        return {
            "message": "Obligation data recovered and saved successfully",
            "recovered": True,
            "recovered_fields": list(recovered_data.keys()),
            "recovery_sources": recovery_sources,
            "recovered_data": recovered_data
        }
    else:
        return {
            "message": "No obligation data found in alternate locations",
            "recovered": False,
            "existing_data": False
        }

@router.post("/obligations/recover-batch", response_model=Dict[str, Any])
async def recover_batch_lead_obligations(
    user_id: str = Query(..., description="ID of the user making the request"),
    file_sent_to_login_only: bool = Query(True, description="Only process leads sent to login"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Batch recovery of obligation data for multiple leads
    This processes all leads (or just file_sent_to_login leads) and attempts recovery
    """
    # Check permission - require admin or manager role
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get user's role
    role = await roles_db.get_role(user.get("role_id"))
    if not role or role.get("name") not in ["Admin", "Manager", "Super Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and managers can perform batch recovery"
        )
    
    # Build filter
    filter_query = {}
    if file_sent_to_login_only:
        filter_query["file_sent_to_login"] = True
    
    # Get all matching leads
    from motor.motor_asyncio import AsyncIOMotorClient
    db_instances = get_database_instances()
    leads_collection = db_instances["leads"]
    
    cursor = leads_collection.find(filter_query)
    leads_to_process = await cursor.to_list(length=None)
    
    results = {
        "total_leads": len(leads_to_process),
        "recovered": 0,
        "already_had_data": 0,
        "no_data_found": 0,
        "errors": 0,
        "details": []
    }
    
    for lead in leads_to_process:
        lead_id = str(lead["_id"])
        try:
            # Check if obligation data already exists
            dynamic_fields = lead.get("dynamic_fields", {})
            has_existing_data = (
                dynamic_fields.get("salary") or 
                dynamic_fields.get("obligations") or 
                dynamic_fields.get("loanRequired")
            )
            
            if has_existing_data:
                results["already_had_data"] += 1
                continue
            
            # Try to recover from alternate locations
            recovered_data = {}
            recovery_sources = []
            
            # Check root level fields
            if lead.get("salary") or lead.get("monthly_income"):
                recovered_data["salary"] = lead.get("salary") or lead.get("monthly_income")
                recovery_sources.append("root.salary or root.monthly_income")
            
            if lead.get("partner_salary"):
                recovered_data["partnerSalary"] = lead.get("partner_salary")
                recovery_sources.append("root.partner_salary")
            
            if lead.get("loan_amount") or lead.get("loan_required"):
                recovered_data["loanRequired"] = lead.get("loan_amount") or lead.get("loan_required")
                recovery_sources.append("root.loan_amount or root.loan_required")
            
            if lead.get("company_name"):
                recovered_data["companyName"] = lead.get("company_name")
                recovery_sources.append("root.company_name")
            
            if lead.get("cibil_score"):
                recovered_data["cibilScore"] = lead.get("cibil_score")
                recovery_sources.append("root.cibil_score")
            
            # Check dynamic_details if it exists
            dynamic_details = lead.get("dynamic_details", {})
            if dynamic_details:
                financial = dynamic_details.get("financial_details", {})
                personal = dynamic_details.get("personal_details", {})
                
                if financial.get("monthly_income") and not recovered_data.get("salary"):
                    recovered_data["salary"] = financial["monthly_income"]
                    recovery_sources.append("dynamic_details.financial_details.monthly_income")
                
                if financial.get("partner_salary") and not recovered_data.get("partnerSalary"):
                    recovered_data["partnerSalary"] = financial["partner_salary"]
                    recovery_sources.append("dynamic_details.financial_details.partner_salary")
                
                if financial.get("loan_required") and not recovered_data.get("loanRequired"):
                    recovered_data["loanRequired"] = financial["loan_required"]
                    recovery_sources.append("dynamic_details.financial_details.loan_required")
                
                if personal.get("company_name") and not recovered_data.get("companyName"):
                    recovered_data["companyName"] = personal["company_name"]
                    recovery_sources.append("dynamic_details.personal_details.company_name")
            
            # If we found any data, save it
            if recovered_data:
                # Merge recovered data into dynamic_fields
                for key, value in recovered_data.items():
                    dynamic_fields[key] = value
                
                # Update the lead
                update_data = {
                    "dynamic_fields": dynamic_fields,
                    "updated_at": datetime.now(),
                    "data_recovered": True,
                    "data_recovery_date": datetime.now(),
                    "data_recovery_sources": recovery_sources
                }
                
                success = await leads_db.update_lead(lead_id, update_data, user_id=user_id)
                if success:
                    results["recovered"] += 1
                    results["details"].append({
                        "lead_id": lead_id,
                        "lead_name": lead.get("first_name", "") + " " + lead.get("last_name", ""),
                        "recovered_fields": list(recovered_data.keys()),
                        "sources": recovery_sources
                    })
                else:
                    results["errors"] += 1
            else:
                results["no_data_found"] += 1
                
        except Exception as e:
            results["errors"] += 1
            print(f"Error recovering data for lead {lead_id}: {str(e)}")
    
    return results

# ----------------------REASSIGN
@router.post("/{lead_id}/request-reassign", response_model=Dict[str, str])
async def request_lead_reassignment(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    target_user_id: Optional[str] = Query(None, description="Target user to reassign to"),
    reason: Optional[str] = Query(None, description="Reason for reassignment"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Request reassignment of a lead (creates pending reassignment)"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    

    # Update with reassignment request
    update_data = {
        "pending_reassignment": True,
        "reassignment_requested_by": user_id,
        "reassignment_requested_at": datetime.now(),
        "reassignment_target_user": target_user_id,
        "reassignment_reason": reason,
        "updated_at": datetime.now()
    }
    
    success = await leads_db.update_lead(lead_id, update_data, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to request lead reassignment"
        )
    
    return {"message": "Lead reassignment requested successfully"}


@router.post("/{lead_id}/approve-reassign", response_model=Dict[str, str])
async def approve_lead_reassignment(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Approve a pending lead reassignment request"""
    # Check permission to approve reassignments
    can_approve = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    
    # if not can_approve:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You don't have permission to approve reassignment requests"
    #     )
    
    # Get the lead
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check if there's actually a pending reassignment
    if not lead.get("pending_reassignment"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending reassignment request for this lead"
        )
    
    # Get target user
    target_user_id = lead.get("reassignment_target_user")
    
    # If target user specified, verify it exists
    if target_user_id:
        target_user = await users_db.get_user(target_user_id)
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target user for reassignment not found"
            )
    else:
        # If no target user, assign to approver
        target_user_id = user_id
    
    # Update assignment and clear pending flag
    update_data = {
        "assigned_to": target_user_id,
        "pending_reassignment": False,
        "reassignment_approved_by": user_id,
        "reassignment_approved_at": datetime.now(),
        "status": "active",  # Set status to active after reassignment
        "updated_at": datetime.now()
    }
    
    success = await leads_db.update_lead(lead_id, update_data, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to approve lead reassignment"
        )
    
    return {"message": "Lead reassignment approved successfully"}


@router.get("/pending-reassignments", response_model=List[Dict[str, Any]])
async def list_pending_reassignments(
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """List all leads with pending reassignment requests (no pagination - fast and raw)"""
    # Check permission to approve reassignments
    can_approve = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    
    if not can_approve:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view reassignment requests"
        )
    
    # Get all leads with pending reassignment
    filter_dict = {"pending_reassignment": True}
    
    leads = await leads_db.list_leads(
        filter_dict=filter_dict,
        skip=0,
        limit=0,  # 0 means no limit - get all records
        sort_by="reassignment_requested_at",
        sort_order=-1
    )
    
    # Enhance leads with user information
    enhanced_leads = []
    for lead in leads:
        lead_dict = convert_object_id(lead)
        
        # Add requestor info
        if lead.get("reassignment_requested_by"):
            requestor = await users_db.get_user(lead["reassignment_requested_by"])
            if requestor:
                lead_dict["requestor_name"] = f"{requestor.get('first_name', '')} {requestor.get('last_name', '')}"
        
        # Add target user info if specified
        if lead.get("reassignment_target_user"):
            target_user = await users_db.get_user(lead["reassignment_target_user"])
            if target_user:
                lead_dict["target_user_name"] = f"{target_user.get('first_name', '')} {target_user.get('last_name', '')}"
        
        # Add current assignee info
        if lead.get("assigned_to"):
            assigned_user = await users_db.get_user(lead["assigned_to"])
            if assigned_user:
                lead_dict["assigned_user_name"] = f"{assigned_user.get('first_name', '')} {assigned_user.get('last_name', '')}"
        
        enhanced_leads.append(lead_dict)
    
    return enhanced_leads

# ========= Copy Lead Endpoint =========

@router.post("/copy", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def copy_lead(
    copy_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Copy an existing lead with all related data"""
    # Check permission
    # await check_permission(user_id, "leads", "create", users_db, roles_db)
    
    lead_id = copy_data.get("lead_id")
    if not lead_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="lead_id is required"
        )
    
    # Get the original lead
    original_lead = await leads_db.get_lead(lead_id)
    if not original_lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check if user can view the original lead
    if not await can_view_lead(user_id, original_lead, users_db, roles_db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to copy this lead"
        )
    
    # Get copy options
    copy_options = copy_data.get("copy_options", {})
    override_values = copy_data.get("override_values", {})
    
    # Get user information
    user = await users_db.get_user(user_id)
    user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}" if user else "Unknown User"
    
    # Create new lead dict without _id
    new_lead = {k: v for k, v in original_lead.items() if k != "_id"}
    
    # Check if we should preserve original metadata
    preserve_metadata = copy_options.get("preserve_original_metadata", True)
    preserve_created_by = copy_options.get("preserve_created_by", True)
    preserve_assigned_to = copy_options.get("preserve_assigned_to", True)
    preserve_all_fields = copy_options.get("preserve_all_fields", True)
    preserve_status = copy_options.get("preserve_status", True)
    add_copy_activity = copy_options.get("add_copy_activity", True)
    
    if not preserve_all_fields and not preserve_metadata:
        # Update metadata with current user (default behavior)
        new_lead["created_by"] = user_id
        new_lead["created_by_name"] = user_name.strip()
        new_lead["created_at"] = datetime.now()
        new_lead["updated_at"] = datetime.now()
    else:
        # Preserve original metadata but update timestamp
        new_lead["updated_at"] = datetime.now()
        # Keep original created_by, created_by_name, created_at if preserve_all_fields or preserve_created_by
        if not (preserve_all_fields or preserve_created_by):
            new_lead["created_by"] = user_id
            new_lead["created_by_name"] = user_name.strip()
            new_lead["created_at"] = datetime.now()
    
    # Handle assigned_to preservation
    if not (preserve_all_fields or preserve_assigned_to):
        # You might want to clear or modify assigned_to here if needed
        # For now, we'll keep the original assigned_to when preserving
        pass
    
    # Handle status preservation
    if not (preserve_all_fields or preserve_status):
        # Set default status for copied lead (same as create lead)
        new_lead["status"] = "Active Leads"
        new_lead["sub_status"] = ""
    # If preserving status, keep the original status and sub_status
    
    # Apply override values (only if not preserving all fields)
    if not preserve_all_fields:
        for key, value in override_values.items():
            new_lead[key] = value
    
    # Handle custom_lead_id - keep it if specified
    if not copy_options.get("keep_custom_lead_id", True):
        # Generate new custom_lead_id or remove it
        if "custom_lead_id" in new_lead:
            del new_lead["custom_lead_id"]
    
    # Create the new lead
    new_lead_id = await leads_db.create_lead(new_lead)
    
    # Copy related data if requested
    try:
        print(f"Starting to copy related data for lead {lead_id} to new lead {new_lead_id}")
        print(f"Copy options: {copy_options}")
        
        # Copy activities
        if copy_options.get("copy_activities", True):
            print("Copying activities...")
            await copy_lead_activities(lead_id, new_lead_id, user_id, leads_db)
        
        # Copy attachments
        if copy_options.get("copy_attachments", True):
            print("Copying attachments...")
            await copy_lead_attachments(lead_id, new_lead_id, user_id, leads_db)
        
        # Copy tasks
        if copy_options.get("copy_tasks", False):
            print("Copying tasks...")
            await copy_lead_tasks(lead_id, new_lead_id, user_id, leads_db)
        
        # Copy remarks
        if copy_options.get("copy_remarks", False):
            print("Copying remarks...")
            await copy_lead_remarks(lead_id, new_lead_id, user_id, leads_db)
        
        # Copy obligations (if they exist in dynamic_fields)
        if copy_options.get("copy_obligations", True):
            print("Obligations are in dynamic_fields, already copied with lead data")
            # Obligations are usually stored in dynamic_fields, so they're already copied
            pass
        
        # Add "Lead copied by" activity if requested
        if add_copy_activity:
            print("Adding copy activity...")
            await add_lead_copy_activity(new_lead_id, user_id, user_name, leads_db)
        
        print("Finished copying related data")
            
    except Exception as e:
        print(f"Error copying related data: {e}")
        import traceback
        traceback.print_exc()
        # Don't fail the whole operation if related data copying fails
    
    return {"lead_id": new_lead_id, "message": "Lead copied successfully"}

# Helper functions for copying related data
async def copy_lead_activities(source_lead_id: str, new_lead_id: str, user_id: str, leads_db: LeadsDB):
    """Copy activities from source lead to new lead"""
    try:
        # Get activities for the source lead
        activities = await leads_db.get_lead_activities(source_lead_id)
        print(f"Found {len(activities)} activities to copy from lead {source_lead_id}")
        
        for activity in activities:
            new_activity = {k: v for k, v in activity.items() if k != "_id"}
            new_activity["lead_id"] = new_lead_id
            new_activity["created_at"] = datetime.now()
            new_activity["created_by"] = user_id
            
            # Add the activity directly to the collection
            await leads_db.activity_collection.insert_one(new_activity)
            print(f"Copied activity: {new_activity.get('title', new_activity.get('description', 'No title'))}")
            
    except Exception as e:
        print(f"Error copying activities: {e}")
        import traceback
        traceback.print_exc()

async def copy_lead_attachments(source_lead_id: str, new_lead_id: str, user_id: str, leads_db: LeadsDB):
    """Copy attachments from source lead to new lead"""
    try:
        # Get documents (attachments) for the source lead
        attachments = await leads_db.get_lead_documents(source_lead_id)
        print(f"Found {len(attachments)} attachments to copy from lead {source_lead_id}")
        
        for attachment in attachments:
            new_attachment = {k: v for k, v in attachment.items() if k != "_id"}
            new_attachment["lead_id"] = new_lead_id
            new_attachment["uploaded_at"] = datetime.now()
            new_attachment["uploaded_by"] = user_id
            
            # Add the attachment directly to the collection
            await leads_db.documents_collection.insert_one(new_attachment)
            print(f"Copied attachment: {new_attachment.get('filename', 'No filename')}")
            
    except Exception as e:
        print(f"Error copying attachments: {e}")
        import traceback
        traceback.print_exc()

async def copy_lead_tasks(source_lead_id: str, new_lead_id: str, user_id: str, leads_db: LeadsDB):
    """Copy tasks from source lead to new lead"""
    try:
        # Check if there's a tasks collection - if not, tasks might be stored as part of lead document
        print(f"Checking for tasks to copy from lead {source_lead_id}")
        
        # Since get_lead_tasks doesn't exist, let's check if tasks are stored in the lead document
        source_lead = await leads_db.get_lead(source_lead_id)
        if source_lead and source_lead.get('tasks'):
            new_tasks = []
            for task in source_lead['tasks']:
                new_task = {k: v for k, v in task.items() if k != "_id"}
                new_task["lead_id"] = new_lead_id
                new_task["created_at"] = datetime.now()
                new_task["created_by"] = user_id
                # Reset task status to pending/new for the copied lead
                new_task["status"] = "pending"
                new_tasks.append(new_task)
            
            # Update the new lead with copied tasks
            await leads_db.collection.update_one(
                {"_id": ObjectId(new_lead_id)},
                {"$set": {"tasks": new_tasks}}
            )
            print(f"Copied {len(new_tasks)} tasks from lead {source_lead_id}")
        else:
            print(f"No tasks found in lead {source_lead_id}")
            
    except Exception as e:
        print(f"Error copying tasks: {e}")
        import traceback
        traceback.print_exc()

async def copy_lead_remarks(source_lead_id: str, new_lead_id: str, user_id: str, leads_db: LeadsDB):
    """Copy remarks from source lead to new lead"""
    try:
        # Check if there's a remarks collection - remarks might be stored as notes
        print(f"Checking for remarks/notes to copy from lead {source_lead_id}")
        
        # Since get_lead_remarks doesn't exist, let's check notes collection
        # and also check if remarks are stored as part of lead document
        source_lead = await leads_db.get_lead(source_lead_id)
        
        # Copy remarks from lead document if they exist
        if source_lead and source_lead.get('remarks'):
            new_remarks = []
            for remark in source_lead['remarks']:
                new_remark = {k: v for k, v in remark.items() if k != "_id"}
                new_remark["lead_id"] = new_lead_id
                new_remark["created_at"] = datetime.now()
                new_remark["created_by"] = user_id
                new_remarks.append(new_remark)
            
            # Update the new lead with copied remarks
            await leads_db.collection.update_one(
                {"_id": ObjectId(new_lead_id)},
                {"$set": {"remarks": new_remarks}}
            )
            print(f"Copied {len(new_remarks)} remarks from lead document")
        
        # Also copy from notes collection (which might contain remarks)
        notes_cursor = leads_db.notes_collection.find({"lead_id": source_lead_id})
        notes = await notes_cursor.to_list(None)
        
        for note in notes:
            new_note = {k: v for k, v in note.items() if k != "_id"}
            new_note["lead_id"] = new_lead_id
            new_note["created_at"] = datetime.now()
            new_note["created_by"] = user_id
            
            # Add the note to the collection
            await leads_db.notes_collection.insert_one(new_note)
            print(f"Copied note/remark: {new_note.get('note', new_note.get('content', 'No content'))[:50]}...")
            
    except Exception as e:
        print(f"Error copying remarks: {e}")
        import traceback
        traceback.print_exc()

async def add_lead_copy_activity(new_lead_id: str, user_id: str, user_name: str, leads_db: LeadsDB):
    """Add a 'Lead copied by' activity to the new lead"""
    try:
        copy_activity = {
            "lead_id": new_lead_id,
            "user_id": user_id,
            "user_name": user_name.strip(),
            "activity_type": "system",
            "description": f"Lead copied by {user_name.strip()}",
            "details": {
                "action": "copy",
                "copied_by": user_name.strip(),
                "copied_by_id": user_id
            },
            "created_at": datetime.now()
        }
        
        # Add the activity directly to the collection
        await leads_db.activity_collection.insert_one(copy_activity)
        print(f"Added copy activity for lead {new_lead_id} by {user_name}")
        
    except Exception as e:
        print(f"Error adding copy activity: {e}")
        import traceback
        traceback.print_exc()