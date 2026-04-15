from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from bson import ObjectId
from datetime import datetime, timedelta
from app.database import get_database_instances
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.utils.permissions import PermissionManager
from app.utils.timezone import get_ist_now
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]


async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]


def _build_date_range_utc(time_filter: str, date_from: Optional[str], date_to: Optional[str]):
    """
    Build naive UTC start/end datetimes for MongoDB queries.
    DB stores created_at as naive UTC datetimes, so we work in UTC.
    IST = UTC + 5:30, so midnight IST = 18:30 previous day UTC.
    """
    # Current time in IST (timezone-aware)
    now_ist = get_ist_now()
    # Strip to naive UTC equivalent for midnight/day boundary calculations
    # IST offset = +5:30 = 330 minutes
    IST_OFFSET = timedelta(hours=5, minutes=30)

    if time_filter == "today":
        # Today midnight IST → subtract IST offset to get UTC
        today_midnight_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        start = (today_midnight_ist - IST_OFFSET).replace(tzinfo=None)
        end_ist = now_ist.replace(hour=23, minute=59, second=59, microsecond=999999)
        end = (end_ist - IST_OFFSET).replace(tzinfo=None)

    elif time_filter == "tomorrow":
        from datetime import timedelta as _td
        tomorrow_ist = (now_ist + _td(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        start = (tomorrow_ist - IST_OFFSET).replace(tzinfo=None)
        end_ist = tomorrow_ist.replace(hour=23, minute=59, second=59, microsecond=999999)
        end = (end_ist - IST_OFFSET).replace(tzinfo=None)

    elif time_filter == "this_week":
        weekday = now_ist.weekday()  # Monday=0
        week_start_ist = (now_ist - timedelta(days=weekday)).replace(hour=0, minute=0, second=0, microsecond=0)
        week_end_ist = (week_start_ist + timedelta(days=6)).replace(hour=23, minute=59, second=59, microsecond=999999)
        start = (week_start_ist - IST_OFFSET).replace(tzinfo=None)
        end = (week_end_ist - IST_OFFSET).replace(tzinfo=None)

    elif time_filter == "this_month":
        month_start_ist = now_ist.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now_ist.month == 12:
            month_end_ist = now_ist.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
        else:
            month_end_ist = (now_ist.replace(month=now_ist.month + 1, day=1) - timedelta(seconds=1)).replace(tzinfo=now_ist.tzinfo)
        start = (month_start_ist - IST_OFFSET).replace(tzinfo=None)
        end = (month_end_ist - IST_OFFSET).replace(tzinfo=None)

    elif time_filter == "custom" and date_from:
        # Custom dates are calendar dates (YYYY-MM-DD) in IST
        start_ist = datetime.strptime(date_from, "%Y-%m-%d")
        start = start_ist - IST_OFFSET
        if date_to:
            end_ist = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        else:
            end_ist = start_ist.replace(hour=23, minute=59, second=59)
        end = end_ist - IST_OFFSET

    else:
        # all_time - no date filter
        return None, None

    return start, end


@router.get("/stats")
async def get_dashboard_stats(
    user_id: str = Query(..., description="ID of the requesting user"),
    time_filter: str = Query("this_month", description="today|this_week|this_month|all_time|custom"),
    date_from: Optional[str] = Query(None, description="Custom start date YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="Custom end date YYYY-MM-DD"),
    emp_status: Optional[str] = Query(None, description="active|inactive — filter by employee_status field"),
    permission_level: Optional[str] = Query(None, description="hint from frontend; backend re-derives from DB role"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Returns per-employee lead and login pipeline stats for the Dashboard page."""
    try:
        if not user_id or not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user_id")

        # ─── Determine effective permission level from the user's ACTUAL role in DB ───
        # Always derive from DB so stale frontend cache can never bypass restrictions.
        user_permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        is_super_admin = any(
            p.get("page") == "*" and (
                p.get("actions") == "*" or
                (isinstance(p.get("actions"), list) and "*" in p.get("actions", []))
            )
            for p in user_permissions
        ) if user_permissions else False

        if is_super_admin:
            effective_level = "all"
        else:
            # ─── Derive effective permission level ───
            # Check across dashboard, leads (multiple page names), and login modules.
            # Take the HIGHEST level found: all > junior > own.
            # "view_team" action is semantically equivalent to "junior".
            #
            # Pages to check for leads: "leads", "leads.pl_odd_leads", "leads.pl_&_odd_leads"
            # (different naming conventions exist in DB and code)
            LEADS_PAGES = ["leads", "leads.pl_odd_leads", "leads.pl_&_odd_leads"]
            LOGIN_PAGES = ["login"]
            DASHBOARD_PAGES = ["dashboard"]
            ALL_PAGES = DASHBOARD_PAGES + LEADS_PAGES + LOGIN_PAGES

            def _has_level(level: str) -> bool:
                """Check if any module grants the given permission level."""
                actions_to_check = [level]
                if level == "junior":
                    actions_to_check.append("view_team")  # view_team = junior
                for page in ALL_PAGES:
                    for action in actions_to_check:
                        if PermissionManager.has_permission(user_permissions, page, action):
                            return True
                return False

            if _has_level("all"):
                effective_level = "all"
            elif _has_level("junior"):
                effective_level = "junior"
            elif _has_level("own"):
                effective_level = "own"
            else:
                # No relevant permission — fallback: own data only (safe default)
                effective_level = permission_level or "own"

        logger.info(f"Dashboard stats: user={user_id}, effective_level={effective_level}, is_super_admin={is_super_admin}")

        # ─── Build allowed_user_ids set based on effective_level ───
        allowed_user_ids: Optional[set] = None  # None = no restriction (all)
        if effective_level == "own":
            allowed_user_ids = {user_id}
        elif effective_level == "junior":
            subordinate_ids = await PermissionManager.get_subordinate_users(user_id, users_db, roles_db)
            allowed_user_ids = {user_id} | set(subordinate_ids)
        # effective_level == "all" → allowed_user_ids stays None (fetch everyone)

        # Get raw database directly from leads_db instance
        db_instances = get_database_instances()
        leads_db_instance = db_instances.get("leads")
        login_leads_db_instance = db_instances.get("login_leads")

        # Use the underlying Motor database
        if leads_db_instance is not None:
            raw_db = leads_db_instance.db
        else:
            raw_db = users_db.db

        leads_col = raw_db["leads"]
        login_leads_col = raw_db["login_leads"]
        departments_col = raw_db["departments"]
        statuses_col = raw_db["statuses"]

        # ─── Fetch statuses dynamically from Settings ───
        all_statuses = await statuses_col.find(
            {}, {"name": 1, "department_ids": 1}
        ).sort("order", 1).to_list(None)

        dyn_lead_statuses = []
        dyn_login_statuses = []
        for s in all_statuses:
            name = s.get("name", "").strip().upper()
            if not name:
                continue
            dept = s.get("department_ids", "")
            if isinstance(dept, list):
                if "leads" in dept:
                    dyn_lead_statuses.append(name)
                if "login" in dept:
                    dyn_login_statuses.append(name)
            elif isinstance(dept, str):
                dl = dept.lower()
                if dl == "leads":
                    dyn_lead_statuses.append(name)
                elif dl == "login":
                    dyn_login_statuses.append(name)

        # Fallback to defaults if nothing configured
        LEAD_STATUSES = dyn_lead_statuses if dyn_lead_statuses else ["ACTIVE LEADS", "NOT A LEAD", "LOST BY MISTAKE", "LOST LEAD"]
        LOGIN_STATUSES = dyn_login_statuses if dyn_login_statuses else [
            "ACTIVE LOGIN", "APPROVED", "DISBURSED",
            "LOST BY MISTAKE", "LOST LOGIN",
            "MULTI LOGIN DISBURSED BY US BY OTHER BANK"
        ]

        # ─── Build date range ───
        start_dt, end_dt = _build_date_range_utc(time_filter, date_from, date_to)

        date_match_leads = {}
        date_match_logins = {}
        date_match_disbursed = {}
        if start_dt and end_dt:
            date_match_leads["created_at"] = {"$gte": start_dt, "$lte": end_dt}
            date_match_logins["login_created_at"] = {"$gte": start_dt, "$lte": end_dt}
            # disbursement_date is stored as YYYY-MM-DD string — convert UTC range to IST date strings
            _IST_OFF = timedelta(hours=5, minutes=30)
            date_match_disbursed["disbursement_date"] = {
                "$gte": (start_dt + _IST_OFF).strftime("%Y-%m-%d"),
                "$lte": (end_dt + _IST_OFF).strftime("%Y-%m-%d")
            }

        # ─── Fetch users scoped by permission level ───
        users_query = {"is_active": {"$ne": False}}
        if emp_status in ("active", "inactive"):
            users_query["employee_status"] = emp_status
        if allowed_user_ids is not None:
            users_query["_id"] = {"$in": [ObjectId(uid) for uid in allowed_user_ids if ObjectId.is_valid(uid)]}
        all_users = await users_db.collection.find(
            users_query,
            {"first_name": 1, "last_name": 1, "username": 1, "department_id": 1, "employee_status": 1}
        ).to_list(None)

        if not all_users:
            return {"employees": [], "totals": {"leads": 0, "logins": 0},
                    "leadStatuses": LEAD_STATUSES, "loginStatuses": LOGIN_STATUSES}

        user_ids = [str(u["_id"]) for u in all_users]

        # ─── Build user name & dept map ───
        dept_ids_needed = set()
        user_map = {}
        for u in all_users:
            uid = str(u["_id"])
            full_name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get("username", uid)
            dept_id = str(u["department_id"]) if u.get("department_id") else ""
            user_map[uid] = {"name": full_name, "team": "", "dept_id": dept_id, "emp_status": u.get("employee_status", "active")}
            if dept_id:
                dept_ids_needed.add(dept_id)

        # Resolve department names
        if dept_ids_needed:
            depts = await departments_col.find(
                {"_id": {"$in": [ObjectId(d) for d in dept_ids_needed if ObjectId.is_valid(d)]}},
                {"name": 1}
            ).to_list(None)
            dept_name_map = {str(d["_id"]): d.get("name", "") for d in depts}
            for uid, udata in user_map.items():
                if udata["dept_id"]:
                    udata["team"] = dept_name_map.get(udata["dept_id"], "")

        # ─── Aggregate LEADS created by each user ───
        leads_pipeline = [
            {"$match": {**date_match_leads, "created_by": {"$in": user_ids}}},
            {"$group": {
                "_id": {
                    "user_id": "$created_by",
                    "status": {"$toUpper": {"$ifNull": ["$status", "UNKNOWN"]}}
                },
                "count": {"$sum": 1}
            }}
        ]
        leads_agg = await leads_col.aggregate(leads_pipeline).to_list(None)

        # ─── Aggregate LOGIN LEADS created by each user (non-DISBURSED, by login_created_at) ───
        logins_pipeline = [
            {"$match": {**date_match_logins, "created_by": {"$in": user_ids}}},
            {"$group": {
                "_id": {
                    "user_id": "$created_by",
                    "status": {"$toUpper": {"$ifNull": ["$status", "UNKNOWN"]}}
                },
                "count": {"$sum": 1}
            }}
        ]
        logins_agg = await login_leads_col.aggregate(logins_pipeline).to_list(None)

        # ─── Aggregate DISBURSED logins separately using disbursement_date ───
        disbursed_pipeline = [
            {"$match": {**date_match_disbursed, "created_by": {"$in": user_ids},
                        "status": {"$regex": "^disbursed$", "$options": "i"}}},
            {"$group": {
                "_id": {
                    "user_id": "$created_by",
                    "status": {"$toUpper": {"$ifNull": ["$status", "UNKNOWN"]}}
                },
                "count": {"$sum": 1}
            }}
        ]
        disbursed_agg = await login_leads_col.aggregate(disbursed_pipeline).to_list(None)

        # ─── Build per-employee data ───
        # (LEAD_STATUSES and LOGIN_STATUSES already built dynamically above)

        emp_data = {
            uid: {
                "leads": {s: 0 for s in LEAD_STATUSES},
                "logins": {s: 0 for s in LOGIN_STATUSES},
                "totalLeads": 0,
                "totalLogins": 0,
            }
            for uid in user_ids
        }

        for row in leads_agg:
            uid = row["_id"]["user_id"]
            status = row["_id"]["status"]
            count = row["count"]
            if uid in emp_data:
                emp_data[uid]["totalLeads"] += count
                if status in emp_data[uid]["leads"]:
                    emp_data[uid]["leads"][status] += count

        for row in logins_agg:
            uid = row["_id"]["user_id"]
            status = row["_id"]["status"]
            if status == "DISBURSED":
                continue  # Counted separately via disbursed_agg (uses disbursement_date)
            count = row["count"]
            if uid in emp_data:
                emp_data[uid]["totalLogins"] += count
                if status in emp_data[uid]["logins"]:
                    emp_data[uid]["logins"][status] += count

        for row in disbursed_agg:
            uid = row["_id"]["user_id"]
            status = row["_id"]["status"]  # Will be "DISBURSED"
            count = row["count"]
            if uid in emp_data:
                emp_data[uid]["totalLogins"] += count
                if status in emp_data[uid]["logins"]:
                    emp_data[uid]["logins"][status] += count

        # ─── Build response — ONLY include employees who have at least 1 lead OR 1 login ───
        employees = []
        total_leads = 0
        total_logins = 0

        for uid in user_ids:
            uinfo = user_map.get(uid, {"name": uid, "team": ""})
            data = emp_data[uid]
            # Skip users with zero leads AND zero logins — they should not appear on dashboard
            if data["totalLeads"] == 0 and data["totalLogins"] == 0:
                continue
            total_leads += data["totalLeads"]
            total_logins += data["totalLogins"]
            employees.append({
                "id": uid,
                "name": uinfo["name"],
                "team": uinfo["team"],
                "empStatus": uinfo.get("emp_status", "active"),
                "totalLeads": data["totalLeads"],
                "totalLogins": data["totalLogins"],
                "leads": data["leads"],
                "logins": data["logins"],
            })

        # ─── ASSIGNED LEADS — only for users with restricted scope ─────────────────
        # Show "ASSIGNED" badge ONLY for leads created by people OUTSIDE the user's
        # full permission hierarchy.  If the creator is within the role hierarchy
        # (allowed_user_ids), the user can already see their data through permissions,
        # so marking it "ASSIGNED" is redundant and confusing.
        #
        # • Super admin / "all" level  → skip entirely (they see everything)
        # • "junior" / "own" level     → use the FULL allowed_user_ids set (not the
        #                                 status-filtered user_ids) for the $nin check
        #                                 so that inactive subordinates don't leak as ASSIGNED.
        if allowed_user_ids is not None:  # Only for "own" or "junior" — NOT for "all"/super admin
            try:
                # Full permission scope IDs (not filtered by emp_status / is_active)
                scope_ids_list = list(allowed_user_ids)

                # --- Regular Leads: assign_report_to contains requesting user_id ---
                ext_leads_pipeline = [
                    {"$match": {
                        **date_match_leads,
                        "$or": [
                            {"assign_report_to": user_id},
                            {"assign_report_to": {"$in": [user_id]}},
                        ],
                        "created_by": {"$nin": scope_ids_list},
                    }},
                    {"$group": {
                        "_id": {
                            "user_id": "$created_by",
                            "status": {"$toUpper": {"$ifNull": ["$status", "UNKNOWN"]}}
                        },
                        "count": {"$sum": 1}
                    }}
                ]

                # --- Login Leads: assign_report_to + assigned_to ---
                ext_logins_pipeline = [
                    {"$match": {
                        **date_match_logins,
                        "$or": [
                            {"assign_report_to": user_id},
                            {"assign_report_to": {"$in": [user_id]}},
                            {"assigned_to": user_id},
                            {"assigned_to": {"$in": [user_id]}},
                        ],
                        "created_by": {"$nin": scope_ids_list},
                    }},
                    {"$group": {
                        "_id": {
                            "user_id": "$created_by",
                            "status": {"$toUpper": {"$ifNull": ["$status", "UNKNOWN"]}}
                        },
                        "count": {"$sum": 1}
                    }}
                ]

                ext_leads_agg = await leads_col.aggregate(ext_leads_pipeline).to_list(None)
                ext_logins_agg = await login_leads_col.aggregate(ext_logins_pipeline).to_list(None)

                # Collect external creator IDs
                ext_creator_ids: set = set()
                for row in ext_leads_agg:
                    cid = row["_id"]["user_id"]
                    if cid:
                        ext_creator_ids.add(str(cid))
                for row in ext_logins_agg:
                    cid = row["_id"]["user_id"]
                    if cid:
                        ext_creator_ids.add(str(cid))

                if ext_creator_ids:
                    # Fetch user info for external creators
                    valid_ext_ids = [uid for uid in ext_creator_ids if uid and ObjectId.is_valid(uid)]
                    ext_users = await users_db.collection.find(
                        {"_id": {"$in": [ObjectId(uid) for uid in valid_ext_ids]}},
                        {"first_name": 1, "last_name": 1, "username": 1, "department_id": 1, "employee_status": 1}
                    ).to_list(None)

                    # Resolve department names for external creators
                    ext_dept_ids = {str(u["department_id"]) for u in ext_users if u.get("department_id")}
                    ext_dept_name_map: dict = {}
                    if ext_dept_ids:
                        ext_depts = await departments_col.find(
                            {"_id": {"$in": [ObjectId(d) for d in ext_dept_ids if ObjectId.is_valid(d)]}},
                            {"name": 1}
                        ).to_list(None)
                        ext_dept_name_map = {str(d["_id"]): d.get("name", "") for d in ext_depts}

                    ext_user_map: dict = {}
                    for u in ext_users:
                        uid = str(u["_id"])
                        name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get("username", uid)
                        dept_id = str(u["department_id"]) if u.get("department_id") else ""
                        ext_user_map[uid] = {
                            "name": name,
                            "team": ext_dept_name_map.get(dept_id, ""),
                            "emp_status": u.get("employee_status", "active"),
                        }

                    # Build per-external-creator data
                    ext_emp_data: dict = {
                        uid: {
                            "leads": {s: 0 for s in LEAD_STATUSES},
                            "logins": {s: 0 for s in LOGIN_STATUSES},
                            "totalLeads": 0,
                            "totalLogins": 0,
                        }
                        for uid in ext_creator_ids
                    }

                    for row in ext_leads_agg:
                        uid = str(row["_id"]["user_id"])
                        status = row["_id"]["status"]
                        count = row["count"]
                        if uid in ext_emp_data:
                            ext_emp_data[uid]["totalLeads"] += count
                            if status in ext_emp_data[uid]["leads"]:
                                ext_emp_data[uid]["leads"][status] += count

                    for row in ext_logins_agg:
                        uid = str(row["_id"]["user_id"])
                        status = row["_id"]["status"]
                        count = row["count"]
                        if uid in ext_emp_data:
                            ext_emp_data[uid]["totalLogins"] += count
                            if status in ext_emp_data[uid]["logins"]:
                                ext_emp_data[uid]["logins"][status] += count

                    # Add external rows to response — only if they have actual data
                    for uid in ext_creator_ids:
                        uinfo = ext_user_map.get(uid, {"name": uid, "team": "", "emp_status": "active"})
                        data = ext_emp_data[uid]
                        # Skip assigned users with zero data
                        if data["totalLeads"] == 0 and data["totalLogins"] == 0:
                            continue
                        total_leads += data["totalLeads"]
                        total_logins += data["totalLogins"]
                        employees.append({
                            "id": uid,
                            "name": uinfo["name"],
                            "team": uinfo["team"],
                            "empStatus": uinfo.get("emp_status", "active"),
                            "totalLeads": data["totalLeads"],
                            "totalLogins": data["totalLogins"],
                            "leads": data["leads"],
                            "logins": data["logins"],
                            "isAssignedView": True,  # Flag: assigned-only rows
                        })
            except Exception as ext_err:
                logger.warning(f"External assigned leads fetch failed (non-critical): {ext_err}")

        # Sort: employees with activity first, then alphabetically
        employees.sort(key=lambda e: (-e["totalLeads"] - e["totalLogins"], e["name"]))

        result = {
            "employees": employees,
            "totals": {"leads": total_leads, "logins": total_logins},
            "leadStatuses": LEAD_STATUSES,
            "loginStatuses": LOGIN_STATUSES,
        }
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Dashboard stats error")
        logger.error(f"Dashboard stats error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard stats: {str(e)}")


@router.get("/teams")
async def get_dashboard_teams(
    user_id: str = Query(..., description="ID of the requesting user"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Returns distinct teams (departments) and employee list for filter dropdowns, scoped by permissions."""
    try:
        if not user_id or not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user_id")

        # ─── Determine effective permission scope (same logic as /stats) ───
        user_permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        is_super_admin = any(
            p.get("page") == "*" and (
                p.get("actions") == "*" or
                (isinstance(p.get("actions"), list) and "*" in p.get("actions", []))
            )
            for p in user_permissions
        ) if user_permissions else False

        if is_super_admin:
            effective_level = "all"
        else:
            LEADS_PAGES = ["leads", "leads.pl_odd_leads", "leads.pl_&_odd_leads"]
            LOGIN_PAGES = ["login"]
            DASHBOARD_PAGES = ["dashboard"]
            ALL_PAGES = DASHBOARD_PAGES + LEADS_PAGES + LOGIN_PAGES

            def _has_level(level: str) -> bool:
                actions_to_check = [level]
                if level == "junior":
                    actions_to_check.append("view_team")
                for page in ALL_PAGES:
                    for action in actions_to_check:
                        if PermissionManager.has_permission(user_permissions, page, action):
                            return True
                return False

            if _has_level("all"):
                effective_level = "all"
            elif _has_level("junior"):
                effective_level = "junior"
            else:
                effective_level = "own"

        allowed_user_ids: Optional[set] = None
        if effective_level == "own":
            allowed_user_ids = {user_id}
        elif effective_level == "junior":
            subordinate_ids = await PermissionManager.get_subordinate_users(user_id, users_db, roles_db)
            allowed_user_ids = {user_id} | set(subordinate_ids)

        db = users_db.db
        users_query: dict = {}
        if allowed_user_ids is not None:
            users_query["_id"] = {"$in": [ObjectId(uid) for uid in allowed_user_ids if ObjectId.is_valid(uid)]}

        users = await users_db.collection.find(
            users_query,
            {"first_name": 1, "last_name": 1, "username": 1, "department_id": 1, "employee_status": 1}
        ).to_list(None)

        dept_ids = {str(u["department_id"]) for u in users if u.get("department_id")}
        dept_name_map = {}
        if dept_ids:
            depts = await db["departments"].find(
                {"_id": {"$in": [ObjectId(d) for d in dept_ids if ObjectId.is_valid(d)]}},
                {"name": 1}
            ).to_list(None)
            dept_name_map = {str(d["_id"]): d.get("name", "") for d in depts}

        employees_list = []
        teams_set = set()

        for u in users:
            uid = str(u["_id"])
            full_name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get("username", "")
            dept_name = dept_name_map.get(str(u.get("department_id", "")), "")
            if dept_name:
                teams_set.add(dept_name)
            employees_list.append({"id": uid, "name": full_name, "team": dept_name, "empStatus": u.get("employee_status", "active")})

        employees_list.sort(key=lambda e: e["name"])
        return {"employees": employees_list, "teams": sorted(teams_set)}

    except Exception as e:
        logger.error(f"Dashboard teams error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

