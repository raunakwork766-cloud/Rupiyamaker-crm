from fastapi import APIRouter, Depends, HTTPException, Query, status, Path, Body
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import DESCENDING
import math
import logging

logger = logging.getLogger(__name__)

from app.database import get_database_instances
from app.database.Leads import LeadsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Departments import DepartmentsDB
from app.database.Notifications import NotificationsDB
from app.database.Settings import SettingsDB
from app.utils.permissions import permission_manager
from app.utils.common_utils import convert_object_id
from app.schemas.lead_schemas import LeadInDB
from app.utils.timezone import get_ist_now

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

async def get_settings_db():
    db_instances = get_database_instances()
    return db_instances["settings"]

@router.get("/list", response_model=Dict[str, Any])
async def list_reassignment_requests(
    user_id: str = Query(..., description="ID of the user making the request"),
    status_filter: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected"),
    page: int = Query(1, description="Page number"),
    page_size: int = Query(20, description="Items per page"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    settings_db: SettingsDB = Depends(get_settings_db),
):
    # Read configurable cooldown period (used for auto-expire + returned to frontend)
    try:
        _cd_doc = await leads_db.db["reassignment_settings"].find_one({"type": "cooldown_period"})
        cooldown_hours = int(_cd_doc.get("hours", 24)) if _cd_doc else 24
    except Exception:
        cooldown_hours = 24

    # Auto-reject pending requests older than cooldown period
    try:
        expiry_cutoff = get_ist_now() - timedelta(hours=cooldown_hours)
        # Auto-reject expired pending requests
        expire_result = await leads_db.collection.update_many(
            {
                "pending_reassignment": True,
                "reassignment_status": "pending",
                "reassignment_requested_at": {"$lt": expiry_cutoff}
            },
            {"$set": {
                "pending_reassignment": False,
                "reassignment_status": "auto_rejected",
                "reassignment_rejection_reason": f"System Auto-Rejected: No action taken within {cooldown_hours} hours cooldown period",
                "reassignment_rejected_by": "system",
                "reassignment_rejected_at": get_ist_now(),
            }}
        )
        if expire_result.modified_count:
            logging.info(f"⏰ Auto-rejected {expire_result.modified_count} pending reassignment request(s) older than {cooldown_hours}h")
        
        # Fix inconsistent state: pending_reassignment=True but status is already approved/rejected/auto_rejected
        fix_result = await leads_db.collection.update_many(
            {
                "pending_reassignment": True,
                "reassignment_status": {"$in": ["approved", "rejected", "auto_rejected"]}
            },
            {"$set": {"pending_reassignment": False}}
        )
        if fix_result.modified_count:
            logging.info(f"🔧 Fixed {fix_result.modified_count} inconsistent pending_reassignment flag(s)")
        
        # Auto-reject pending requests that have no reassignment_requested_at (safety net)
        orphan_result = await leads_db.collection.update_many(
            {
                "pending_reassignment": True,
                "reassignment_status": "pending",
                "reassignment_requested_at": {"$exists": False}
            },
            {"$set": {
                "pending_reassignment": False,
                "reassignment_status": "auto_rejected",
                "reassignment_rejection_reason": f"System Auto-Rejected: Missing request timestamp",
                "reassignment_rejected_by": "system",
                "reassignment_rejected_at": get_ist_now(),
            }}
        )
        if orphan_result.modified_count:
            logging.info(f"🔧 Auto-rejected {orphan_result.modified_count} orphan pending request(s) with no timestamp")
    except Exception as _exp_err:
        logging.warning(f"⚠️ Auto-rejection error (non-fatal): {_exp_err}")
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
    
    # Check if user is super admin (super admins see everything)
    is_super_admin = await permission_manager.is_admin(user_id, users_db, roles_db)
    
    # Approval authority comes ONLY from reassignment_approval_routes settings (+ super admin).
    # The generic leads.assign permission does NOT grant approval access.
    configured_routes = await settings_db.get_reassignment_approval_routes()
    routes_for_me = [r for r in configured_routes if user_id in (r.get("approver_ids") or [])]
    is_configured_approver = len(routes_for_me) > 0
    
    logger.debug(f"Reassignment list: user={user_id} is_super_admin={is_super_admin} is_configured_approver={is_configured_approver}")
    logger.warning(f"REASSIGN_DEBUG: user={user_id} is_super_admin={is_super_admin} is_configured_approver={is_configured_approver} routes_count={len(configured_routes)} routes_for_me={len(routes_for_me)}")
    
    # Build filter query
    filter_dict = {}
    
    if is_super_admin:
        # Super admins see all requests
        logger.debug(f"Super admin: showing ALL reassignment requests")
    elif is_configured_approver:
        # Configured approver: see requests ONLY from their configured roles
        # Roles with NO configured route (orphan) go to Super Admin only
        role_ids_for_me = [r["role_id"] for r in routes_for_me]
        all_users = await users_db.list_users()
        visible_user_ids = set()
        for u in all_users:
            u_role = str(u.get("role_id", ""))
            u_id = str(u.get("_id"))
            if u_role in role_ids_for_me:
                # User's role is one I'm configured to approve
                visible_user_ids.add(u_id)
        visible_user_ids.add(user_id)  # Always include own requests
        filter_dict["reassignment_requested_by"] = {"$in": list(visible_user_ids)}
        logger.warning(f"REASSIGN_DEBUG: visible_user_ids count={len(visible_user_ids)}, filter_dict={filter_dict}")
        logger.debug(f"Configured approver: showing requests from {len(visible_user_ids)} users (roles {role_ids_for_me})")
    else:
        # Regular user: only their own requests
        filter_dict["reassignment_requested_by"] = user_id
        logger.debug(f"Regular user: showing only own requests for {user_id}")
    
    # If a status filter is provided, add it to the query
    if status_filter and status_filter.lower() != "all":
        if status_filter.lower() == "pending":
            filter_dict["pending_reassignment"] = True
        elif status_filter.lower() == "rejected":
            # Include both manual rejections and system auto-rejections
            filter_dict["pending_reassignment"] = False
            filter_dict["reassignment_status"] = {"$in": ["rejected", "auto_rejected"]}
        else:
            # For approved (and anything else), filter by exact status
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
    
    # Get leads with reassignment requests
    # CRITICAL: Pass explicit projection including ALL reassignment fields
    # Default projection in list_leads excludes these fields
    reassignment_projection = {
        "_id": 1, "first_name": 1, "last_name": 1, "name": 1, "customer_name": 1,
        "phone": 1, "mobile_number": 1, "email": 1, "alternative_phone": 1,
        "status": 1, "sub_status": 1, "loan_type": 1, "loan_type_name": 1,
        "assigned_to": 1, "created_by": 1, "created_by_name": 1,
        "department_name": 1, "team_name": 1,
        "created_at": 1, "updated_at": 1,
        # Reassignment-specific fields
        "pending_reassignment": 1,
        "reassignment_requested_by": 1,
        "reassignment_target_user": 1,
        "reassignment_reason": 1,
        "reassignment_requested_at": 1,
        "reassignment_status": 1,
        "reassignment_approved_by": 1,
        "reassignment_approved_at": 1,
        "reassignment_rejected_by": 1,
        "reassignment_rejected_at": 1,
        "reassignment_rejection_reason": 1,
        "reassignment_approval_remark": 1,
        "reassignment_eligibility": 1,
        "reassignment_new_data_code": 1,
        "reassignment_new_campaign_name": 1,
        "file_sent_to_login": 1,
    }
    leads = await leads_db.list_leads(
        filter_dict=filter_dict,
        skip=skip,
        limit=page_size,
        sort_by="reassignment_requested_at",
        sort_order=-1,
        projection=reassignment_projection
    )
    
    # Get total count
    total_leads = await leads_db.count_leads(filter_dict)
    
    # Enhance leads with user information
    # Pre-compute: load all configured approval routes once for per-request can_approve_request flag
    all_approval_routes = await settings_db.get_reassignment_approval_routes()
    # Build map: role_id -> set of approver_ids
    role_approver_map = {}
    for rt in all_approval_routes:
        role_approver_map[rt.get("role_id", "")] = set(rt.get("approver_ids") or [])

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
        
        # Add approved_by name
        if lead.get("reassignment_approved_by"):
            approver = await users_db.get_user(lead["reassignment_approved_by"])
            if approver:
                lead_dict["approved_by_name"] = f"{approver.get('first_name', '')} {approver.get('last_name', '')}".strip()

        # Add rejected_by name
        if lead.get("reassignment_rejected_by"):
            if lead["reassignment_rejected_by"] == "system":
                lead_dict["rejected_by_name"] = "System"
            else:
                rejector = await users_db.get_user(lead["reassignment_rejected_by"])
                if rejector:
                    lead_dict["rejected_by_name"] = f"{rejector.get('first_name', '')} {rejector.get('last_name', '')}".strip()

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
        elif lead.get("reassignment_status") in ("rejected", "auto_rejected"):
            lead_dict["status"] = "rejected"
            if lead.get("reassignment_status") == "auto_rejected":
                lead_dict["auto_rejected"] = True
        else:
            lead_dict["status"] = "unknown"
        
        
        
        # Add reassignment change requests
        if lead.get("reassignment_new_data_code") is not None:
            lead_dict["reassignment_new_data_code"] = lead["reassignment_new_data_code"]
        
        if lead.get("reassignment_new_campaign_name") is not None:
            lead_dict["reassignment_new_campaign_name"] = lead["reassignment_new_campaign_name"]
        
        # ── Per-request visibility flags ──
        requester_id = str(lead.get("reassignment_requested_by") or "")
        assigned_to_id = str(lead.get("assigned_to") or "")
        target_user_id_val = str(lead.get("reassignment_target_user") or "")
        lead_dict["is_own_request"] = (requester_id == user_id)
        lead_dict["is_own_lead"] = (assigned_to_id == user_id)
        # Self-transfer: lead target == current assignee (transfer to yourself is meaningless)
        lead_dict["is_self_transfer"] = (target_user_id_val == assigned_to_id) if (target_user_id_val and assigned_to_id) else False
        # can_approve_request: super_admin or configured approver for requester's role
        # First check if current user is a configured approver (takes priority)
        is_role_approver = False
        if requester_id:
            requester_user = await users_db.get_user(requester_id)
            requester_role_id = str(requester_user.get("role_id") or "") if requester_user else ""
            approvers_for_role = role_approver_map.get(requester_role_id, set())
            is_role_approver = (user_id in approvers_for_role)
        
        if is_super_admin or is_role_approver:
            # Super admin and configured approvers can always review/approve
            lead_dict["can_approve_request"] = True
        else:
            lead_dict["can_approve_request"] = False

        enhanced_leads.append(lead_dict)

    # ── Enrich each lead with duplicate leads (same phone) & reassignment history ──
    try:
        user_name_cache: Dict[str, str] = {}

        async def _resolve_name(uid: str) -> str:
            if not uid:
                return ""
            if uid in user_name_cache:
                return user_name_cache[uid]
            try:
                u = await users_db.get_user(uid)
                if u:
                    name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get("username", "")
                    user_name_cache[uid] = name
                    return name
            except Exception:
                pass
            user_name_cache[uid] = ""
            return ""

        for el in enhanced_leads:
            phone = (el.get("phone") or el.get("mobile_number") or "").strip()
            if not phone:
                el["duplicate_leads"] = []
                el["duplicate_count"] = 0
                el["reassignment_history"] = []
                continue

            clean_phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

            # Find other leads with the same phone number
            dup_filter = {
                "$or": [
                    {"phone": {"$regex": clean_phone, "$options": "i"}},
                    {"alternative_phone": {"$regex": clean_phone, "$options": "i"}}
                ]
            }
            dup_leads = await leads_db.list_leads(
                filter_dict=dup_filter, skip=0, limit=20,
                sort_by="created_at", sort_order=-1
            )

            dup_results = []
            for dl in dup_leads:
                dl_id = str(dl.get("_id", ""))
                assigned_name = await _resolve_name(str(dl.get("assigned_to", ""))) if dl.get("assigned_to") else ""
                created_name = await _resolve_name(str(dl.get("created_by", ""))) if dl.get("created_by") else ""
                created_at_val = dl.get("created_at")
                if isinstance(created_at_val, datetime):
                    created_at_val = created_at_val.isoformat()
                dup_results.append({
                    "id": dl_id,
                    "name": f"{dl.get('first_name', '')} {dl.get('last_name', '')}".strip() or dl.get("name", ""),
                    "phone": dl.get("phone", ""),
                    "status": dl.get("status", ""),
                    "sub_status": dl.get("sub_status", ""),
                    "file_sent_to_login": dl.get("file_sent_to_login", False),
                    "assigned_to_name": assigned_name,
                    "created_by_name": created_name,
                    "loan_type": dl.get("loan_type_name") or dl.get("loan_type") or "",
                    "created_at": created_at_val or "",
                    "is_current": dl_id == el.get("_id", ""),
                })

            el["duplicate_leads"] = dup_results
            el["duplicate_count"] = len(dup_results)

        # Fetch reassignment history (from activity collection) for all leads
        lead_ids_obj = []
        for el in enhanced_leads:
            lid = el.get("_id", "")
            if lid and ObjectId.is_valid(lid):
                lead_ids_obj.append(ObjectId(lid))

        if lead_ids_obj:
            history_cursor = leads_db.activity_collection.find(
                {"lead_id": {"$in": lead_ids_obj}, "type": "reassignment"},
                {"_id": 0, "lead_id": 1, "created_at": 1, "created_by": 1,
                 "action": 1, "activity_description": 1, "details": 1}
            ).sort("created_at", 1)  # ascending so field_history order matches
            history_records = await history_cursor.to_list(length=200)

            import re as _re

            def _plain_uid(val) -> str:
                """Normalize a user ID to a plain string (handles list, old '['id']' format)."""
                if not val:
                    return ""
                if isinstance(val, list):
                    val = val[0] if val else ""
                s = str(val).strip()
                if s.startswith("[") and s.endswith("]"):
                    m = _re.search(r"'([^']+)'", s)
                    if m:
                        s = m.group(1)
                return s

            # ── Pass 1: compute to_user_id and from_user_id for each record ──
            # Also collect lead IDs that still need field_history for from_user fallback
            needs_fh_leads: set = set()
            per_rec: list = []  # (rec, to_user_id, from_user_id)

            for rec in history_records:
                details = rec.get("details") or {}
                action = rec.get("action", "")

                # to_user: target_user (requests/old direct) OR assigned_to (new records)
                to_user_id = _plain_uid(details.get("target_user") or "")
                if not to_user_id:
                    to_user_id = _plain_uid(details.get("assigned_to") or "")

                # from_user: explicitly stored (new records after fix)
                from_user_id = _plain_uid(details.get("from_user") or "")

                # Fallback 1: field_changes embedded in the activity (approved activities)
                if not from_user_id:
                    for fc in (details.get("field_changes") or []):
                        if fc.get("field_name") == "assigned_to" and fc.get("old_value"):
                            from_user_id = _plain_uid(fc["old_value"])
                            break

                # Fallback 2: for approved_direct/requested old records, need lead field_history
                if not from_user_id and action in ("approved_direct", "requested", "approved"):
                    lid = str(rec.get("lead_id", ""))
                    if lid:
                        needs_fh_leads.add(lid)

                per_rec.append((rec, to_user_id, from_user_id))

            # ── Batch-fetch field_history from lead documents for fallback ──
            lead_fh_map: Dict[str, list] = {}   # lead_id -> [{field_name, old_value, new_value, changed_at}]
            lead_current_owner: Dict[str, str] = {}  # lead_id -> current assigned_to plain id

            if needs_fh_leads:
                fh_cursor = leads_db.collection.find(
                    {"_id": {"$in": [ObjectId(lid) for lid in needs_fh_leads if ObjectId.is_valid(lid)]}},
                    {"_id": 1, "field_history": 1, "assigned_to": 1}
                )
                async for doc in fh_cursor:
                    lid_str = str(doc["_id"])
                    fh = [fc for fc in (doc.get("field_history") or [])
                          if fc.get("field_name") == "assigned_to"]
                    lead_fh_map[lid_str] = fh
                    lead_current_owner[lid_str] = _plain_uid(doc.get("assigned_to"))

            # ── Pass 2: resolve from_user via field_history where still empty ──
            resolved_per_rec: list = []
            for (rec, to_user_id, from_user_id) in per_rec:
                action = rec.get("action", "")
                lid = str(rec.get("lead_id", ""))

                if not from_user_id and lid in lead_fh_map:
                    fh = lead_fh_map[lid]
                    if action in ("approved_direct", "approved") and to_user_id:
                        # Find the field_history entry where new_value matches to_user_id
                        match = next(
                            (fc for fc in fh if _plain_uid(fc.get("new_value", "")) == to_user_id),
                            None
                        )
                        if match:
                            from_user_id = _plain_uid(match.get("old_value", ""))
                    elif action == "requested":
                        # For pending requests: previous owner = current assigned_to
                        # For old processed requests: find field_history entry whose new_value
                        # matches to_user_id (the requestor's target); old_value = who had it before
                        if to_user_id:
                            match = next(
                                (fc for fc in fh if _plain_uid(fc.get("new_value", "")) == to_user_id),
                                None
                            )
                            if match:
                                from_user_id = _plain_uid(match.get("old_value", ""))
                        # If still empty, use lead's current owner (works for still-pending requests)
                        if not from_user_id:
                            from_user_id = lead_current_owner.get(lid, "")

                resolved_per_rec.append((rec, to_user_id, from_user_id))

            # ── Pre-resolve all user IDs into names ──
            all_uids: set = set()
            for (rec, to_uid, from_uid) in resolved_per_rec:
                if rec.get("created_by"):
                    all_uids.add(str(rec["created_by"]))
                if to_uid:
                    all_uids.add(to_uid)
                if from_uid:
                    all_uids.add(from_uid)

            for uid in all_uids:
                if uid:
                    await _resolve_name(uid)

            # ── Build final history_by_lead ──
            history_by_lead: Dict[str, list] = {}
            for (rec, to_user_id, from_user_id) in resolved_per_rec:
                lid = str(rec.get("lead_id", ""))
                if lid not in history_by_lead:
                    history_by_lead[lid] = []
                created_at_val = rec.get("created_at")
                if isinstance(created_at_val, datetime):
                    created_at_val = created_at_val.isoformat()
                details = rec.get("details") or {}
                action = rec.get("action", "")

                history_by_lead[lid].append({
                    "date": created_at_val or "",
                    "action": action,
                    "by_user": user_name_cache.get(str(rec.get("created_by", "")), ""),
                    "to_user": user_name_cache.get(to_user_id, ""),
                    "from_user": user_name_cache.get(from_user_id, ""),
                    "reason": details.get("reason", ""),
                    "status": details.get("reassignment_status", ""),
                    "description": rec.get("activity_description", ""),
                    # Field-level before/after changes (data_code, campaign — exclude assigned_to/status)
                    "field_changes": [
                        fc for fc in (details.get("field_changes") or [])
                        if fc.get("field_name") not in ("assigned_to", "reassignment_status")
                    ],
                })

            for el in enhanced_leads:
                el["reassignment_history"] = history_by_lead.get(el.get("_id", ""), [])
        else:
            for el in enhanced_leads:
                el["reassignment_history"] = []

    except Exception as e:
        logging.error(f"Failed to enrich reassignment leads with duplicates/history: {e}")
        for el in enhanced_leads:
            if "duplicate_leads" not in el:
                el["duplicate_leads"] = []
                el["duplicate_count"] = 0
            if "reassignment_history" not in el:
                el["reassignment_history"] = []

    # Calculate total pages
    total_pages = math.ceil(total_leads / page_size) if total_leads > 0 else 1
    
    return {
        "requests": enhanced_leads,
        "cooldown_hours": cooldown_hours,
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
    
    # ── Configurable reassignment cooldown lock ────────────────────────────────
    # If a pending request was already submitted within the cooldown window,
    # block any new request (pending OR direct) unless user has override permission.
    # After the cooldown window with no manager action, the lead is automatically reopened.
    try:
        _cd_doc = await leads_db.db["reassignment_settings"].find_one({"type": "cooldown_period"})
        cooldown_hours = int(_cd_doc.get("hours", 24)) if _cd_doc else 24
    except Exception:
        cooldown_hours = 24
    req_at_raw = lead.get("reassignment_requested_at")
    if lead.get("pending_reassignment") and req_at_raw:
        try:
            req_dt = req_at_raw if isinstance(req_at_raw, datetime) else datetime.fromisoformat(str(req_at_raw).replace("Z", "+00:00"))
            # Strip timezone for arithmetic with get_ist_now() (which returns naive IST)
            req_dt_naive = req_dt.replace(tzinfo=None)
            elapsed_h = (get_ist_now() - req_dt_naive).total_seconds() / 3600
            if elapsed_h >= cooldown_hours:
                # Auto-reset: cooldown window passed without manager action → reopen lead
                await leads_db.update_lead_reassignment_status(lead_id, {
                    "pending_reassignment": False,
                    "reassignment_status": "auto_rejected",
                    "reassignment_rejection_reason": f"System Auto-Rejected: No action taken within {cooldown_hours} hours",
                    "reassignment_rejected_at": get_ist_now(),
                })
                logging.info(f"⏰ Auto-reset lead {lead_id}: {cooldown_hours}h cooldown expired (elapsed={elapsed_h:.1f}h)")
                # Reload lead after reset
                lead = await leads_db.get_lead(lead_id)
            else:
                # Still within cooldown window — block new requests for non-overriders
                can_override_24h = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
                if not can_override_24h:
                    hours_remaining = round(cooldown_hours - elapsed_h, 1)
                    raise HTTPException(
                        status_code=status.HTTP_423_LOCKED,
                        detail=f"A reassignment request was already submitted {round(elapsed_h, 1):.1f}h ago. Locked for {hours_remaining}h more. No new request allowed until {cooldown_hours}h have passed."
                    )
        except HTTPException:
            raise
        except Exception as e:
            logging.warning(f"⚠️ Could not check cooldown reassignment lock for lead {lead_id}: {e}")
    elif req_at_raw and lead.get("reassignment_status") not in ("approved", "none", None):
        # A request was made recently and resolved (rejected/expired) — still within cooldown window.
        # Nobody (regardless of who originally requested) can submit a new request within cooldown_hours.
        can_override_24h = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
        if not can_override_24h:
            try:
                req_dt = req_at_raw if isinstance(req_at_raw, datetime) else datetime.fromisoformat(str(req_at_raw).replace("Z", "+00:00"))
                req_dt_naive = req_dt.replace(tzinfo=None)
                elapsed_h = (get_ist_now() - req_dt_naive).total_seconds() / 3600
                if elapsed_h < cooldown_hours:
                    hours_remaining = round(cooldown_hours - elapsed_h, 1)
                    raise HTTPException(
                        status_code=status.HTTP_423_LOCKED,
                        detail=f"You already submitted a request for this lead {round(elapsed_h, 1):.1f}h ago. Please wait {hours_remaining}h before requesting again."
                    )
            except HTTPException:
                raise
            except Exception as e:
                logging.warning(f"⚠️ Could not check re-request cooldown for lead {lead_id}: {e}")

    # Check reassignment eligibility based on status/sub-status settings
    eligibility = await leads_db.check_reassignment_eligibility(lead_id)
    
    # Check if user has admin/manager permission
    can_override = await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)
    
    # If reassignment requires manager permission AND the user wants direct (approved) reassignment,
    # block it — they must go through the pending/approval flow.
    # Pending requests from regular users are ALWAYS allowed regardless of manager permission.
    if is_direct_reassignment and eligibility.get("is_manager_permission_required") and not can_override:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This lead requires manager approval for reassignment. Please submit a pending request."
        )
    
    # If lead is not yet eligible (locking period not elapsed) and user doesn't have override
    # permission, only block DIRECT reassignments. Pending requests must still be submittable
    # so that managers can process them once the lock expires or override it.
    if is_direct_reassignment and not eligibility.get("can_reassign") and not can_override:
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
            "reassignment_approved_at": get_ist_now(),
            "reassignment_requested_by": user_id,
            "reassignment_target_user": target_user_id,
            "reassignment_reason": reason,
            "reassignment_requested_at": get_ist_now(),
            # Record eligibility info for auditing purposes
            "reassignment_eligibility": eligibility,
            # Update ownership to requesting user
            "created_by": user_id,
            "created_at": get_ist_now(),
            # Set status directly without lookup
            "status": "ACTIVE LEADS",
            "sub_status": "NEW LEAD",
            "file_sent_to_login": False,
            # Clear TL/supervisor assignment — new owner must set their own
            "assign_report_to": [],

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
                    "created_at": get_ist_now(),
                    "created_by": user_id,
                    "type": "reassignment",
                    "action": "approved_direct",
                    "activity_type": activity_type,
                    "activity_description": activity_description or f"Lead directly reassigned to {target_user_id}",
                    "details": {
                        "target_user": target_user_id,
                        "from_user": str(lead.get("assigned_to") or "") if lead else "",
                        "reason": reason,
                        "data_code_changed": data_code if data_code else None,
                        "campaign_name_changed": campaign_name if campaign_name else None,
                        "reassignment_status": "approved",
                        "timestamp": get_ist_now().isoformat()
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
            "reassignment_requested_at": get_ist_now(),
            # Clear stale fields from any previous approval/rejection
            "reassignment_status": "pending",
            "reassignment_approved_by": None,
            "reassignment_approved_at": None,
            "reassignment_rejected_by": None,
            "reassignment_rejected_at": None,
            "reassignment_rejection_reason": None,
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
    remark: Optional[str] = Body(None, embed=True, description="Manager's approval remark"),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db),
    notifications_db: NotificationsDB = Depends(get_notifications_db),
    settings_db: SettingsDB = Depends(get_settings_db),
):
    """Approve a reassignment request
    
    Only super admins OR users specifically configured as approvers for the
    requester's role can approve. If requester's role has no configured
    approver, only super admin can approve.
    """
    # Step 1: Super admin can always approve
    is_admin = await permission_manager.is_admin(user_id, users_db, roles_db)
    can_approve = is_admin

    # Step 2: Check if user is a configured approver for the requester's specific role
    if not can_approve:
        lead_check = await leads_db.get_lead(lead_id)
        if lead_check:
            requester_id = lead_check.get("reassignment_requested_by")
            if requester_id:
                requester = await users_db.get_user(requester_id)
                if requester:
                    requester_role_id = str(requester.get("role_id") or "")
                    if requester_role_id:
                        approver_ids = await settings_db.get_reassignment_approvers_for_employee(requester_role_id)
                        if user_id in approver_ids:
                            can_approve = True
                            logging.info(f"✅ User {user_id} is a configured reassignment approver for role {requester_role_id}")
                        else:
                            logging.info(f"❌ User {user_id} is NOT configured as approver for role {requester_role_id} (configured: {approver_ids})")
                    else:
                        logging.info(f"❌ Requester {requester_id} has no role_id — only super admin can approve")

    if not can_approve:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to approve reassignment requests for this role"
        )
    
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )

    # Prevent self-approval only if NOT a configured approver
    requester_id_check = str(lead.get("reassignment_requested_by") or "")
    if requester_id_check == user_id and not can_approve:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot approve your own reassignment request"
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

    # Fetch the requesting user's details to update ownership fields
    requesting_user = await users_db.get_user(requesting_user_id)
    requesting_user_name = ""
    requesting_department_id = None
    requesting_department_name = "Unknown Department"

    if requesting_user:
        first_name = requesting_user.get("first_name", "")
        last_name = requesting_user.get("last_name", "")
        requesting_user_name = f"{first_name} {last_name}".strip() or requesting_user.get("name", "") or requesting_user.get("username", "") or "Unknown"
        requesting_department_id = requesting_user.get("department_id")
        if requesting_department_id:
            dept = await departments_db.get_department(requesting_department_id)
            requesting_department_name = dept.get("name", "Unknown Department") if dept else "Unknown Department"
        else:
            requesting_department_name = "No Department"
    else:
        logging.warning(f"⚠️ Requesting user {requesting_user_id} not found when approving reassignment for lead {lead_id}")

    # Update lead with new assignment and clear reassignment request
    # Also update ownership (created_by, created_by_name, created_at, department)
    # so the lead appears under the new owner in lists with the reassignment date.
    update_data = {
        "assigned_to": requesting_user_id,  # Assign to requesting user
        "pending_reassignment": False,
        "reassignment_status": "approved",
        "reassignment_approved_by": user_id,
        "reassignment_approved_at": get_ist_now(),
        # Record eligibility info for auditing purposes
        "reassignment_eligibility": reassignment_eligibility,
        # Transfer ownership to the requesting user with today's date
        "created_by": requesting_user_id,
        "created_by_name": requesting_user_name,
        "created_at": get_ist_now(),
        "department_id": requesting_department_id,
        "department_name": requesting_department_name,
        # Reset lead status
        "status": "ACTIVE LEADS",
        "sub_status": "NEW LEAD",
        "file_sent_to_login": False,
        # Save manager's approval remark for history display
        "reassignment_approval_remark": remark or "",
        # Clear TL/supervisor assignment — new owner must set their own
        "assign_report_to": [],
    }

    logging.info(f"🔄 Setting assigned_to + created_by to requesting user: {requesting_user_id} ({requesting_user_name})")
    logging.info(f"🔄 Setting created_at to reassignment date: {update_data['created_at']}")
    logging.info(f"🔄 Setting department: {requesting_department_name} ({requesting_department_id})")
    logging.info(f"🔄 Setting status to: {update_data['status']}")
    logging.info(f"🔄 Setting sub_status to: {update_data['sub_status']}")
    
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
    notifications_db: NotificationsDB = Depends(get_notifications_db),
    settings_db: SettingsDB = Depends(get_settings_db),
):
    """Reject a reassignment request
    
    Only super admins OR users specifically configured as approvers for the
    requester's role can reject. If requester's role has no configured
    approver, only super admin can reject.
    """
    # Step 1: Super admin can always reject
    is_admin = await permission_manager.is_admin(user_id, users_db, roles_db)
    can_approve = is_admin

    # Step 2: Check if user is a configured approver for the requester's specific role
    if not can_approve:
        lead_check = await leads_db.get_lead(lead_id)
        if lead_check:
            requester_id = lead_check.get("reassignment_requested_by")
            if requester_id:
                requester = await users_db.get_user(requester_id)
                if requester:
                    requester_role_id = str(requester.get("role_id") or "")
                    if requester_role_id:
                        approver_ids = await settings_db.get_reassignment_approvers_for_employee(requester_role_id)
                        if user_id in approver_ids:
                            can_approve = True

    if not can_approve:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to reject reassignment requests for this role"
        )
    
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )

    # Prevent self-rejection only if NOT a configured approver
    requester_id_check = str(lead.get("reassignment_requested_by") or "")
    if requester_id_check == user_id and not can_approve:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot reject your own reassignment request"
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
        "reassignment_rejected_at": get_ist_now(),
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
        update_data["updated_at"] = get_ist_now()
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
            "created_at": get_ist_now(),
            "created_by": user_id,
            "type": "field_update",
            "action": "updated",
            "activity_type": "lead_field_update",
            "activity_description": f"Lead fields updated: {', '.join(updated_fields)}",
            "details": {
                "fields_updated": updated_fields,
                "updates": updates,
                "timestamp": get_ist_now().isoformat()
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
            "created_at": get_ist_now(),
            "created_by": user_id,
            "type": activity_data.get("activity_type", "general"),
            "action": "logged",
            "activity_type": activity_data.get("activity_type", "general"),
            "activity_title": activity_data.get("activity_title", "Activity"),
            "activity_description": activity_data.get("activity_description", ""),
            "details": activity_data.get("details", {}),
            "timestamp": get_ist_now()
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
