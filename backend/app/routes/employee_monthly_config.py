"""
Employee Monthly Config Routes

GET  /employee-monthly-config/bulk?year=&month=&employee_ids=id1,id2,...
     → { employee_id: { salary, monthly_target, settled_target } }

POST /employee-monthly-config/upsert
     Body: { employee_id, year, month, salary?, monthly_target?, settled_target? }

GET  /employee-monthly-config/start-month
     → { year, month } or null — earliest month with any data

GET  /employee-monthly-config/{employee_id}/history
     → list of all per-month records for this employee
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Any, Dict, List, Optional
import logging

from app.database.EmployeeMonthlyConfig import EmployeeMonthlyConfigDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.utils.permissions import PermissionManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/employee-monthly-config", tags=["employee-monthly-config"])

# ── DB singletons ──────────────────────────────────────────────────────────────

_monthly_config_db: Optional[EmployeeMonthlyConfigDB] = None

def get_monthly_config_db() -> EmployeeMonthlyConfigDB:
    global _monthly_config_db
    if _monthly_config_db is None:
        from app.database import get_async_db
        _monthly_config_db = EmployeeMonthlyConfigDB(get_async_db())
    return _monthly_config_db

def get_users_db() -> UsersDB:
    from app.database import get_users_db as _get
    return _get()

def get_roles_db() -> RolesDB:
    from app.database import get_roles_db as _get
    return _get()

# ── Permission helper ──────────────────────────────────────────────────────────

async def _is_admin(user_id: str, users_db: UsersDB, roles_db: RolesDB) -> bool:
    try:
        user = await users_db.get_user(user_id)
        if not user:
            return False
        if user.get("is_super_admin"):
            return True
        perms = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        for p in perms:
            page = p.get("page", "")
            acts = p.get("actions")
            if page in ("*", "any"):
                return True
            if page in ("employees", "hrms", "salary"):
                if acts == "*" or (isinstance(acts, list) and "*" in acts):
                    return True
        return False
    except Exception:
        return False


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/start-month")
async def get_start_month(
    user_id: str = Query(...),
    db: EmployeeMonthlyConfigDB = Depends(get_monthly_config_db),
):
    """Return the earliest month/year for which any salary data was configured."""
    result = await db.get_start_month()
    return {"data": result}


@router.get("/bulk")
async def get_bulk_for_month(
    year: int = Query(...),
    month: int = Query(...),  # 0-indexed
    employee_ids: str = Query(..., description="Comma-separated list of employee _id values"),
    user_id: str = Query(...),
    db: EmployeeMonthlyConfigDB = Depends(get_monthly_config_db),
):
    """
    Return effective salary/target config for a list of employees for the given month.
    Uses "at-or-before" logic — inherits most recent config if no exact match.
    """
    ids = [i.strip() for i in employee_ids.split(",") if i.strip()]
    configs = await db.get_bulk_for_month(ids, year, month)
    # Serialize: remove MongoDB _id
    clean = {}
    for eid, doc in configs.items():
        clean[eid] = {
            "salary": doc.get("salary"),
            "monthly_target": doc.get("monthly_target"),
            "settled_target": doc.get("settled_target"),
            "carry_forward_shortfall": doc.get("carry_forward_shortfall", 0),
            "year": doc.get("year"),
            "month": doc.get("month"),
        }
    return {"data": clean}


@router.post("/upsert")
async def upsert_monthly_config(
    body: Dict[str, Any],
    user_id: str = Query(...),
    db: EmployeeMonthlyConfigDB = Depends(get_monthly_config_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """
    Set salary/monthly_target/settled_target for a specific employee-month.
    Only admins can set salary/monthly_target. Any user can set their own settled_target.
    """
    employee_id = body.get("employee_id")
    year = body.get("year")
    month = body.get("month")  # 0-indexed

    if not employee_id or year is None or month is None:
        raise HTTPException(status_code=422, detail="employee_id, year, month required")

    # Check if caller is admin or updating their own settled_target only
    is_adm = await _is_admin(user_id, users_db, roles_db)
    updating_salary_or_target = "salary" in body or "monthly_target" in body
    if updating_salary_or_target and not is_adm:
        raise HTTPException(status_code=403, detail="Only admins can update salary/monthly_target")

    fields: Dict[str, Any] = {}
    if "salary" in body and body["salary"] is not None:
        fields["salary"] = float(body["salary"])
    if "monthly_target" in body and body["monthly_target"] is not None:
        fields["monthly_target"] = float(body["monthly_target"])
    if "settled_target" in body and body["settled_target"] is not None:
        fields["settled_target"] = float(body["settled_target"])

    if not fields:
        raise HTTPException(status_code=422, detail="No fields to update")

    ok = await db.upsert(employee_id, int(year), int(month), fields)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save monthly config")

    return {"success": True, "employee_id": employee_id, "year": year, "month": month, "updated": list(fields.keys())}


@router.get("/{employee_id}/history")
async def get_employee_history(
    employee_id: str,
    user_id: str = Query(...),
    db: EmployeeMonthlyConfigDB = Depends(get_monthly_config_db),
):
    """Return all per-month config records for a given employee."""
    docs = await db.list_history(employee_id)
    clean = []
    for d in docs:
        clean.append({
            "year": d.get("year"),
            "month": d.get("month"),
            "salary": d.get("salary"),
            "monthly_target": d.get("monthly_target"),
            "settled_target": d.get("settled_target"),
            "updated_at": d.get("updated_at"),
        })
    return {"data": clean}


@router.post("/migrate-from-employee-docs")
async def migrate_from_employee_docs(
    body: Dict[str, Any],
    user_id: str = Query(...),
    db: EmployeeMonthlyConfigDB = Depends(get_monthly_config_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """
    One-time migration: copy settled_target (and optionally salary/monthly_target)
    from employee documents into the per-month config for a given month.
    Only inserts if no per-month record already exists for that employee-month.

    Body: { year: int, month: int, employees: [{employee_id, settled_target, salary?, monthly_target?}] }
    """
    is_adm = await _is_admin(user_id, users_db, roles_db)
    if not is_adm:
        raise HTTPException(status_code=403, detail="Admins only")

    year = body.get("year")
    month = body.get("month")
    employees = body.get("employees", [])

    if year is None or month is None:
        raise HTTPException(status_code=422, detail="year and month required")

    migrated = 0
    skipped = 0
    for emp in employees:
        employee_id = emp.get("employee_id")
        if not employee_id:
            continue
        # Only insert if no record already exists for this month
        existing = await db.get_for_month(employee_id, int(year), int(month))
        if existing:
            skipped += 1
            continue
        fields = {}
        if emp.get("settled_target") is not None:
            fields["settled_target"] = float(emp["settled_target"])
        if emp.get("salary") is not None:
            fields["salary"] = float(emp["salary"])
        if emp.get("monthly_target") is not None:
            fields["monthly_target"] = float(emp["monthly_target"])
        if not fields:
            skipped += 1
            continue
        await db.upsert(employee_id, int(year), int(month), fields)
        migrated += 1

    return {"success": True, "migrated": migrated, "skipped": skipped}
