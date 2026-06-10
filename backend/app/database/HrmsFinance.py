"""
HRMS Finance database collections.

Handles three separate MongoDB collections:
  - hrms_reimbursements
  - hrms_advance_salary
  - hrms_deductions

Each document shape follows the frontend's FinanceManagement.jsx schema.
"""

from bson import ObjectId
from typing import List, Dict, Any, Optional
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.utils.timezone import get_ist_now
from app.config import Config

logger = logging.getLogger(__name__)


def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert ObjectId _id to string."""
    if not doc:
        return doc
    doc["_id"] = str(doc["_id"])
    return doc


class HrmsFinanceDB:
    def __init__(self, db: AsyncIOMotorDatabase = None):
        if db is None:
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db

        self.reimbursements = self.db["hrms_reimbursements"]
        self.advance_salary = self.db["hrms_advance_salary"]
        self.deductions     = self.db["hrms_deductions"]

    async def init_indexes(self):
        try:
            await self.reimbursements.create_index("employee_id")
            await self.reimbursements.create_index("status")
            await self.reimbursements.create_index([("created_at", -1)])

            await self.advance_salary.create_index("employee_id")
            await self.advance_salary.create_index("status")
            await self.advance_salary.create_index([("created_at", -1)])

            await self.deductions.create_index("employee_id")
            await self.deductions.create_index([("created_at", -1)])

            logger.info("✓ HrmsFinance indexes created")
        except Exception as e:
            logger.warning(f"HrmsFinance index creation warning: {e}")

    # ── Generic helpers ───────────────────────────────────────────────

    def _col(self, kind: str):
        """Return the Motor collection for 'reimbursements', 'advance-salary', or 'deductions'."""
        if kind == "advance-salary":
            return self.advance_salary
        if kind == "deductions":
            return self.deductions
        return self.reimbursements

    # ── List ──────────────────────────────────────────────────────────

    async def list_records(
        self,
        kind: str,
        employee_id: Optional[str] = None,
        can_see_all: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        List records for a collection.
        - Admins (can_see_all=True) see everything.
        - Regular employees see only their own records.
        """
        col = self._col(kind)
        query: Dict[str, Any] = {}
        if not can_see_all and employee_id:
            query["employee_id"] = employee_id

        cursor = col.find(query).sort("created_at", -1)
        docs = await cursor.to_list(length=None)
        return [_serialize(d) for d in docs]

    # ── Create ────────────────────────────────────────────────────────

    async def create_record(self, kind: str, data: Dict[str, Any]) -> str:
        col = self._col(kind)
        now = get_ist_now()
        # Remove any frontend-generated _id so MongoDB assigns its own
        data.pop("_id", None)
        data.setdefault("created_at", now.isoformat())
        data.setdefault("updated_at", now.isoformat())
        result = await col.insert_one(data)
        return str(result.inserted_id)

    # ── Patch (status update) ─────────────────────────────────────────

    async def patch_record(self, kind: str, record_id: str, patch: Dict[str, Any]) -> bool:
        col = self._col(kind)
        patch["updated_at"] = get_ist_now().isoformat()
        try:
            result = await col.update_one(
                {"_id": ObjectId(record_id)},
                {"$set": patch},
            )
            return result.matched_count > 0
        except Exception as e:
            logger.error(f"patch_record({kind}, {record_id}): {e}")
            return False

    # ── Delete ────────────────────────────────────────────────────────────────

    async def delete_record(self, kind: str, record_id: str) -> bool:
        col = self._col(kind)
        try:
            result = await col.delete_one({"_id": ObjectId(record_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"delete_record({kind}, {record_id}): {e}")
            return False

    async def bulk_delete_records(self, kind: str, record_ids: List[str]) -> int:
        """Delete multiple records. Returns count of deleted documents."""
        col = self._col(kind)
        try:
            oids = [ObjectId(rid) for rid in record_ids if rid]
            if not oids:
                return 0
            result = await col.delete_many({"_id": {"$in": oids}})
            return result.deleted_count
        except Exception as e:
            logger.error(f"bulk_delete_records({kind}): {e}")
            return 0

    # ── Get single ────────────────────────────────────────────────────

    async def get_record(self, kind: str, record_id: str) -> Optional[Dict[str, Any]]:
        col = self._col(kind)
        try:
            doc = await col.find_one({"_id": ObjectId(record_id)})
            return _serialize(doc) if doc else None
        except Exception:
            return None

    # ── Finance summary (per-employee, per-month) for salary page ─────────────

    async def get_finance_summary_for_month(
        self,
        year: int,
        month: int,  # 0-indexed (January = 0) — matches JS Date.getMonth()
    ) -> Dict[str, Any]:
        """
        Returns all approved/paid reimbursements, approved deductions, and all
        approved advance records for a given calendar month.
        Used by SalaryManagement.jsx to auto-apply finance data into salary calc.
        month is 0-indexed to match JavaScript's Date.getMonth().
        """
        import calendar as _calendar
        from datetime import datetime as _dt

        m1 = month + 1  # convert to 1-indexed for datetime
        days_in_month = _calendar.monthrange(year, m1)[1]

        # ISO date range boundaries (string comparison works because ISO format is lexicographic)
        start_str = f"{year}-{str(m1).zfill(2)}-01"
        end_str   = f"{year}-{str(m1).zfill(2)}-{str(days_in_month).zfill(2)}"

        def _in_month(doc):
            """Check if doc falls within the target month.
            Primary: use explicit month/year integer fields (new records).
            Fallback: parse date or created_at string (legacy records).
            """
            # Primary: explicit month/year fields (0-indexed month, same as JS)
            doc_month = doc.get("month")
            doc_year  = doc.get("year")
            if doc_month is not None and doc_year is not None:
                return int(doc_year) == year and int(doc_month) == month

            # Fallback: string date comparison
            for field in ("date", "created_at"):
                val = doc.get(field)
                if val and isinstance(val, str):
                    day = val[:10]  # "YYYY-MM-DD"
                    if start_str <= day <= end_str:
                        return True
            return False

        # ── Reimbursements: approved or paid this month ───────────────────────
        reimb_docs = await self.reimbursements.find(
            {"status": {"$in": ["approved", "paid"]}}
        ).to_list(length=None)
        reimbs = [_serialize(d) for d in reimb_docs if _in_month(d)]

        # ── Deductions: approved this month ──────────────────────────────────
        ded_docs = await self.deductions.find(
            {"status": "approved"}
        ).to_list(length=None)
        deds = [_serialize(d) for d in ded_docs if _in_month(d)]

        # ── Advances: all approved (full list — balance computed frontend-side) ─
        adv_docs = await self.advance_salary.find(
            {"status": "approved"}
        ).to_list(length=None)
        advances = [_serialize(d) for d in adv_docs]

        return {
            "reimbursements": reimbs,
            "deductions": deds,
            "advances": advances,
        }
