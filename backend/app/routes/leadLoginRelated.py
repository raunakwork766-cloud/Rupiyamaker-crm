from fastapi import APIRouter, HTTPException, Depends, status, Query, UploadFile, File, Form, Body
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, validator, root_validator
from bson import ObjectId
from datetime import datetime
from app.utils.timezone import get_ist_now
import time
import asyncio
import logging
import copy
import uuid
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

# ── Security: fields that must never be writable via the public API ──────────
_PROTECTED_FIELDS = frozenset({
    # Identity / auth
    "_id", "id",
    # Privileges
    "is_super_admin", "role_id", "role", "permissions",
    # Immutable lead metadata
    "created_at", "login_created_at", "login_created_by", "created_by",
    # System-managed audit fields (set by server only)
    "updated_at", "updated_by",
    # Source / origin control
    "original_lead_id", "lead_source",
})

class LoginLeadUpdateRequest(BaseModel):
    """
    Pydantic schema for PUT /login-leads/{id}.
    Accepts any field that is NOT in _PROTECTED_FIELDS.
    All values remain untyped (Any) because login-lead fields are highly dynamic.
    """
    class Config:
        extra = "allow"  # allow arbitrary lead fields

    @root_validator(pre=True)
    @classmethod
    def strip_protected_fields(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        blocked = _PROTECTED_FIELDS & set(values.keys())
        if blocked:
            raise ValueError(
                f"Attempt to set protected field(s): {', '.join(sorted(blocked))}. "
                "These fields cannot be modified via this endpoint."
            )
        return values

async def create_field_update_activity(
    login_leads_db,
    login_lead_id: str,
    user_id: str,
    field_changes: Dict[str, Any],
    lead_name: str = "Lead",
    old_lead_data: Dict[str, Any] = None
):
    """
    Create a detailed activity log for field updates in login lead
    
    Args:
        login_leads_db: LoginLeadsDB instance
        login_lead_id: ID of the login lead
        user_id: ID of user making the change
        field_changes: Dictionary of field names to their new values
        lead_name: Name of the lead for better readability
        old_lead_data: Previous lead data to show old vs new values
    """
    try:
        # Field name mapping for better readability
        field_labels = {
            'first_name': 'First Name',
            'last_name': 'Last Name',
            'email': 'Email',
            'phone': 'Phone',
            'mobile_number': 'Mobile Number',
            'alternative_phone': 'Alternative Phone',
            'address': 'Address',
            'status': 'Status',
            'sub_status': 'Sub Status',
            'priority': 'Priority',
            'loan_type': 'Loan Type',
            'loan_amount': 'Loan Amount',
            'processing_bank': 'Processing Bank',
            'assigned_to': 'Assigned To',
            'department_id': 'Department',
            'city': 'City',
            'pincode': 'Pincode',
            'company_name': 'Company Name',
            'cibil_score': 'CIBIL Score',
            'salary': 'Salary',
            'loan_required': 'Loan Required',
        }
        
        changes_summary = []
        field_details = {}
        
        for field, new_value in field_changes.items():
            # Skip internal fields
            if field in ['updated_at', 'updated_by', '_id', 'id', 'created_at', 'created_by']:
                continue
            
            # Get old value for comparison if available
            old_value = None
            if old_lead_data:
                old_value = old_lead_data.get(field)
            
            # Get readable field name
            field_label = field_labels.get(field, field.replace('_', ' ').title())
            
            # Handle different value types with detailed formatting
            if isinstance(new_value, dict) and field == 'dynamic_fields':
                # For dynamic_fields, dig deeper to see what actually changed
                if old_lead_data and 'dynamic_fields' in old_lead_data:
                    old_dynamic = old_lead_data['dynamic_fields'] or {}
                    new_dynamic = new_value or {}
                    
                    # Recursive function to compare nested dictionaries
                    def compare_nested(old_dict, new_dict, path=""):
                        """Compare two nested dictionaries and find specific changes"""
                        changes = []
                        
                        for key, new_val in new_dict.items():
                            if key in ['updated_at', 'updated_by']:
                                continue
                            
                            old_val = old_dict.get(key) if isinstance(old_dict, dict) else None
                            full_path = f"{path}.{key}" if path else key
                            
                            if isinstance(new_val, dict) and isinstance(old_val, dict):
                                # Recursively compare nested dicts
                                nested_changes = compare_nested(old_val, new_val, full_path)
                                changes.extend(nested_changes)
                            elif new_val != old_val:
                                # Found a change - format it nicely
                                field_name = field_labels.get(key, key.replace('_', ' ').title())
                                
                                if old_val is not None and old_val != '':
                                    # Show old -> new
                                    old_str = str(old_val)
                                    new_str = str(new_val)
                                    if len(old_str) > 30:
                                        old_str = old_str[:27] + "..."
                                    if len(new_str) > 30:
                                        new_str = new_str[:27] + "..."
                                    changes.append({
                                        'summary': f"{field_name}: {old_str} → {new_str}",
                                        'field': key,
                                        'old': old_val,
                                        'new': new_val
                                    })
                                else:
                                    # New value (no old value)
                                    new_str = str(new_val)
                                    if len(new_str) > 50:
                                        new_str = new_str[:47] + "..."
                                    changes.append({
                                        'summary': f"{field_name}: {new_str}",
                                        'field': key,
                                        'old': None,
                                        'new': new_val
                                    })
                        
                        return changes
                    
                    # Get all nested changes
                    nested_changes = compare_nested(old_dynamic, new_dynamic)
                    
                    if nested_changes:
                        for change in nested_changes:
                            changes_summary.append(change['summary'])
                            field_details[change['field']] = {'old': change['old'], 'new': change['new']}
                    else:
                        changes_summary.append("Dynamic fields updated")
                else:
                    changes_summary.append("Dynamic fields updated")
                    
            elif isinstance(new_value, dict):
                # Other dict fields
                changes_summary.append(f"{field_label} updated")
                field_details[field] = {'type': 'object', 'keys': list(new_value.keys())}
                
            elif isinstance(new_value, list):
                list_desc = f"{field_label}: {len(new_value)} items"
                if new_value and len(new_value) <= 3:
                    list_desc = f"{field_label}: {', '.join(str(x) for x in new_value)}"
                changes_summary.append(list_desc)
                field_details[field] = {'old': old_value, 'new': new_value, 'count': len(new_value)}
                
            elif new_value is not None and new_value != '':
                # Simple value - show old -> new if different
                if old_value != new_value:
                    str_value = str(new_value)
                    if len(str_value) > 50:
                        str_value = str_value[:47] + "..."
                    
                    if old_value:
                        old_str = str(old_value)
                        if len(old_str) > 30:
                            old_str = old_str[:27] + "..."
                        changes_summary.append(f"{field_label}: {old_str} → {str_value}")
                    else:
                        changes_summary.append(f"{field_label}: {str_value}")
                    
                    field_details[field] = {'old': old_value, 'new': new_value}
        
        if not changes_summary:
            return  # No meaningful changes to log
        
        # Create a clear, readable description
        if len(changes_summary) == 1:
            description = f"Updated {changes_summary[0]}"
        elif len(changes_summary) <= 3:
            description = f"Updated {', '.join(changes_summary)}"
        else:
            description = f"Updated {len(changes_summary)} fields: {', '.join(changes_summary[:2])} and {len(changes_summary) - 2} more"
        
        await login_leads_db._log_activity(
            login_lead_id=login_lead_id,
            activity_type='field_update',
            description=description,
            user_id=user_id,
            details={
                'fields_changed': list(field_changes.keys()),
                'change_count': len(changes_summary),
                'field_details': field_details,
                'timestamp': get_ist_now().isoformat()
            }
        )
        logger.info(f"✅ Activity logged for login lead {login_lead_id}: {description}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to create activity log: {e}")
        import traceback
        traceback.print_exc()

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
        # Login lead already exists (likely re-send after rollback)
        # Just re-mark the original lead as sent to login without creating a new login lead
        # This preserves login CRM data while allowing re-send after rollback
        existing_login_lead_id = str(existing_login_lead.get("_id", ""))
        re_update_data = {
            "file_sent_to_login": True,
            "login_department_sent_date": get_ist_now().isoformat(),
            "login_department_sent_by": user_id,
            "login_lead_id": existing_login_lead_id,
            "updated_at": get_ist_now().isoformat()
        }
        success = await leads_db.update_lead(lead_id, re_update_data, user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to re-mark lead as sent to login"
            )
        # Invalidate cache
        try:
            await invalidate_cache_pattern("login-department-leads*")
        except Exception:
            pass
        return {
            "message": "Lead re-sent to login department successfully (existing login lead preserved)",
            "lead_id": lead_id,
            "login_lead_id": existing_login_lead_id,
            "info": "Login lead already existed from previous send. Original lead re-marked as sent to login.",
            "obligation_data_preserved": True
        }
    
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

@router.get("/check-phone/{phone_number}")
async def check_login_phone_number(
    phone_number: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Check if a phone number exists in the login_leads collection.
    Used by the CreateLead duplicate check to populate the 'Login in Leads' tab.
    """
    await check_permission(user_id, "leads", "show", users_db, roles_db)

    clean_phone = phone_number.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    search_filter = {
        "$or": [
            {"phone": {"$regex": clean_phone, "$options": "i"}},
            {"mobile_number": {"$regex": clean_phone, "$options": "i"}},
            {"alternative_phone": {"$regex": clean_phone, "$options": "i"}}
        ]
    }

    matching_leads = await login_leads_db.list_login_leads(filter_dict=search_filter, limit=20)

    if not matching_leads:
        return {"found": False, "leads": [], "total_leads": 0}

    lead_results = []
    for lead in matching_leads:
        lead_id = str(lead.get("_id", ""))

        created_by_name = lead.get("created_by_name", "")
        if not created_by_name and lead.get("login_created_by"):
            try:
                creator = await users_db.get_user(str(lead["login_created_by"]))
                if creator:
                    created_by_name = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip() or creator.get("username", "")
            except Exception:
                pass

        dept_name = lead.get("department_name", "")
        if isinstance(dept_name, dict):
            dept_name = dept_name.get("name", "")

        bank_name = lead.get("bank_name", "") or lead.get("processing_bank", "") or ""
        if not bank_name:
            fin = lead.get("financial_details", {}) or {}
            bank_name = fin.get("bank_name", "") or ""
        if not bank_name:
            # Check dynamic_fields.process.processing_bank (set by HowToProcessSection)
            dyn = lead.get("dynamic_fields", {}) or {}
            bank_name = (
                dyn.get("process", {}).get("processing_bank", "")
                or dyn.get("login_form", {}).get("processing_bank", "")
                or dyn.get("processingBank", "")
                or dyn.get("processing_bank", "")
                or ""
            )
        if not bank_name:
            # Check processing_banks list
            pb = lead.get("processing_banks", []) or []
            if isinstance(pb, list) and pb:
                bank_name = pb[0] if isinstance(pb[0], str) else (pb[0].get("bank_name", "") if isinstance(pb[0], dict) else "")
        if isinstance(bank_name, list):
            bank_name = bank_name[0] if bank_name else ""

        loan_type_display = lead.get("loan_type_name") or lead.get("loan_type") or ""

        lead_results.append({
            "id": lead_id,
            "name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
            "phone": lead.get("phone", lead.get("mobile_number", "")),
            "status": lead.get("status", ""),
            "sub_status": lead.get("sub_status", ""),
            "bank_name": bank_name,
            "loan_type": loan_type_display,
            "login_date": lead.get("login_date", lead.get("login_created_at", "")),
            "created_at": lead.get("created_at", ""),
            "login_created_at": lead.get("login_created_at", ""),
            "created_by_name": created_by_name,
            "department_name": dept_name,
            "original_lead_id": lead.get("original_lead_id", ""),
        })

    return {"found": True, "leads": lead_results, "total_leads": len(lead_results)}


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
    update_request: LoginLeadUpdateRequest,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Update a login lead with any non-protected fields.
    Used by the details panel for auto-save functionality.
    Protected fields (role_id, is_super_admin, created_at, etc.) are rejected with 422.
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

    # Convert validated model to plain dict (extra fields preserved via Config.extra="allow")
    update_data = update_request.dict()

    # Server-controlled audit fields — always overwritten here, never from client
    update_data["updated_at"] = get_ist_now().isoformat()
    update_data["updated_by"] = user_id
    
    # 📝 Create activity log for field updates with old vs new comparison
    lead_name = f"{login_lead.get('first_name', '')} {login_lead.get('last_name', '')}".strip() or "Lead"
    await create_field_update_activity(
        login_leads_db=login_leads_db,
        login_lead_id=login_lead_id,
        user_id=user_id,
        field_changes=update_data,
        lead_name=lead_name,
        old_lead_data=login_lead  # Pass old data for comparison
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
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)

    login_lead = await login_leads_db.get_login_lead(login_lead_id)
    if not login_lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Login lead with ID {login_lead_id} not found")

    dynamic_fields = login_lead.get("dynamic_fields") or {}
    dynamic_details = login_lead.get("dynamic_details") or {}

    # ── Canonical location (new saves go here) ──
    canonical = dynamic_fields.get("obligation_data") or {}

    # ── Legacy fallback locations ──
    fin_df   = dynamic_fields.get("financial_details") or {}
    fin_dd   = dynamic_details.get("financial_details") or {}
    per_df   = dynamic_fields.get("personal_details") or {}
    per_dd   = dynamic_details.get("personal_details") or {}

    def first(*vals):
        """Return first truthy value, empty string as fallback."""
        for v in vals:
            if v not in (None, "", [], {}):
                return v
        return ""

    salary          = first(canonical.get("salary"),
                            fin_df.get("salary"), fin_df.get("monthly_income"),
                            fin_dd.get("salary"), fin_dd.get("monthly_income"),
                            dynamic_fields.get("salary"), login_lead.get("salary"))

    cibil_score     = first(canonical.get("cibilScore"),
                            fin_df.get("cibil_score"), fin_dd.get("cibil_score"),
                            dynamic_fields.get("cibil_score"), login_lead.get("cibil_score"))

    loan_required   = first(canonical.get("loanRequired"),
                            fin_dd.get("loan_required"), fin_dd.get("loan_amount"),
                            fin_df.get("loan_required"), fin_df.get("loan_amount"),
                            fin_df.get("required_loan"), fin_df.get("loan_amt"),
                            dynamic_fields.get("loanRequired"), dynamic_fields.get("loan_required"),
                            login_lead.get("loan_required"), login_lead.get("loanRequired"))

    company_name    = first(canonical.get("companyName"),
                            per_df.get("company_name"), per_dd.get("company_name"),
                            dynamic_fields.get("companyName"), dynamic_fields.get("company_name"),
                            login_lead.get("company_name"))

    processing_bank = first(canonical.get("processingBank"),
                            dynamic_fields.get("processingBank"), dynamic_fields.get("processing_bank"),
                            login_lead.get("processingBank"), login_lead.get("processing_bank"))

    partner_salary  = first(canonical.get("partnerSalary"),
                            fin_df.get("partner_salary"), fin_dd.get("partner_salary"),
                            dynamic_fields.get("partnerSalary"))

    yearly_bonus    = first(canonical.get("yearlyBonus"),
                            fin_df.get("yearly_bonus"), fin_dd.get("yearly_bonus"),
                            dynamic_fields.get("yearlyBonus"))

    bonus_division  = first(canonical.get("bonusDivision"),
                            fin_df.get("bonus_division"), fin_dd.get("bonus_division"),
                            dynamic_fields.get("bonusDivision"))

    selected_banks  = first(canonical.get("selectedBanks"),
                            dynamic_fields.get("selectedBanks"))
    if not isinstance(selected_banks, list):
        selected_banks = []

    obligations_list = first(canonical.get("obligations"),
                             dynamic_fields.get("obligations"),
                             fin_df.get("obligations"))
    if not isinstance(obligations_list, list):
        obligations_list = []

    result = {
        "salary":        salary,
        "cibilScore":    cibil_score,
        "loanRequired":  loan_required,
        "companyName":   company_name,
        "processingBank": processing_bank,
        "partnerSalary": partner_salary,
        "yearlyBonus":   yearly_bonus,
        "bonusDivision": bonus_division,
        "selectedBanks": selected_banks,
        "obligations":   obligations_list,
        # Preserve for eligibility section
        "check_eligibility":  dynamic_fields.get("check_eligibility") or {},
        "eligibility_details": dynamic_fields.get("eligibility_details") or {},
    }

    logger.info(f"✅ GET obligations {login_lead_id}: salary={salary}, cibil={cibil_score}, "
                f"loan={loan_required}, obligations={len(obligations_list)}")
    return result

@router.post("/login-leads/{login_lead_id}/obligations")
async def update_login_lead_obligations(
    login_lead_id: str,
    obligation_data: Dict[str, Any],
    user_id: str = Query(..., description="ID of the user making the request"),
    context: Optional[str] = Query(None, description="Context: 'reassignment' or 'transfer'"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update obligation and eligibility data for a login lead"""
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)

    login_lead = await login_leads_db.get_login_lead(login_lead_id)
    if not login_lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Login lead with ID {login_lead_id} not found")

    dynamic_fields = dict(login_lead.get('dynamic_fields') or {})

    # ── Known obligation field keys (camelCase as sent by frontend) ──
    OBLIGATION_KEYS = {
        "salary", "cibilScore", "loanRequired", "companyName", "processingBank",
        "partnerSalary", "yearlyBonus", "bonusDivision", "selectedBanks", "obligations",
    }

    # Build canonical obligation_data from incoming payload
    existing_canonical = dynamic_fields.get("obligation_data") or {}
    new_canonical = dict(existing_canonical)  # start from existing, overwrite with incoming
    for key in OBLIGATION_KEYS:
        if key in obligation_data:
            new_canonical[key] = obligation_data[key]

    # Preserve eligibility fields if present in payload
    for key in ("check_eligibility", "eligibility_details"):
        if key in obligation_data:
            dynamic_fields[key] = obligation_data[key]

    # Write canonical block
    dynamic_fields["obligation_data"] = new_canonical

    # ── Remove stale duplicates from legacy locations ──
    # This progressively cleans up old data over time without a one-shot migration.
    for stale_key in ("obligations", "salary", "cibil_score",
                      "loanRequired", "loan_required",
                      "companyName", "company_name",
                      "processingBank", "processing_bank",
                      "partnerSalary", "yearlyBonus", "bonusDivision", "selectedBanks"):
        dynamic_fields.pop(stale_key, None)

    # Clean salary/cibil out of financial_details and personal_details sub-dicts too
    if isinstance(dynamic_fields.get("financial_details"), dict):
        for k in ("salary", "monthly_income", "cibil_score",
                  "loan_required", "loan_amount", "required_loan", "loan_amt",
                  "partner_salary", "yearly_bonus", "bonus_division",
                  "obligations"):
            dynamic_fields["financial_details"].pop(k, None)
        if not dynamic_fields["financial_details"]:
            dynamic_fields.pop("financial_details", None)

    if isinstance(dynamic_fields.get("personal_details"), dict):
        dynamic_fields["personal_details"].pop("company_name", None)
        if not dynamic_fields["personal_details"]:
            dynamic_fields.pop("personal_details", None)

    update_data = {
        'dynamic_fields': dynamic_fields,
        'updated_at': get_ist_now().isoformat(),
        'updated_by': user_id
    }

    success = await login_leads_db.update_login_lead(login_lead_id, update_data, user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Failed to update obligations")

    obligations_count = len(new_canonical.get('obligations', []))
    salary = new_canonical.get('salary', '')
    loan_required = new_canonical.get('loanRequired', '')

    description = "Updated Obligation Section"
    if context == "reassignment":
        description += " (during reassignment review)"
    elif context == "transfer":
        description += " (during transfer review)"
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

    try:
        await invalidate_cache_pattern("login-department-leads*")
    except Exception as cache_error:
        logger.warning(f"⚠️ Failed to invalidate cache: {cache_error}")

    logger.info(f"✅ POST obligations {login_lead_id}: canonical saved with "
                f"salary={salary}, cibil={new_canonical.get('cibilScore')}, "
                f"loan={loan_required}, obligations={obligations_count}")
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
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    
    # Create directory for this login lead's documents
    lead_media_dir = await login_leads_db.create_media_path(login_lead_id)
    document_ids = []
    
    for file in files:
        if not file.filename:
            continue
            
        # Save file
        file_data = await save_upload_file(file, lead_media_dir)
        
        # Permanently remove PDF password using qpdf — saves a fully unlocked copy
        _abs_path = file_data["file_path"]
        _stored_password = password.strip() if password and password.strip() else None
        if _stored_password and file.filename.lower().endswith(".pdf"):
            try:
                import subprocess as _sp, shutil as _sh, os as _os
                _tmp_out = _abs_path + ".tmp_unlocked.pdf"
                _res = _sp.run(
                    ['qpdf', '--decrypt', f'--password={_stored_password}', _abs_path, _tmp_out],
                    capture_output=True, text=True
                )
                if _res.returncode == 0 and _os.path.exists(_tmp_out):
                    _sh.move(_tmp_out, _abs_path)  # replace original with unlocked version
                    _stored_password = None  # no password needed anymore
                else:
                    if _os.path.exists(_tmp_out): _os.remove(_tmp_out)
                    if _os.path.exists(_abs_path): _os.remove(_abs_path)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Wrong PDF password for file '{file.filename}'. Upload rejected."
                    )
            except HTTPException:
                raise
            except Exception as _e:
                if _os.path.exists(_abs_path): _os.remove(_abs_path)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PDF password verification failed for '{file.filename}': {str(_e)}"
                )
        
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
            "password": _stored_password,
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


@router.delete("/login-leads/{login_lead_id}/documents/{document_id}", response_model=Dict[str, str])
async def delete_login_lead_document(
    login_lead_id: str,
    document_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db=Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Delete a document from a login lead"""
    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login lead not found")

    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)

    document = await login_leads_db.get_document(document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    success = await login_leads_db.delete_document(document_id, user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete document")

    return {"message": "Document deleted successfully"}


@router.put("/login-leads/{login_lead_id}/documents/{document_id}", response_model=Dict[str, str])
async def update_login_lead_document(
    login_lead_id: str,
    document_id: str,
    update_data: Dict[str, Any] = Body(...),
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db=Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Update document metadata (e.g. rename) for a login lead document"""
    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login lead not found")

    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)

    document = await login_leads_db.get_document(document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    update_data["updated_at"] = get_ist_now().isoformat()
    await login_leads_db.documents_collection.update_one(
        {"_id": ObjectId(document_id)},
        {"$set": update_data}
    )
    return {"message": "Document updated successfully"}



async def view_login_lead_attachment(
    login_lead_id: str,
    attachment_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db=Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """View/preview an attachment from a login lead"""
    import os, io, mimetypes, logging as _logging

    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login lead not found")

    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)

    document = await login_leads_db.get_document(attachment_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    abs_file_path = document.get("absolute_file_path")
    if not abs_file_path:
        file_path = document.get("file_path", "")
        abs_file_path = file_path if os.path.isabs(file_path) else os.path.join(os.getcwd(), file_path)

    if not os.path.exists(abs_file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    _fname = document.get("filename", "attachment")
    _mtype = document.get("file_type") or mimetypes.guess_type(_fname)[0] or "application/octet-stream"

    stored_password = document.get("password")
    if stored_password and _fname.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader, PdfWriter
            with open(abs_file_path, "rb") as f:
                pdf_bytes = f.read()
            reader = PdfReader(io.BytesIO(pdf_bytes))
            if reader.is_encrypted:
                if reader.decrypt(stored_password).value > 0:
                    writer = PdfWriter()
                    for page in reader.pages:
                        writer.add_page(page)
                    output = io.BytesIO()
                    writer.write(output)
                    output.seek(0)
                    return StreamingResponse(output, media_type="application/pdf",
                                             headers={"Content-Disposition": f'inline; filename="{_fname}"'})
        except Exception as _e:
            _logging.error(f"PDF decrypt error for login attachment {attachment_id}: {_e}")

    return FileResponse(path=abs_file_path, filename=_fname, media_type=_mtype,
                        headers={"Content-Disposition": f'inline; filename="{_fname}"'})


@router.get("/login-leads/{login_lead_id}/attachments/{attachment_id}/download")
async def download_login_lead_attachment(
    login_lead_id: str,
    attachment_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db=Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Download an attachment from a login lead"""
    import os, io, logging as _logging

    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login lead not found")

    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)

    document = await login_leads_db.get_document(attachment_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    abs_file_path = document.get("absolute_file_path")
    if not abs_file_path:
        file_path = document.get("file_path", "")
        abs_file_path = file_path if os.path.isabs(file_path) else os.path.join(os.getcwd(), file_path)

    if not os.path.exists(abs_file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    _fname = document.get("filename", "attachment")

    stored_password = document.get("password")
    if stored_password and _fname.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader, PdfWriter
            with open(abs_file_path, "rb") as f:
                pdf_bytes = f.read()
            reader = PdfReader(io.BytesIO(pdf_bytes))
            if reader.is_encrypted:
                if reader.decrypt(stored_password).value > 0:
                    writer = PdfWriter()
                    for page in reader.pages:
                        writer.add_page(page)
                    output = io.BytesIO()
                    writer.write(output)
                    output.seek(0)
                    return StreamingResponse(output, media_type="application/octet-stream",
                                             headers={"Content-Disposition": f'attachment; filename="{_fname}"'})
        except Exception as _e:
            _logging.error(f"PDF decrypt error for login attachment {attachment_id}: {_e}")

    return FileResponse(path=abs_file_path, filename=_fname, media_type="application/octet-stream")


@router.get("/login-leads/{login_lead_id}/extra-document-fields", response_model=List[Dict[str, Any]])
async def get_login_lead_extra_document_fields(
    login_lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db=Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Get extra (custom) document fields for a login lead"""
    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login lead not found")
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    return lead.get("extra_document_fields", [])


@router.post("/login-leads/{login_lead_id}/extra-document-fields", response_model=Dict[str, Any])
async def add_login_lead_extra_document_field(
    login_lead_id: str,
    body: Dict[str, Any] = Body(...),
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db=Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Add a new extra (custom) document field to a login lead"""
    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login lead not found")
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Field name cannot be empty")
    field = {
        "id": str(uuid.uuid4()),
        "name": name,
        "category_id": body.get("category_id") or "other",
        "created_at": get_ist_now().isoformat(),
    }
    await login_leads_db.collection.update_one(
        {"_id": ObjectId(login_lead_id)},
        {"$push": {"extra_document_fields": field}}
    )
    return field


@router.delete("/login-leads/{login_lead_id}/extra-document-fields/{field_id}", response_model=Dict[str, str])
async def delete_login_lead_extra_document_field(
    login_lead_id: str,
    field_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db=Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Delete an extra (custom) document field from a login lead"""
    lead = await login_leads_db.get_login_lead(login_lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login lead not found")
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)
    await login_leads_db.collection.update_one(
        {"_id": ObjectId(login_lead_id)},
        {"$pull": {"extra_document_fields": {"id": field_id}}}
    )
    return {"message": "Deleted successfully"}


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
            # Only check the specific module (login) - do NOT bleed leads permissions into login
            if perm.get("page") == module:
                actions = perm.get("actions", [])
                if isinstance(actions, str):
                    actions = [actions]
                
                if "all" in actions or "*" in actions:
                    has_all = True
                elif "junior" in actions or "view_team" in actions:
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
            # Use login_date (set during creation), fallback to other date fields if not present
            if not lead_dict.get("login_date"):
                lead_dict["login_date"] = lead_dict.get("login_created_at") or lead_dict.get("login_department_sent_date") or lead_dict.get("created_at", "")
            
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
            
            # ✅ FILTER: Skip inactive employees — they should not appear in junior users dropdown
            if user.get("employee_status", "active") == "inactive" or user.get("is_active", True) == False:
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

@router.get("/login-leads/{lead_id}/assignment-history")
async def get_login_lead_assignment_history(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    login_leads_db = Depends(get_login_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get enriched assignment/reassignment history for a login lead with user names resolved"""
    await check_permission(user_id, ["leads", "login"], "show", users_db, roles_db)

    lead = await login_leads_db.get_login_lead(lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login lead not found")

    raw_history = lead.get("assignment_history", [])

    # Collect all unique user IDs for bulk lookup
    all_user_ids = set()
    for entry in raw_history:
        if entry.get("assigned_by"):
            all_user_ids.add(str(entry["assigned_by"]))
        for uid in entry.get("users", []):
            all_user_ids.add(str(uid))

    # Resolve user names in bulk
    user_name_map = {}
    for uid in all_user_ids:
        try:
            u = await users_db.get_user(uid)
            if u:
                fn = u.get("first_name", "")
                ln = u.get("last_name", "")
                user_name_map[uid] = f"{fn} {ln}".strip() or u.get("username", uid)
        except Exception:
            user_name_map[uid] = uid

    enriched = []
    for entry in raw_history:
        assigned_by_id = str(entry.get("assigned_by", ""))
        assigned_to_ids = [str(u) for u in entry.get("users", [])]
        enriched.append({
            "assigned_by_id": assigned_by_id,
            "assigned_by_name": user_name_map.get(assigned_by_id, assigned_by_id),
            "assigned_to_ids": assigned_to_ids,
            "assigned_to_names": [user_name_map.get(uid, uid) for uid in assigned_to_ids],
            "assigned_date": entry.get("assigned_date", ""),
            "assignment_type": entry.get("assignment_type", "login_department"),
            "department_id": str(entry.get("department_id", "")) if entry.get("department_id") else None,
            "remark": entry.get("remark", ""),
        })

    # Newest first
    enriched.sort(key=lambda x: x["assigned_date"], reverse=True)

    return {"lead_id": lead_id, "history": enriched, "total": len(enriched)}


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
