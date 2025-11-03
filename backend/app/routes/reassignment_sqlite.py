from fastapi import APIRouter, Depends, HTTPException, Query, status, Path, Body
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
import math
import logging
import json

from app.database.LeadsSQLite import LeadsSQLiteDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Departments import DepartmentsDB
from app.utils.permissions import permission_manager
from app.utils.common_utils import convert_object_id
from app.database import get_database_instances

router = APIRouter(prefix="/reassignment", tags=["reassignment-sqlite"])
logger = logging.getLogger(__name__)

# Dependency to get DB instances
def get_leads_sqlite_db():
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

def get_all_subordinates(user_id: str, all_users: list, roles_db: RolesDB) -> set:
    """Get all subordinate user IDs for a given user based on role hierarchy (recursive)"""
    subordinates = set()
    
    # Debug: Log the user we're finding subordinates for
    logger.debug(f"🔍 Finding subordinates for user: {user_id}")
    
    # Get the current user's role
    current_user = next((user for user in all_users if str(user.get("_id")) == user_id), None)
    if not current_user or not current_user.get("role_id"):
        logger.debug(f"🔍 User {user_id} has no role_id")
        return subordinates
    
    current_user_role_id = str(current_user["role_id"])
    current_user_role = await roles_db.get_role(current_user_role_id)
    if not current_user_role:
        logger.debug(f"🔍 Role {current_user_role_id} not found")
        return subordinates
    
    logger.debug(f"🔍 User {user_id} has role: {current_user_role.get('name')} (ID: {current_user_role_id})")
    
    # Get all roles for building hierarchy
    all_roles = await roles_db.list_roles()
    
    # Create role hierarchy mapping: role_id -> [subordinate_role_ids]
    role_hierarchy = {}
    for role in all_roles:
        role_id = str(role.get("_id"))
        reporting_id = str(role.get("reporting_id")) if role.get("reporting_id") else None
        
        if reporting_id:
            if reporting_id not in role_hierarchy:
                role_hierarchy[reporting_id] = []
            role_hierarchy[reporting_id].append(role_id)
    
    # Find all subordinate roles recursively
    subordinate_roles = set()
    
    def find_subordinate_roles(role_id: str):
        if role_id in role_hierarchy:
            direct_subordinates = role_hierarchy[role_id]
            subordinate_roles.update(direct_subordinates)
            # Recursively find subordinates of subordinates
            for sub_role in direct_subordinates:
                find_subordinate_roles(sub_role)
    
    find_subordinate_roles(current_user_role_id)
    logger.debug(f"🔍 All subordinate roles: {subordinate_roles}")
    
    # Find users with subordinate roles
    for user in all_users:
        user_role_id = str(user.get("role_id")) if user.get("role_id") else None
        if user_role_id and user_role_id in subordinate_roles:
            user_id_str = str(user.get("_id"))
            subordinates.add(user_id_str)
            logger.debug(f"🔍 Found subordinate user: {user_id_str} with role: {user_role_id}")
    
    logger.debug(f"🔍 Final subordinates set for {user_id}: {subordinates}")
    return subordinates

@router.get("/list", response_model=Dict[str, Any])
async def list_reassignment_requests(
    user_id: str = Query(..., description="ID of the user making the request"),
    status_filter: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected"),
    page: int = Query(1, description="Page number"),
    page_size: int = Query(20, description="Items per page"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_sqlite_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """List reassignment requests with filtering and pagination (SQLite version)
    
    - Regular users: See only their own requests
    - Users with leads.assign permission or super admins: See all reassignment requests
    """
    # Check if user exists
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check for super admin or leads.assign permission
    can_approve = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    
    # Check if user is super admin (super admins see everything)
    is_super_admin = await permission_manager.is_admin(user_id, users_db, roles_db)
    
    # Debug logging for permission checks
    logger.debug(f"🔍 REASSIGNMENT DEBUG - User {user_id}: can_approve={can_approve}, is_super_admin={is_super_admin}")
    
    # Build filter query
    filter_dict = {}
    
    # If not admin and cannot approve, only show their own requests
    if not can_approve:
        filter_dict["reassignment_requested_by"] = user_id
        logger.debug(f"🔍 Regular user filter: only show requests by {user_id}")
    elif is_super_admin:
        # Super admins see all requests - no additional filter needed
        logger.debug(f"🔍 Super admin: showing ALL requests")
        pass
    else:
        # For managers with assign permission (but not super admin), 
        # show requests from their hierarchy only
        # Get all users to build reporting hierarchy
        all_users = await users_db.list_users()
        logger.debug(f"🔍 Found {len(all_users)} total users in database")
        
        # Get all subordinate user IDs (including nested subordinates)
        subordinates = get_all_subordinates(user_id, all_users, roles_db)
        subordinates.add(user_id)  # Include manager's own requests too
        
        # Convert to list for SQLite IN query
        subordinate_list = list(subordinates)
        
        # Debug logging
        logger.debug(f"🔍 Manager {user_id} hierarchy: {subordinate_list}")
        
        # Filter to show only requests from users in this manager's hierarchy
        filter_dict["reassignment_requested_by"] = {"$in": subordinate_list}
    
    # If a status filter is provided, add it to the query
    if status_filter and status_filter.lower() != "all":
        if status_filter.lower() == "pending":
            filter_dict["pending_reassignment"] = True
        else:
            # For approved/rejected, we need to check if reassignment_status exists
            filter_dict["pending_reassignment"] = False
            filter_dict["reassignment_status"] = status_filter.lower()
    else:
        # Include any lead that has been involved in reassignment
        filter_dict["$or"] = [
            {"pending_reassignment": True},
            {"reassignment_requested_by": {"$exists": True}}
        ]
    
    # Calculate pagination
    skip = (page - 1) * page_size
    
    # Debug: Log the final filter being used
    logger.debug(f"🔍 Final filter: {filter_dict}")
    
    # Get leads with reassignment requests using SQLite database
    leads = await leads_db.list_leads_with_reassignment_filter(
        filter_dict=filter_dict,
        skip=skip,
        limit=page_size,
        sort_by="reassignment_requested_at",
        sort_order=-1
    )
    
    # Debug: Log results
    logger.debug(f"🔍 Query returned {len(leads)} leads after filtering")
    
    # Get total count
    total_leads = await leads_db.count_leads_with_reassignment_filter(filter_dict)
    
    # Enhance leads with user information
    enhanced_leads = []
    for lead in leads:
        lead_dict = dict(lead)  # Convert SQLite Row to dict
        
        # Add requestor info
        if lead.get("reassignment_requested_by"):
            requestor = await users_db.get_user(lead["reassignment_requested_by"])
            if requestor:
                lead_dict["requestor_name"] = f"{requestor.get('first_name', '')} {requestor.get('last_name', '')}"
                lead_dict["requestor"] = {
                    "id": str(requestor.get("_id", "")),
                    "name": f"{requestor.get('first_name', '')} {requestor.get('last_name', '')}",
                    "email": requestor.get("email", "")
                }
        
        # Add target user info if specified
        if lead.get("reassignment_target_user"):
            target_user = await users_db.get_user(lead["reassignment_target_user"])
            if target_user:
                lead_dict["target_user_name"] = f"{target_user.get('first_name', '')} {target_user.get('last_name', '')}"
                lead_dict["target_user"] = {
                    "id": str(target_user.get("_id", "")),
                    "name": f"{target_user.get('first_name', '')} {target_user.get('last_name', '')}",
                    "email": target_user.get("email", "")
                }
        
        # Add current assignee info
        if lead.get("assigned_to"):
            assigned_user = await users_db.get_user(lead["assigned_to"])
            if assigned_user:
                lead_dict["assigned_user_name"] = f"{assigned_user.get('first_name', '')} {assigned_user.get('last_name', '')}"
                lead_dict["current_assignee"] = {
                    "id": str(assigned_user.get("_id", "")),
                    "name": f"{assigned_user.get('first_name', '')} {assigned_user.get('last_name', '')}",
                    "email": assigned_user.get("email", "")
                }
        
        # Format dates (SQLite stores as ISO strings)
        date_fields = [
            "reassignment_requested_at", "reassignment_approved_at", 
            "reassignment_rejected_at", "created_at", "updated_at"
        ]
        for field in date_fields:
            if lead.get(field) and isinstance(lead[field], str):
                try:
                    # Ensure proper ISO format
                    dt = datetime.fromisoformat(lead[field].replace('Z', '+00:00'))
                    lead_dict[field] = dt.isoformat()
                except:
                    lead_dict[field] = lead[field]
        
        # Determine status for consistent response format
        if lead.get("pending_reassignment"):
            lead_dict["status"] = "pending"
        elif lead.get("reassignment_status") == "approved":
            lead_dict["status"] = "approved"
        elif lead.get("reassignment_status") == "rejected":
            lead_dict["status"] = "rejected"
        else:
            lead_dict["status"] = "unknown"
        
        # Add reassignment change requests
        if lead.get("reassignment_new_data_code") is not None:
            lead_dict["reassignment_new_data_code"] = lead["reassignment_new_data_code"]
        
        if lead.get("reassignment_new_campaign_name") is not None:
            lead_dict["reassignment_new_campaign_name"] = lead["reassignment_new_campaign_name"]
        
        enhanced_leads.append(lead_dict)
    
    # Calculate total pages
    total_pages = math.ceil(total_leads / page_size) if total_leads > 0 else 1
    
    return {
        "requests": enhanced_leads,
        "pagination": {
            "total": total_leads,
            "page": page,
            "page_size": page_size,
            "pages": total_pages
        }
    }

@router.post("/request", response_model=Dict[str, Any])
async def create_reassignment_request(
    lead_id: str = Query(..., description="ID of the lead to reassign"),
    target_user_id: str = Query(..., description="ID of the user to reassign to"),
    reason: str = Query(..., description="Reason for reassignment"),
    user_id: str = Query(..., description="ID of the user making the request"),
    data_code: Optional[str] = Query(None, description="New data code for the lead"),
    campaign_name: Optional[str] = Query(None, description="New campaign name for the lead"),
    # Enhanced parameters for direct reassignment
    reassignment_status: Optional[str] = Query(None, description="Set reassignment status (approved for direct)"),
    log_activity: Optional[bool] = Query(False, description="Whether to log activity"),
    activity_type: Optional[str] = Query(None, description="Type of activity to log"),
    activity_description: Optional[str] = Query(None, description="Activity description"),
    update_lead_fields: Optional[bool] = Query(False, description="Whether to update lead fields"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_sqlite_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a reassignment request or directly assign lead (SQLite version)"""
    
    # Validate that the lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Validate users exist
    requesting_user = await users_db.get_user(user_id)
    target_user = await users_db.get_user(target_user_id)
    
    if not requesting_user:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Requesting user not found"
        )
    
    if not target_user:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )
    
    # Check if lead can be reassigned
    eligibility = await leads_db.check_reassignment_eligibility(lead_id)
    if not eligibility.get("can_reassign"):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Lead cannot be reassigned: {eligibility.get('reason')}"
        )
    
    # Check if user has permission to make reassignment requests
    user_permissions = await permission_manager.get_user_permissions(user_id, users_db, roles_db)
    can_request_reassignment = await permission_manager.has_permission(user_permissions, "leads.reassign_request")
    can_approve_reassignment = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    
    # If reassignment_status is 'approved', this is a direct reassignment (requires approval permission)
    if reassignment_status == "approved":
        if not can_approve_reassignment:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="User does not have permission to directly approve reassignments"
            )
        
        # Direct reassignment - update lead immediately
        update_data = {
            "pending_reassignment": False,
            "reassignment_status": "approved",
            "reassignment_approved_by": user_id,
            "reassignment_approved_by_name": f"{requesting_user.get('first_name', '')} {requesting_user.get('last_name', '')}",
            "reassignment_approved_at": datetime.now().isoformat(),
            "assigned_to": target_user_id,
            "reassignment_reason": reason
        }
        
        # Update data_code and campaign_name if provided
        if data_code is not None:
            update_data["data_code"] = data_code
        if campaign_name is not None:
            update_data["campaign_name"] = campaign_name
        
        success = await leads_db.update_lead_reassignment_status(lead_id, update_data)
        
        if success:
            return {
                "success": True,
                "message": "Lead reassigned successfully",
                "type": "direct_reassignment",
                "assigned_to": target_user_id,
                "assigned_to_name": f"{target_user.get('first_name', '')} {target_user.get('last_name', '')}"
            }
        else:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reassign lead"
            )
    
    else:
        # Standard reassignment request (requires request permission)
        if not can_request_reassignment:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="User does not have permission to request reassignments"
            )
        
        # Create reassignment request
        reassignment_data = {
            "requested_by": user_id,
            "requested_by_name": f"{requesting_user.get('first_name', '')} {requesting_user.get('last_name', '')}",
            "target_user_id": target_user_id,
            "target_user_name": f"{target_user.get('first_name', '')} {target_user.get('last_name', '')}",
            "reason": reason,
            "new_data_code": data_code,
            "new_campaign_name": campaign_name,
            "metadata": {
                "log_activity": log_activity,
                "activity_type": activity_type,
                "activity_description": activity_description,
                "update_lead_fields": update_lead_fields
            }
        }
        
        success = await leads_db.create_reassignment_request(lead_id, reassignment_data)
        
        if success:
            return {
                "success": True,
                "message": "Reassignment request created successfully",
                "type": "request",
                "status": "pending",
                "target_user": f"{target_user.get('first_name', '')} {target_user.get('last_name', '')}"
            }
        else:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create reassignment request"
            )

@router.post("/approve/{lead_id}", response_model=Dict[str, Any])
async def approve_reassignment_request(
    lead_id: str = Path(..., description="ID of the lead"),
    approval_data: Dict[str, Any] = Body(..., description="Approval data"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_sqlite_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Approve a pending reassignment request (SQLite version)"""
    
    user_id = approval_data.get("approved_by")
    if not user_id:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="approved_by field is required"
        )
    
    # Check if user has permission to approve reassignments
    can_approve = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    if not can_approve:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User does not have permission to approve reassignments"
        )
    
    # Get approving user info
    approving_user = await users_db.get_user(user_id)
    if not approving_user:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Approving user not found"
        )
    
    # Add user name to approval data
    approval_data["approved_by_name"] = f"{approving_user.get('first_name', '')} {approving_user.get('last_name', '')}"
    
    # Approve the reassignment
    success = await leads_db.approve_reassignment_request(lead_id, approval_data)
    
    if success:
        return {
            "success": True,
            "message": "Reassignment request approved successfully",
            "approved_by": approval_data["approved_by_name"],
            "approved_at": datetime.now().isoformat()
        }
    else:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve reassignment request"
        )

@router.post("/reject/{lead_id}", response_model=Dict[str, Any])
async def reject_reassignment_request(
    lead_id: str = Path(..., description="ID of the lead"),
    rejection_data: Dict[str, Any] = Body(..., description="Rejection data"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_sqlite_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Reject a pending reassignment request (SQLite version)"""
    
    user_id = rejection_data.get("rejected_by")
    if not user_id:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="rejected_by field is required"
        )
    
    # Check if user has permission to reject reassignments
    can_approve = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    if not can_approve:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User does not have permission to reject reassignments"
        )
    
    # Get rejecting user info
    rejecting_user = await users_db.get_user(user_id)
    if not rejecting_user:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Rejecting user not found"
        )
    
    # Add user name to rejection data
    rejection_data["rejected_by_name"] = f"{rejecting_user.get('first_name', '')} {rejecting_user.get('last_name', '')}"
    
    # Reject the reassignment
    success = await leads_db.reject_reassignment_request(lead_id, rejection_data)
    
    if success:
        return {
            "success": True,
            "message": "Reassignment request rejected successfully",
            "rejected_by": rejection_data["rejected_by_name"],
            "rejected_at": datetime.now().isoformat(),
            "reason": rejection_data.get("reason", "No reason provided")
        }
    else:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reject reassignment request"
        )

@router.get("/eligibility/{lead_id}", response_model=Dict[str, Any])
async def check_reassignment_eligibility(
    lead_id: str = Path(..., description="ID of the lead"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_sqlite_db)
):
    """Check if a lead is eligible for reassignment (SQLite version)"""
    
    eligibility = await leads_db.check_reassignment_eligibility(lead_id)
    return eligibility

@router.get("/history/{lead_id}", response_model=Dict[str, Any])
async def get_reassignment_history(
    lead_id: str = Path(..., description="ID of the lead"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_sqlite_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Get reassignment history for a lead (SQLite version)"""
    
    # Get reassignment requests
    history = await leads_db.get_reassignment_history(lead_id)
    
    # Get field change history
    field_history = await leads_db.get_field_history(lead_id)
    
    # Enhance with user information
    enhanced_history = []
    for record in history:
        record_dict = dict(record)
        
        # Add requestor info
        if record.get("requested_by"):
            requestor = await users_db.get_user(record["requested_by"])
            if requestor:
                record_dict["requestor_name"] = f"{requestor.get('first_name', '')} {requestor.get('last_name', '')}"
        
        # Add processor info if processed
        if record.get("processed_by"):
            processor = await users_db.get_user(record["processed_by"])
            if processor:
                record_dict["processor_name"] = f"{processor.get('first_name', '')} {processor.get('last_name', '')}"
        
        enhanced_history.append(record_dict)
    
    return {
        "reassignment_requests": enhanced_history,
        "field_changes": [dict(change) for change in field_history],
        "total_requests": len(enhanced_history),
        "total_field_changes": len(field_history)
    }

@router.get("/stats", response_model=Dict[str, Any])
async def get_reassignment_stats(
    user_id: str = Query(..., description="ID of the user requesting stats"),
    leads_db: LeadsSQLiteDB = Depends(get_leads_sqlite_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get reassignment statistics (SQLite version)"""
    
    # Check permissions
    can_approve = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    is_super_admin = await permission_manager.is_admin(user_id, users_db, roles_db)
    
    stats = {}
    
    if can_approve or is_super_admin:
        # Get comprehensive stats for admins/managers
        stats["pending_requests"] = leads_db.count_leads_with_reassignment_filter({"pending_reassignment": True})
        stats["approved_requests"] = leads_db.count_leads_with_reassignment_filter({"reassignment_status": "approved"})
        stats["rejected_requests"] = leads_db.count_leads_with_reassignment_filter({"reassignment_status": "rejected"})
    else:
        # Get user-specific stats
        stats["my_pending_requests"] = leads_db.count_leads_with_reassignment_filter({
            "pending_reassignment": True, 
            "reassignment_requested_by": user_id
        })
        stats["my_approved_requests"] = leads_db.count_leads_with_reassignment_filter({
            "reassignment_status": "approved", 
            "reassignment_requested_by": user_id
        })
        stats["my_rejected_requests"] = leads_db.count_leads_with_reassignment_filter({
            "reassignment_status": "rejected", 
            "reassignment_requested_by": user_id
        })
    
    return stats
