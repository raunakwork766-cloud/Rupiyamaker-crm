"""
EmployeeMonthlyConfig — Per-month salary, monthly_target, settled_target storage.

Collection: employee_monthly_config
Document shape:
  {
    employee_id: str,       # MongoDB _id of the user
    year: int,
    month: int,             # 0-indexed (Jan=0, May=4)
    salary: float | None,
    monthly_target: float | None,
    settled_target: float | None,
    updated_at: str
  }

Rules:
  - When salary/target is changed for month M, store in this collection.
  - When fetching for a given month, use this collection first; fall back to
    the employee's live document value only if no history entry exists.
  - The EARLIEST month for which data is stored acts as the "start month".
    Any month before that is considered "not started yet" — return None.
"""

from typing import Optional, Dict, Any, List
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.utils.timezone import get_ist_now

logger = logging.getLogger(__name__)


class EmployeeMonthlyConfigDB:
    COLLECTION = "employee_monthly_config"

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.col = db[self.COLLECTION]

    async def init_indexes(self):
        try:
            await self.col.create_index(
                [("employee_id", 1), ("year", 1), ("month", 1)], unique=True
            )
            logger.info("✓ EmployeeMonthlyConfig indexes created")
        except Exception as e:
            logger.warning(f"EmployeeMonthlyConfig index warning: {e}")

    # ── Upsert a monthly record ────────────────────────────────────────────────

    async def upsert(self, employee_id: str, year: int, month: int, fields: Dict[str, Any]) -> bool:
        """Set salary/monthly_target/settled_target for a specific month."""
        try:
            fields["updated_at"] = get_ist_now().isoformat()
            await self.col.update_one(
                {"employee_id": employee_id, "year": year, "month": month},
                {"$set": fields},
                upsert=True,
            )
            return True
        except Exception as e:
            logger.error(f"EmployeeMonthlyConfig.upsert: {e}")
            return False

    # ── Get config for a specific month ───────────────────────────────────────

    async def get_for_month(self, employee_id: str, year: int, month: int) -> Optional[Dict[str, Any]]:
        """Return the monthly config for employee in given month, or None."""
        try:
            doc = await self.col.find_one(
                {"employee_id": employee_id, "year": year, "month": month}
            )
            return doc
        except Exception as e:
            logger.error(f"EmployeeMonthlyConfig.get_for_month: {e}")
            return None

    # ── Get the MOST RECENT config at-or-before a month (for inheritance) ─────

    async def get_effective_for_month(self, employee_id: str, year: int, month: int) -> Optional[Dict[str, Any]]:
        """
        Return the most recent monthly config at or before the given month.
        Used to inherit salary/target when no explicit override exists for that month.
        """
        try:
            # Build a comparable integer: year*100 + month  (e.g. 2026*100+4 = 202604)
            target_key = year * 100 + month
            docs = await self.col.find(
                {"employee_id": employee_id}
            ).to_list(length=None)

            candidates = [
                d for d in docs
                if d["year"] * 100 + d["month"] <= target_key
            ]
            if not candidates:
                return None
            # Return the latest one at or before target month
            candidates.sort(key=lambda d: d["year"] * 100 + d["month"], reverse=True)
            return candidates[0]
        except Exception as e:
            logger.error(f"EmployeeMonthlyConfig.get_effective_for_month: {e}")
            return None

    # ── Bulk fetch for multiple employees (for a given month) ─────────────────

    async def get_bulk_for_month(self, employee_ids: List[str], year: int, month: int) -> Dict[str, Dict]:
        """
        Returns { employee_id: config_doc } for all employees in one query.
        Uses effective-at-or-before logic: for each employee returns the latest
        config whose month <= target month.
        """
        try:
            all_docs = await self.col.find(
                {"employee_id": {"$in": employee_ids}}
            ).to_list(length=None)

            target_key = year * 100 + month
            # Group by employee_id, keep only docs at or before target month
            by_emp: Dict[str, list] = {}
            for doc in all_docs:
                eid = doc["employee_id"]
                doc_key = doc["year"] * 100 + doc["month"]
                if doc_key <= target_key:
                    by_emp.setdefault(eid, []).append(doc)

            result = {}
            for eid, docs in by_emp.items():
                docs.sort(key=lambda d: d["year"] * 100 + d["month"], reverse=True)
                result[eid] = docs[0]

            return result
        except Exception as e:
            logger.error(f"EmployeeMonthlyConfig.get_bulk_for_month: {e}")
            return {}

    # ── Get the earliest month for which data exists (= "start month") ────────

    async def get_start_month(self) -> Optional[Dict[str, int]]:
        """Return {year, month} of the globally earliest config entry, or None."""
        try:
            docs = await self.col.find({}).sort(
                [("year", 1), ("month", 1)]
            ).limit(1).to_list(length=1)
            if not docs:
                return None
            return {"year": docs[0]["year"], "month": docs[0]["month"]}
        except Exception as e:
            logger.error(f"EmployeeMonthlyConfig.get_start_month: {e}")
            return None

    # ── List all history for an employee ─────────────────────────────────────

    async def list_history(self, employee_id: str) -> List[Dict[str, Any]]:
        try:
            docs = await self.col.find(
                {"employee_id": employee_id}
            ).sort([("year", 1), ("month", 1)]).to_list(length=None)
            return docs
        except Exception as e:
            logger.error(f"EmployeeMonthlyConfig.list_history: {e}")
            return []
