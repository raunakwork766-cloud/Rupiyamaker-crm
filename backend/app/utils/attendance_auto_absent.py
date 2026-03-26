"""
Attendance Auto-Absent Scheduler
---------------------------------
Runs two jobs daily (IST):

1.  END-OF-DAY JOB  (triggers just after check_out_end_time, default 20:05 IST)
    • Finds every active user who has checked IN but NOT checked OUT today.
    • Marks their status = -1 (Absent) and sets a comment "Auto-absent: no check-out recorded".
    • Also records that checkout was missed so the UI can signal it.

2.  MIDNIGHT JOB  (triggers at 00:05 IST for the PREVIOUS calendar day)
    • Finds every active user who has NO attendance record at all for yesterday.
    • Skips weekends (from settings) and holidays.
    • Creates an absent record (-1) with comment "Auto-absent: did not check in".
"""

import asyncio
import logging
from datetime import datetime, date, timedelta

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
    For every user who has a check_in_time but no check_out_time today,
    set status = -1 (absent) and mark auto_absent_no_checkout = True.
    """
    try:
        from app.database.Attendance import AttendanceDB
        from app.database import get_database_instances
        import pytz

        today = datetime.now(IST).date().isoformat()
        logger.info(f"[AutoAbsent] Running missing-checkout job for {today}")

        db = get_database_instances()
        attendance_db: AttendanceDB = db["attendance"]

        # Find all records for today with check_in but no check_out
        cursor = attendance_db.collection.find({
            "date": today,
            "check_in_time": {"$exists": True, "$ne": None, "$ne": ""},
            "$or": [
                {"check_out_time": {"$exists": False}},
                {"check_out_time": None},
                {"check_out_time": ""},
            ]
        })

        updated = 0
        async for record in cursor:
            # Only update if not already marked absent/override
            if record.get("auto_absent_no_checkout"):
                continue  # already processed
            await attendance_db.collection.update_one(
                {"_id": record["_id"]},
                {"$set": {
                    "status": -1,
                    "auto_absent_no_checkout": True,
                    "comments": "Auto-absent: checked in but did not check out",
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

async def run_daily_absent_job():
    """
    For the previous calendar day: find all active users with NO attendance record,
    skip weekends & holidays, then insert absent records.
    """
    try:
        from app.database.Attendance import AttendanceDB
        from app.database import get_database_instances
        from bson import ObjectId

        yesterday = (datetime.now(IST).date() - timedelta(days=1))
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
# Scheduler loop
# ─────────────────────────────────────────────────────────────────────────────

_scheduler_running = False


async def _attendance_scheduler_loop():
    """
    Main loop that sleeps until each daily trigger time and fires the job.

    Trigger times (IST):
      • End-of-day job : check_out_end_time + 5 min  (default 20:05)
      • Midnight job   : 00:05
    """
    global _scheduler_running
    logger.info("[AutoAbsent] Scheduler started.")

    while _scheduler_running:
        try:
            settings = await _get_settings()

            # Parse check_out_end_time from settings (default "20:00")
            eod_str = settings.get("check_out_end_time", "20:00")
            eod_h, eod_m = map(int, eod_str.split(":"))
            # Fire 5 minutes after shift end
            eod_trigger_h = eod_h
            eod_trigger_m = eod_m + 5
            if eod_trigger_m >= 60:
                eod_trigger_h += 1
                eod_trigger_m -= 60

            # Sleep until whichever comes first: EOD job or midnight job
            secs_eod = _seconds_until(eod_trigger_h, eod_trigger_m)
            secs_midnight = _seconds_until(0, 5)

            next_secs = min(secs_eod, secs_midnight)
            is_eod_next = secs_eod < secs_midnight

            logger.info(
                f"[AutoAbsent] Next job in {next_secs/60:.1f} min "
                f"({'EOD no-checkout' if is_eod_next else 'midnight absent'})."
            )

            # Sleep in chunks so we can respect stop requests
            elapsed = 0.0
            chunk = 60.0  # 1-minute sleep chunks
            while elapsed < next_secs and _scheduler_running:
                await asyncio.sleep(min(chunk, next_secs - elapsed))
                elapsed += chunk

            if not _scheduler_running:
                break

            if is_eod_next:
                await run_missing_checkout_job()
            else:
                await run_daily_absent_job()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[AutoAbsent] Scheduler loop error: {e}", exc_info=True)
            await asyncio.sleep(60)

    logger.info("[AutoAbsent] Scheduler stopped.")


def start_attendance_scheduler():
    """Called from app lifespan to start the scheduler as a background task."""
    global _scheduler_running
    _scheduler_running = True
    return asyncio.create_task(_attendance_scheduler_loop())


def stop_attendance_scheduler():
    """Called from app lifespan shutdown."""
    global _scheduler_running
    _scheduler_running = False
