"""
HRMS Finance Routes

Endpoints for:
  GET  /hrms/reimbursements
  POST /hrms/reimbursements
  PATCH /hrms/reimbursements/{record_id}

  GET  /hrms/advance-salary
  POST /hrms/advance-salary
  PATCH /hrms/advance-salary/{record_id}

  GET  /hrms/deductions
  POST /hrms/deductions
  PATCH /hrms/deductions/{record_id}

  GET  /hrms/salary-holds
  POST /hrms/salary-holds
  PATCH /hrms/salary-holds/{record_id}

Permission model (mirrors leaves / warnings):
  - Finance page users see all records created in the finance module.
  - Only admins can PATCH (approve/reject/paid).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Any, Dict, List, Optional
import logging

from app.database.HrmsFinance import HrmsFinanceDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.utils.common_utils import get_current_user_id
from app.utils.permissions import PermissionManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hrms", tags=["hrms-finance"])

# ── DB dependency ─────────────────────────────────────────────────────────────

_hrms_finance_db: Optional[HrmsFinanceDB] = None


def get_hrms_finance_db() -> HrmsFinanceDB:
    global _hrms_finance_db
    if _hrms_finance_db is None:
        from app.database import get_async_db
        db = get_async_db()
        _hrms_finance_db = HrmsFinanceDB(db)
    return _hrms_finance_db


def get_users_db() -> UsersDB:
    from app.database import get_users_db as _get
    return _get()


def get_roles_db() -> RolesDB:
    from app.database import get_roles_db as _get
    return _get()


# ── Permission helper ─────────────────────────────────────────────────────────
_FINANCE_PAGES = {"finance", "hrms", "hrms_finance", "hr_finance", "employees"}
_FINANCE_ACTIONS = {"*", "all", "view_all", "show", "edit", "manage", "finance_admin", "junior", "view_team"}
_ATTENDANCE_PAGES = {"attendance", "hrms_attendance"}
_ATTENDANCE_SUMMARY_ACTIONS = {"*", "all", "view_all", "edit", "view_salary", "attendance_admin"}


def _normalize_page_name(page: Any) -> str:
    """Normalize permission page keys for stable matching."""
    if not isinstance(page, str):
        return ""
    page = page.strip().lower().replace("-", "_").replace(" ", "_")
    return "_".join(part for part in page.split("_") if part)


def _is_finance_page(page: Any) -> bool:
    """Check if permission page corresponds to finance module."""
    if not isinstance(page, str):
        return False
    normalized = _normalize_page_name(page)
    if normalized in _FINANCE_PAGES:
        return True

    base = normalized.split(".")[0]
    return base in _FINANCE_PAGES


def _actions_match(acts: Any, allowed) -> bool:
    """Check whether stored action payload matches any allowed action."""
    if acts == "*":
        return True

    if isinstance(acts, str):
        return acts.lower() in allowed

    if isinstance(acts, list):
        return any(isinstance(a, str) and a.lower() in allowed for a in acts)

    if isinstance(acts, dict):
        return any(bool(v) and isinstance(k, str) and k.lower() in allowed for k, v in acts.items())

    return False


def _has_any_permission_payload(acts: Any) -> bool:
    """Backward compatible fallback: treat any explicit permission payload as valid access."""
    if acts is None:
        return False
    if acts == "*":
        return True
    if isinstance(acts, str):
        return bool(acts.strip())
    if isinstance(acts, list):
        return any(isinstance(a, str) and bool(a.strip()) for a in acts)
    if isinstance(acts, dict):
        return any(bool(v) for v in acts.values())
    return False


def _is_global_admin(page: str, acts: Any) -> bool:
    """Check for strict super-admin permission."""
    return page in ("*", "any") and _actions_match(acts, frozenset({"*"}))


def _to_float_or_none(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_salary_hold_payload(body: Dict[str, Any], *, creating: bool) -> None:
    """Normalize partial salary hold fields in-place."""
    hold_type = str(body.get("hold_type") or "").strip().lower()
    if not hold_type:
        if body.get("hold_percentage") not in (None, ""):
            hold_type = "percentage"
        elif body.get("hold_amount") not in (None, "") or body.get("salary_amount") not in (None, ""):
            hold_type = "amount"
        elif creating:
            hold_type = "full"
        else:
            return

    if hold_type in {"percent", "percentage"}:
        pct = _to_float_or_none(body.get("hold_percentage"))
        if pct is None or pct <= 0 or pct > 100:
            raise HTTPException(status_code=422, detail="hold_percentage must be between 0 and 100")
        body["hold_type"] = "percentage"
        body["hold_percentage"] = pct
        body.pop("hold_amount", None)
        body.pop("salary_amount", None)
        return

    if hold_type == "amount":
        amount = _to_float_or_none(body.get("hold_amount"))
        if amount is None:
            amount = _to_float_or_none(body.get("salary_amount"))
        if amount is None or amount <= 0:
            raise HTTPException(status_code=422, detail="hold_amount must be greater than zero")
        body["hold_type"] = "amount"
        body["hold_amount"] = amount
        body["salary_amount"] = amount
        body.pop("hold_percentage", None)
        return

    if hold_type == "full":
        body["hold_type"] = "full"
        body.pop("hold_percentage", None)
        return

    raise HTTPException(status_code=422, detail="hold_type must be percentage, amount, or full")


async def _can_see_all(
    user_id: str,
    users_db: UsersDB,
    roles_db: RolesDB,
) -> bool:
    """Returns True if the user is super-admin or has finance:all / finance:view_all."""
    try:
        user = await users_db.get_user(user_id)
        if not user:
            return False
        if user.get("is_super_admin"):
            return True

        permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        for perm in permissions:
            page = perm.get("page", "")
            acts = perm.get("actions")

            # Super-admin wildcard
            if _is_global_admin(page, acts):
                return True

            # finance page
            if _is_finance_page(page):
                if _actions_match(acts, _FINANCE_ACTIONS) or _has_any_permission_payload(acts):
                    return True

        return False
    except Exception as e:
        logger.warning(f"_can_see_all({user_id}): {e}")
        return False


# ── Generic GET list ──────────────────────────────────────────────────────────

async def _list(
    kind: str,
    user_id: str,
    current_user_id: str,
    hrms_db: HrmsFinanceDB,
    users_db: UsersDB,
    roles_db: RolesDB,
) -> List[Dict[str, Any]]:
    if not await _can_see_all(current_user_id, users_db, roles_db):
        raise HTTPException(status_code=403, detail="Finance access required")

    # Finance page requirement: records created by any user must be visible
    # to every user who can access this module. Keep create/update/delete
    # permission checks separate, but do not scope list results by creator.
    records = await hrms_db.list_records(
        kind=kind,
        employee_id=None,
        can_see_all=True,
    )
    return records


# ── Reimbursements ────────────────────────────────────────────────────────────

@router.get("/reimbursements")
async def list_reimbursements(
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """List reimbursement claims for all finance users."""
    try:
        records = await _list("reimbursements", user_id, current_user_id, hrms_db, users_db, roles_db)
        return records
    except Exception as e:
        logger.error(f"list_reimbursements: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reimbursements")
async def create_reimbursement(
    body: Dict[str, Any],
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Create a new reimbursement claim."""
    try:
        is_admin = await _can_see_all(current_user_id, users_db, roles_db)
        if not is_admin:
            # Force employee_id to the caller
            body["employee_id"] = current_user_id
        body.setdefault("employee_id", current_user_id)
        body.setdefault("status", "pending")
        record_id = await hrms_db.create_record("reimbursements", body)
        record = await hrms_db.get_record("reimbursements", record_id)
        return record or {"_id": record_id, **body}
    except Exception as e:
        logger.error(f"create_reimbursement: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/reimbursements/{record_id}")
async def delete_reimbursement(
    record_id: str,
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Delete a reimbursement. Admins only."""
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to delete reimbursements")
    ok = await hrms_db.delete_record("reimbursements", record_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"success": True}


@router.patch("/reimbursements/{record_id}")
async def patch_reimbursement(
    record_id: str,
    body: Dict[str, Any],
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Update reimbursement status (approve/reject/paid). Admins only."""
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to update reimbursements")
    ok = await hrms_db.patch_record("reimbursements", record_id, body)
    if not ok:
        raise HTTPException(status_code=404, detail="Record not found")
    record = await hrms_db.get_record("reimbursements", record_id)
    return record or {"_id": record_id}


# ── Advance Salary ────────────────────────────────────────────────────────────

@router.get("/advance-salary")
async def list_advance_salary(
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """List advance salary requests."""
    try:
        records = await _list("advance-salary", user_id, current_user_id, hrms_db, users_db, roles_db)
        return records
    except Exception as e:
        logger.error(f"list_advance_salary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/advance-salary")
async def create_advance_salary(
    body: Dict[str, Any],
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Create a new advance salary request."""
    try:
        is_admin = await _can_see_all(current_user_id, users_db, roles_db)
        if not is_admin:
            body["employee_id"] = current_user_id
        body.setdefault("employee_id", current_user_id)
        body.setdefault("status", "pending")
        body.setdefault("paid_amount", 0)
        record_id = await hrms_db.create_record("advance-salary", body)
        record = await hrms_db.get_record("advance-salary", record_id)
        return record or {"_id": record_id, **body}
    except Exception as e:
        logger.error(f"create_advance_salary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/advance-salary/{record_id}")
async def delete_advance_salary(
    record_id: str,
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Delete an advance salary record. Admins only."""
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to delete advance salary records")
    ok = await hrms_db.delete_record("advance-salary", record_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"success": True}


@router.patch("/advance-salary/{record_id}")
async def patch_advance_salary(
    record_id: str,
    body: Dict[str, Any],
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Update advance salary status. Admins only."""
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to update advance salary records")
    ok = await hrms_db.patch_record("advance-salary", record_id, body)
    if not ok:
        raise HTTPException(status_code=404, detail="Record not found")
    record = await hrms_db.get_record("advance-salary", record_id)
    return record or {"_id": record_id}


# ── Deductions ────────────────────────────────────────────────────────────────

@router.get("/deductions")
async def list_deductions(
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """List deductions."""
    try:
        records = await _list("deductions", user_id, current_user_id, hrms_db, users_db, roles_db)
        return records
    except Exception as e:
        logger.error(f"list_deductions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deductions")
async def create_deduction(
    body: Dict[str, Any],
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Create a new deduction."""
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to create deductions")
    body.setdefault("status", "approved")
    record_id = await hrms_db.create_record("deductions", body)
    record = await hrms_db.get_record("deductions", record_id)
    return record or {"_id": record_id, **body}


@router.delete("/deductions/{record_id}")
async def delete_deduction(
    record_id: str,
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Delete a deduction."""
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to delete deductions")
    ok = await hrms_db.delete_record("deductions", record_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"success": True}


@router.patch("/deductions/{record_id}")
async def patch_deduction(
    record_id: str,
    body: Dict[str, Any],
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Update a deduction."""
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to update deductions")
    ok = await hrms_db.patch_record("deductions", record_id, body)
    if not ok:
        raise HTTPException(status_code=404, detail="Record not found")
    record = await hrms_db.get_record("deductions", record_id)
    return record or {"_id": record_id}


# ── Bulk Delete ───────────────────────────────────────────────────────────────

@router.post("/bulk-delete")
async def bulk_delete(
    body: Dict[str, Any],
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """
    Bulk delete records.
    Body: { "kind": "reimbursements"|"advance-salary"|"deductions"|"salary-holds", "ids": ["id1","id2",...] }
    """
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to delete records")
    kind = body.get("kind", "")
    ids  = body.get("ids", [])
    if kind not in ("reimbursements", "advance-salary", "deductions", "salary-holds"):
        raise HTTPException(status_code=422, detail="Invalid kind")
    if not ids:
        raise HTTPException(status_code=422, detail="No ids provided")
    deleted = await hrms_db.bulk_delete_records(kind, ids)
    return {"deleted": deleted}


# ── Salary Holds ──────────────────────────────────────────────────────────────

@router.get("/salary-holds")
async def list_salary_holds(
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """List salary holds for all finance users."""
    try:
        records = await _list("salary-holds", user_id, current_user_id, hrms_db, users_db, roles_db)
        return records
    except Exception as e:
        logger.error(f"list_salary_holds: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/salary-holds")
async def create_salary_hold(
    body: Dict[str, Any],
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Hold an employee's salary for a specific month."""
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to hold salaries")

    employee_id = body.get("employee_id")
    year = body.get("year")
    month = body.get("month")
    if not employee_id or year is None or month is None:
        raise HTTPException(status_code=422, detail="employee_id, year, month required")
    if not (0 <= int(month) <= 11):
        raise HTTPException(status_code=422, detail="month must be 0–11")

    body["year"] = int(year)
    body["month"] = int(month)
    _normalize_salary_hold_payload(body, creating=True)
    body.setdefault("status", "held")
    body.setdefault("held_by", current_user_id)
    body.setdefault("held_at", body.get("created_at"))
    record_id = await hrms_db.create_record("salary-holds", body)
    record = await hrms_db.get_record("salary-holds", record_id)
    return record or {"_id": record_id, **body}


@router.patch("/salary-holds/{record_id}")
async def patch_salary_hold(
    record_id: str,
    body: Dict[str, Any],
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Update/release a salary hold."""
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to update salary holds")
    if body.get("status") == "released":
        body.setdefault("released_by", current_user_id)
        body.setdefault("released_at", body.get("actioned_at"))
    if any(k in body for k in ("hold_type", "hold_percentage", "hold_amount", "salary_amount")):
        _normalize_salary_hold_payload(body, creating=False)
    ok = await hrms_db.patch_record("salary-holds", record_id, body)
    if not ok:
        raise HTTPException(status_code=404, detail="Record not found")
    record = await hrms_db.get_record("salary-holds", record_id)
    return record or {"_id": record_id}


@router.delete("/salary-holds/{record_id}")
async def delete_salary_hold(
    record_id: str,
    user_id: str = Query(..., description="Current user ID"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Delete a salary hold."""
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to delete salary holds")
    ok = await hrms_db.delete_record("salary-holds", record_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"success": True}


# ── Finance Summary (salary page + attendance page integration) ───────────────

async def _can_view_finance_summary(
    user_id: str,
    users_db: UsersDB,
    roles_db: RolesDB,
) -> bool:
    """
    Returns True if the user can view finance summary data.
    Allowed for:
    - Super-admins
    - Users with finance:all / finance:view_all
    - Users with attendance:view_all / attendance:edit (salary column visible)
    """
    try:
        user = await users_db.get_user(user_id)
        if not user:
            return False
        if user.get("is_super_admin"):
            return True

        permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        for perm in permissions:
            page = perm.get("page", "")
            acts = perm.get("actions")

            # Super-admin wildcard
            if _is_global_admin(page, acts):
                return True

            # Finance page access
            if _is_finance_page(page):
                if _actions_match(acts, _FINANCE_ACTIONS) or _has_any_permission_payload(acts):
                    return True

            # Attendance page — users who can see salary column can also see finance deductions
            page_norm = _normalize_page_name(page).split(".")[0]
            if page_norm in _ATTENDANCE_PAGES:
                if _actions_match(acts, _ATTENDANCE_SUMMARY_ACTIONS):
                    return True

        return False
    except Exception as e:
        logger.warning(f"_can_view_finance_summary({user_id}): {e}")
        return False


@router.get("/finance-summary")
async def get_finance_summary(
    user_id: str = Query(..., description="Current user ID"),
    year: int = Query(..., description="Year (e.g. 2026)"),
    month: int = Query(..., description="Month 0-indexed (0=Jan, 11=Dec)"),
    current_user_id: str = Depends(get_current_user_id),
    hrms_db: HrmsFinanceDB = Depends(get_hrms_finance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """
    Returns approved reimbursements, deductions, and outstanding advances for
    the given month. Used by SalaryManagement.jsx and AttendancePage.jsx.
    Accessible to finance admins AND attendance admins (salary-view permission).
    """
    can_view = await _can_view_finance_summary(current_user_id, users_db, roles_db)
    if not can_view:
        raise HTTPException(status_code=403, detail="Finance summary requires finance or attendance admin access")
    if not (0 <= month <= 11):
        raise HTTPException(status_code=422, detail="month must be 0–11")
    try:
        summary = await hrms_db.get_finance_summary_for_month(year=year, month=month)
        return summary
    except Exception as e:
        logger.error(f"get_finance_summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))
