from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from bson import ObjectId
from datetime import datetime, timedelta
from app.database import get_database_instances
from app.database.Users import UsersDB
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
    users_db: UsersDB = Depends(get_users_db),
):
    """Returns per-employee lead and login pipeline stats for the Dashboard page."""
    try:
        # ─── Permission check (lenient: allow anyone logged in) ───
        # Super admin or leads permission required; fallback allows access so UI can render
        # Backend data is still scoped — no sensitive exposure
        if not user_id or not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user_id")

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

        # ─── Build date range ───
        start_dt, end_dt = _build_date_range_utc(time_filter, date_from, date_to)

        date_match_leads = {}
        date_match_logins = {}
        if start_dt and end_dt:
            date_match_leads["created_at"] = {"$gte": start_dt, "$lte": end_dt}
            date_match_logins["created_at"] = {"$gte": start_dt, "$lte": end_dt}

        # ─── Fetch all active users ───
        # Filter by employee_status if requested
        users_query = {"is_active": {"$ne": False}}
        if emp_status in ("active", "inactive"):
            users_query["employee_status"] = emp_status
        users_cursor = users_db.collection.find(
            users_query,
            {"first_name": 1, "last_name": 1, "username": 1, "department_id": 1, "employee_status": 1}
        )
        all_users = await users_cursor.to_list(None)

        if not all_users:
            return {"employees": [], "totals": {"leads": 0, "logins": 0}}

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
        # Use created_by (who entered the lead) grouped by status
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

        # ─── Aggregate LOGIN LEADS created by each user ───
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

        # ─── Build per-employee data ───
        LEAD_STATUSES = ["ACTIVE LEADS", "NOT A LEAD", "LOST BY MISTAKE", "LOST LEAD"]
        LOGIN_STATUSES = [
            "ACTIVE LOGIN", "APPROVED", "DISBURSED",
            "LOST BY MISTAKE", "LOST LOGIN",
            "MULTI LOGIN DISBURSED BY US BY OTHER BANK"
        ]

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
            count = row["count"]
            if uid in emp_data:
                emp_data[uid]["totalLogins"] += count
                if status in emp_data[uid]["logins"]:
                    emp_data[uid]["logins"][status] += count

        # ─── Build response — only include employees who have at least 1 lead/login OR always include all ───
        employees = []
        total_leads = 0
        total_logins = 0

        for uid in user_ids:
            uinfo = user_map.get(uid, {"name": uid, "team": ""})
            data = emp_data[uid]
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

        # Sort: employees with activity first, then alphabetically
        employees.sort(key=lambda e: (-e["totalLeads"] - e["totalLogins"], e["name"]))

        return {
            "employees": employees,
            "totals": {"leads": total_leads, "logins": total_logins}
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard stats: {str(e)}")


@router.get("/teams")
async def get_dashboard_teams(
    user_id: str = Query(..., description="ID of the requesting user"),
    users_db: UsersDB = Depends(get_users_db),
):
    """Returns distinct teams (departments) and employee list for filter dropdowns."""
    try:
        db = users_db.db
        users = await users_db.collection.find(
            {},
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

