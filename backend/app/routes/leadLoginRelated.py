from fastapi import APIRouter, HTTPException, Depends, status, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime
from app.utils.timezone import get_ist_now
import time
import asyncio
import logging
from app.database import get_database_instances
from app.database.Leads import LeadsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Tasks import TasksDB
from app.database.LoanTypes import LoanTypesDB
from app.schemas.lead_schemas import LeadBase, LeadCreate, LeadUpdate, LeadInDB, NoteCreate
from app.schemas.task_schemas import TaskCreate
from app.utils.common_utils import ObjectIdStr, convert_object_id
from app.utils.permissions import check_permission, get_user_capabilities, get_user_permissions, get_user_role
from app.utils.permission_helpers import is_super_admin_permission
from app.utils.performance_cache import (
    cached_response, cache_user_permissions, get_cached_user_permissions,
    performance_monitor, invalidate_cache_pattern, cache_response, get_cached_response
)
from app.utils.lead_utils import save_upload_file, get_relative_media_url

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/lead-login",
    tags=["Lead Login Operations"]
)

# ⚡ OPTIMIZED: Cache subordinates lookup for better performance
_subordinates_cache = {}
_cache_timestamps = {}
CACHE_TTL = 300  # 5 minutes

async def create_field_update_activity(
    login_leads_db,
    login_lead_id: str,
    user_id: str,
    field_changes: Dict[str, Any],
    lead_name: str = "Lead"
):
    """
    Create an activity log for field updates in login lead
    
    Args:
        login_leads_db: LoginLeadsDB instance
        login_lead_id: ID of the login lead
        user_id: ID of user making the change
        field_changes: Dictionary of field names to their new values
        lead_name: Name of the lead for better readability
    """
    try:
        # Create a human-readable description of changes
        changes_summary = []
        for field, value in field_changes.items():
            # Skip internal fields
            if field in ['updated_at', 'updated_by', '_id', 'id']:
                continue
            
            # Format field name nicely
            field_name = field.replace('_', ' ').title()
            
            # Handle different value types
            if isinstance(value, dict):
                changes_summary.append(f"{field_name} updated")
            elif isinstance(value, list):
                changes_summary.append(f"{field_name} updated ({len(value)} items)")
            elif value:
                # Truncate long values
                str_value = str(value)
                if len(str_value) > 50:
                    str_value = str_value[:47] + "..."
                changes_summary.append(f"{field_name}: {str_value}")
        
        if not changes_summary:
            return  # No meaningful changes to log
        
        description = f"Updated {', '.join(changes_summary)}"
        
        await login_leads_db._log_activity(
            login_lead_id=login_lead_id,
            activity_type='field_update',
            description=description,
            user_id=user_id,
            details={
                'fields_changed': list(field_changes.keys()),
                'change_count': len(field_changes),
                'timestamp': get_ist_now().isoformat()
            }
        )
        logger.info(f"✅ Activity logged for login lead {login_lead_id}: {description}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to create activity log: {e}")

async def get_all_subordinates_cached(user_id: str, all_users: List[Dict]) -> List[str]:
    """Get all subordinate user IDs with caching for performance"""
    current_time = time.time()
    
    # Check cache first
    if (user_id in _subordinates_cache and 
        user_id in _cache_timestamps and 
        current_time - _cache_timestamps[user_id] < CACHE_TTL):
        return _subordinates_cache[user_id]
    
    # Calculate subordinates
    subordinates = get_all_subordinates(user_id, all_users)
    
    # Cache the result
    _subordinates_cache[user_id] = subordinates
    _cache_timestamps[user_id] = current_time
    
    return subordinates

def get_all_subordinates(user_id: str, all_users: List[Dict]) -> List[str]:
    """⚡ OPTIMIZED: Get all subordinate user IDs for a given user (recursive)"""
    subordinates = set()  # Use set for O(1) lookups and automatic deduplication
    
    # Create a mapping for faster lookups
    user_reporting_map = {
        user.get("_id"): user.get("reporting_id") 
        for user in all_users 
        if user.get("_id")
    }
    
    # Find direct subordinates (users who report to this user)
    direct_subordinates = [
        uid for uid, reporting_id in user_reporting_map.items() 
        if reporting_id == user_id
    ]
    
    subordinates.update(direct_subordinates)
    
    # Recursively find subordinates of subordinates (optimized with queue)
    queue = direct_subordinates.copy()
    processed = set()
    
    while queue:
        current_user = queue.pop(0)
        if current_user in processed:
            continue
        processed.add(current_user)
        
        # Find subordinates of current user
        current_subordinates = [
            uid for uid, reporting_id in user_reporting_map.items() 
            if reporting_id == current_user and uid not in processed
        ]
        
        subordinates.update(current_subordinates)
        queue.extend(current_subordinates)
    
    return list(filter(None, subordinates))  # Remove None values

# ⚡ OPTIMIZED: Fast dependency injection with caching
async def get_leads_db():
    db_instances = get_database_instances()
    return db_instances["leads"]

async def get_login_leads_db():
    db_instances = get_database_instances()
    return db_instances["login_leads"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]
    
async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_tasks_db():
    db_instances = get_database_instances()
    return db_instances["tasks"]

async def get_loan_types_db():
    db_instances = get_database_instances()
    return db_instances["loan_types"]

@router.post("/send-to-login-department/{lead_id}")
@router.post("/{lead_id}/send-to-login")  # Add alias route for frontend compatibility
async def send_lead_to_login_department(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Send a lead to login department for processing
    
    NEW BEHAVIOR: Creates a separate login lead in login_leads collection
    while keeping the original lead in leads collection
    """
    # Check permission - user should be able to edit leads (check both leads and login permissions)
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Verify lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check if login lead already exists for this original lead
    existing_login_lead = await login_leads_db.get_login_lead_by_original_id(lead_id)
    if existing_login_lead:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A login lead already exists for this lead. Use update operations instead."
        )
    
    # Create a complete copy of the lead data for the login department
    # ⚡ CRITICAL FIX: Use convert_object_id to properly convert ALL nested BSON objects
    # This ensures ObligationSection and all dynamic_fields are properly preserved
    from app.utils.common_utils import convert_object_id
    login_lead_data = convert_object_id(lead)
    
    # Debug logging to verify data preservation
    print(f"🔍 Original lead dynamic_fields keys: {list(lead.get('dynamic_fields', {}).keys()) if lead.get('dynamic_fields') else 'None'}")
    print(f"🔍 Login lead data dynamic_fields keys: {list(login_lead_data.get('dynamic_fields', {}).keys()) if login_lead_data.get('dynamic_fields') else 'None'}")
    
    # 🔍 LOAN REQUIRED DEBUG - Check all possible locations
    loan_required_checks = {
        'lead.loan_required': lead.get('loan_required'),
        'lead.loan_amount': lead.get('loan_amount'),
        'lead.loanRequired': lead.get('loanRequired'),
        'lead.dynamic_fields.financial_details.loan_required': lead.get('dynamic_fields', {}).get('financial_details', {}).get('loan_required'),
        'lead.dynamic_details.financial_details.loan_required': lead.get('dynamic_details', {}).get('financial_details', {}).get('loan_required'),
        'login_lead_data.loan_required': login_lead_data.get('loan_required'),
        'login_lead_data.loan_amount': login_lead_data.get('loan_amount'),
        'login_lead_data.loanRequired': login_lead_data.get('loanRequired'),
        'login_lead_data.dynamic_fields.financial_details.loan_required': login_lead_data.get('dynamic_fields', {}).get('financial_details', {}).get('loan_required'),
        'login_lead_data.dynamic_details.financial_details.loan_required': login_lead_data.get('dynamic_details', {}).get('financial_details', {}).get('loan_required'),
    }
    print(f"💰 LOAN REQUIRED TRANSFER CHECK:")
    for key, value in loan_required_checks.items():
        if value:
            print(f"   ✅ {key}: {value}")
    
    # 🔍 PROCESSING BANK DEBUG - Check all possible locations
    processing_bank_checks = {
        'lead.processing_bank': lead.get('processing_bank'),
        'lead.processingBank': lead.get('processingBank'),
        'lead.bank_name': lead.get('bank_name'),
        'lead.dynamic_fields.processingBank': lead.get('dynamic_fields', {}).get('processingBank'),
        'lead.dynamic_fields.processing_bank': lead.get('dynamic_fields', {}).get('processing_bank'),
        'login_lead_data.processing_bank': login_lead_data.get('processing_bank'),
        'login_lead_data.processingBank': login_lead_data.get('processingBank'),
        'login_lead_data.dynamic_fields.processingBank': login_lead_data.get('dynamic_fields', {}).get('processingBank'),
        'login_lead_data.dynamic_fields.processing_bank': login_lead_data.get('dynamic_fields', {}).get('processing_bank'),
    }
    print(f"🏦 PROCESSING BANK TRANSFER CHECK:")
    for key, value in processing_bank_checks.items():
        if value:
            print(f"   ✅ {key}: {value}")
    
    if lead.get('dynamic_fields', {}).get('obligation_data'):
        print(f"✅ Original lead has obligation_data with keys: {list(lead['dynamic_fields']['obligation_data'].keys())}")
        print(f"✅ Login lead data has obligation_data: {bool(login_lead_data.get('dynamic_fields', {}).get('obligation_data'))}")
    
    # Create the new login lead in login_leads collection
    try:
        login_lead_id = await login_leads_db.create_login_lead(
            lead_data=login_lead_data,
            original_lead_id=lead_id,
            user_id=user_id
        )
        
        print(f"✅ Login lead created: {login_lead_id} from original lead {lead_id}")
        print(f"✅ ObligationSection data preserved: {bool(login_lead_data.get('dynamic_fields', {}).get('obligation_data'))}")
        
        # 🎯 Create activity for login transfer with status information
        try:
            login_lead = await login_leads_db.get_login_lead(login_lead_id)
            lead_status = login_lead.get('status', 'Active Login')
            lead_name = login_lead.get('first_name', '') + ' ' + login_lead.get('last_name', '')
            
            activity_description = f"File/Lead '{lead_name.strip()}' transferred to Login Department with status: {lead_status}"
            
            await login_leads_db._log_activity(
                login_lead_id=login_lead_id,
                activity_type='login_transfer',
                description=activity_description,
                user_id=user_id,
                details={
                    'original_lead_id': lead_id,
                    'status': lead_status,
                    'transfer_date': get_ist_now().isoformat()
                }
            )
            print(f"✅ Login transfer activity created: {activity_description}")
        except Exception as activity_error:
            logger.warning(f"⚠️ Error creating login transfer activity: {activity_error}")
        
        # 📋 Copy all activities from original lead to login lead
        try:
            original_activities = await leads_db.get_lead_activities(lead_id, skip=0, limit=1000)
            print(f"📋 Copying {len(original_activities)} activities from original lead")
            
            for activity in original_activities:
                # Create a copy of the activity for the login lead
                activity_copy = convert_object_id(activity)
                if '_id' in activity_copy:
                    del activity_copy['_id']  # Remove original ID to create new one
                
                # Update to reference login lead instead of original lead
                activity_copy['login_lead_id'] = login_lead_id
                if 'lead_id' in activity_copy:
                    del activity_copy['lead_id']
                
                # Insert into login lead activities collection
                await login_leads_db.activity_collection.insert_one(activity_copy)
            
            print(f"✅ Copied {len(original_activities)} activities to login lead")
        except Exception as activity_error:
            logger.warning(f"⚠️ Error copying activities: {activity_error}")
            # Don't fail the whole operation if activity copy fails
        
        # 📎 Copy all attachments/documents from original lead to login lead
        try:
            # Get attachments from original lead
            original_attachments = await leads_db.get_lead_documents(lead_id)
            print(f"📎 Found {len(original_attachments)} attachments in original lead")
            
            if original_attachments:
                print(f"📎 Sample attachment structure: {list(original_attachments[0].keys()) if original_attachments else 'None'}")
            
            copied_count = 0
            for attachment in original_attachments:
                try:
                    # Create a copy of the attachment for the login lead
                    attachment_copy = convert_object_id(attachment)
                    if '_id' in attachment_copy:
                        del attachment_copy['_id']  # Remove original ID to create new one
                    
                    # Update to reference login lead instead of original lead
                    attachment_copy['login_lead_id'] = login_lead_id
                    if 'lead_id' in attachment_copy:
                        del attachment_copy['lead_id']
                    
                    # Preserve original timestamps
                    if 'created_at' not in attachment_copy:
                        attachment_copy['created_at'] = get_ist_now()
                    
                    # Insert into login lead documents collection
                    result = await login_leads_db.documents_collection.insert_one(attachment_copy)
                    if result.inserted_id:
                        copied_count += 1
                        print(f"📎 Copied attachment: {attachment_copy.get('filename', 'unknown')} -> {result.inserted_id}")
                except Exception as single_attachment_error:
                    logger.error(f"⚠️ Error copying single attachment: {single_attachment_error}")
                    import traceback
                    traceback.print_exc()
            
            print(f"✅ Successfully copied {copied_count}/{len(original_attachments)} attachments to login lead")
        except Exception as attachment_error:
            logger.error(f"⚠️ Error in attachment copying process: {attachment_error}")
            import traceback
            traceback.print_exc()
            # Don't fail the whole operation if attachment copy fails
        
        # 📝 Copy all notes/remarks from original lead to login lead
        try:
            print(f"\n📝 ========== NOTES COPY OPERATION START ==========")
            print(f"📝 Fetching notes for lead_id: {lead_id}")
            original_notes = await leads_db.get_lead_notes(lead_id, skip=0, limit=1000)
            print(f"📝 Found {len(original_notes)} notes/remarks in original lead")
            
            if original_notes:
                print(f"📝 Sample note structure: {list(original_notes[0].keys()) if original_notes else 'None'}")
                print(f"📝 Sample note content: {original_notes[0].get('content', original_notes[0].get('note', 'N/A'))[:100] if original_notes else 'N/A'}")
            else:
                print(f"⚠️ No notes found in original lead collection for lead_id={lead_id}")
            
            copied_count = 0
            for note in original_notes:
                try:
                    # Create a copy of the note for the login lead
                    note_copy = convert_object_id(note)
                    if '_id' in note_copy:
                        del note_copy['_id']  # Remove original ID to create new one
                    
                    print(f"📝 Processing note - original lead_id field: {note_copy.get('lead_id')}")
                    
                    # Update to reference login lead instead of original lead
                    note_copy['login_lead_id'] = note_copy.pop('lead_id', lead_id)
                    
                    print(f"📝 After conversion - login_lead_id: {note_copy.get('login_lead_id')}")
                    
                    # Preserve original timestamps and author info
                    if 'created_at' not in note_copy:
                        note_copy['created_at'] = get_ist_now()
                    
                    # Insert into login lead notes collection
                    print(f"📝 Inserting into login_lead_notes collection...")
                    result = await login_leads_db.notes_collection.insert_one(note_copy)
                    if result.inserted_id:
                        copied_count += 1
                        note_preview = note_copy.get('note', note_copy.get('content', note_copy.get('comment', '')))[:50]
                        print(f"📝 ✅ Copied note #{copied_count}: '{note_preview}...' -> ObjectId({result.inserted_id})")
                except Exception as single_note_error:
                    logger.error(f"⚠️ Error copying single note: {single_note_error}")
                    import traceback
                    traceback.print_exc()
            
            print(f"📝 ========== NOTES COPY SUMMARY ==========")
            print(f"📝 Total found: {len(original_notes)}")
            print(f"📝 Successfully copied: {copied_count}")
            print(f"📝 Failed: {len(original_notes) - copied_count}")
            print(f"📝 Target collection: login_lead_notes")
            print(f"📝 Login lead ID: {login_lead_id}")
            print(f"📝 ========== NOTES COPY OPERATION END ==========\n")
        except Exception as note_error:
            logger.error(f"⚠️ Error in notes copying process: {note_error}")
            import traceback
            traceback.print_exc()
            # Don't fail the whole operation if note copy fails
        
    except Exception as e:
        print(f"❌ Error creating login lead: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create login lead: {str(e)}"
        )
    
    # Update the original lead to mark it as sent to login (for tracking)
    update_data = {
        "file_sent_to_login": True,
        "login_department_sent_date": get_ist_now().isoformat(),
        "login_department_sent_by": user_id,
        "login_lead_id": login_lead_id,  # Link to the login lead
        "updated_at": get_ist_now().isoformat()
    }
    
    # Update the original lead
    success = await leads_db.update_lead(lead_id, update_data, user_id)
    if not success:
        # Rollback: delete the login lead we just created
        await login_leads_db.delete_login_lead(login_lead_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update original lead"
        )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after sending lead to login department
    try:
        await invalidate_cache_pattern("login-department-leads*")
        print(f"🔄 Cache invalidated for login leads after sending lead {lead_id} to login department")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after sending to login: {cache_error}")
    
    return {
        "message": "Lead successfully sent to login department", 
        "lead_id": lead_id,
        "login_lead_id": login_lead_id,
        "info": "A separate login lead has been created with all data from the original lead",
        "obligation_data_preserved": bool(login_lead_data.get('dynamic_fields', {}).get('obligation_data'))
    }

@router.get("/login-leads/{login_lead_id}")
async def get_single_login_lead(
    login_lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get a single login lead by ID
    Used when clicking on a login lead row to view details
    """
    # Check permission
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Get the login lead
    login_lead = await login_leads_db.get_login_lead(login_lead_id)
    if not login_lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {login_lead_id} not found"
        )
    
    # Convert ObjectId fields to strings for JSON serialization
    from app.utils.common_utils import convert_object_id
    login_lead_data = convert_object_id(login_lead)
    
    return login_lead_data

@router.put("/login-leads/{login_lead_id}")
async def update_login_lead(
    login_lead_id: str,
    update_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Update a login lead with any fields
    Used by the details panel for auto-save functionality
    """
    # Check permission
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Get the login lead
    login_lead = await login_leads_db.get_login_lead(login_lead_id)
    if not login_lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {login_lead_id} not found"
        )
    
    # Add updated timestamp
    update_data["updated_at"] = get_ist_now().isoformat()
    update_data["updated_by"] = user_id
    
    # 📝 Create activity log for field updates
    lead_name = f"{login_lead.get('first_name', '')} {login_lead.get('last_name', '')}".strip() or "Lead"
    await create_field_update_activity(
        login_leads_db=login_leads_db,
        login_lead_id=login_lead_id,
        user_id=user_id,
        field_changes=update_data,
        lead_name=lead_name
    )
    
    # Update the login lead
    success = await login_leads_db.update_login_lead(login_lead_id, update_data, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update login lead"
        )
    
    # ⚡ CACHE INVALIDATION: Clear cache after update
    try:
        await invalidate_cache_pattern("login-department-leads*")
        logger.info(f"🔄 Cache invalidated after login lead update: {login_lead_id}")
    except Exception as cache_error:
        logger.warning(f"⚠️ Failed to invalidate cache: {cache_error}")
    
    # Return the updated lead
    updated_lead = await login_leads_db.get_login_lead(login_lead_id)
    from app.utils.common_utils import convert_object_id
    return convert_object_id(updated_lead)

@router.post("/login-leads/{login_lead_id}/login-form")
async def update_login_lead_form(
    login_lead_id: str,
    login_form_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update login form data (applicant_form or co_applicant_form) for a login lead"""
    # Check permission
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Get the login lead
    login_lead = await login_leads_db.get_login_lead(login_lead_id)
    if not login_lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {login_lead_id} not found"
        )
    
    # Get existing dynamic fields
    dynamic_fields = login_lead.get('dynamic_fields', {}) or {}
    
    # Determine which fields to update based on what's in the login_form_data
    form_field_updated = False
    
    # Support for both applicant_form and co_applicant_form
    if 'applicant_form' in login_form_data:
        if 'applicant_form' not in dynamic_fields:
            dynamic_fields['applicant_form'] = {}
        # Merge the applicant form data instead of replacing it
        dynamic_fields['applicant_form'].update(login_form_data['applicant_form'])
        form_field_updated = True
        logger.info(f"Updated applicant_form for login lead {login_lead_id}")
    
    if 'co_applicant_form' in login_form_data:
        if 'co_applicant_form' not in dynamic_fields:
            dynamic_fields['co_applicant_form'] = {}
        # Merge the co-applicant form data instead of replacing it
        dynamic_fields['co_applicant_form'].update(login_form_data['co_applicant_form'])
        form_field_updated = True
        logger.info(f"Updated co_applicant_form for login lead {login_lead_id}")
    
    # Handle legacy login_form - if nothing else was updated and login_form exists in data
    if not form_field_updated and login_form_data:
        dynamic_fields['login_form'] = login_form_data
        form_field_updated = True
        logger.info(f"Updated legacy login_form for login lead {login_lead_id}")
    
    if not form_field_updated:
        logger.warning(f"No form data to update for login lead {login_lead_id}")
        return {"message": "No form data provided to update"}
    
    # Prepare update data
    update_data = {
        'dynamic_fields': dynamic_fields,
        'updated_at': get_ist_now().isoformat(),
        'updated_by': user_id
    }
    
    # Update the login lead
    success = await login_leads_db.update_login_lead(login_lead_id, update_data, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update login form"
        )
    
    # 📝 Create activity log for form updates
    lead_name = f"{login_lead.get('first_name', '')} {login_lead.get('last_name', '')}".strip() or "Lead"
    form_types = []
    if 'applicant_form' in login_form_data:
        form_types.append("Applicant Form")
    if 'co_applicant_form' in login_form_data:
        form_types.append("Co-Applicant Form")
    if not form_types and login_form_data:
        form_types.append("Login Form")
    
    description = f"Updated {' and '.join(form_types)}"
    
    await login_leads_db._log_activity(
        login_lead_id=login_lead_id,
        activity_type='form_update',
        description=description,
        user_id=user_id,
        details={
            'forms_updated': form_types,
            'timestamp': get_ist_now().isoformat()
        }
    )
    
    # ⚡ CACHE INVALIDATION: Clear cache after update
    try:
        await invalidate_cache_pattern("login-department-leads*")
        logger.info(f"🔄 Cache invalidated after login lead form update: {login_lead_id}")
    except Exception as cache_error:
        logger.warning(f"⚠️ Failed to invalidate cache: {cache_error}")
    
    return {"message": "Login form updated successfully", "success": True}

@router.get("/login-leads/{login_lead_id}/obligations")
async def get_login_lead_obligations(
    login_lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get obligation and eligibility data for a login lead"""
    # Check permission
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Get the login lead
    login_lead = await login_leads_db.get_login_lead(login_lead_id)
    if not login_lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {login_lead_id} not found"
        )
    
    # 🔍 DEBUG: Log the entire lead structure
    logger.info("🔍 ========== FULL LEAD DATA DEBUG ==========")
    logger.info(f"🔍 Lead ID: {login_lead_id}")
    logger.info(f"🔍 Top-level keys: {list(login_lead.keys())}")
    logger.info(f"🔍 dynamic_fields keys: {list(login_lead.get('dynamic_fields', {}).keys()) if login_lead.get('dynamic_fields') else 'None'}")
    logger.info(f"🔍 dynamic_details keys: {list(login_lead.get('dynamic_details', {}).keys()) if login_lead.get('dynamic_details') else 'None'}")
    logger.info(f"🔍 financial_details (in dynamic_fields): {login_lead.get('dynamic_fields', {}).get('financial_details', {})}")
    logger.info(f"🔍 financial_details (in dynamic_details): {login_lead.get('dynamic_details', {}).get('financial_details', {})}")
    logger.info(f"🔍 personal_details (in dynamic_fields): {login_lead.get('dynamic_fields', {}).get('personal_details', {})}")
    logger.info(f"🔍 personal_details (in dynamic_details): {login_lead.get('dynamic_details', {}).get('personal_details', {})}")
    logger.info(f"🔍 obligation_data (in dynamic_fields): {login_lead.get('dynamic_fields', {}).get('obligation_data', {})}")
    logger.info("🔍 ==========================================")
    
    # Extract obligation data from the lead's dynamic_fields
    dynamic_fields = login_lead.get("dynamic_fields") or {}
    dynamic_details = login_lead.get("dynamic_details") or {}  # Also check dynamic_details
    financial_details = dynamic_fields.get("financial_details") or {}
    financial_details_v2 = dynamic_details.get("financial_details") or {}  # Check both locations
    personal_details = dynamic_fields.get("personal_details") or {}
    personal_details_v2 = dynamic_details.get("personal_details") or {}  # Check both locations
    check_eligibility = dynamic_fields.get("check_eligibility") or {}
    eligibility_details = dynamic_fields.get("eligibility_details") or {}
    obligation_data_nested = dynamic_fields.get("obligation_data") or {}
    
    # Extract obligations with priority order: 
    # 1. dynamic_fields.obligations (top level)
    # 2. dynamic_fields.obligation_data.obligations (nested)
    # 3. financial_details.obligations (fallback)
    obligations_list = (
        dynamic_fields.get("obligations") or 
        obligation_data_nested.get("obligations") or 
        financial_details.get("obligations") or 
        []
    )
    
    # 🎯 ENHANCED: Extract loan_required from all possible locations with priority
    loan_required_value = (
        # Check dynamic_details first (newer structure)
        financial_details_v2.get("loan_required") or
        financial_details_v2.get("loan_amount") or
        financial_details_v2.get("required_loan") or
        financial_details_v2.get("loan_amt") or
        dynamic_details.get("loan_required") or
        dynamic_details.get("loan_amount") or
        dynamic_details.get("required_loan") or
        # Then check dynamic_fields (older structure)
        financial_details.get("loan_required") or
        financial_details.get("loan_amount") or
        financial_details.get("required_loan") or  # ✨ NEW: Check required_loan
        financial_details.get("loan_amt") or      # ✨ NEW: Check loan_amt
        dynamic_fields.get("loanRequired") or
        dynamic_fields.get("loan_required") or
        dynamic_fields.get("loan_amount") or
        # Finally check top-level lead fields
        login_lead.get("loan_required") or
        login_lead.get("loan_amount") or
        login_lead.get("loanRequired") or
        ""
    )
    
    # 🎯 ENHANCED: Extract salary from all possible locations
    salary_value = (
        financial_details_v2.get("salary") or
        financial_details_v2.get("monthly_income") or
        dynamic_details.get("salary") or
        financial_details.get("salary") or
        financial_details.get("monthly_income") or
        dynamic_fields.get("salary") or
        login_lead.get("salary") or
        ""
    )
    
    # 🎯 ENHANCED: Extract company_name from all possible locations
    company_name_value = (
        personal_details_v2.get("company_name") or
        dynamic_details.get("company_name") or
        personal_details.get("company_name") or
        dynamic_fields.get("companyName") or
        dynamic_fields.get("company_name") or
        login_lead.get("company_name") or
        ""
    )
    
    # 🎯 Extract processing bank from all possible locations
    processing_bank_value = (
        dynamic_fields.get("processingBank") or
        dynamic_fields.get("processing_bank") or
        dynamic_fields.get("bank_name") or
        login_lead.get("processing_bank") or
        login_lead.get("processingBank") or
        ""
    )
    
    # Build obligation data - Return COMPLETE lead structure with minimal extraction
    # The key is to preserve ALL nested structures so frontend can find data anywhere
    obligation_data = {
        # 🎯 Core extracted fields (single source of truth for display)
        "salary": salary_value,
        "partnerSalary": dynamic_fields.get("partnerSalary", financial_details.get("partner_salary", financial_details_v2.get("partner_salary", ""))),
        "yearlyBonus": dynamic_fields.get("yearlyBonus", financial_details.get("yearly_bonus", financial_details_v2.get("yearly_bonus", ""))),
        "bonusDivision": dynamic_fields.get("bonusDivision", financial_details.get("bonus_division", financial_details_v2.get("bonus_division", None))),
        "loanRequired": loan_required_value,
        "companyName": company_name_value,
        "processingBank": processing_bank_value,
        "obligations": obligations_list,
        "selectedBanks": dynamic_fields.get("selectedBanks", []),
        "cibilScore": (
            financial_details.get("cibil_score") or
            financial_details_v2.get("cibil_score") or
            dynamic_fields.get("cibil_score") or
            login_lead.get("cibil_score") or
            ""
        ),
        
        # 🎯 CRITICAL: Preserve COMPLETE nested structures
        # This allows frontend to find data in ANY location without conflicts
        "dynamic_fields": dynamic_fields,
        "dynamic_details": dynamic_details,
        "check_eligibility": check_eligibility,
        "eligibility_details": eligibility_details,
        "obligation_data": obligation_data_nested,
    }
    
    # 🔍 DEBUG: Log what we're returning
    print(f"\n📊 ========== OBLIGATIONS RESPONSE DEBUG ==========")
    print(f"📊 Login Lead ID: {login_lead_id}")
    print(f"📊 Extracted Values:")
    print(f"   - salary: {salary_value}")
    print(f"   - loanRequired: {loan_required_value}")
    print(f"   - companyName: {company_name_value}")
    print(f"   - processingBank: {processing_bank_value}")
    print(f"   - obligations count: {len(obligations_list)}")
    print(f"   - cibilScore: {obligation_data['cibilScore']}")
    print(f"📊 Nested Structures Preserved:")
    print(f"   - dynamic_fields keys: {list(dynamic_fields.keys()) if dynamic_fields else 'None'}")
    print(f"   - dynamic_details keys: {list(dynamic_details.keys()) if dynamic_details else 'None'}")
    print(f"   - check_eligibility keys: {list(check_eligibility.keys()) if check_eligibility else 'None'}")
    if obligations_list:
        print(f"📊 First Obligation Sample: {obligations_list[0] if obligations_list else 'None'}")
    print(f"📊 ================================================\n")
    
    logger.info(f"📊 Login lead {login_lead_id} obligations: salary={salary_value}, loanRequired={loan_required_value}, companyName={company_name_value}, processingBank={processing_bank_value}, obligations={len(obligations_list)}")
    return obligation_data

@router.post("/login-leads/{login_lead_id}/obligations")
async def update_login_lead_obligations(
    login_lead_id: str,
    obligation_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update obligation and eligibility data for a login lead"""
    # Check permission
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Get the login lead
    login_lead = await login_leads_db.get_login_lead(login_lead_id)
    if not login_lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {login_lead_id} not found"
        )
    
    # Get existing dynamic fields
    dynamic_fields = login_lead.get('dynamic_fields', {}) or {}
    
    # 🔍 DEBUG: Log what we're receiving and what exists
    logger.info("🔍 ========== OBLIGATION SAVE DEBUG ==========")
    logger.info(f"🔍 Login Lead ID: {login_lead_id}")
    logger.info(f"🔍 Received obligation_data keys: {list(obligation_data.keys())}")
    logger.info(f"🔍 Received obligations count: {len(obligation_data.get('obligations', []))}")
    if obligation_data.get('obligations'):
        logger.info(f"🔍 First obligation sample: {obligation_data['obligations'][0]}")
    logger.info(f"🔍 BEFORE UPDATE - Existing dynamic_fields keys: {list(dynamic_fields.keys())}")
    logger.info(f"🔍 BEFORE UPDATE - Existing personal_details: {dynamic_fields.get('personal_details', {})}")
    logger.info(f"🔍 BEFORE UPDATE - Existing financial_details: {dynamic_fields.get('financial_details', {})}")
    logger.info("🔍 ==========================================")
    
    # 🎯 CRITICAL FIX: Deep merge obligation data to preserve other sections
    # Instead of replacing, we need to intelligently merge nested structures
    
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
    
    # Apply deep merge for obligation data
    for key, value in obligation_data.items():
        if key not in ['_id', 'id']:  # Skip ID fields
            if key in dynamic_fields and isinstance(dynamic_fields[key], dict) and isinstance(value, dict):
                # Deep merge for nested objects like personal_details, financial_details
                dynamic_fields[key] = deep_merge(dynamic_fields[key], value)
            else:
                # Direct assignment for non-dict values or new keys
                dynamic_fields[key] = value
    
    logger.info(f"🔍 AFTER UPDATE - dynamic_fields keys: {list(dynamic_fields.keys())}")
    logger.info(f"🔍 AFTER UPDATE - personal_details: {dynamic_fields.get('personal_details', {})}")
    logger.info(f"🔍 AFTER UPDATE - financial_details: {dynamic_fields.get('financial_details', {})}")
    
    # Prepare update data
    update_data = {
        'dynamic_fields': dynamic_fields,
        'updated_at': get_ist_now().isoformat(),
        'updated_by': user_id
    }
    
    # Update the login lead
    success = await login_leads_db.update_login_lead(login_lead_id, update_data, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update obligations"
        )
    
    # 📝 Create activity log for obligation updates
    lead_name = f"{login_lead.get('first_name', '')} {login_lead.get('last_name', '')}".strip() or "Lead"
    obligations_count = len(obligation_data.get('obligations', []))
    salary = obligation_data.get('salary', '')
    loan_required = obligation_data.get('loanRequired', '')
    
    description = f"Updated Obligation Section"
    if obligations_count > 0:
        description += f" ({obligations_count} obligations)"
    if salary:
        description += f", Salary: {salary}"
    if loan_required:
        description += f", Loan Required: {loan_required}"
    
    await login_leads_db._log_activity(
        login_lead_id=login_lead_id,
        activity_type='obligation_update',
        description=description,
        user_id=user_id,
        details={
            'obligations_count': obligations_count,
            'salary': salary,
            'loan_required': loan_required,
            'timestamp': get_ist_now().isoformat()
        }
    )
    
    # ⚡ CACHE INVALIDATION
    try:
        await invalidate_cache_pattern("login-department-leads*")
        logger.info(f"🔄 Cache invalidated after login lead obligations update: {login_lead_id}")
    except Exception as cache_error:
        logger.warning(f"⚠️ Failed to invalidate cache: {cache_error}")
    
    return {"message": "Obligations updated successfully", "success": True}

@router.post("/login-leads/{login_lead_id}/notes", response_model=Dict[str, str])
async def add_note_to_login_lead(
    login_lead_id: str,
    note: NoteCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Add a note to a login lead"""
    # Check if login lead exists
    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {login_lead_id} not found"
        )
    
    # Check permission
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Ensure lead_id in body matches URL
    if note.lead_id != login_lead_id:
        note.lead_id = login_lead_id
    
    # Ensure created_by is the current user
    note.created_by = user_id
    
    # Add the note using the LoginLeadsDB method
    note_id = await login_leads_db.add_note(note.dict())
    
    if not note_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add note"
        )
    
    # 📝 Create activity log for note addition
    lead_name = f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip() or "Lead"
    note_content = note.note if hasattr(note, 'note') else note.content if hasattr(note, 'content') else ""
    note_preview = note_content[:50] + "..." if len(note_content) > 50 else note_content
    
    description = f"Added note: {note_preview}"
    
    await login_leads_db._log_activity(
        login_lead_id=login_lead_id,
        activity_type='note_added',
        description=description,
        user_id=user_id,
        details={
            'note_id': note_id,
            'note_length': len(note_content),
            'timestamp': get_ist_now().isoformat()
        }
    )
    
    # ⚡ CACHE INVALIDATION
    try:
        await invalidate_cache_pattern("login-department-leads*")
        logger.info(f"🔄 Cache invalidated after adding note to login lead: {login_lead_id}")
    except Exception as cache_error:
        logger.warning(f"⚠️ Failed to invalidate cache: {cache_error}")
    
    return {"id": note_id}

@router.get("/login-leads/{login_lead_id}/notes", response_model=List[Dict[str, Any]])
async def get_login_lead_notes(
    login_lead_id: str,
    skip: int = 0,
    limit: int = 20,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get notes for a login lead"""
    # Check if login lead exists
    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {login_lead_id} not found"
        )
    
    # Check permission
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Get notes using the LoginLeadsDB method
    notes = await login_leads_db.get_lead_notes(login_lead_id, skip, limit)
    
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
            perm["page"] in ["leads", "login"] and ("create" in perm["actions"] or "*" in perm["actions"])
            for perm in permissions
        )
        note_dict["can_edit"] = can_edit
        
        # User can delete if they created the note or have delete permission
        can_delete = note.get("created_by") == user_id or any(
            perm["page"] in ["leads", "login"] and ("delete" in perm["actions"] or "*" in perm["actions"])
            for perm in permissions
        )
        note_dict["can_delete"] = can_delete
        
        enhanced_notes.append(note_dict)
    
    return enhanced_notes

@router.get("/login-leads/{login_lead_id}/documents", response_model=List[Dict[str, Any]])
async def get_login_lead_documents(
    login_lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get documents/attachments for a login lead"""
    # Check if login lead exists
    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {login_lead_id} not found"
        )
    
    # Check permission
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Get documents using the LoginLeadsDB method
    documents = await login_leads_db.get_lead_documents(login_lead_id)
    
    # Convert ObjectIds to strings
    return [convert_object_id(doc) for doc in documents]

@router.post("/login-leads/{login_lead_id}/documents", response_model=Dict[str, List[str]])
async def upload_login_lead_documents(
    login_lead_id: str,
    files: List[UploadFile] = File(...),
    document_type: str = Form(...),
    category: str = Form(...),
    description: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Upload one or more documents to a login lead"""
    # Check if login lead exists
    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {login_lead_id} not found"
        )
    
    # Check permission
    await check_permission(user_id, ["leads", "login"], "create", users_db, roles_db)
    
    # Create directory for this login lead's documents
    lead_media_dir = await login_leads_db.create_media_path(login_lead_id)
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
            "login_lead_id": login_lead_id,
            "filename": file.filename,
            "file_path": relative_path,
            "absolute_file_path": file_data["file_path"],
            "file_type": file_data["file_type"],
            "document_type": document_type,
            "category": category,
            "description": description,
            "password": password if password and password.strip() else None,
            "status": "received",
            "uploaded_by": user_id,
            "uploaded_at": get_ist_now(),
            "size": file_data["size"]
        }
        
        # Insert into login lead documents collection
        result = await login_leads_db.documents_collection.insert_one(document_data)
        if result.inserted_id:
            document_ids.append(str(result.inserted_id))
    
    if not document_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files were uploaded"
        )
    
    # 📝 Create activity log for document uploads
    lead_name = f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip() or "Lead"
    file_count = len(document_ids)
    file_names = [f.filename for f in files if f.filename]
    
    description = f"Uploaded {file_count} document{'s' if file_count > 1 else ''}"
    if file_count <= 3:
        description += f": {', '.join(file_names)}"
    description += f" ({category})"
    
    await login_leads_db._log_activity(
        login_lead_id=login_lead_id,
        activity_type='document_upload',
        description=description,
        user_id=user_id,
        details={
            'document_count': file_count,
            'category': category,
            'document_type': document_type,
            'filenames': file_names,
            'timestamp': get_ist_now().isoformat()
        }
    )
    
    return {"uploaded_files": document_ids}


@router.get("/login-leads/{login_lead_id}/tasks", response_model=Dict[str, Any])
async def get_tasks_for_login_lead(
    login_lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    loan_types_db: LoanTypesDB = Depends(get_loan_types_db)
):
    """Get all tasks associated with a specific login lead"""
    try:
        # Verify login lead exists
        lead = await login_leads_db.get_login_lead(login_lead_id)
        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Login lead not found"
            )
        
        # Check permission
        await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
        
        logger.info(f"Getting tasks for login lead {login_lead_id}, user {user_id}")
        
        # Get tasks for this login lead
        lead_filter = {"lead_id": ObjectId(login_lead_id)}
        tasks = await tasks_db.list_tasks(filter_dict=lead_filter)
        
        logger.info(f"Found {len(tasks)} tasks for login lead {login_lead_id}")
        
        # Import enhance_task_details from tasks module
        from app.routes.tasks import enhance_task_details
        
        # Convert to response format
        task_responses = []
        for task in tasks:
            task_dict = await enhance_task_details(task, users_db, None, loan_types_db, user_id)
            task_responses.append(task_dict)
        
        return {
            "tasks": task_responses,
            "total": len(task_responses),
            "lead_id": login_lead_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tasks for login lead {login_lead_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get tasks for login lead"
        )

@router.post("/login-leads/{login_lead_id}/tasks/create", response_model=Dict[str, Any])
async def create_task_for_login_lead(
    login_lead_id: str,
    task: TaskCreate,
    user_id: str = Query(..., description="ID of the user creating the task"),
    login_leads_db = Depends(get_login_leads_db),
    tasks_db: TasksDB = Depends(get_tasks_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new task for a specific login lead"""
    try:
        # Verify login lead exists
        lead = await login_leads_db.get_login_lead(login_lead_id)
        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Login lead not found"
            )
        
        # Check permission
        await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
        
        # Set the lead_id in the task
        task.lead_id = login_lead_id
        task.created_by = user_id
        
        # Ensure the creator is in assigned_to list by default
        if user_id not in task.assigned_to:
            task.assigned_to.append(user_id)
        
        # Validate assigned users exist
        for assigned_user_id in task.assigned_to:
            assigned_user = await users_db.get_user(assigned_user_id)
            if not assigned_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Assigned user with ID {assigned_user_id} not found"
                )
        
        # Create task
        task_data = task.dict()
        task_id = await tasks_db.create_task(task_data)
        
        if not task_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create task"
            )
        
        logger.info(f"Created task {task_id} for login lead {login_lead_id}")
        
        # ⚡ CACHE INVALIDATION
        try:
            await invalidate_cache_pattern("login-department-leads*")
            logger.info(f"🔄 Cache invalidated after creating task for login lead: {login_lead_id}")
        except Exception as cache_error:
            logger.warning(f"⚠️ Failed to invalidate cache: {cache_error}")
        
        return {"message": "Task created successfully for login lead", "task_id": task_id, "lead_id": login_lead_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating task for login lead {login_lead_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create task for login lead"
        )

@router.get("/login-leads/{login_lead_id}/activities", response_model=List[Dict[str, Any]])
async def get_login_lead_activities(
    login_lead_id: str,
    skip: int = 0,
    limit: int = 50,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get activity timeline for a login lead"""
    # Check if login lead exists
    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {login_lead_id} not found"
        )
    
    # Check permission
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Get activities for this login lead
    activities = await login_leads_db.get_login_lead_activities(login_lead_id, skip, limit)
    
    logger.info(f"Retrieved {len(activities)} activities for login lead {login_lead_id}")
    
    # Convert ObjectIds to strings and enhance with user names
    enhanced_activities = []
    for activity in activities:
        activity_dict = convert_object_id(activity)
        
        # If user_name is not stored (for legacy activities), fetch it
        if activity.get("user_id") and not activity.get("user_name"):
            user = await users_db.get_user(activity["user_id"])
            if user:
                activity_dict["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}"
        
        # Also check performed_by field (used in login lead activities)
        if activity.get("performed_by") and not activity.get("user_name"):
            user = await users_db.get_user(activity["performed_by"])
            if user:
                activity_dict["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}"
        
        enhanced_activities.append(activity_dict)
    
    return enhanced_activities

@router.patch("/assign-multiple-users/{lead_id}")
async def assign_lead_to_multiple_users(
    lead_id: str,
    request_data: Dict[str, Any],  # Accept a dictionary with assigned_user_ids and activity data
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),  # CHANGED: Use login_leads collection
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Assign a login lead to multiple users"""
    # Check permission - check both leads and login permissions
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Extract the assigned_user_ids from the request_data
    # Support both formats - array directly or inside assigned_user_ids field
    if isinstance(request_data, list):
        assigned_user_ids = request_data
    else:
        assigned_user_ids = request_data.get("assigned_user_ids", [])
        
    # Extract activity data if provided
    activity_data = request_data.get("activity")
    
    # Verify login lead exists
    lead = await login_leads_db.get_login_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {lead_id} not found"
        )
    
    # Verify all assigned users exist
    for assigned_id in assigned_user_ids:
        user = await users_db.get_user(assigned_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {assigned_id} not found"
            )
    
    # Update lead assignments
    current_assigned = lead.get("assigned_to", [])
    if isinstance(current_assigned, str):
        current_assigned = [current_assigned]
    
    # Check if we have new users that weren't previously assigned
    new_users = [user_id for user_id in assigned_user_ids if user_id not in current_assigned]
    
    # Add new assignments without duplicates
    updated_assigned = list(set(current_assigned + assigned_user_ids))
    
    # Get or create assignment history array
    assignment_history = lead.get("assignment_history", [])
    
    # Add assignment history entry if there are new users
    if new_users:
        history_entry = {
            "users": new_users,
            "department_id": lead.get("department_id"),
            "assigned_date": get_ist_now().isoformat(),
            "assigned_by": user_id,
            "assignment_type": "login_department"
        }
        assignment_history.append(history_entry)
    
    update_data = {
        "assigned_to": updated_assigned,
        "last_assigned_by": user_id,
        "last_assigned_date": get_ist_now().isoformat(),
        "assignment_history": assignment_history,
        "updated_at": get_ist_now().isoformat()
    }
    
    # If activity data was provided, include it in the update
    if activity_data:
        update_data["activity"] = activity_data
    
    # Update the login lead
    success = await login_leads_db.update_login_lead(lead_id, update_data, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update login lead assignments"
        )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after assignment update
    try:
        await invalidate_cache_pattern("login-department-leads*")
        print(f"🔄 Cache invalidated for login leads after assignment update for lead {lead_id}")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after assignment: {cache_error}")
    
    return {"message": "Login lead assigned to multiple users successfully", "assigned_to": updated_assigned}

@router.patch("/update-operations/{lead_id}")
async def update_lead_operations(
    lead_id: str,
    request_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),  # CHANGED: Use login_leads collection
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update operations section data for a login lead"""
    # Check permission - check both leads and login permissions
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Verify login lead exists
    lead = await login_leads_db.get_login_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {lead_id} not found"
        )
    
    # Extract activity data if provided
    activity_data = None
    operations_data = request_data
    
    if "activity" in request_data:
        activity_data = request_data.pop("activity")
        operations_data = request_data
        
    # Prepare operations update data - Updated field names
    allowed_operations_fields = [
        "login_sent_date", "login_person", "channel_name", "los_number",
        "amount_approved", "amount_disbursed", "internal_top", 
        "cashback_to_customer", "net_disbursement_amount", "rate_percentage",
        "tenure_given", "pf_and_insurance", "disbursement_date"
    ]
    
    operations_update = {}
    for field in allowed_operations_fields:
        if field in operations_data:
            # Store with new field names (no operations_ prefix)
            operations_update[field] = operations_data[field]
    
    if operations_update:
        operations_update["updated_at"] = get_ist_now().isoformat()
        operations_update["operations_updated_by"] = user_id
        
        # Include activity data if provided
        if activity_data:
            operations_update["activity"] = activity_data
        
        # Update the login lead
        success = await login_leads_db.update_login_lead(lead_id, operations_update, user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update operations data"
            )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after operations update
    try:
        await invalidate_cache_pattern("login-department-leads*")
        print(f"🔄 Cache invalidated for login leads after operations update for lead {lead_id}")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after operations update: {cache_error}")
    
    return {"message": "Operations data updated successfully", "updated_fields": list(operations_update.keys())}

async def get_hierarchical_permissions(user_id: str, module: str = "login") -> Dict[str, Any]:
    """Get simplified hierarchical permissions for login module"""
    try:
        from app.database.Users import UsersDB
        from app.database.Roles import RolesDB
        
        users_db = UsersDB()
        roles_db = RolesDB()
        
        # Get user data
        user = await users_db.get_user(user_id)
        if not user:
            return {"permission_level": "own", "is_super_admin": False}
        
        # Check if user is super admin
        is_super_admin = user.get("is_super_admin", False)
        if is_super_admin:
            return {"permission_level": "all", "is_super_admin": True}
        
        # Get user's role permissions
        role_id = user.get("role_id")
        if not role_id:
            return {"permission_level": "own", "is_super_admin": False}
        
        role = await roles_db.get_role(role_id)
        if not role:
            return {"permission_level": "own", "is_super_admin": False}
        
        permissions = role.get("permissions", [])
        
        # Check for super admin permission in role
        for perm in permissions:
            if is_super_admin_permission(perm):
                return {"permission_level": "all", "is_super_admin": True}
        
        # Check for module-specific permissions (login) and fallback to leads
        has_all = False
        has_junior = False
        
        for perm in permissions:
            # Check both login and leads modules
            if perm.get("page") in [module, "leads"]:
                actions = perm.get("actions", [])
                if isinstance(actions, str):
                    actions = [actions]
                
                if "all" in actions or "*" in actions:
                    has_all = True
                elif "junior" in actions:
                    has_junior = True
        
        # Determine permission level
        if has_all:
            return {"permission_level": "all", "is_super_admin": False}
        elif has_junior:
            return {"permission_level": "junior", "is_super_admin": False}
        else:
            return {"permission_level": "own", "is_super_admin": False}
            
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting hierarchical permissions for {user_id}: {e}")
        return {"permission_level": "own", "is_super_admin": False}

@router.get("/login-department-leads")
@cached_response(ttl=5)  # ⚡ Reduced cache to 5 seconds for real-time updates
async def get_login_department_leads(
    user_id: str = Query(..., description="ID of the user making the request"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    loan_type: Optional[str] = Query(None, description="Filter by loan type"),
    no_activity_date: Optional[str] = Query(None, description="Filter leads with no activity since this date"),
    _cache_bust: Optional[str] = Query(None, description="Cache busting parameter"),
    login_leads_db = Depends(get_login_leads_db),  # CHANGED: Use login_leads collection
    leads_db: LeadsDB = Depends(get_leads_db),  # Keep for backward compatibility
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    ⚡ OPTIMIZED: Get leads for login department view with caching and fast permissions
    
    NEW BEHAVIOR: Fetches from separate login_leads collection instead of filtering main leads
    """
    start_time = time.time()
    
    print(f"🚀 Login department leads called with no_activity_date: {no_activity_date}")
    
    try:
        # ⚡ STEP 1: Fast permission check with caching
        cached_permissions = await get_cached_user_permissions(user_id)
        if not cached_permissions:
            await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
            # Cache permissions for future requests
            user_permissions = await get_user_permissions(user_id, users_db, roles_db)
            await cache_user_permissions(user_id, user_permissions)
        
        # ⚡ STEP 2: Fast hierarchical permissions lookup
        permission_data = await get_hierarchical_permissions(user_id, "login")
        permission_level = permission_data["permission_level"]
        is_super_admin = permission_data["is_super_admin"]
        
        # ⚡ STEP 3: Build optimized filters with PROPER permission-based visibility
        # 🔒 SECURITY FIX: Use LOGIN-specific visibility filter (not leads filter)
        # This ensures LOGIN section permissions are separate from LEADS section permissions
        from app.utils.permissions import PermissionManager
        
        # Get the proper LOGIN visibility filter based on user's LOGIN permissions
        visibility_filter = await PermissionManager.get_login_visibility_filter(user_id, users_db, roles_db)
        
        print(f"🔒 SECURITY: Applying LOGIN-specific lead visibility filter for user {user_id}")
        print(f"📊 LOGIN Visibility filter: {visibility_filter}")
        print(f"🔍 Permission level from hierarchical check: {permission_level}")
        print(f"✅ FIXED: Now using LOGIN permissions instead of LEADS permissions")
        
        # Build filters for login_leads collection
        # NOTE: No need for file_sent_to_login filter since we're querying login_leads directly
        extra_filters = {}
        
        # Add status filter if provided
        if status_filter:
            extra_filters["status"] = status_filter
        
        # ⚡ STEP 4: Combine visibility filter with login department filters
        # CRITICAL: visibility_filter should NEVER be empty for Team Leaders!
        # Only Super Admins with page: "*", actions: "*" should have empty filter
        if not visibility_filter or visibility_filter == {}:
            print(f"⚠️ CRITICAL: Empty visibility filter for user {user_id} - treating as Super Admin")
            print(f"⚠️ If this is a Team Leader, there's a BUG in get_lead_visibility_filter!")
            filters = extra_filters if extra_filters else {}
        else:
            print(f"✅ Applying strict visibility filter for user {user_id}")
            # Combine both filters - user must match visibility criteria
            if extra_filters:
                filters = {
                    "$and": [
                        visibility_filter,
                        extra_filters
                    ]
                }
            else:
                filters = visibility_filter
        
        print(f"📊 Final combined filter: {filters}")
        
        # ⚡ STEP 5: Optimized database query with caching
        # Disable cache when no_activity_date filter is active to ensure real-time filtering
        cache_key = f"login_department_leads:{user_id}:{permission_level}:{status_filter or 'all'}:{no_activity_date or 'none'}"
        cached_result = None
        if not no_activity_date:
            cached_result = await get_cached_response(cache_key)
        
        if cached_result:
            print(f"⚡ Cache HIT for login department leads: {time.time() - start_time:.3f}s")
            return cached_result
        
        # ⚡ STEP 6: Database query with performance optimization
        # CHANGED: Query from login_leads collection
        leads = await login_leads_db.list_login_leads(filter_dict=filters, limit=1000)
        
        # Import DepartmentsDB for department name lookup
        from app.database.Departments import DepartmentsDB
        departments_db = DepartmentsDB()
        
        # ⚡ STEP 7: Fast result processing with minimal data transformation
        formatted_leads = []
        for lead in leads:
            lead_dict = convert_object_id(lead)
            
            # Get creator details efficiently
            if lead_dict.get("created_by"):
                creator = await users_db.get_user(lead_dict["created_by"])
                if creator:
                    lead_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
            
            # Add essential login department fields
            lead_dict["login_date"] = lead_dict.get("login_department_sent_date", "")
            
            # Add team/department name efficiently
            department_id = lead_dict.get("department_id")
            if department_id:
                department = await departments_db.get_department(department_id)
                lead_dict["team_name"] = department.get("name", "") if department else "Unknown"
            else:
                lead_dict["team_name"] = "Not Assigned"
            
            # Customer name from lead details
            customer_name = f"{lead_dict.get('first_name', '')} {lead_dict.get('last_name', '')}".strip()
            lead_dict["customer_name"] = customer_name
            
            # Process dynamic fields efficiently
            if lead_dict.get("dynamic_fields"):
                dynamic_fields = lead_dict["dynamic_fields"]
                financial_details = dynamic_fields.get("financial_details", {}) or {}
                address = dynamic_fields.get("address", {}) or {}
                eligibility_details = dynamic_fields.get("eligibility_details", {}) or {}
                personal_details = dynamic_fields.get("personal_details", {}) or {}
                
                lead_dict["salary"] = financial_details.get('monthly_income', "")
                lead_dict["pincode"] = address.get("pincode", "")
                lead_dict["city"] = address.get("city", "")
                lead_dict["loan_eligibility"] = eligibility_details.get("finalEligibility", "")
                lead_dict["cibil_score"] = financial_details.get("cibil_score", "")
                
                # Extract company details efficiently
                company_name_value = personal_details.get("company_name")
                company_category_value = personal_details.get("company_category")
                
                lead_dict["company_name"] = (company_name_value[0] if isinstance(company_name_value, list) and company_name_value 
                                           else company_name_value if isinstance(company_name_value, str) else 'NONE')
                lead_dict["company_category"] = (company_category_value[0] if isinstance(company_category_value, list) and company_category_value 
                                               else company_category_value if isinstance(company_category_value, str) else 'NONE')
                
                # Include question responses
                lead_dict["question_responses"] = lead_dict.get("question_responses", {})
                lead_dict["important_questions_validated"] = lead_dict.get("important_questions_validated", False)
            
            # Add operations info
            lead_dict["amount_approved"] = lead_dict.get("operations_amount_approved", "")
            
            # Get assigned users details efficiently
            assigned_users = []
            assigned_to = lead_dict.get("assigned_to", [])
            if isinstance(assigned_to, str):
                assigned_to = [assigned_to]
            
            for assigned_id in assigned_to:
                user = await users_db.get_user(assigned_id)
                if user:
                    assigned_users.append({
                        "user_id": assigned_id,
                        "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                        "email": user.get("email", "")
                    })
            
            lead_dict["assigned_users"] = assigned_users
            formatted_leads.append(lead_dict)
        
        # ⚡ STEP 7.5: Apply no activity date filtering if specified
        if no_activity_date:
            print(f"🔍 Applying no activity filter for date: {no_activity_date}")
            print(f"📊 Total leads before filtering: {len(formatted_leads)}")
            try:
                # Parse the no activity date
                from datetime import datetime
                cutoff_date = datetime.fromisoformat(no_activity_date.replace('Z', '+00:00'))
                print(f"📅 Parsed cutoff date: {cutoff_date}")
                
                # Filter leads that have no activity since the cutoff date
                filtered_leads = []
                for lead in formatted_leads:
                    lead_id = str(lead["_id"])
                    
                    # Check if lead has any activity since the cutoff date
                    try:
                        # Use the existing get_lead_activities method from LeadsDB
                        activities = await leads_db.get_lead_activities(lead_id)
                        
                        # Check if any activity exists after the cutoff date
                        has_recent_activity = False
                        if activities:
                            for activity in activities:
                                activity_date = activity.get("created_at")
                                if activity_date:
                                    # Handle different date formats
                                    if isinstance(activity_date, str):
                                        try:
                                            activity_datetime = datetime.fromisoformat(activity_date.replace('Z', '+00:00'))
                                        except:
                                            # Try parsing as timestamp
                                            activity_datetime = datetime.fromtimestamp(float(activity_date))
                                    elif isinstance(activity_date, datetime):
                                        activity_datetime = activity_date
                                    else:
                                        continue
                                    
                                    if activity_datetime > cutoff_date:
                                        has_recent_activity = True
                                        break
                        
                        # Only include leads with no recent activity
                        if not has_recent_activity:
                            filtered_leads.append(lead)
                            
                    except Exception as activity_error:
                        # If error checking activities, include the lead (fail-safe)
                        print(f"⚠️ Error checking activities for lead {lead_id}: {activity_error}")
                        filtered_leads.append(lead)
                
                original_count = len(formatted_leads)
                formatted_leads = filtered_leads
                print(f"🔍 No activity filter applied: {len(formatted_leads)} leads without activity since {no_activity_date}")
                print(f"📊 Filtered out {original_count - len(filtered_leads)} leads with recent activity")
                
            except Exception as date_error:
                print(f"⚠️ Error parsing no_activity_date '{no_activity_date}': {date_error}")
                # Continue with unfiltered results if date parsing fails
        
        # ⚡ STEP 8: Prepare optimized response
        result = {
            "leads": formatted_leads, 
            "total": len(formatted_leads),
            "metadata": {
                "permission_level": permission_level,
                "user_id": user_id,
                "response_time": f"{time.time() - start_time:.3f}s"
            }
        }
        
        # ⚡ STEP 9: Cache the result for future requests
        await cache_response(cache_key, result, ttl=30)
        
        print(f"⚡ Login department leads processed in {time.time() - start_time:.3f}s")
        return result
        
    except Exception as e:
        print(f"❌ Login department leads error: {e} - Time: {time.time() - start_time:.3f}s")
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads: {e}")

@router.get("/important-questions")
@cached_response(ttl=300)  # ⚡ Cache for 5 minutes - questions rarely change
async def get_important_questions(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """⚡ OPTIMIZED: Get dynamic important questions with caching"""
    start_time = time.time()
    
    try:
        # ⚡ STEP 1: Fast permission check with caching
        cached_permissions = await get_cached_user_permissions(user_id)
        if not cached_permissions:
            await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
            # Cache permissions for future requests
            user_permissions = await get_user_permissions(user_id, users_db, roles_db)
            await cache_user_permissions(user_id, user_permissions)
        
        # ⚡ STEP 2: Check cache first
        cache_key = "important_questions:active"
        cached_result = await get_cached_response(cache_key)
        if cached_result:
            print(f"⚡ Cache HIT for important questions: {time.time() - start_time:.3f}s")
            return cached_result
        
        # ⚡ STEP 3: Database query with fallback
        from app.database.ImportantQuestions import ImportantQuestionsDB
        questions_db = ImportantQuestionsDB()
        
        # Get active questions efficiently
        questions = await questions_db.get_questions(is_active=True)
        
        # ⚡ STEP 4: Use default questions if none configured
        if not questions:
            questions = [
                {"id": "default_1", "question": "Has customer provided all required documents?", "mandatory": True, "type": "checkbox", "is_active": True, "display_order": 1},
                {"id": "default_2", "question": "Is customer's CIBIL score verified?", "mandatory": True, "type": "checkbox", "is_active": True, "display_order": 2},
                {"id": "default_3", "question": "Has income verification been completed?", "mandatory": True, "type": "checkbox", "is_active": True, "display_order": 3},
                {"id": "default_4", "question": "Are bank statements validated?", "mandatory": True, "type": "checkbox", "is_active": True, "display_order": 4},
                {"id": "default_5", "question": "Has reference verification been done?", "mandatory": True, "type": "checkbox", "is_active": True, "display_order": 5}
            ]
        
        # ⚡ STEP 5: Fast result formatting
        formatted_questions = [
            {
                "id": str(question.get("_id", question.get("id"))),
                "question": question["question"],
                "mandatory": question.get("mandatory", True),
                "type": question.get("type", "checkbox")
            }
            for question in questions
        ]
        
        # ⚡ STEP 6: Prepare response
        result = {
            "questions": formatted_questions,
            "metadata": {
                "response_time": f"{time.time() - start_time:.3f}s",
                "count": len(formatted_questions)
            }
        }
        
        # ⚡ STEP 7: Cache for future requests
        await cache_response(cache_key, result, ttl=300)
        
        print(f"⚡ Important questions fetched in {time.time() - start_time:.3f}s")
        return result
        
    except Exception as e:
        print(f"❌ Important questions error: {e} - Time: {time.time() - start_time:.3f}s")
        
        # ⚡ Fast fallback without database
        fallback_questions = [
            {"id": "fallback_1", "question": "Has customer provided all required documents?", "mandatory": True, "type": "checkbox"},
            {"id": "fallback_2", "question": "Is customer's CIBIL score verified?", "mandatory": True, "type": "checkbox"},
            {"id": "fallback_3", "question": "Has income verification been completed?", "mandatory": True, "type": "checkbox"},
            {"id": "fallback_4", "question": "Are bank statements validated?", "mandatory": True, "type": "checkbox"},
            {"id": "fallback_5", "question": "Has reference verification been done?", "mandatory": True, "type": "checkbox"}
        ]
        return {"questions": fallback_questions}

@router.patch("/validate-questions/{lead_id}")
async def validate_important_questions(
    lead_id: str,
    request_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    leads_db: LeadsDB = Depends(get_leads_db),  # FIXED: Use leads collection (validation happens BEFORE sending to login)
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Validate that all mandatory questions are answered
    
    IMPORTANT: This validates questions in the main leads collection BEFORE sending to LoginCRM
    """
    # Check permission - check both leads and login permissions
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Extract responses from request data
    if "responses" in request_data:
        # New format with activity
        question_responses = request_data["responses"]
        # Extract activity if present
        activity_data = request_data.get("activity")
    else:
        # Old format - direct responses object
        question_responses = request_data
        activity_data = None
    
    # Get all questions to check mandatory ones
    questions_response = await get_important_questions(user_id, users_db, roles_db)
    questions = questions_response["questions"]
    
    # Check all mandatory questions are answered positively
    missing_questions = []
    for question in questions:
        if question["mandatory"]:
            question_id = question["id"]
            if question_id not in question_responses or not question_responses[question_id]:
                missing_questions.append(question["question"])
    
    if missing_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Please complete all mandatory questions: {', '.join(missing_questions)}"
        )
    
    # Update login lead with question responses
    update_data = {
        "important_questions_validated": True,
        "question_responses": question_responses,
        "questions_validated_by": user_id,
        "questions_validated_date": get_ist_now().isoformat(),
        "updated_at": get_ist_now().isoformat()
    }
    
    # Include activity data if provided
    if activity_data:
        update_data["activity"] = activity_data
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"🔍 Validating questions for lead {lead_id}")
    logger.info(f"   Question responses: {question_responses}")
    logger.info(f"   Update data: {list(update_data.keys())}")
    
    # Update the lead using correct method signature (MAIN leads collection, not login_leads)
    try:
        success = await leads_db.update_lead(lead_id, update_data, user_id)
        if not success:
            logger.error(f"❌ update_lead returned False for lead {lead_id}")
            logger.error(f"   This usually means no changes were made or lead not found")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update question responses"
            )
        logger.info(f"✅ Successfully validated questions for lead {lead_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Exception during question validation: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update question responses: {str(e)}"
        )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after questions validation
    try:
        await invalidate_cache_pattern("login-department-leads*")
        print(f"🔄 Cache invalidated for login leads after questions validation for lead {lead_id}")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after questions update: {cache_error}")
    
    return {"message": "All important questions validated successfully"}

@router.get("/junior-users")
@cached_response(ttl=120)  # ⚡ Cache for 2 minutes - user hierarchy changes rarely
async def get_junior_users(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """⚡ OPTIMIZED: Get users under current user's hierarchy with caching"""
    start_time = time.time()
    
    try:
        # ⚡ STEP 1: Fast permission check with caching
        cached_permissions = await get_cached_user_permissions(user_id)
        if not cached_permissions:
            await check_permission(user_id, ["users", "leads", "login"], "show", users_db, roles_db)
            # Cache permissions for future requests
            user_permissions = await get_user_permissions(user_id, users_db, roles_db)
            await cache_user_permissions(user_id, user_permissions)
        
        # ⚡ STEP 2: Check cache first
        cache_key = f"junior_users:{user_id}"
        cached_result = await get_cached_response(cache_key)
        if cached_result:
            print(f"⚡ Cache HIT for junior users: {time.time() - start_time:.3f}s")
            return cached_result
        
        # ⚡ STEP 3: Get current user efficiently
        current_user = await users_db.get_user(user_id)
        if not current_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Current user not found")
        
        # ⚡ STEP 4: Get current user's role efficiently
        current_user_role = None
        if current_user.get("role_id"):
            current_user_role = await roles_db.get_role(current_user["role_id"])
        
        # ⚡ STEP 5: Get all users and filter efficiently
        all_users = await users_db.list_users()
        junior_users = []
        
        for user in all_users:
            # Skip the current user
            if str(user.get("_id")) == user_id:
                continue
            
            # Get user's role efficiently
            user_role = None
            if user.get("role_id"):
                user_role = await roles_db.get_role(user["role_id"])
            
            # Include user based on role hierarchy
            if user_role:
                user_dict = convert_object_id(user)
                user_dict["role"] = {
                    "name": user_role.get("name", ""),
                    "level": user_role.get("level", 0)
                }
                junior_users.append(user_dict)
        
        # ⚡ STEP 6: Prepare optimized response
        result = {
            "users": junior_users,
            "metadata": {
                "count": len(junior_users),
                "current_user_id": user_id,
                "response_time": f"{time.time() - start_time:.3f}s"
            }
        }
        
        # ⚡ STEP 7: Cache for future requests
        await cache_response(cache_key, result, ttl=120)
        
        print(f"⚡ Junior users fetched in {time.time() - start_time:.3f}s")
        return result
        
    except Exception as e:
        print(f"❌ Junior users error: {e} - Time: {time.time() - start_time:.3f}s")
        raise HTTPException(status_code=500, detail=f"Failed to fetch junior users: {e}")

@router.patch("/update-login-fields/{lead_id}")
async def update_login_fields(
    lead_id: str,
    login_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),  # CHANGED: Use login_leads collection
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Update login form fields for a lead
    
    NEW BEHAVIOR: Updates login_leads collection (separate from leads)
    """
    
    # Check permission - check both leads and login permissions
    try:
        await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    except Exception as e:
        raise
    
    # Verify login lead exists
    lead = await login_leads_db.get_login_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {lead_id} not found"
        )
    
    # Prepare login update data
    # Initialize dynamic_fields if not present
    dynamic_fields = lead.get("dynamic_fields", {})
    
    # Track any direct fields to update
    direct_update = {}
    
    # Check if we're receiving a complete login form submission
    if 'login_form' in login_data:
        # Initialize login_form in dynamic_fields if it doesn't exist
        if 'login_form' not in dynamic_fields:
            dynamic_fields['login_form'] = {}
            
        # Store the complete login form submission
        login_form_data = login_data['login_form']
        dynamic_fields['login_form'] = login_form_data
        
        # Handle special fields to maintain compatibility with existing code
        # Handle CIBIL Score
        if 'cibil_score' in login_form_data:
            if 'financial_details' not in dynamic_fields:
                dynamic_fields['financial_details'] = {}
            dynamic_fields['financial_details']['cibil_score'] = login_form_data['cibil_score']
            dynamic_fields['cibil_score'] = login_form_data['cibil_score']
            
        # Handle company name and category
        if 'company_name' in login_form_data:
            if 'personal_details' not in dynamic_fields:
                dynamic_fields['personal_details'] = {}
            dynamic_fields['personal_details']['company_name'] = login_form_data['company_name']
            dynamic_fields['company_name'] = login_form_data['company_name']
            
        if 'company_category' in login_form_data:
            if 'personal_details' not in dynamic_fields:
                dynamic_fields['personal_details'] = {}
            dynamic_fields['personal_details']['company_category'] = login_form_data['company_category']
            dynamic_fields['company_category'] = login_form_data['company_category']
            
        # Handle identity fields
        if 'pan_number' in login_form_data:
            if 'identity_details' not in dynamic_fields:
                dynamic_fields['identity_details'] = {}
            dynamic_fields['identity_details']['pan_number'] = login_form_data['pan_number']
            
        if 'aadhar_number' in login_form_data:
            if 'identity_details' not in dynamic_fields:
                dynamic_fields['identity_details'] = {}
            dynamic_fields['identity_details']['aadhar_number'] = login_form_data['aadhar_number']
    else:
        # Process individual fields from the request (backward compatibility)
        for field, value in login_data.items():
            # Special handling for CIBIL score - ensure it's stored in financial_details
            if field == 'cibil_score':
                # Initialize financial_details if not present
                if 'financial_details' not in dynamic_fields:
                    dynamic_fields['financial_details'] = {}
                # Store in both places for backward compatibility
                dynamic_fields[field] = value
                dynamic_fields['financial_details']['cibil_score'] = value
            # Check if this field should be stored in dynamic_fields
            elif field in ['loan_eligibility', 'company_name', 'company_category', 'salary', 
                        'pincode', 'city', 'customer_name']:
                dynamic_fields[field] = value
            else:
                # Store other fields directly in the lead document
                direct_update[field] = value
    
    # Combine updates
    update_data = {
        "dynamic_fields": dynamic_fields,
        "updated_at": get_ist_now().isoformat(),
        "login_form_updated_by": user_id,
        "login_form_updated_at": get_ist_now().isoformat()
    }
    
    # Add any direct fields
    update_data.update(direct_update)
    
    # Update the login lead using correct method signature
    success = await login_leads_db.update_login_lead(lead_id, update_data, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update login form data"
        )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after login fields update
    try:
        await invalidate_cache_pattern("login-department-leads*")
        print(f"🔄 Cache invalidated for login leads after login fields update for lead {lead_id}")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after login fields update: {cache_error}")
    
    return {
        "message": "Login form data updated successfully", 
        "updated_fields": list(login_data.keys()),
        "timestamp": get_ist_now().isoformat()
    }

@router.get("/debug/test-lead/{lead_id}")
async def debug_test_lead(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db)  # CHANGED: Use login_leads collection
):
    """
    Debug endpoint to test login lead retrieval and database connection
    
    NEW BEHAVIOR: Queries login_leads collection (separate from leads)
    """
    
    try:
        # Test database connection
        collection_name = login_leads_db.collection.name
        
        # Test login lead retrieval
        lead = await login_leads_db.get_login_lead(lead_id)
        if not lead:
            return {
                "status": "error",
                "message": f"Login lead {lead_id} not found",
                "database_collection": collection_name
            }
        
        # Get basic lead info
        lead_info = {
            "id": str(lead.get('_id')),
            "name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
            "phone": lead.get('phone'),
            "email": lead.get('email'),
            "status": lead.get('status'),
            "has_dynamic_fields": bool(lead.get('dynamic_fields')),
            "dynamic_fields_keys": list(lead.get('dynamic_fields', {}).keys()),
            "has_login_form": bool(lead.get('dynamic_fields', {}).get('login_form')),
            "login_form_keys": list(lead.get('dynamic_fields', {}).get('login_form', {}).keys())
        }
        
        return {
            "status": "success",
            "lead": lead_info,
            "database_collection": collection_name
        }
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Debug test failed: {e}")
        return {
            "status": "error",
            "message": str(e),
            "database_collection": getattr(leads_db.collection, 'name', 'unknown')
        }

@router.delete("/{lead_id}")
@router.delete("/login-leads/{lead_id}")  # Add alias for frontend compatibility
async def delete_login_lead(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),  # CHANGED: Use login_leads collection
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Delete a login department lead
    
    NEW BEHAVIOR: Deletes from login_leads collection (separate from leads)
    Permission rule: Only lead creator, users with all/junior permissions can delete
    """
    
    # Check if login lead exists
    lead = await login_leads_db.get_login_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Login lead with ID {lead_id} not found"
        )
    
    # Get hierarchical permissions for login module
    permission_data = await get_hierarchical_permissions(user_id, "login")
    permission_level = permission_data["permission_level"]
    is_super_admin = permission_data["is_super_admin"]
    
    # Check if user is the creator of the lead
    is_creator = lead.get("created_by") == user_id
    
    # Apply delete permission rule: Only creator or users with junior/all permissions can delete
    has_delete_permission = (
        is_super_admin or 
        permission_level in ["all", "junior"] or 
        is_creator
    )
    
    # Additional hierarchical check for junior level users
    if permission_level == "junior" and not is_creator and not is_super_admin:
        # Check if lead was created by a subordinate
        from app.utils.permissions import PermissionManager
        try:
            subordinate_ids = await PermissionManager.get_subordinate_users(user_id, users_db, roles_db)
            if lead.get("created_by") not in subordinate_ids:
                has_delete_permission = False
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error checking subordinates for delete permission: {e}")
            has_delete_permission = False
    
    if not has_delete_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this login department lead"
        )
    
    # Delete the login lead
    success = await login_leads_db.delete_login_lead(lead_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete login department lead"
        )
    
    # ⚡ CACHE INVALIDATION: Clear login department leads cache after deletion
    try:
        await invalidate_cache_pattern("login-department-leads*")
        await invalidate_cache_pattern(f"*{user_id}*")  # Clear user-specific caches
        print(f"🔄 Cache invalidated for login leads after deleting lead {lead_id}")
    except Exception as cache_error:
        print(f"⚠️ Warning: Failed to invalidate cache after deletion: {cache_error}")
        # Don't fail the operation if cache invalidation fails
    
    return {"message": "Login department lead deleted successfully"}

@router.get("/channel-names")
async def get_channel_names_for_operations(
    user_id: str = Query(..., description="ID of the user making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get channel names for operations dropdown in LoginCRM"""
    try:
        # Check permission - user should be able to view login operations
        await check_permission(user_id, "login", "show", users_db, roles_db)
        
        # Import SettingsDB here to avoid circular imports
        from app.database.Settings import SettingsDB
        settings_db = SettingsDB()
        
        # Get only active channel names
        channels = await settings_db.get_channel_names(is_active=True)
        
        # Extract just the names for dropdown
        channel_names = [channel['name'] for channel in channels]
        
        return {
            "success": True,
            "channel_names": channel_names,
            "count": len(channel_names)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch channel names: {str(e)}"
        )
