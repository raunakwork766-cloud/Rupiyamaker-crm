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
    For every user who has a check_in_time but no check_out_time today,
    set status = -1 (absent) and mark auto_absent_no_checkout = True.
    Only processes records not already marked absent (-1).
    """
    try:
        from app.database.Attendance import AttendanceDB
        from app.database import get_database_instances
        import pytz

        today = datetime.now(IST).date().isoformat()
        logger.info(f"[AutoAbsent] Running missing-checkout job for {today}")

        db = get_database_instances()
        attendance_db: AttendanceDB = db["attendance"]

        # Find all records for today with check_in but no check_out and not already absent
        cursor = attendance_db.collection.find({
            "date": today,
            "check_in_time": {"$exists": True, "$ne": None, "$ne": ""},
            "$or": [
                {"check_out_time": {"$exists": False}},
                {"check_out_time": None},
                {"check_out_time": ""},
            ],
            "status": {"$ne": -1},   # skip already-absent records
            "auto_absent_no_checkout": {"$ne": True},  # skip already processed
        })

        updated = 0
        async for record in cursor:
            await attendance_db.collection.update_one(
                {"_id": record["_id"]},
                {"$set": {
                    "status": -1,
                    "auto_absent_no_checkout": True,
                    "comments": "Auto-absent: checked in but did not check out before working hours ended",
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
                # After midnight absent job, run the consecutive-absent absconding check
                await run_consecutive_absent_absconding_job()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[AutoAbsent] Scheduler loop error: {e}", exc_info=True)
            await asyncio.sleep(60)

    logger.info("[AutoAbsent] Scheduler stopped.")


# ─────────────────────────────────────────────────────────────────────────────
# Job 3 – Consecutive-absent absconding rule
# ─────────────────────────────────────────────────────────────────────────────

async def run_consecutive_absent_absconding_job(check_date: date = None):
    """
    Rule: If an employee has 3+ consecutive absent days (Mon–Sat, ignoring Sundays)
    **without** an approved leave for any of those days, convert ALL those absent
    records to Absconding (status = -2).

    Runs daily (triggered after the midnight absent job, so new absences are already
    written). Looks back up to 14 days to catch streaks.
    """
    try:
        from app.database.Attendance import AttendanceDB
        from app.database import get_database_instances

        settings = await _get_settings()

        # Feature flag: default enabled
        if not settings.get("enable_consecutive_absent_absconding", True):
            logger.info("[AutoAbsent] Consecutive-absent absconding rule is disabled — skipping.")
            return

        threshold = int(settings.get("consecutive_absent_absconding_days", 3))
        check_date = check_date or datetime.now(IST).date()

        logger.info(f"[AutoAbsent] Running consecutive-absent absconding job (threshold={threshold}) as of {check_date}")

        db = get_database_instances()
        attendance_db: AttendanceDB = db["attendance"]

        # Look back enough days to include the full streak window
        lookback_days = max(threshold + 4, 14)
        start_date = check_date - timedelta(days=lookback_days)

        # Fetch all absent / absconding records in the window (Mon–Sat only)
        working_dates = [
            start_date + timedelta(days=i)
            for i in range((check_date - start_date).days + 1)
            if (start_date + timedelta(days=i)).weekday() != 6  # skip Sundays
        ]
        date_strs = [d.isoformat() for d in working_dates]

        # Pull all attendance records in the window (absent=-1 only; absconding=-2 already done)
        cursor = attendance_db.collection.find({
            "date": {"$in": date_strs},
            "status": -1,  # absent only (not yet absconding)
        })

        # Group by user_id
        from collections import defaultdict
        user_absences: dict = defaultdict(list)
        async for rec in cursor:
            uid = str(rec.get("user_id") or rec.get("employee_id") or "")
            if uid:
                user_absences[uid].append((rec["date"], rec["_id"]))

        if not user_absences:
            logger.info("[AutoAbsent] No absent records in window — nothing to check.")
            return

        # For each user, find consecutive streaks ≥ threshold
        converted_users = 0
        converted_records = 0

        for uid, absence_list in user_absences.items():
            # Sort by date
            absence_dates_sorted = sorted(d for d, _ in absence_list)
            id_map = {d: oid for d, oid in absence_list}

            # Build consecutive working-day streaks using the working_dates list
            streak: list = []
            streaks_to_convert: list = []

            for wd in working_dates:
                wd_str = wd.isoformat()
                if wd_str in id_map:
                    streak.append(wd_str)
                else:
                    # Break in streak — check if the preceding streak qualifies
                    if len(streak) >= threshold:
                        streaks_to_convert.extend(streak)
                    streak = []

            # Check tail streak
            if len(streak) >= threshold:
                streaks_to_convert.extend(streak)

            if not streaks_to_convert:
                continue

            # For each day in the streak, verify no approved leave exists
            # If even one day has an approved leave we skip (employee is covered)
            days_without_leave = []
            for date_str in streaks_to_convert:
                d = date.fromisoformat(date_str)
                approved = None
                try:
                    approved = await check_approved_leave_for_date(uid, d)
                except Exception:
                    pass
                if not approved:
                    days_without_leave.append(date_str)

            if len(days_without_leave) < threshold:
                continue

            # Convert absent → absconding for these days
            for date_str in days_without_leave:
                oid = id_map.get(date_str)
                if not oid:
                    continue
                await attendance_db.collection.update_one(
                    {"_id": oid},
                    {"$set": {
                        "status": -2,  # Absconding
                        "auto_absconding": True,
                        "auto_absconding_reason": f"Auto-absconding: {threshold}+ consecutive absent days without approved leave",
                        "updated_at": datetime.now(IST),
                    }}
                )
                converted_records += 1

            if days_without_leave:
                converted_users += 1
                logger.info(
                    f"[AutoAbsent] User {uid}: converted {len(days_without_leave)} absent day(s) "
                    f"to absconding ({', '.join(days_without_leave)})"
                )

        logger.info(
            f"[AutoAbsent] Consecutive-absent absconding job done: "
            f"{converted_records} record(s) across {converted_users} employee(s) converted."
        )

    except Exception as e:
        logger.error(f"[AutoAbsent] Error in consecutive-absent absconding job: {e}", exc_info=True)


async def run_historical_absconding_backfill(from_date: date = None, to_date: date = None) -> dict:
    """
    One-time / on-demand backfill: apply the consecutive-absent→absconding rule
    across ALL historical absent records (or a date range if provided).
    Returns a summary dict with counts.
    """
    try:
        from app.database.Attendance import AttendanceDB
        from app.database import get_database_instances
        from collections import defaultdict

        settings = await _get_settings()
        threshold = int(settings.get("consecutive_absent_absconding_days", 3))

        db = get_database_instances()
        attendance_db: AttendanceDB = db["attendance"]

        # Build the query — fetch ALL absent records (optionally within date range)
        query: dict = {"status": -1}  # absent only
        if from_date or to_date:
            date_filter: dict = {}
            if from_date:
                date_filter["$gte"] = from_date.isoformat()
            if to_date:
                date_filter["$lte"] = to_date.isoformat()
            query["date"] = date_filter

        logger.info(f"[Backfill] Starting historical absconding backfill (threshold={threshold}, from={from_date}, to={to_date})")

        # Fetch all matching absent records
        cursor = attendance_db.collection.find(query, {"_id": 1, "date": 1, "user_id": 1, "employee_id": 1})
        user_absences: dict = defaultdict(list)
        async for rec in cursor:
            uid = str(rec.get("user_id") or rec.get("employee_id") or "")
            if uid and rec.get("date"):
                user_absences[uid].append((rec["date"], rec["_id"]))

        logger.info(f"[Backfill] Found absent records for {len(user_absences)} employee(s)")

        if not user_absences:
            return {"converted_records": 0, "converted_users": 0, "message": "No absent records found"}

        converted_users = 0
        converted_records = 0
        skipped_users = 0

        for uid, absence_list in user_absences.items():
            # Sort and build map
            absence_list_sorted = sorted(absence_list, key=lambda x: x[0])
            id_map = {d: oid for d, oid in absence_list_sorted}
            all_dates_sorted = [date.fromisoformat(d) for d, _ in absence_list_sorted]

            # Build consecutive Mon-Sat streaks
            streak: list = []
            streaks_to_convert: list = []

            for i, d in enumerate(all_dates_sorted):
                if d.weekday() == 6:  # skip Sunday
                    continue
                if streak and (d - streak[-1]).days > 2:
                    # Gap > 1 working day (allowing for Sunday in between)
                    # Actually check: is the gap only because of one Sunday?
                    prev = streak[-1]
                    days_gap = (d - prev).days
                    # Allow gap of 2 if the day in between is a Sunday
                    middle = prev + timedelta(days=1)
                    if days_gap == 2 and middle.weekday() == 6:
                        pass  # Saturday→Sunday→Monday is still consecutive
                    elif days_gap == 1:
                        pass  # directly consecutive
                    else:
                        # real break
                        if len(streak) >= threshold:
                            streaks_to_convert.extend([s.isoformat() for s in streak])
                        streak = []
                streak.append(d)

            if len(streak) >= threshold:
                streaks_to_convert.extend([s.isoformat() for s in streak])

            if not streaks_to_convert:
                skipped_users += 1
                continue

            # Verify no approved leave for each qualifying day
            days_without_leave = []
            for date_str in streaks_to_convert:
                d = date.fromisoformat(date_str)
                approved = None
                try:
                    approved = await check_approved_leave_for_date(uid, d)
                except Exception:
                    pass
                if not approved:
                    days_without_leave.append(date_str)

            if len(days_without_leave) < threshold:
                skipped_users += 1
                continue

            # Convert to absconding
            for date_str in days_without_leave:
                oid = id_map.get(date_str)
                if not oid:
                    continue
                await attendance_db.collection.update_one(
                    {"_id": oid},
                    {"$set": {
                        "status": -2,
                        "auto_absconding": True,
                        "auto_absconding_reason": f"Backfill: {threshold}+ consecutive absent days without approved leave",
                        "updated_at": datetime.now(IST),
                    }}
                )
                converted_records += 1

            if days_without_leave:
                converted_users += 1
                logger.info(
                    f"[Backfill] User {uid}: {len(days_without_leave)} day(s) → absconding "
                    f"({', '.join(days_without_leave)})"
                )

        summary = {
            "converted_records": converted_records,
            "converted_users": converted_users,
            "skipped_users": skipped_users,
            "message": f"Backfill done: {converted_records} record(s) across {converted_users} employee(s) converted to absconding."
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
