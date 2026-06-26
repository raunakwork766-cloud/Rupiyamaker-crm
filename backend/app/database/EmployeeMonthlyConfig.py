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
    carry_forward_shortfall: float | None,  # derived when reading, not stored
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

    @staticmethod
    def _month_key(year: int, month: int) -> int:
        return year * 100 + month

    @staticmethod
    def _previous_month(year: int, month: int) -> tuple[int, int]:
        if month == 0:
            return year - 1, 11
        return year, month - 1

    def _effective_field_at_key(self, docs: List[Dict[str, Any]], field: str, key: int) -> Optional[float]:
        candidates = [
            d for d in docs
            if self._month_key(int(d.get("year", 0)), int(d.get("month", 0))) <= key
            and d.get(field) is not None
        ]
        if not candidates:
            return None
        candidates.sort(key=lambda d: self._month_key(int(d["year"]), int(d["month"])), reverse=True)
        try:
            return float(candidates[0].get(field))
        except (TypeError, ValueError):
            return None

    def _carry_forward_shortfall(self, docs: List[Dict[str, Any]], year: int, month: int) -> float:
        """
        Compute shortfall carried into year/month from closed previous months.
        A month is considered closed only when it has an exact settled_target.
        This avoids generating shortfall for months that were never filled in.
        """
        if not docs:
            return 0.0

        prev_year, prev_month = self._previous_month(year, month)
        prev_key = self._month_key(prev_year, prev_month)
        exact_by_key = {
            self._month_key(int(d.get("year", 0)), int(d.get("month", 0))): d
            for d in docs
        }

        carry = 0.0
        for key in sorted(k for k in exact_by_key.keys() if k <= prev_key):
            doc = exact_by_key[key]
            if doc.get("settled_target") is None:
                continue
            base_target = self._effective_field_at_key(docs, "monthly_target", key) or 0.0
            try:
                achieved = float(doc.get("settled_target") or 0)
            except (TypeError, ValueError):
                achieved = 0.0
            carry = max(0.0, base_target + carry - achieved)
        return carry

    async def get_bulk_for_month(self, employee_ids: List[str], year: int, month: int) -> Dict[str, Dict]:
        """
        Returns { employee_id: config_doc } for all employees in one query.
        Salary/monthly_target inherit from the latest config at or before the
        target month. settled_target is exact-month only because it represents
        the employee's achieved target for that month.
        """
        try:
            all_docs = await self.col.find(
                {"employee_id": {"$in": employee_ids}}
            ).to_list(length=None)

            target_key = self._month_key(year, month)
            # Group by employee_id, keeping history for salary/target inheritance
            # and exact-month entries for achieved target.
            by_emp: Dict[str, list] = {}
            exact_by_emp: Dict[str, Dict[str, Any]] = {}
            for doc in all_docs:
                eid = doc["employee_id"]
                doc_key = self._month_key(doc["year"], doc["month"])
                if doc.get("year") == year and doc.get("month") == month:
                    exact_by_emp[eid] = doc
                if doc_key <= target_key:
                    by_emp.setdefault(eid, []).append(doc)

            result = {}
            for eid in set(by_emp.keys()) | set(exact_by_emp.keys()):
                docs = by_emp.get(eid, [])
                docs.sort(key=lambda d: self._month_key(d["year"], d["month"]), reverse=True)
                inherited_values: Dict[str, Any] = {}
                inherited_sources: Dict[str, Any] = {}
                for doc in docs:
                    for field in ("salary", "monthly_target"):
                        if field not in inherited_values and doc.get(field) is not None:
                            inherited_values[field] = doc.get(field)
                            inherited_sources[f"{field}_source_year"] = doc.get("year")
                            inherited_sources[f"{field}_source_month"] = doc.get("month")
                exact_doc = exact_by_emp.get(eid)
                result[eid] = {
                    "employee_id": eid,
                    "year": year,
                    "month": month,
                    "salary": inherited_values.get("salary"),
                    "monthly_target": inherited_values.get("monthly_target"),
                    "settled_target": exact_doc.get("settled_target") if exact_doc else None,
                    "carry_forward_shortfall": self._carry_forward_shortfall(
                        by_emp.get(eid, []),
                        year,
                        month,
                    ),
                    "salary_source_year": inherited_sources.get("salary_source_year"),
                    "salary_source_month": inherited_sources.get("salary_source_month"),
                    "monthly_target_source_year": inherited_sources.get("monthly_target_source_year"),
                    "monthly_target_source_month": inherited_sources.get("monthly_target_source_month"),
                    "settled_source_year": exact_doc.get("year") if exact_doc else None,
                    "settled_source_month": exact_doc.get("month") if exact_doc else None,
                }

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
