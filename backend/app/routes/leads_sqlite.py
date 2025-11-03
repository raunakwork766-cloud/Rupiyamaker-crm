from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from typing import List, Dict, Optional, Any, Union, Set
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

# Import SQLite database instead of MongoDB
from app.database import get_database_instances
from app.database.LeadsSQLite import LeadsSQLiteDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Departments import DepartmentsDB
from app.database.Notifications import NotificationsDB

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
from app.utils.common_utils import convert_object_id, convert_object_ids_in_list
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

# Dependency to get DB instances - Updated to use SQLite
def get_leads_db():
    return LeadsSQLiteDB()

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
    leads_db: LeadsSQLiteDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Create a new lead"""
    # Check permission
    # await check_permission(user_id, "leads", "create", users_db, roles_db)
    
    # Validate department
    if lead.department_id:
        department = departments_db.get_department(lead.department_id)
        if not department:
            department = "Unknown"
    
    # Validate assigned user
    if lead.assigned_to:
        assigned_user = users_db.get_user(lead.assigned_to)
        if not assigned_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with ID {lead.assigned_to} not found"
            )
    
    # Validate reporting users
    if lead.assign_report_to:
        valid_reporters = []
        for reporter_id in lead.assign_report_to:
            reporter = users_db.get_user(reporter_id)
            if reporter:
                valid_reporters.append(reporter_id)
        
        # Replace with only valid user IDs
        lead.assign_report_to = valid_reporters
    
    # Get user's full name and department
    user = users_db.get_user(user_id)
    user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}" if user else "Unknown User"
    
    # Get user's role
    user_role_name = "Unknown Role"
    if user and user.get('role_id'):
        role = roles_db.get_role(user.get('role_id'))
        if role:
            user_role_name = role.get('name', 'Unknown Role')
    
    # If department_id is not provided, use the user's department
    if not lead.department_id and user and user.get('department_id'):
        lead.department_id = str(user.get('department_id'))
    
    # Get department name (team name)
    department_name = "Unknown Department"
    department_id = lead.department_id
    
    if department_id:
        department = departments_db.get_department(department_id)
        if department:
            # Use department name as team name
            department_name = department.get('name', 'Unknown Department')
            
            # Check if this is a child department - if it is, prefer it as the team name
            if department.get('parent_id'):
                pass  # Use the child department name directly
    # If department_id is not provided but user has a department, use it
    elif user and user.get('department_id'):
        department = departments_db.get_department(user.get('department_id'))
        if department:
            department_name = department.get('name', 'Unknown Department')
            # Also update the lead's department_id
            lead.department_id = str(user.get('department_id'))
    
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
        lead_dict["loan_type_id"] = lead.loan_type_id
        lead_dict["loan_type_name"] = lead.loan_type_name
        # For backward compatibility
        lead_dict["loan_type"] = lead.loan_type_name
    
    # 2. If only loan_type_id is provided
    elif hasattr(lead, 'loan_type_id') and lead.loan_type_id:
        lead_dict["loan_type_id"] = lead.loan_type_id
        # Try to find the name
        try:
            loan_type = loan_types_db.get_loan_type(lead.loan_type_id)
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
            loan_type = loan_types_db.get_loan_type_by_name(lead.loan_type_name)
            if loan_type:
                lead_dict["loan_type_id"] = str(loan_type.get("_id", ""))
        except Exception as e:
            print(f"Error looking up loan type ID: {e}")
    
    # 4. Fall back to legacy loan_type field (backward compatibility)
    elif lead.loan_type:
        # If loan_type looks like an ID, store it as loan_type_id
        if len(lead.loan_type) == 24:  # Probably an ObjectId
            lead_dict["loan_type_id"] = lead.loan_type
            # Try to find the name
            try:
                loan_type = loan_types_db.get_loan_type(lead.loan_type)
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
                loan_type = loan_types_db.get_loan_type_by_name(lead.loan_type)
                if loan_type:
                    lead_dict["loan_type_id"] = str(loan_type.get("_id", ""))
            except Exception as e:
                print(f"Error looking up loan type ID: {e}")
        
    lead_id = leads_db.create_lead(lead_dict)
    
    return {"id": lead_id, "department_name": department_name}

@router.get("/", response_model=List[Dict[str, Any]])
async def list_leads(
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    loan_type: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: int = -1,
    skip: int = 0,
    limit: int = 50,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """
    List all leads with filtering - SQLite version
    """
    start_time = time.time()
    
    try:
        # Permission check
        try:
            await check_permission(user_id, "leads", "show", users_db, roles_db)
        except:
            # For now, allow access - implement proper permission checking later
            pass
        
        # Build filter dictionary
        filter_dict = {}
        
        if status:
            filter_dict["status"] = status
        
        if department_id:
            filter_dict["department_id"] = department_id
        
        if assigned_to:
            filter_dict["assigned_to"] = assigned_to
            
        if loan_type:
            filter_dict["loan_type"] = loan_type
        
        # Execute database query
        leads = leads_db.list_leads(
            filter_dict=filter_dict,
            skip=skip,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        # Enhance leads with additional information
        enhanced_leads = []
        
        # Collect all unique IDs for batch processing
        user_ids = set()
        dept_ids = set()
        
        for lead in leads:
            assigned_to = lead.get("assigned_to")
            if assigned_to:
                if isinstance(assigned_to, list):
                    user_ids.update(assigned_to)
                else:
                    user_ids.add(assigned_to)
            
            if lead.get("department_id"):
                dept_ids.add(lead["department_id"])
            
            if lead.get("created_by"):
                user_ids.add(lead["created_by"])
        
        # Fetch user and department data
        users_data = {}
        for user_id_item in user_ids:
            user = users_db.get_user(user_id_item)
            if user:
                users_data[user_id_item] = user
        
        departments_data = {}
        for dept_id in dept_ids:
            dept = departments_db.get_department(dept_id)
            if dept:
                departments_data[dept_id] = dept
        
        # Enhance each lead
        for lead in leads:
            lead_dict = lead.copy()
            
            # Handle assigned_to (can be single user or list)
            assigned_to = lead_dict.get("assigned_to")
            if assigned_to:
                if isinstance(assigned_to, list):
                    # Handle multiple assigned users
                    assigned_names = []
                    assigned_emails = []
                    for uid in assigned_to:
                        if uid in users_data:
                            user = users_data[uid]
                            assigned_names.append(f"{user.get('first_name', '')} {user.get('last_name', '')}".strip())
                            assigned_emails.append(user.get('email', ''))
                    lead_dict["assigned_to_name"] = ", ".join(assigned_names)
                    lead_dict["assigned_to_email"] = ", ".join(assigned_emails)
                else:
                    # Handle single assigned user
                    if assigned_to in users_data:
                        user = users_data[assigned_to]
                        lead_dict["assigned_to_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                        lead_dict["assigned_to_email"] = user.get('email', '')
                    else:
                        lead_dict["assigned_to_name"] = "Unknown User"
                        lead_dict["assigned_to_email"] = ""
            else:
                lead_dict["assigned_to_name"] = "Unassigned"
                lead_dict["assigned_to_email"] = ""
            
            # Add department name
            if lead.get("department_id") and lead["department_id"] in departments_data:
                dept = departments_data[lead["department_id"]]
                lead_dict["department_name"] = dept.get("name", "Unknown Department")
            elif not lead_dict.get("department_name"):
                lead_dict["department_name"] = "Unknown Department"
            
            # Add creator info
            if lead.get("created_by") and lead["created_by"] in users_data:
                creator = users_data[lead["created_by"]]
                lead_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
            
            # Add user capabilities for this lead
            try:
                user_capabilities = await get_lead_user_capabilities(
                    user_id, lead, users_db, roles_db
                )
                lead_dict.update(user_capabilities)
            except:
                # Default capabilities if function fails
                lead_dict.update({
                    "can_edit": True,
                    "can_delete": True,
                    "can_assign": True,
                    "can_transfer": True,
                    "can_view_activities": True,
                    "can_upload_attachments": True
                })
            
            enhanced_leads.append(lead_dict)
        
        response_time = (time.time() - start_time) * 1000
        print(f"✓ SQLite leads query completed in {response_time:.2f}ms")
        
        return enhanced_leads
        
    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        print(f"✗ SQLite leads query failed in {response_time:.2f}ms: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving leads: {str(e)}")

@router.get("/{lead_id}", response_model=Dict[str, Any])
async def get_lead(
    lead_id: str,
    skip_auth: bool = False,
    user_id: Optional[str] = Query(None, description="ID of the user making the request"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a specific lead by ID"""
    # Check if lead exists
    lead = leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # For public access (skip_auth=true), return limited data
    if skip_auth:
        # Only block access if form_share is explicitly False AND there are submission timestamps
        if lead.get("form_share") is False:
            dynamic_fields = lead.get("dynamic_fields", {})
            if isinstance(dynamic_fields, dict):
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
            "_id": lead["id"],
            "id": lead["id"],
            "first_name": lead.get("first_name", ""),
            "last_name": lead.get("last_name", ""),
            "email": lead.get("email", ""),
            "phone": lead.get("phone", ""),
            "mobile_number": lead.get("mobile_number", ""),
            "loan_type": lead.get("loan_type", ""),
            "loan_amount": lead.get("loan_amount"),
            "form_share": lead.get("form_share", True),
            "dynamic_fields": lead.get("dynamic_fields", {})
        }
        return public_lead_data
    
    # For authenticated access, check permission if user_id is provided
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="user_id is required for authenticated access"
        )
        
    # Check permission (simplified for now)
    try:
        has_view_permission = await check_lead_view_permission(
            lead_id, user_id, leads_db, users_db, roles_db
        )
    except:
        # Allow access for now
        has_view_permission = True
    
    # Enhance lead with related information
    lead_dict = lead.copy()
    
    # Add assigned user info
    if lead.get("assigned_to"):
        if isinstance(lead["assigned_to"], list):
            assigned_users = []
            for user_id_item in lead["assigned_to"]:
                assigned_user = users_db.get_user(user_id_item)
                if assigned_user:
                    assigned_users.append({
                        "id": user_id_item,
                        "name": f"{assigned_user.get('first_name', '')} {assigned_user.get('last_name', '')}"
                    })
            lead_dict["assigned_users"] = assigned_users
        else:
            assigned_user = users_db.get_user(lead["assigned_to"])
            if assigned_user:
                lead_dict["assigned_user_name"] = f"{assigned_user.get('first_name', '')} {assigned_user.get('last_name', '')}"
    
    # Add creator info
    if lead.get("created_by"):
        creator = users_db.get_user(lead["created_by"])
        if creator:
            lead_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}"
    
    # Add user capabilities for this lead
    try:
        user_capabilities = await get_lead_user_capabilities(
            user_id, lead, users_db, roles_db
        )
        lead_dict.update(user_capabilities)
    except:
        # Default capabilities if function fails
        lead_dict.update({
            "can_edit": True,
            "can_delete": True,
            "can_assign": True,
            "can_transfer": True,
            "can_view_activities": True,
            "can_upload_attachments": True
        })
    
    return lead_dict

@router.put("/{lead_id}", response_model=Dict[str, str])
async def update_lead(
    lead_id: str,
    lead_update: LeadUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Update a lead"""
    
    # Check if lead exists
    lead = leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Permission check (simplified for now)
    try:
        await check_permission(user_id, "leads", "create", users_db, roles_db)
    except:
        # Allow for now
        pass
    
    # Validate department if changing
    if lead_update.department_id:
        department = departments_db.get_department(lead_update.department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department with ID {lead_update.department_id} not found"
            )
    
    # Validate assigned user if changing
    if lead_update.assigned_to:
        if isinstance(lead_update.assigned_to, list):
            valid_users = []
            for user_id_item in lead_update.assigned_to:
                assigned_user = users_db.get_user(user_id_item)
                if assigned_user:
                    valid_users.append(user_id_item)
            lead_update.assigned_to = valid_users if valid_users else None
        else:
            assigned_user = users_db.get_user(lead_update.assigned_to)
            if not assigned_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User with ID {lead_update.assigned_to} not found"
                )
    
    # Update the lead
    update_dict = {k: v for k, v in lead_update.dict().items() if v is not None}
    
    success = leads_db.update_lead(lead_id, update_dict, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update lead"
        )
    
    return {"message": "Lead updated successfully"}

@router.delete("/{lead_id}", response_model=Dict[str, str])
async def delete_lead(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a lead"""
    
    # Check if lead exists
    lead = leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Permission check (simplified for now)
    try:
        # Check if user is the creator or has admin permissions
        is_creator = lead.get("created_by") == user_id
        if not is_creator:
            await check_permission(user_id, "leads", "delete", users_db, roles_db)
    except:
        # Allow for now
        pass
    
    # Delete the lead (soft delete)
    success = leads_db.delete_lead(lead_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete lead"
        )
    
    return {"message": "Lead deleted successfully"}

# Phone check endpoint
@router.get("/check-phone/{phone_number}", response_model=Dict[str, Any])
async def check_phone_number(
    phone_number: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    loan_type_id: Optional[str] = Query(None, description="ID of the loan type for uniqueness check"),
    loan_type_name: Optional[str] = Query(None, description="Name of the loan type for uniqueness check"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Check if a combination of phone number and loan type exists in the leads database"""
    
    # Permission check
    try:
        await check_permission(user_id, "leads", "show", users_db, roles_db)
    except:
        # Allow for now
        pass
    
    # Clean phone number
    clean_phone = phone_number.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    
    # For SQLite, we'll do a simple search for now
    # In a full implementation, you'd want to use proper SQL LIKE queries
    filter_dict = {}
    
    # Search by phone (simplified - in production you'd want better phone matching)
    leads = leads_db.list_leads(filter_dict={}, limit=1000)  # Get more leads to search through
    
    matching_leads = []
    for lead in leads:
        lead_phone = str(lead.get("phone", "")).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        alt_phone = str(lead.get("alternative_phone", "")).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        
        if clean_phone in lead_phone or clean_phone in alt_phone:
            # Check loan type if provided
            if loan_type_id or loan_type_name:
                if (loan_type_id and lead.get("loan_type_id") == loan_type_id) or \
                   (loan_type_name and (lead.get("loan_type_name") == loan_type_name or lead.get("loan_type") == loan_type_name)):
                    matching_leads.append(lead)
            else:
                matching_leads.append(lead)
    
    if not matching_leads:
        message = "Phone number"
        if loan_type_id or loan_type_name:
            message += " with the selected loan type"
        message += " not found in database"
        
        return {
            "found": False,
            "message": message,
            "can_create_new": True
        }
    
    # Process matching leads
    lead_results = []
    current_time = datetime.now()
    
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
        
        if lead_age_days > 15:
            action = "can_reassign"
            can_reassign = True
        elif lead_status in ["active", "new", "pending"]:
            if assigned_to != user_id:
                action = "can_reassign" 
                can_reassign = True
            else:
                action = "processing"
        elif lead_status in ["closed", "completed", "converted", "rejected", "cancelled"]:
            action = "can_create_new"
        else:
            action = "processing"
        
        lead_info = {
            "id": lead.get("id", ""),
            "name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
            "phone": lead.get("phone", ""),
            "email": lead.get("email", ""),
            "status": lead.get("status", ""),
            "loan_type": lead.get("loan_type_name") or lead.get("loan_type", ""),
            "loan_type_id": lead.get("loan_type_id", ""),
            "created_at": lead.get("created_at", ""),
            "assigned_to": assigned_to,
            "created_by": lead.get("created_by", ""),
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

# Additional simplified endpoints can be added here as needed
# For now, let's focus on the main CRUD operations
