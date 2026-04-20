"""
Attendance Auto-Absent Scheduler
---------------------------------
Runs three jobs daily (IST):

1.  REPORTING-DEADLINE JOB  (triggers just after reporting_deadline, default 10:20 IST)
    • Finds every active user who has NOT checked in yet today.
    • Creates an absent record (-1) with flag auto_absent_late = True.
    • If the user checks in after this, the check-in updates the record to status 0.5
      (half day) automatically — no separate handling needed.

2.  END-OF-DAY JOB  (triggers just after check_out_end_time, default 20:05 IST)
    • Finds every active user who has checked IN but NOT checked OUT today.
    • Marks their status = -1 (Absent) and sets a comment "Auto-absent: no check-out recorded".
    • Also records that checkout was missed so the UI can signal it.

3.  MIDNIGHT JOB  (triggers at 00:05 IST for the PREVIOUS calendar day)
    • Finds every active user who has NO attendance record at all for yesterday.
    • Skips weekends (from settings) and holidays.
    • Creates an absent record (-1) with comment "Auto-absent: did not check in".
"""

import asyncio
import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any

import pytz

logger = logging.getLogger(__name__)
IST = pytz.timezone("Asia/Kolkata")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _ist_now() -> datetime:
    return datetime.now(IST)


def _seconds_until(target_h: int, target_m: int) -> float:
    """Seconds from now (IST) until the next occurrence of HH:MM IST."""
    now = _ist_now()
    target = now.replace(hour=target_h, minute=target_m, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


async def _is_weekend(d: date, settings: dict) -> bool:
    """Return True if the date's weekday is in the configured weekend_days list."""
    weekend_days = settings.get("weekend_days", [5, 6])  # 5=Sat, 6=Sun by default
    return d.weekday() in weekend_days


async def _is_holiday(d: date) -> bool:
    """Return True if the date is a configured holiday."""
    try:
        from app.database.Holidays import get_holidays_db
        holidays_db = await get_holidays_db()
        return await holidays_db.is_holiday(d.isoformat())
    except Exception as e:
        logger.warning(f"[AutoAbsent] Could not check holidays: {e}")
        return False


async def _get_settings() -> dict:
    try:
        from app.database.Settings import SettingsDB
        s = SettingsDB()
        return await s.get_attendance_settings() or {}
    except Exception as e:
        logger.warning(f"[AutoAbsent] Could not load settings: {e}")
        return {}


async def _get_active_users() -> list:
    try:
        from app.database import get_database_instances
        db = get_database_instances()
        return await db["users"].get_active_users()
    except Exception as e:
        logger.error(f"[AutoAbsent] Could not load active users: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Job 1 – End-of-day: mark absent users who checked in but not out
# ─────────────────────────────────────────────────────────────────────────────

async def run_missing_checkout_job():
    """
    For every user who has a check_in_time but no check_out_time today (end-of-day),
    set status = -1 (ABSENT) and mark auto_absent_no_checkout = True.
    Only processes records not already marked absent (-1) or absconding (-2).

    Rule: Missing check-out → ABSENT (not half day, not absconding directly).
    After 2 consecutive absent days without approved leave or correction,
    run_consecutive_absent_absconding_job() will convert them to ABSCONDING (-2).
    """
    try:
        from app.database.Attendance import AttendanceDB
        from app.database import get_database_instances
        import pytz

        today = datetime.now(IST).date().isoformat()
        logger.info(f"[AutoAbsent] Running missing-checkout job for {today}")

        db = get_database_instances()
        attendance_db: AttendanceDB = db["attendance"]

        # Find all records for today with check_in but no check_out and not already absent/absconding
        cursor = attendance_db.collection.find({
            "date": today,
            "check_in_time": {"$exists": True, "$ne": None, "$ne": ""},
            "$or": [
                {"check_out_time": {"$exists": False}},
                {"check_out_time": None},
                {"check_out_time": ""},
            ],
            "status": {"$nin": [-1, -2]},   # skip already-absent or absconding records
            "auto_absent_no_checkout": {"$ne": True},  # skip already processed
        })

        updated = 0
        async for record in cursor:
            await attendance_db.collection.update_one(
                {"_id": record["_id"]},
                {"$set": {
                    "status": -1,  # ABSENT — will escalate to ABSCONDING after 2 days if uncorrected
                    "auto_absent_no_checkout": True,
                    "comments": "Auto-absent: user missed check-out",
                    "updated_at": datetime.now(IST),
                }}
            )
            updated += 1

        logger.info(f"[AutoAbsent] Missing-checkout job done: {updated} record(s) marked absent.")
    except Exception as e:
        logger.error(f"[AutoAbsent] Error in missing-checkout job: {e}", exc_info=True)


# ─────────────────────────────────────────────────────────────────────────────
# Job 2 – Midnight: mark absent users who never checked in (previous day)
# ─────────────────────────────────────────────────────────────────────────────

async def run_daily_absent_job(target_date: date = None):
    """
    For the given date (default: previous calendar day): find all active users with NO attendance record,
    skip weekends & holidays, then insert absent records.
    """
    try:
        from app.database.Attendance import AttendanceDB
        from app.database import get_database_instances
        from bson import ObjectId

        yesterday = target_date or (datetime.now(IST).date() - timedelta(days=1))
        yesterday_str = yesterday.isoformat()

        settings = await _get_settings()

        # Skip weekends
        if await _is_weekend(yesterday, settings):
            logger.info(f"[AutoAbsent] {yesterday_str} is a weekend — skipping daily-absent job.")
            return

        # Skip holidays
        if await _is_holiday(yesterday):
            logger.info(f"[AutoAbsent] {yesterday_str} is a holiday — skipping daily-absent job.")
            return

        logger.info(f"[AutoAbsent] Running daily-absent job for {yesterday_str}")

        db = get_database_instances()
        attendance_db: AttendanceDB = db["attendance"]

        # Get all active users
        users = await _get_active_users()
        if not users:
            logger.warning("[AutoAbsent] No active users found.")
            return

        # Get all attendance records already existing for yesterday
        existing_cursor = attendance_db.collection.find({"date": yesterday_str})
        existing_user_ids = set()
        async for rec in existing_cursor:
            uid = rec.get("user_id") or rec.get("employee_id")
            if uid:
                existing_user_ids.add(str(uid))

        # For each user without a record, create absent
        inserted = 0
        for user in users:
            uid = str(user.get("_id", ""))
            if not uid or uid in existing_user_ids:
                continue

            # Skip inactive / disabled users
            if user.get("is_disabled") or user.get("employee_status") == "inactive":
                continue

            dept_id = user.get("department_id")
            absent_doc = {
                "user_id": uid,
                "employee_id": user.get("employee_id", ""),
                "employee_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "department_id": str(dept_id) if dept_id else None,
                "department_name": user.get("department_name", ""),
                "date": yesterday_str,
                "status": -1,  # Absent
                "check_in_time": None,
                "check_out_time": None,
                "total_working_hours": 0.0,
                "comments": "Auto-absent: did not check in",
                "auto_absent_no_checkin": True,
                "is_holiday": False,
                "marked_by": "system",
                "marked_at": datetime.now(IST),
                "created_at": datetime.now(IST),
                "updated_at": datetime.now(IST),
            }
            try:
                await attendance_db.collection.update_one(
                    {"user_id": uid, "date": yesterday_str},
                    {"$setOnInsert": absent_doc},
                    upsert=True
                )
                inserted += 1
            except Exception as e:
                logger.warning(f"[AutoAbsent] Could not insert absent for user {uid}: {e}")

        logger.info(f"[AutoAbsent] Daily-absent job done: {inserted} record(s) created.")
    except Exception as e:
        logger.error(f"[AutoAbsent] Error in daily-absent job: {e}", exc_info=True)


# ─────────────────────────────────────────────────────────────────────────────
# Job 0 – Reporting-deadline: mark absent users who haven't checked in yet
# ─────────────────────────────────────────────────────────────────────────────

async def run_reporting_deadline_absent_job():
    """
    Triggered just after reporting_deadline (default 10:15 IST → fires at 10:20).
    For every active user who has NOT checked in today, creates an absent record
    with status = -1 and flag auto_absent_late = True.

    If the user checks in AFTER this job runs, the check-in endpoint will:
      • Find the existing absent record (check_in_time is null)
      • Update it with check-in data and set status = 0.5 (late / half day)
      • Clear the auto_absent_late flag automatically
    """
    try:
        from app.database.Attendance import AttendanceDB
        from app.database import get_database_instances

        ist_today = datetime.now(IST).date()
        today_str = ist_today.isoformat()
        logger.info(f"[AutoAbsent] Running reporting-deadline absent job for {today_str}")

        settings = await _get_settings()

        # Skip weekends
        if await _is_weekend(ist_today, settings):
            logger.info(f"[AutoAbsent] {today_str} is a weekend — skipping reporting-deadline job.")
            return

        # Skip holidays
        if await _is_holiday(ist_today):
            logger.info(f"[AutoAbsent] {today_str} is a holiday — skipping reporting-deadline job.")
            return

        db = get_database_instances()
        attendance_db: AttendanceDB = db["attendance"]

        # Get all active users
        users = await _get_active_users()
        if not users:
            logger.warning("[AutoAbsent] No active users found.")
            return

        # Find users who have ALREADY checked in today
        checked_in_cursor = attendance_db.collection.find(
            {
                "date": today_str,
                "check_in_time": {"$exists": True, "$nin": [None, ""]},
            },
            {"user_id": 1}
        )
        checked_in_ids: set = set()
        async for rec in checked_in_cursor:
            uid = rec.get("user_id") or rec.get("employee_id")
            if uid:
                checked_in_ids.add(str(uid))

        inserted = 0
        for user in users:
            uid = str(user.get("_id", ""))
            if not uid or uid in checked_in_ids:
                continue
            if user.get("is_disabled") or user.get("employee_status") == "inactive":
                continue

            dept_id = user.get("department_id")
            absent_doc = {
                "user_id": uid,
                "employee_id": user.get("employee_id", ""),
                "employee_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "department_id": str(dept_id) if dept_id else None,
                "department_name": user.get("department_name", ""),
                "date": today_str,
                "status": -1,  # Absent
                "check_in_time": None,
                "check_out_time": None,
                "total_working_hours": 0.0,
                "comments": "Auto-absent: did not check in before reporting deadline",
                "auto_absent_late": True,  # Flag: can still check in later (will become half-day)
                "is_holiday": False,
                "marked_by": "system",
                "marked_at": datetime.now(IST),
                "created_at": datetime.now(IST),
                "updated_at": datetime.now(IST),
            }
            try:
                # Only insert if no record already exists for this user today
                await attendance_db.collection.update_one(
                    {"user_id": uid, "date": today_str},
                    {"$setOnInsert": absent_doc},
                    upsert=True
                )
                inserted += 1
            except Exception as e:
                logger.warning(f"[AutoAbsent] Reporting-deadline: could not insert absent for user {uid}: {e}")

        logger.info(f"[AutoAbsent] Reporting-deadline absent job done: {inserted} record(s) created.")
    except Exception as e:
        logger.error(f"[AutoAbsent] Error in reporting-deadline absent job: {e}", exc_info=True)


# ─────────────────────────────────────────────────────────────────────────────
# Scheduler loop
# ─────────────────────────────────────────────────────────────────────────────

_scheduler_running = False


async def _attendance_scheduler_loop():
    """
    Main loop that sleeps until each daily trigger time and fires the job.

    Trigger times (IST):
      • Reporting-deadline job : reporting_deadline + 5 min  (default 10:20)
      • End-of-day job         : check_out_end_time + 5 min  (default 20:05)
      • Midnight job           : 00:05
    """
    global _scheduler_running
    logger.info("[AutoAbsent] Scheduler started.")

    while _scheduler_running:
        try:
            settings = await _get_settings()

            # Parse reporting_deadline from settings (default "10:15")
            rd_str = settings.get("reporting_deadline", "10:15")
            rd_h, rd_m = map(int, rd_str.split(":"))
            rd_trigger_h = rd_h
            rd_trigger_m = rd_m + 5
            if rd_trigger_m >= 60:
                rd_trigger_h += 1
                rd_trigger_m -= 60

            # Parse check_out_end_time from settings (default "20:00")
            eod_str = settings.get("check_out_end_time", "20:00")
            eod_h, eod_m = map(int, eod_str.split(":"))
            eod_trigger_h = eod_h
            eod_trigger_m = eod_m + 5
            if eod_trigger_m >= 60:
                eod_trigger_h += 1
                eod_trigger_m -= 60

            # Determine which job fires next
            secs_map = [
                (_seconds_until(rd_trigger_h, rd_trigger_m), "reporting_deadline"),
                (_seconds_until(eod_trigger_h, eod_trigger_m), "eod_no_checkout"),
                (_seconds_until(0, 5), "midnight_absent"),
            ]
            secs_map.sort(key=lambda x: x[0])
            next_secs, next_job = secs_map[0]

            logger.info(
                f"[AutoAbsent] Next job in {next_secs/60:.1f} min ({next_job})."
            )

            # Sleep in chunks so we can respect stop requests
            elapsed = 0.0
            chunk = 60.0  # 1-minute sleep chunks
            while elapsed < next_secs and _scheduler_running:
                await asyncio.sleep(min(chunk, next_secs - elapsed))
                elapsed += chunk

            if not _scheduler_running:
                break

            if next_job == "reporting_deadline":
                await run_reporting_deadline_absent_job()
            elif next_job == "eod_no_checkout":
                await run_missing_checkout_job()
            else:
                await run_daily_absent_job()
                # After midnight absent job, run the consecutive-absent absconding check
                await run_consecutive_absent_absconding_job()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[AutoAbsent] Scheduler loop error: {e}", exc_info=True)
            await asyncio.sleep(60)

    logger.info("[AutoAbsent] Scheduler stopped.")


# ─────────────────────────────────────────────────────────────────────────────
# Job 3 – Age-based absent → absconding rule
# ─────────────────────────────────────────────────────────────────────────────

async def run_consecutive_absent_absconding_job(check_date: date = None):
    """
    Rule: Any ABSENT (-1) record whose date is at least `threshold` calendar days
    BEFORE today, and has no approved leave and no admin correction, is converted to
    ABSCONDING (-2).

    Example (threshold=2):
      - Absent April 7 → becomes ABSCONDING on April 9 (2 days later) ✓
      - Absent April 8 → still ABSENT on April 9 (only 1 day old, waits until April 10) ✓
      - Absent April 9 (today) → still ABSENT (today not finalised) ✓

    Runs daily at midnight (after the midnight absent job writes new records).
    """
    try:
        from app.database.Attendance import AttendanceDB
        from app.database import get_database_instances

        settings = await _get_settings()

        # Feature flag: default enabled
        if not settings.get("enable_consecutive_absent_absconding", True):
            logger.info("[AutoAbsent] Absent-age absconding rule is disabled — skipping.")
            return

        threshold = int(settings.get("consecutive_absent_absconding_days", 2))
        today_ist = datetime.now(IST).date()
        check_date = check_date or today_ist

        # Cutoff: only absent records STRICTLY older than `threshold` days are eligible
        # e.g. threshold=2: dates <= today-2 (i.e. April 7 when today is April 9)
        cutoff_date = check_date - timedelta(days=threshold)

        logger.info(
            f"[AutoAbsent] Running age-based absconding job "
            f"(threshold={threshold} days, cutoff={cutoff_date}) as of {check_date}"
        )

        db = get_database_instances()
        attendance_db: AttendanceDB = db["attendance"]

        # Pull ALL absent records older than the cutoff (not manually edited)
        cursor = attendance_db.collection.find({
            "date": {"$lte": cutoff_date.isoformat()},
            "status": -1,                      # absent only (not yet absconding)
            "edited_by": {"$exists": False},   # skip manually edited records
        })

        converted_users: set = set()
        converted_records = 0

        async for rec in cursor:
            uid = str(rec.get("user_id") or rec.get("employee_id") or "")
            if not uid:
                continue

            date_str = rec.get("date", "")
            if not date_str:
                continue

            # Check no approved leave for this specific day
            approved = None
            try:
                approved = await check_approved_leave_for_date(uid, date.fromisoformat(date_str))
            except Exception:
                pass

            if approved:
                continue  # Leave covers this absence — skip

            # Convert ABSENT → ABSCONDING
            await attendance_db.collection.update_one(
                {"_id": rec["_id"]},
                {"$set": {
                    "status": -2,
                    "auto_absconding": True,
                    "auto_absconding_reason": (
                        f"Auto-absconding: absent for {threshold}+ days without approved leave"
                    ),
                    "updated_at": datetime.now(IST),
                }}
            )
            converted_records += 1
            converted_users.add(uid)
            logger.info(
                f"[AutoAbsent] User {uid}: {date_str} → absconding "
                f"(absent {(check_date - date.fromisoformat(date_str)).days} days ago)"
            )

        logger.info(
            f"[AutoAbsent] Age-based absconding job done: "
            f"{converted_records} record(s) across {len(converted_users)} employee(s) converted."
        )

    except Exception as e:
        logger.error(f"[AutoAbsent] Error in consecutive-absent absconding job: {e}", exc_info=True)


async def run_historical_absconding_backfill(from_date: date = None, to_date: date = None) -> dict:
    """
    One-time / on-demand backfill: apply the age-based absent→absconding rule
    across ALL historical absent records (or a date range if provided).

    Rule: Any absent record whose date is `threshold` or more calendar days before
    today (or to_date, whichever is earlier) is converted to ABSCONDING, unless
    the employee has an approved leave for that day or the record was manually edited.

    Returns a summary dict with counts.
    """
    try:
        from app.database.Attendance import AttendanceDB
        from app.database import get_database_instances

        settings = await _get_settings()
        threshold = int(settings.get("consecutive_absent_absconding_days", 2))

        db = get_database_instances()
        attendance_db: AttendanceDB = db["attendance"]

        # Always exclude today (and future) — today is not yet finalised.
        today_ist = datetime.now(IST).date()
        # Cutoff: any absent record on or before (today - threshold) is eligible
        cutoff_date = today_ist - timedelta(days=threshold)
        if to_date:
            cutoff_date = min(cutoff_date, to_date)

        query: dict = {
            "status": -1,                      # absent only
            "edited_by": {"$exists": False},   # skip manually edited
            "date": {"$lte": cutoff_date.isoformat()},
        }
        if from_date:
            query["date"]["$gte"] = from_date.isoformat()

        logger.info(
            f"[Backfill] Starting age-based absconding backfill "
            f"(threshold={threshold} days, cutoff={cutoff_date}, from={from_date})"
        )

        cursor = attendance_db.collection.find(query, {"_id": 1, "date": 1, "user_id": 1, "employee_id": 1})

        converted_records = 0
        converted_users: set = set()
        skipped_records = 0

        async for rec in cursor:
            uid = str(rec.get("user_id") or rec.get("employee_id") or "")
            date_str = rec.get("date", "")
            if not uid or not date_str:
                continue

            # Verify no approved leave
            approved = None
            try:
                approved = await check_approved_leave_for_date(uid, date.fromisoformat(date_str))
            except Exception:
                pass

            if approved:
                skipped_records += 1
                continue

            await attendance_db.collection.update_one(
                {"_id": rec["_id"]},
                {"$set": {
                    "status": -2,
                    "auto_absconding": True,
                    "auto_absconding_reason": (
                        f"Backfill: absent {threshold}+ days ago without approved leave"
                    ),
                    "updated_at": datetime.now(IST),
                }}
            )
            converted_records += 1
            converted_users.add(uid)

        summary = {
            "converted_records": converted_records,
            "converted_users": len(converted_users),
            "skipped_records": skipped_records,
            "message": (
                f"Backfill done: {converted_records} record(s) across "
                f"{len(converted_users)} employee(s) converted to absconding."
            ),
        }
        logger.info(f"[Backfill] {summary['message']}")
        return summary

    except Exception as e:
        logger.error(f"[Backfill] Error in historical absconding backfill: {e}", exc_info=True)
        raise


def start_attendance_scheduler():
    """Called from app lifespan to start the scheduler as a background task."""
    global _scheduler_running
    _scheduler_running = True
    return asyncio.create_task(_attendance_scheduler_loop())


def stop_attendance_scheduler():
    """Called from app lifespan shutdown."""
    global _scheduler_running
    _scheduler_running = False
