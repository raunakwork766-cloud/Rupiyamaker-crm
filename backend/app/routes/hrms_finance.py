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

Permission model (mirrors leaves / warnings):
  - Users with finance:all or super-admin see all records.
  - Regular employees see only their own.
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
            if page in ("*", "any"):
                if acts == "*" or (isinstance(acts, list) and "*" in acts):
                    return True

            # finance page
            if isinstance(page, str) and page.lower() in ("finance", "hrms", "hrms_finance"):
                if acts == "*":
                    return True
                if isinstance(acts, list) and any(
                    a in ("*", "all", "view_all", "edit", "finance_admin")
                    for a in acts
                ):
                    return True
                if isinstance(acts, dict) and any(
                    v and k in ("*", "all", "view_all", "edit", "finance_admin")
                    for k, v in acts.items()
                ):
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
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    records = await hrms_db.list_records(
        kind=kind,
        employee_id=current_user_id,
        can_see_all=is_admin,
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
    """List reimbursement claims (all for admins, own for employees)."""
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
    """Create a new deduction. Admins only."""
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
    """Delete a deduction. Admins only."""
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
    """Update a deduction. Admins only."""
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
    Bulk delete records. Admins only.
    Body: { "kind": "reimbursements"|"advance-salary"|"deductions", "ids": ["id1","id2",...] }
    """
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to delete records")
    kind = body.get("kind", "")
    ids  = body.get("ids", [])
    if kind not in ("reimbursements", "advance-salary", "deductions"):
        raise HTTPException(status_code=422, detail="Invalid kind")
    if not ids:
        raise HTTPException(status_code=422, detail="No ids provided")
    deleted = await hrms_db.bulk_delete_records(kind, ids)
    return {"deleted": deleted}


# ── Finance Summary (salary page integration) ─────────────────────────────────

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
    Single endpoint for SalaryManagement.jsx — returns approved reimbursements,
    deductions, and outstanding advances for the given month in one call.
    Admin-only (same permission check as other HRMS endpoints).
    """
    is_admin = await _can_see_all(current_user_id, users_db, roles_db)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Finance summary is admin-only")
    if not (0 <= month <= 11):
        raise HTTPException(status_code=422, detail="month must be 0–11")
    try:
        summary = await hrms_db.get_finance_summary_for_month(year=year, month=month)
        return summary
    except Exception as e:
        logger.error(f"get_finance_summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))
