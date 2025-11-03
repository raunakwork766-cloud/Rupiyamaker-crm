from fastapi import APIRouter, Depends, HTTPException, Query, status, Path, Body
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import DESCENDING
import math
import logging

from app.database import get_database_instances
from app.database.Leads import LeadsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Departments import DepartmentsDB
from app.database.Notifications import NotificationsDB
from app.utils.permissions import permission_manager
from app.utils.common_utils import convert_object_id
from app.schemas.lead_schemas import LeadInDB

router = APIRouter(prefix="/reassignment", tags=["reassignment"])

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

async def get_all_subordinates(user_id: str, all_users: list, roles_db: RolesDB) -> set:
    """Get all subordinate user IDs for a given user based on role hierarchy (recursive)"""
    subordinates = set()
    
    # Debug: Log the user we're finding subordinates for
    print(f"🔍 Finding subordinates for user: {user_id}")
    
    # Get the current user's role
    current_user = next((user for user in all_users if str(user.get("_id")) == user_id), None)
    if not current_user or not current_user.get("role_id"):
        print(f"🔍 User {user_id} has no role_id")
        return subordinates
    
    current_user_role_id = str(current_user["role_id"])
    current_user_role = await roles_db.get_role(current_user_role_id)
    if not current_user_role:
        print(f"🔍 Role {current_user_role_id} not found")
        return subordinates
    
    print(f"🔍 User {user_id} has role: {current_user_role.get('name')} (ID: {current_user_role_id})")
    
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
    
    print(f"🔍 Role hierarchy map: {dict(list(role_hierarchy.items())[:5])}")
    
    # Find all subordinate roles recursively
    subordinate_roles = set()
    
    def find_subordinate_roles(role_id: str):
        if role_id in role_hierarchy:
            direct_subordinates = role_hierarchy[role_id]
            print(f"🔍 Role {role_id} has direct subordinate roles: {direct_subordinates}")
            subordinate_roles.update(direct_subordinates)
            # Recursively find subordinates of subordinates
            for sub_role in direct_subordinates:
                find_subordinate_roles(sub_role)
    
    find_subordinate_roles(current_user_role_id)
    print(f"🔍 All subordinate roles: {subordinate_roles}")
    
    # Find users with subordinate roles
    for user in all_users:
        user_role_id = str(user.get("role_id")) if user.get("role_id") else None
        if user_role_id and user_role_id in subordinate_roles:
            user_id_str = str(user.get("_id"))
            subordinates.add(user_id_str)
            print(f"🔍 Found subordinate user: {user_id_str} with role: {user_role_id}")
    
    print(f"🔍 Final subordinates set for {user_id}: {subordinates}")
    return subordinates

@router.get("/list", response_model=Dict[str, Any])
async def list_reassignment_requests(
    user_id: str = Query(..., description="ID of the user making the request"),
    status_filter: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected"),
    page: int = Query(1, description="Page number"),
    page_size: int = Query(20, description="Items per page"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """List reassignment requests with filtering and pagination
    
    - Regular users: See only their own requests
    - Users with leads.assign permission or super admins: See all reassignment requests
    """
    # Check if user exists
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check for super admin or leads.assign permission
    can_approve = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    
    # Check if user is super admin (super admins see everything)
    is_super_admin = await permission_manager.is_admin(user_id, users_db, roles_db)
    
    # Debug logging for permission checks
    print(f"🔍 REASSIGNMENT DEBUG - User {user_id}: can_approve={can_approve}, is_super_admin={is_super_admin}")
    
    # Build filter query
    filter_dict = {}
    
    # If not admin and cannot approve, only show their own requests
    if not can_approve:
        filter_dict["reassignment_requested_by"] = user_id
        print(f"🔍 Regular user filter: only show requests by {user_id}")
    elif is_super_admin:
        # Super admins see all requests - no additional filter needed
        print(f"🔍 Super admin: showing ALL requests")
        pass
    else:
        # For managers with assign permission (but not super admin), 
        # show requests from their hierarchy only
        # Get all users to build reporting hierarchy
        all_users = await users_db.list_users()
        print(f"🔍 Found {len(all_users)} total users in database")
        
        # Get all subordinate user IDs (including nested subordinates)
        subordinates = await get_all_subordinates(user_id, all_users, roles_db)
        subordinates.add(user_id)  # Include manager's own requests too
        
        # Convert ObjectId to string for comparison
        subordinate_strings = [str(sub) for sub in subordinates]
        
        # Debug logging
        print(f"🔍 Manager {user_id} hierarchy: {subordinate_strings}")
        
        # Filter to show only requests from users in this manager's hierarchy
        filter_dict["reassignment_requested_by"] = {"$in": subordinate_strings}
    
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
    print(f"🔍 Final MongoDB filter: {filter_dict}")
    
    # Debug: Check how many reassignment requests exist in total
    all_reassignment_requests = await leads_db.list_leads(
        filter_dict={"$or": [
            {"pending_reassignment": True},
            {"reassignment_requested_by": {"$exists": True}}
        ]},
        limit=1000  # Get a reasonable sample
    )
    print(f"🔍 Total reassignment requests in DB: {len(all_reassignment_requests)}")
    if all_reassignment_requests:
        sample_requestors = [r.get("reassignment_requested_by") for r in all_reassignment_requests[:5]]
        print(f"🔍 Sample request requestors: {sample_requestors}")
    
    # Get leads with reassignment requests
    leads = await leads_db.list_leads(
        filter_dict=filter_dict,
        skip=skip,
        limit=page_size,
        sort_by="reassignment_requested_at",
        sort_order=-1
    )
    
    # Debug: Log results
    print(f"🔍 Query returned {len(leads)} leads after filtering")
    
    # Get total count
    total_leads = await leads_db.count_leads(filter_dict)
    
    # Enhance leads with user information
    enhanced_leads = []
    for lead in leads:
        lead_dict = convert_object_id(lead)
        
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
        if lead.get("status"):
            lead_dict["lead_status"] = lead["status"]
            
        # Format dates
        if lead.get("reassignment_requested_at"):
            lead_dict["reassignment_requested_at"] = lead["reassignment_requested_at"].isoformat()
        
        if lead.get("reassignment_approved_at"):
            lead_dict["reassignment_approved_at"] = lead["reassignment_approved_at"].isoformat()
        
        if lead.get("reassignment_rejected_at"):
            lead_dict["reassignment_rejected_at"] = lead["reassignment_rejected_at"].isoformat()
        
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
    file_sent_to_login: Optional[bool] = Query(None, description="File sent to login status"),
    main_status: Optional[str] = Query(None, description="Main status of the lead"),
    age_days: Optional[int] = Query(None, description="Age in days"),
    approved_at: Optional[str] = Query(None, description="Approval timestamp"),
    approved_by: Optional[str] = Query(None, description="User who approved"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Create a new reassignment request for a lead or process direct reassignment"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check if the target user exists
    target_user = await users_db.get_user(target_user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )
    
    # Check if this is a direct reassignment (approved status)
    is_direct_reassignment = reassignment_status == "approved"
    
    if not is_direct_reassignment:
        # Check if lead is already pending reassignment for non-direct requests
        if lead.get("pending_reassignment"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Lead already has a pending reassignment request"
            )
    
    # Check reassignment eligibility based on status/sub-status settings
    eligibility = await leads_db.check_reassignment_eligibility(lead_id)
    
    # Check if user has admin/manager permission
    can_override = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    
    # If reassignment requires manager permission but user is not a manager
    if eligibility.get("is_manager_permission_required") and not can_override:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This lead requires manager approval for reassignment"
        )
    
    # If lead is not eligible for reassignment and user doesn't have override permission
    if not eligibility.get("can_reassign") and not can_override:
        # Return specific error details
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=eligibility.get("reason", "This lead is not eligible for reassignment yet")
        )
    
    # Validation logic for self-reassignment prevention
    # Check if user is trying to reassign their own lead to themselves
    if str(lead.get("created_by")) == user_id and target_user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can't reassign your own lead to yourself"
        )
    
    # Check if user is already in assign_report_to (TL of this lead)
    assign_report_to = lead.get("assign_report_to")
    if assign_report_to:
        if isinstance(assign_report_to, list):
            if target_user_id in [str(user_id) for user_id in assign_report_to]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You're already TL of this lead"
                )
        else:
            if str(assign_report_to) == target_user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You're already TL of this lead"
                )
    
    # Check if user is already assigned to this lead
    assigned_to = lead.get("assigned_to")
    if assigned_to:
        if isinstance(assigned_to, list):
            if target_user_id in [str(user_id) for user_id in assigned_to]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You're already assigned to this lead"
                )
        else:
            if str(assigned_to) == target_user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You're already assigned to this lead"
                )
    
    # Create reassignment request or direct reassignment
    if is_direct_reassignment:
        # Process direct reassignment (immediate approval)
        update_data = {
            "assigned_to": user_id,  # Assign to requesting user, not target user
            "pending_reassignment": False,
            "reassignment_status": "approved",
            "reassignment_approved_by": user_id,
            "reassignment_approved_at": datetime.now(),
            "reassignment_requested_by": user_id,
            "reassignment_target_user": target_user_id,
            "reassignment_reason": reason,
            "reassignment_requested_at": datetime.now(),
            # Record eligibility info for auditing purposes
            "reassignment_eligibility": eligibility,
            # Update ownership to requesting user
            "created_by": user_id,
            "created_at": datetime.now(),
            # Set status directly without lookup
            "status": "ACTIVE LEADS",
            "sub_status": "NEW LEAD"
        }
        
        # Get requesting user's name for created_by_name
        logging.info(f"🔍 Looking up user {user_id} for created_by_name (type: {type(user_id)})")
        requesting_user = await users_db.get_user(user_id)
        logging.info(f"🔍 User lookup result: {requesting_user is not None}")
        
        # If primary lookup failed, try alternative lookups
        if not requesting_user:
            logging.info(f"🔍 Primary lookup failed, trying alternative methods...")
            # Try looking up by employee_id if user_id might be employee_id
            try:
                requesting_user = await users_db.get_user_by_employee_id(str(user_id))
                if requesting_user:
                    logging.info(f"🔍 Found user by employee_id: {user_id}")
            except:
                pass
                
            # Try looking up by username if user_id might be username
            if not requesting_user:
                try:
                    requesting_user = await users_db.get_user_by_username(str(user_id))
                    if requesting_user:
                        logging.info(f"🔍 Found user by username: {user_id}")
                except:
                    pass
            
            # Final fallback: direct database query
            if not requesting_user:
                try:
                    from app.database import db
                    users_collection = db["users"]
                    # Try to find by string ID match in any relevant field
                    requesting_user = await users_collection.find_one({
                        "$or": [
                            {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else None},
                            {"employee_id": str(user_id)},
                            {"username": str(user_id)},
                            {"email": str(user_id)}
                        ]
                    })
                    if requesting_user:
                        logging.info(f"🔍 Found user by direct database query: {user_id}")
                except Exception as e:
                    logging.error(f"🔍 Direct database query failed: {e}")
                    pass
        
        if requesting_user:
            logging.info(f"🔍 User data keys: {list(requesting_user.keys())}")
            first_name = requesting_user.get("first_name", "")
            last_name = requesting_user.get("last_name", "")
            full_name = f"{first_name} {last_name}".strip()
            logging.info(f"🔍 Found user: first_name='{first_name}', last_name='{last_name}', full_name='{full_name}'")
            update_data["created_by_name"] = full_name if full_name else "Unknown User"
            
            # Get department information
            user_department_id = requesting_user.get("department_id")
            if user_department_id:
                update_data["department_id"] = user_department_id
                # Get department name
                department = await departments_db.get_department(user_department_id)
                if department:
                    update_data["department_name"] = department.get("name", "Unknown Department")
                else:
                    update_data["department_name"] = "Unknown Department"
                logging.info(f"🔄 Setting department: {update_data['department_name']} (ID: {user_department_id})")
            else:
                update_data["department_id"] = None
                update_data["department_name"] = "No Department"
                logging.info(f"🔄 User has no department assigned")
        else:
            logging.warning(f"⚠️ User {user_id} not found in database by any method!")
            update_data["created_by_name"] = "Unknown User"
            update_data["department_id"] = None
            update_data["department_name"] = "Unknown Department"
            
        logging.info(f"🔄 Setting lead ownership to user: {user_id} ({update_data['created_by_name']})")
        logging.info(f"🔄 Setting assigned_to to requesting user: {user_id}")
        logging.info(f"🔄 Setting status to: {update_data['status']}")
        logging.info(f"🔄 Setting sub_status to: {update_data['sub_status']}")
        logging.info(f"🔄 Updating created_at to: {update_data['created_at']}")
        
        # Add additional fields if provided
        if file_sent_to_login is not None:
            update_data["file_sent_to_login"] = file_sent_to_login
        if main_status is not None:
            update_data["main_status"] = main_status
        if age_days is not None:
            update_data["age_days"] = age_days
        
        # Apply data_code and campaign_name changes if provided
        if data_code is not None:
            update_data["data_code"] = data_code
            update_data["dataCode"] = data_code  # Support both naming conventions
            logging.info(f"🔄 Setting new data_code: {data_code}")
        
        if campaign_name is not None:
            update_data["campaign_name"] = campaign_name
            update_data["campaignName"] = campaign_name  # Support both naming conventions
            logging.info(f"🔄 Setting new campaign_name: {campaign_name}")
        
        # Update lead with direct reassignment
        success = await leads_db.update_lead_reassignment_status(lead_id, update_data)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process direct reassignment"
            )
        
        # Log activity if requested
        if log_activity and activity_type:
            try:
                activity_data = {
                    "lead_id": ObjectId(lead_id),
                    "created_at": datetime.now(),
                    "created_by": user_id,
                    "type": "reassignment",
                    "action": "approved_direct",
                    "activity_type": activity_type,
                    "activity_description": activity_description or f"Lead directly reassigned to {target_user_id}",
                    "details": {
                        "target_user": target_user_id,
                        "reason": reason,
                        "data_code_changed": data_code if data_code else None,
                        "campaign_name_changed": campaign_name if campaign_name else None,
                        "reassignment_status": "approved",
                        "timestamp": datetime.now().isoformat()
                    }
                }
                await leads_db.activity_collection.insert_one(activity_data)
                logging.info(f"✓ Activity logged for direct reassignment: {lead_id}")
            except Exception as e:
                logging.error(f"✗ Failed to log activity: {str(e)}")
        
        return {
            "message": "Direct reassignment completed successfully",
            "lead_id": lead_id,
            "status": "approved",
            "assigned_to": target_user_id
        }
    
    else:
        # Create standard reassignment request
        update_data = {
            "pending_reassignment": True,
            "reassignment_requested_by": user_id,
            "reassignment_target_user": target_user_id,
            "reassignment_reason": reason,
            "reassignment_requested_at": datetime.now()
        }
        
        # Add data_code and campaign_name changes if provided
        if data_code is not None:
            update_data["reassignment_new_data_code"] = data_code
        
        if campaign_name is not None:
            update_data["reassignment_new_campaign_name"] = campaign_name
        
        # Update lead with reassignment request
        success = await leads_db.update_lead_reassignment_status(lead_id, update_data)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create reassignment request"
            )
        
        return {
            "message": "Reassignment request created successfully",
            "lead_id": lead_id,
            "status": "pending"
        }

@router.post("/approve/{lead_id}", response_model=Dict[str, Any])
async def approve_reassignment(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user approving the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Approve a reassignment request
    
    Only users with leads.assign permission or super admins can approve requests
    """
    # Check if user has permission to approve
    can_approve = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    if not can_approve:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to approve reassignment requests"
        )
    
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check if lead has a pending reassignment
    if not lead.get("pending_reassignment"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lead doesn't have a pending reassignment request"
        )
    
    # Get requesting user from reassignment request
    requesting_user_id = lead.get("reassignment_requested_by")
    
    # Get reassignment eligibility info for auditing purposes
    reassignment_eligibility = await leads_db.check_reassignment_eligibility(lead_id)
    
    # Update lead with new assignment and clear reassignment request
    update_data = {
        "assigned_to": requesting_user_id,  # Assign to requesting user, not target user
        "pending_reassignment": False,
        "reassignment_status": "approved",
        "reassignment_approved_by": user_id,
        "reassignment_approved_at": datetime.now(),
        # Record eligibility info for auditing purposes
        "reassignment_eligibility": reassignment_eligibility,
        # Update ownership to requesting user (from the original request)
        "created_by": requesting_user_id,
        "created_at": datetime.now(),
        # Set status directly without lookup
        "status": "ACTIVE LEADS",
        "sub_status": "NEW LEAD"
    }
    
    # Get requesting user's name for created_by_name
    logging.info(f"🔍 Looking up requesting user {requesting_user_id} for created_by_name (type: {type(requesting_user_id)})")
    requesting_user = await users_db.get_user(requesting_user_id)
    logging.info(f"🔍 User lookup result: {requesting_user is not None}")
    
    # If primary lookup failed, try alternative lookups
    if not requesting_user:
        logging.info(f"🔍 Primary lookup failed, trying alternative methods...")
        # Try looking up by employee_id if user_id might be employee_id
        try:
            requesting_user = await users_db.get_user_by_employee_id(str(requesting_user_id))
            if requesting_user:
                logging.info(f"🔍 Found user by employee_id: {requesting_user_id}")
        except:
            pass
            
        # Try looking up by username if user_id might be username
        if not requesting_user:
            try:
                requesting_user = await users_db.get_user_by_username(str(requesting_user_id))
                if requesting_user:
                    logging.info(f"🔍 Found user by username: {requesting_user_id}")
            except:
                pass
        
        # Final fallback: direct database query
        if not requesting_user:
            try:
                from app.database import db
                users_collection = db["users"]
                # Try to find by string ID match in any relevant field
                requesting_user = await users_collection.find_one({
                    "$or": [
                        {"_id": ObjectId(requesting_user_id) if ObjectId.is_valid(requesting_user_id) else None},
                        {"employee_id": str(requesting_user_id)},
                        {"username": str(requesting_user_id)},
                        {"email": str(requesting_user_id)}
                    ]
                })
                if requesting_user:
                    logging.info(f"🔍 Found user by direct database query: {requesting_user_id}")
            except Exception as e:
                logging.error(f"🔍 Direct database query failed: {e}")
                pass
    
    if requesting_user:
        logging.info(f"🔍 User data keys: {list(requesting_user.keys())}")
        first_name = requesting_user.get("first_name", "")
        last_name = requesting_user.get("last_name", "")
        full_name = f"{first_name} {last_name}".strip()
        logging.info(f"🔍 Found user: first_name='{first_name}', last_name='{last_name}', full_name='{full_name}'")
        update_data["created_by_name"] = full_name if full_name else "Unknown User"
        
        # Get department information
        user_department_id = requesting_user.get("department_id")
        if user_department_id:
            update_data["department_id"] = user_department_id
            # Get department name
            department = await departments_db.get_department(user_department_id)
            if department:
                update_data["department_name"] = department.get("name", "Unknown Department")
            else:
                update_data["department_name"] = "Unknown Department"
            logging.info(f"🔄 Setting department: {update_data['department_name']} (ID: {user_department_id})")
        else:
            update_data["department_id"] = None
            update_data["department_name"] = "No Department"
            logging.info(f"🔄 User has no department assigned")
    else:
        logging.warning(f"⚠️ Requesting user {requesting_user_id} not found in database by any method!")
        update_data["created_by_name"] = "Unknown User"
        update_data["department_id"] = None
        update_data["department_name"] = "Unknown Department"
        
    logging.info(f"🔄 Setting lead ownership to user: {requesting_user_id} ({update_data['created_by_name']})")
    logging.info(f"🔄 Setting assigned_to to requesting user: {requesting_user_id}")
    logging.info(f"🔄 Setting status to: {update_data['status']}")
    logging.info(f"🔄 Setting sub_status to: {update_data['sub_status']}")
    logging.info(f"🔄 Updating created_at to: {update_data['created_at']}")
    
    # Apply data_code and campaign_name changes if they were requested
    if lead.get("reassignment_new_data_code") is not None:
        update_data["data_code"] = lead["reassignment_new_data_code"]
        logging.info(f"🔄 Applying new data_code: {lead['reassignment_new_data_code']}")
    
    if lead.get("reassignment_new_campaign_name") is not None:
        update_data["campaign_name"] = lead["reassignment_new_campaign_name"]
        logging.info(f"🔄 Applying new campaign_name: {lead['reassignment_new_campaign_name']}")
    
    # Update lead with approved reassignment
    success = await leads_db.update_lead_reassignment_status(lead_id, update_data)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve reassignment request"
        )
    
    # Send notification to the employee who requested the reassignment
    try:
        # Get approver user details for notification
        approver_user = await users_db.get_user(user_id)
        approver_name = "Manager"
        if approver_user:
            approver_name = approver_user.get("name") or approver_user.get("username") or "Manager"
        
        # Create notification for the requesting employee
        notification_data = {
            "user_id": requesting_user_id,
            "type": "reassignment",
            "title": "Lead Reassignment Approved",
            "message": f"Your lead reassignment request has been approved by {approver_name}",
            "link": f"/leads/{lead_id}",
            "reference_id": lead_id,
            "created_by": user_id,
            "created_by_name": approver_name
        }
        
        await notifications_db.create_notification(notification_data)
        logging.info(f"✅ Notification sent to user {requesting_user_id} for approved reassignment of lead {lead_id}")
        
    except Exception as e:
        # Don't fail the approval if notification fails
        logging.error(f"❌ Failed to send notification for approved reassignment: {e}")
    
    return {
        "message": "Reassignment request approved successfully",
        "lead_id": lead_id,
        "status": "approved"
    }

@router.get("/check-eligibility/{lead_id}", response_model=Dict[str, Any])
async def check_reassignment_eligibility(
    lead_id: str,
    user_id: str = Query(..., description="ID of the user checking eligibility"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Check if a lead is eligible for reassignment based on status settings"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check if user has admin/manager permission
    can_override = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    
    # Get eligibility status
    eligibility = await leads_db.check_reassignment_eligibility(lead_id)
    
    # Add override permission to the response
    result = {
        **eligibility,
        "can_override": can_override,
        "status": lead.get("status"),
        "sub_status": lead.get("sub_status"),
    }
    
    # If user has override permission, they can always reassign
    if can_override:
        result["can_reassign"] = True
        if not eligibility.get("can_reassign"):
            result["override_reason"] = "User has manager/admin permission to override restrictions"
    
    return result

@router.post("/reject/{lead_id}", response_model=Dict[str, Any])
async def reject_reassignment(
    lead_id: str,
    rejection_reason: str = Body(..., embed=True),
    user_id: str = Query(..., description="ID of the user rejecting the request"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Reject a reassignment request
    
    Only users with leads.assign permission or super admins can reject requests
    """
    # Check if user has permission to reject
    can_approve = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    if not can_approve:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to reject reassignment requests"
        )
    
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check if lead has a pending reassignment
    if not lead.get("pending_reassignment"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lead doesn't have a pending reassignment request"
        )
    
    # Get requesting user from reassignment request
    requesting_user_id = lead.get("reassignment_requested_by")
    
    # Update lead to reject reassignment request
    update_data = {
        "pending_reassignment": False,
        "reassignment_status": "rejected",
        "reassignment_rejected_by": user_id,
        "reassignment_rejected_at": datetime.now(),
        "reassignment_rejection_reason": rejection_reason
    }
    
    # Update lead with rejected reassignment
    success = await leads_db.update_lead_reassignment_status(lead_id, update_data)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reject reassignment request"
        )
    
    # Send notification to the employee who requested the reassignment
    try:
        # Get rejector user details for notification
        rejector_user = await users_db.get_user(user_id)
        rejector_name = "Manager"
        if rejector_user:
            rejector_name = rejector_user.get("name") or rejector_user.get("username") or "Manager"
        
        # Create notification for the requesting employee
        notification_data = {
            "user_id": requesting_user_id,
            "type": "reassignment",
            "title": "Lead Reassignment Rejected",
            "message": f"Your lead reassignment request has been rejected by {rejector_name}. Reason: {rejection_reason}",
            "link": f"/leads/{lead_id}",
            "reference_id": lead_id,
            "created_by": user_id,
            "created_by_name": rejector_name
        }
        
        await notifications_db.create_notification(notification_data)
        logging.info(f"✅ Notification sent to user {requesting_user_id} for rejected reassignment of lead {lead_id}")
        
    except Exception as e:
        # Don't fail the rejection if notification fails
        logging.error(f"❌ Failed to send notification for rejected reassignment: {e}")
    
    return {
        "message": "Reassignment request rejected successfully",
        "lead_id": lead_id,
        "status": "rejected"
    }

@router.patch("/leads/{lead_id}/update-fields", response_model=Dict[str, Any])
async def update_lead_fields(
    lead_id: str,
    updates: Dict[str, Any] = Body(..., description="Fields to update"),
    user_id: str = Query(..., description="ID of the user making the update"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Update specific fields in a lead record"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check if user exists
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # Convert lead_id to ObjectId for database operations
        lead_object_id = ObjectId(lead_id)
        
        # Prepare update data with both naming conventions
        update_data = {}
        updated_fields = []
        
        for field, value in updates.items():
            if field in ["data_code", "dataCode"]:
                update_data["data_code"] = value
                update_data["dataCode"] = value  # Support both naming conventions
                updated_fields.append("data_code")
            elif field in ["campaign_name", "campaignName"]:
                update_data["campaign_name"] = value
                update_data["campaignName"] = value  # Support both naming conventions
                updated_fields.append("campaign_name")
            else:
                update_data[field] = value
                updated_fields.append(field)
        
        # Add update metadata
        update_data["updated_at"] = datetime.now()
        update_data["updated_by"] = user_id
        
        # Update the lead in database
        result = await leads_db.collection.update_one(
            {"_id": lead_object_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update lead fields"
            )
        
        # Log field update activity
        activity_data = {
            "lead_id": lead_object_id,
            "created_at": datetime.now(),
            "created_by": user_id,
            "type": "field_update",
            "action": "updated",
            "activity_type": "lead_field_update",
            "activity_description": f"Lead fields updated: {', '.join(updated_fields)}",
            "details": {
                "fields_updated": updated_fields,
                "updates": updates,
                "timestamp": datetime.now().isoformat()
            }
        }
        await leads_db.activity_collection.insert_one(activity_data)
        
        return {
            "success": True,
            "message": "Lead fields updated successfully",
            "updated_fields": updated_fields,
            "lead_id": lead_id
        }
        
    except Exception as e:
        logging.error(f"Error updating lead fields: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update lead fields: {str(e)}"
        )

@router.post("/leads/{lead_id}/activity", response_model=Dict[str, Any])
async def add_lead_activity(
    lead_id: str,
    activity_data: Dict[str, Any] = Body(..., description="Activity data to log"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Add an activity record to a lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Extract user_id from activity data
    user_id = activity_data.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id is required in activity data"
        )
    
    # Check if user exists
    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # Convert lead_id to ObjectId
        lead_object_id = ObjectId(lead_id)
        
        # Prepare activity record
        activity_record = {
            "lead_id": lead_object_id,
            "created_at": datetime.now(),
            "created_by": user_id,
            "type": activity_data.get("activity_type", "general"),
            "action": "logged",
            "activity_type": activity_data.get("activity_type", "general"),
            "activity_title": activity_data.get("activity_title", "Activity"),
            "activity_description": activity_data.get("activity_description", ""),
            "details": activity_data.get("details", {}),
            "timestamp": datetime.now()
        }
        
        # Insert activity record
        result = await leads_db.activity_collection.insert_one(activity_record)
        
        if not result.inserted_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to log activity"
            )
        
        return {
            "success": True,
            "message": "Activity logged successfully",
            "activity_id": str(result.inserted_id),
            "lead_id": lead_id
        }
        
    except Exception as e:
        logging.error(f"Error logging activity: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to log activity: {str(e)}"
        )
