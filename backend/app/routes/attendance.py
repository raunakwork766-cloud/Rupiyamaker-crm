from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Dict, List, Any, Optional
from datetime import datetime, date, timedelta
import calendar
import base64
import os
import uuid
import math
import traceback
import logging
import time
import asyncio
from bson import ObjectId

from app.database import get_database_instances
from app.database.Attendance import AttendanceDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Departments import DepartmentsDB
from app.database.Leaves import LeavesDB
from app.database.Settings import SettingsDB
from app.database.AttendanceComments import get_attendance_comments_db
from app.database.AttendanceHistory import get_attendance_history_db
from app.database.Holidays import get_holidays_db
from app.routes.settings import get_settings_db
from app.utils.performance_cache import (
    cached_response, cache_user_permissions, get_cached_user_permissions,
    performance_monitor, invalidate_cache_pattern, cache_response, get_cached_response
)
from app.schemas.attendance_schemas import (
    AttendanceCreate, AttendanceUpdate, BulkAttendanceCreate,
    AttendanceResponse, AttendanceStats, MonthlyAttendanceRequest,
    AttendanceCalendarResponse, EmployeeAttendanceCalendar,
    AttendanceCalendarDay, AttendanceListResponse,
    AttendancePermissions, AttendanceMarkRequest, get_status_text,
    AttendanceCheckInRequest, AttendanceCheckOutRequest, AttendanceEditRequest,
    AttendanceDetailResponse, GeolocationData, AttendanceSettings, AttendanceSettingsUpdate
)
from app.utils.permissions import PermissionManager
from app.utils.timezone import get_ist_now

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)

# Initialize logger
logger = logging.getLogger(__name__)

async def get_hierarchical_permissions(user_id: str, module: str = "attendance") -> Dict[str, Any]:
    """Get simplified hierarchical permissions for attendance module"""
    try:
        from app.utils.permission_helpers import is_super_admin_permission
        from app.database import get_database_instances
        
        db_instances = get_database_instances()
        users_db = db_instances["users"]
        roles_db = db_instances["roles"]
        
        # Get user data
        user = await users_db.get_user(user_id)
        if not user:
            return {"permission_level": "own", "is_super_admin": False}
        
        # Check if user is super admin
        is_super_admin = user.get("is_super_admin", False)
        if is_super_admin:
            return {"permission_level": "all", "is_super_admin": True}
        
        # Get user's role permissions
        role_id = user.get("role_id")
        if not role_id:
            return {"permission_level": "own", "is_super_admin": False}
        
        role = await roles_db.get_role(role_id)
        if not role:
            return {"permission_level": "own", "is_super_admin": False}
        
        permissions = role.get("permissions", [])
        
        # Check for super admin permission in role
        for perm in permissions:
            if is_super_admin_permission(perm):
                return {"permission_level": "all", "is_super_admin": True}
        
        # Check for module-specific permissions
        has_all = False
        has_junior = False
        has_update = False
        
        for perm in permissions:
            if perm.get("page") == module:
                actions = perm.get("actions", [])
                if isinstance(actions, str):
                    actions = [actions]
                
                if "all" in actions or "view_all" in actions or "*" in actions:
                    has_all = True
                elif "junior" in actions or "view_team" in actions:
                    has_junior = True
                
                if "update" in actions or "update_attendance" in actions:
                    has_update = True
        
        # Determine permission level
        if has_all:
            return {"permission_level": "all", "is_super_admin": False, "has_update": True}
        elif has_junior:
            return {"permission_level": "junior", "is_super_admin": False, "has_update": has_update}
        else:
            return {"permission_level": "own", "is_super_admin": False, "has_update": has_update}
            
    except Exception as e:
        # Error getting hierarchical permissions
        return {"permission_level": "own", "is_super_admin": False}

# Helper function for getting subordinate users in attendance context
async def get_subordinate_users_for_attendance(user_id: str, users_db, roles_db) -> List[str]:
    """Get subordinate user IDs for attendance visibility"""
    try:
        subordinate_user_ids = await PermissionManager.get_subordinate_users(
            user_id, users_db, roles_db
        )
        return subordinate_user_ids
    except Exception as e:
        # Error getting subordinate users
        return []

# Database dependency functions
async def get_attendance_db():
    db_instances = get_database_instances()
    return db_instances["attendance"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_departments_db():
    db_instances = get_database_instances()
    return db_instances["departments"]

async def get_leaves_db():
    db_instances = get_database_instances()
    return db_instances["leaves"]

def save_attendance_photo(photo_data: str, user_id: str, date_str: str, photo_type: str = "checkin") -> str:
    """Save base64 encoded photo to file system with type (checkin/checkout)"""
    try:
        # Create directory structure
        media_dir = "media/attendance"
        os.makedirs(media_dir, exist_ok=True)
        
        # Generate unique filename using user_id and photo type
        timestamp = get_ist_now().strftime("%H%M%S")
        photo_filename = f"{user_id}_{date_str}_{photo_type}_{timestamp}_{uuid.uuid4().hex[:8]}.jpg"
        photo_path = os.path.join(media_dir, photo_filename)
        
        # Remove the data URL prefix if present
        if "," in photo_data:
            photo_data = photo_data.split(",")[1]
        
        # Decode and save the image
        image_data = base64.b64decode(photo_data)
        with open(photo_path, "wb") as f:
            f.write(image_data)
        
        return photo_path
        
    except Exception as e:
        # Error saving photo
        return None

def format_datetime_ist(dt: datetime) -> str:
    """Format datetime to IST format: '08 August 2004, 13:16'"""
    try:
        # Convert to IST (assuming input is UTC)
        from datetime import timedelta
        ist_dt = dt + timedelta(hours=5, minutes=30)
        
        months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
        
        day = ist_dt.day
        month = months[ist_dt.month - 1]
        year = ist_dt.year
        time_str = ist_dt.strftime("%H:%M")
        
        return f"{day:02d} {month} {year}, {time_str}"
    except:
        return str(dt)

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS coordinates in meters"""
    try:
        from math import radians, sin, cos, sqrt, atan2
        
        # Earth radius in meters
        R = 6371000
        
        lat1_rad = radians(lat1)
        lat2_rad = radians(lat2)
        delta_lat = radians(lat2 - lat1)
        delta_lon = radians(lon2 - lon1)
        
        a = sin(delta_lat/2) * sin(delta_lat/2) + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon/2) * sin(delta_lon/2)
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        distance = R * c
        return distance
        
    except Exception as e:
        # Error calculating distance
        return 0.0

def validate_geofence(user_location: Dict[str, float], office_location: Dict[str, float], radius: float) -> bool:
    """Validate if user is within allowed geofence radius"""
    try:
        import math
        
        # Haversine formula to calculate distance between two points
        lat1, lon1 = math.radians(user_location["latitude"]), math.radians(user_location["longitude"])
        lat2, lon2 = math.radians(office_location["latitude"]), math.radians(office_location["longitude"])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Radius of earth in meters
        r = 6371000
        distance = c * r
        
        return distance <= radius
    except Exception as e:
        # Error validating geofence
        return True  # Allow if validation fails

async def get_user_permissions(user_id: str, users_db: UsersDB, roles_db: RolesDB) -> Dict[str, bool]:
    """Get attendance permissions for a user - SIMPLIFIED to 3-type system"""
    try:
        # Use centralized hierarchical permission system
        permissions = await get_hierarchical_permissions(user_id, "attendance")
        permission_level = permissions["permission_level"]
        has_update = permissions.get("has_update", False)
        
        # Convert to legacy boolean format for backward compatibility
        if permission_level == "all":
            return {
                "can_view_own": True,
                "can_view_all": True,
                "can_view_junior": True,  # All permission includes junior viewing
                "can_mark_own": True,
                "can_mark_all": True,
                "can_edit": True,
                "can_delete": True,
                "can_export": True
            }
        elif permission_level == "junior":
            return {
                "can_view_own": True,
                "can_view_all": False,
                "can_view_junior": True,  # Enable viewing subordinate attendance
                "can_mark_own": True,
                "can_mark_all": has_update,  # Can mark for others if update permission given
                "can_edit": True,
                "can_delete": False,
                "can_export": True
            }
        else:  # permission_level == "own"
            return {
                "can_view_own": True,
                "can_view_all": False,
                "can_view_junior": False,  # Own permission cannot view subordinates
                "can_mark_own": True,
                "can_mark_all": has_update,  # Can mark for others if explicit update permission
                "can_edit": has_update,       # Can edit if explicit update permission
                "can_delete": False,
                "can_export": False
            }
    except Exception as e:
        # Error getting user permissions
        # Safe fallback to own permissions only
        return {
            "can_view_own": True,
            "can_view_all": False,
            "can_view_junior": False,  # Safe fallback - no junior viewing
            "can_mark_own": True,
            "can_mark_all": False,
            "can_edit": False,
            "can_delete": False,
            "can_export": False
        }

@router.get("/permissions")
async def get_attendance_permissions(
    user_id: str = Query(..., description="User _id making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get attendance permissions for the current user"""
    try:
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        return {
            "success": True,
            "permissions": AttendancePermissions(**permissions)
        }
        
    except Exception as e:
        # Error getting attendance permissions
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get permissions: {str(e)}"
        )

@router.get("/calendar")
@cached_response(ttl=30)  # ⚡ Cache for 30 seconds - attendance data changes frequently
async def get_attendance_calendar(
    user_id: str = Query(..., description="User _id making the request"),
    year: Optional[int] = Query(None, description="Year (default: current year)"),
    month: Optional[int] = Query(None, description="Month (default: current month)"),
    employee_id: Optional[str] = Query(None, description="Employee _id (for individual view)"),
    department_id: Optional[str] = Query(None, description="Department ID (for department view)"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db),
    settings_db: SettingsDB = Depends(get_settings_db),
    holidays_db = Depends(get_holidays_db)
):
    """⚡ ULTRA-OPTIMIZED: Get monthly attendance calendar - Target: <2s for 100 employees"""
    start_time = time.time()
    
    try:
        # Default to current year/month
        if not year:
            year = get_ist_now().year
        if not month:
            month = get_ist_now().month
        
        month_name = calendar.month_name[month]
        
        # Calculate date range for the month
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        
        # ⚡ STEP 1: Batch load all settings and user permissions in parallel
        settings_task = asyncio.create_task(settings_db.get_attendance_settings())
        permissions_task = asyncio.create_task(get_user_permissions(user_id, users_db, roles_db))
        requesting_user_task = asyncio.create_task(users_db.get_user(user_id))
        
        # Wait for all tasks to complete
        attendance_settings, permissions, requesting_user = await asyncio.gather(
            settings_task, permissions_task, requesting_user_task,
            return_exceptions=True
        )
        
        # Handle exceptions
        if isinstance(attendance_settings, Exception):
            attendance_settings = {"weekend_days": [5, 6]}
        if isinstance(permissions, Exception):
            permissions = {"can_view_all": False}
        if isinstance(requesting_user, Exception):
            requesting_user = None
            
        weekend_days = attendance_settings.get("weekend_days", [5, 6])
        # Sunday rule settings
        enable_sunday_rule = attendance_settings.get("enable_sunday_sandwich_rule", True)
        min_days_for_sunday = attendance_settings.get("minimum_working_days_for_sunday", 4)
        # Adjacent absconding rule: absent working-day adjacent to Sunday-off → Absconding
        _raw_abscond_rule = attendance_settings.get("enable_adjacent_absconding_rule")
        enable_adjacent_absconding_rule = _raw_abscond_rule if _raw_abscond_rule is not None else True
        can_view_all = permissions.get("can_view_all", False)
        can_view_junior = permissions.get("can_view_junior", False)
        
        # Get employees efficiently
        if employee_id:
            # Single employee view
            employees = [await users_db.get_user(employee_id)]
            employees = [emp for emp in employees if emp is not None]
        elif department_id:
            # Department view
            employees = await users_db.list_users({"department_id": department_id})
        else:
            # Multiple employees based on permissions
            if can_view_all:
                employees = await users_db.list_users()
            elif can_view_junior:
                subordinate_user_ids = await get_subordinate_users_for_attendance(user_id, users_db, roles_db)
                allowed_user_ids = [user_id] + subordinate_user_ids
                all_users = await users_db.list_users()
                employees = [emp for emp in all_users if str(emp.get('_id')) in allowed_user_ids]
            else:
                employees = [await users_db.get_user(user_id)]
                employees = [emp for emp in employees if emp is not None]
        
        if not employees:
            return AttendanceCalendarResponse(
                year=year,
                month=month,
                month_name=month_name,
                employees=[]
            )
        
        # ✅ FILTER: Separate active and inactive employees
        # Active employees → always show
        # Inactive employees → only show if they have attendance records for this month  
        active_employees = []
        inactive_employees = []
        for emp in employees:
            emp_status = emp.get("employee_status", "active")
            emp_is_active = emp.get("is_active", True)
            if emp_status == "inactive" or emp_is_active == False:
                inactive_employees.append(emp)
            else:
                active_employees.append(emp)
        
        # ⚡ STEP 3: Batch fetch ALL data in parallel (the key optimization!)
        employee_ids = [str(emp.get('_id')) for emp in employees if emp.get('_id')]
        
        # Create all batch fetch tasks
        # ⚡ STEP 2: Setup parallel async tasks for bulk data fetching
        async def fetch_leaves_data():
            leaves_db_instance = await get_leaves_db()
            return await leaves_db_instance.get_leaves_in_date_range(
                start_date=datetime.combine(start_date, datetime.min.time()),
                end_date=datetime.combine(end_date, datetime.max.time())
            )
        
        batch_tasks = {
            'attendance': asyncio.create_task(
                attendance_db.get_bulk_employee_attendance(employee_ids, start_date, end_date)
            ),
            'holidays': asyncio.create_task(holidays_db.get_all_holidays()),
            'leaves': asyncio.create_task(fetch_leaves_data()),
            'departments': asyncio.create_task(departments_db.list_departments())
        }
        
        # Execute all batch operations in parallel
        try:
            batch_results = await asyncio.gather(
                *batch_tasks.values(),
                return_exceptions=True
            )
            
            attendance_records = batch_results[0] if not isinstance(batch_results[0], Exception) else []
            all_holidays = batch_results[1] if not isinstance(batch_results[1], Exception) else []
            all_leaves = batch_results[2] if not isinstance(batch_results[2], Exception) else []
            all_departments = batch_results[3] if not isinstance(batch_results[3], Exception) else []
            
        except Exception as e:
            # Fallback to empty data if batch operations fail
            attendance_records = []
            all_holidays = []
            all_leaves = []
            all_departments = []
        
        # ⚡ STEP 4: Create fast lookup dictionaries
        # Attendance lookup: {employee_id: {date_str: record}}
        # Note: attendance_records is already organized as {emp_id: {date: record}}
        attendance_lookup = attendance_records if isinstance(attendance_records, dict) else {}
        
        # Holiday lookup: {date_str: True}
        holiday_dates = {str(holiday.get('date')): True for holiday in all_holidays if holiday.get('date')}
        
        # Leave lookup: {employee_id: {date_str: leave_info}}
        leave_lookup = {}
        for leave in all_leaves:
            if leave.get('status') == 'approved':
                emp_id = str(leave.get('employee_id', ''))
                if emp_id and leave.get('start_date') and leave.get('end_date'):
                    if emp_id not in leave_lookup:
                        leave_lookup[emp_id] = {}
                    
                    # Generate all dates for this leave
                    leave_start = leave.get('start_date')
                    leave_end = leave.get('end_date')
                    
                    if hasattr(leave_start, 'date'):
                        leave_start = leave_start.date()
                    elif isinstance(leave_start, str):
                        leave_start = datetime.strptime(leave_start[:10], '%Y-%m-%d').date()
                    
                    if hasattr(leave_end, 'date'):
                        leave_end = leave_end.date()
                    elif isinstance(leave_end, str):
                        leave_end = datetime.strptime(leave_end[:10], '%Y-%m-%d').date()
                    
                    current_date = leave_start
                    while current_date <= leave_end:
                        if start_date <= current_date <= end_date:  # Only include dates in our month
                            leave_lookup[emp_id][current_date.isoformat()] = {
                                'leave_id': str(leave.get('_id', '')),
                                'leave_type': leave.get('leave_type', ''),
                                'leave_type_display': leave.get('leave_type', '').replace('_', ' ').title(),
                                'leave_reason': leave.get('reason', ''),
                                'leave_approved_by': leave.get('approved_by', ''),
                                'leave_approved_by_name': 'Manager',  # Could be enhanced
                                'approval_comments': leave.get('approval_comments', '')
                            }
                        current_date += timedelta(days=1)
        
        # Department lookup: {department_id: department_name}
        department_lookup = {}
        for dept in all_departments:
            dept_id = str(dept.get('_id', ''))
            dept_name = dept.get('name', 'Unknown Department')
            if dept_id:
                department_lookup[dept_id] = dept_name
        
        # ✅ FILTER: For inactive employees, only include them if they have attendance data for this month
        # Active employees are always included. Inactive employees are included ONLY if they have
        # at least one attendance record for the selected month.
        filtered_employees = list(active_employees)  # Always include all active employees
        
        for emp in inactive_employees:
            emp_id = str(emp.get('_id', ''))
            emp_attendance = attendance_lookup.get(emp_id, {})
            emp_leaves = leave_lookup.get(emp_id, {})
            # Include inactive employee ONLY if they have attendance or leave records this month
            if emp_attendance or emp_leaves:
                filtered_employees.append(emp)
        
        # Replace employees with filtered list
        employees = filtered_employees

        # ── Sunday Rule: Pre-fetch previous month attendance if any Sunday's week
        #    starts in the previous month (e.g. month starts on Sun Mon Tue …)
        days_in_month = calendar.monthrange(year, month)[1]
        prev_month_attendance_lookup = {}
        if enable_sunday_rule:
            for d_check in range(1, min(8, days_in_month + 1)):
                d_obj = date(year, month, d_check)
                if d_obj.weekday() == 6:  # Sunday
                    week_monday = d_obj - timedelta(days=6)  # Mon of that week
                    if week_monday < start_date:  # Week starts in previous month
                        prev_end = start_date - timedelta(days=1)
                        prev_start = date(prev_end.year, prev_end.month, 1)
                        try:
                            prev_att = await attendance_db.get_bulk_employee_attendance(
                                employee_ids, prev_start, prev_end
                            )
                            prev_month_attendance_lookup = prev_att if isinstance(prev_att, dict) else {}
                        except Exception:
                            prev_month_attendance_lookup = {}
                    break  # Only need to check the first Sunday

        # ⚡ STEP 5: Ultra-fast calendar generation using lookups
        employee_calendars = []
        
        for employee in employees:
            user_emp_id = str(employee.get("_id", ""))
            if not user_emp_id:
                continue
            
            employee_name = f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
            
            # Get pre-fetched data for this employee
            employee_attendance = attendance_lookup.get(user_emp_id, {})
            employee_leaves = leave_lookup.get(user_emp_id, {})
            # Merge prev-month attendance for cross-month Sunday week lookups
            emp_prev_attendance = prev_month_attendance_lookup.get(user_emp_id, {})
            all_emp_attendance = {**emp_prev_attendance, **employee_attendance}
            
            # Generate days using lookup tables
            days = []
            total_days = 0
            full_days = 0
            half_days = 0
            absent_days = 0
            absconding_days = 0
            leave_days = 0
            
            for day in range(1, days_in_month + 1):
                date_obj = date(year, month, day)
                date_str = date_obj.isoformat()
                
                # Fast weekend check
                is_weekend = date_obj.weekday() in weekend_days
                
                # Fast holiday check using lookup
                is_holiday = date_str in holiday_dates
                
                # Fast leave check using lookup
                leave_info = employee_leaves.get(date_str)
                
                # Fast attendance check using lookup
                attendance_record = employee_attendance.get(date_str)
                
                # Initialize day data
                status = None
                status_text = None
                comments = None
                photo_path = None
                leave_id = None
                leave_type = None
                leave_reason = None
                leave_approved_by = None
                leave_approved_by_name = None
                
                if is_holiday:
                    # ── Holiday takes TOP priority ──
                    # Even if an attendance/auto-absent record exists for this day,
                    # a declared holiday always shows as Holiday (1.5).
                    status = 1.5
                    status_text = "Holiday"

                elif leave_info:
                    # Employee has approved leave
                    status = 0
                    status_text = f"Leave ({leave_info['leave_type_display']})"
                    comments = f"On {leave_info['leave_type_display']}: {leave_info['leave_reason']}"
                    if leave_info.get('approval_comments'):
                        comments += f" | Approval: {leave_info['approval_comments']}"
                    
                    leave_id = leave_info["leave_id"]
                    leave_type = leave_info["leave_type"]
                    leave_reason = leave_info["leave_reason"]
                    leave_approved_by = leave_info["leave_approved_by"]
                    leave_approved_by_name = leave_info["leave_approved_by_name"]
                    
                    total_days += 1
                    leave_days += 1
                    
                elif attendance_record:
                    # Use existing attendance record
                    raw_status = attendance_record.get("status")
                    
                    # Convert status to proper numeric format
                    if isinstance(raw_status, str):
                        # Convert string status to numeric
                        status_mapping = {
                            'present': 1.0,
                            'full day': 1.0,
                            'half day': 0.5,
                            'half': 0.5,
                            'leave': 0.0,
                            'absent': -1.0,
                            'absconding': -2.0,
                            'holiday': 1.5
                        }
                        status = status_mapping.get(raw_status.lower(), 1.0)  # Default to full day
                    elif isinstance(raw_status, (int, float)):
                        # Normalize numeric status values
                        if raw_status == -2:  # Absconding status
                            status = -2.0
                        elif raw_status in [1, 1.0]:
                            status = 1.0
                        elif raw_status in [0.5]:
                            status = 0.5
                        elif raw_status in [0, 0.0]:
                            status = 0.0
                        elif raw_status in [-1, -1.0]:
                            status = -1.0
                        elif raw_status in [1.5]:
                            status = 1.5
                        else:
                            status = 1.0  # Default to full day for unknown values
                    else:
                        status = 1.0  # Default to full day if status is None or unknown type
                    
                    # ── Rule: Check-in without check-out ──
                    chk_in = attendance_record.get("check_in_time")
                    chk_out = attendance_record.get("check_out_time")
                    was_manually_edited = attendance_record.get("edited_by") is not None
                    _auto_absconding = attendance_record.get("auto_absconding", False)
                    # Override to ABSENT only when: has check-in, no check-out, not manually
                    # edited, and NOT already escalated to absconding by the age-based job.
                    # If auto_absconding=True the record is legitimately absconding — keep it.
                    if chk_in and not chk_out and not was_manually_edited and not _auto_absconding:
                        _day_date_obj = date.fromisoformat(date_str)
                        if _day_date_obj < get_ist_now().date():
                            status = -1.0  # Past date: missed checkout → ABSENT
                        elif _day_date_obj == get_ist_now().date():
                            status = 2.0   # Today: still working
                    
                    status_text = get_status_text(status) if status is not None else None
                    comments = attendance_record.get("comments", "")
                    photo_path = attendance_record.get("photo_path")
                    
                    if attendance_record.get("leave_id"):
                        leave_id = attendance_record.get("leave_id")
                    
                    total_days += 1
                    if status == 2 or status == 2.0:
                        pass  # Working/IN — don't count yet, still in progress
                    elif status == 1 or status == 1.0:
                        full_days += 1
                    elif status == 0.5:
                        half_days += 1
                    elif status == 0 or status == 0.0:
                        leave_days += 1
                    elif status == -1 or status == -1.0:
                        absent_days += 1
                    elif status == -2 or status == -2.0:
                        absconding_days += 1
                        
                elif not is_weekend:
                    # ── Rule: No attendance record on a past working day = Absent ──
                    _day_date_obj = date.fromisoformat(date_str)
                    _today_ist = get_ist_now().date()
                    if _day_date_obj < _today_ist:
                        status = -1.0
                        status_text = "Absent"
                        total_days += 1
                        absent_days += 1
                    else:
                        status = None
                        status_text = "Not Marked"
                        total_days += 1
                
                # Calculate attendance percentage
                attendance_percentage = 0.0
                if total_days > 0:
                    attended_days = full_days + (half_days * 0.5) + leave_days
                    attendance_percentage = round((attended_days / total_days) * 100, 2)
                
                day_data = {
                    "day": day,
                    "date": date_str,
                    "is_weekend": is_weekend,
                    "is_holiday": is_holiday,
                    "status": status,
                    "status_text": status_text,
                    "is_manually_edited": attendance_record.get("edited_by") is not None or attendance_record.get("marked_by") is not None if attendance_record else False,
                    "check_in_time": attendance_record.get("check_in_time") if attendance_record else None,
                    "check_out_time": attendance_record.get("check_out_time") if attendance_record else None,
                    "comments": comments,
                    "photo_path": photo_path,
                    "leave_id": leave_id,
                    "leave_type": leave_type,
                    "leave_reason": leave_reason,
                    "leave_approved_by": leave_approved_by,
                    "leave_approved_by_name": leave_approved_by_name
                }
                days.append(day_data)

            # ── Sunday Rule: Sunday is absent if adjacent Sat/Mon absent OR < min working days in week ──
            if enable_sunday_rule:
                _days_by_date = {d["date"]: d for d in days}
                _today_ist = get_ist_now().date()

                def _day_absent(check_date):
                    """True if check_date is a working day that is absent/not-present."""
                    if check_date.weekday() in weekend_days:
                        return False  # Weekend itself — not a working absence
                    d_s = check_date.isoformat()
                    # In-month days: use updated status from days list
                    if d_s in _days_by_date:
                        d = _days_by_date[d_s]
                        s = d.get("status")
                        # If admin manually edited this day, respect their override — never treat as absent for sandwich rule
                        if d.get("is_manually_edited", False):
                            return False
                        # Present statuses: full day (1/1.0), holiday (1.5), approved leave (0/0.0), working/IN (2/2.0)
                        return s not in [1, 1.0, 1.5, 0, 0.0, 2, 2.0, 0.5]
                    # Out-of-month days: use raw attendance lookup
                    rec = all_emp_attendance.get(d_s)
                    if rec is None:
                        return check_date < _today_ist  # No record in past → absent
                    try:
                        return float(rec.get("status", 0)) not in [1.0, 1.5, 0.0, 2.0, 0.5]
                    except (TypeError, ValueError):
                        return True

                def _day_present(check_date):
                    """True if check_date is a working day with present status."""
                    if check_date.weekday() in weekend_days:
                        return False
                    d_s = check_date.isoformat()
                    if d_s in _days_by_date:
                        s = _days_by_date[d_s].get("status")
                        return s in [1, 1.0, 1.5, 0.5, 2, 2.0]  # full, holiday, half, working
                    rec = all_emp_attendance.get(d_s)
                    if rec is None:
                        return False
                    try:
                        return float(rec.get("status", -1)) in [1.0, 1.5, 0.5, 2.0]
                    except (TypeError, ValueError):
                        return False

                for day_data in days:
                    d_sun = date.fromisoformat(day_data["date"])
                    if d_sun.weekday() != 6:  # Only Sundays
                        continue

                    # ── Holiday takes priority: skip Sunday rule for holiday Sundays ──
                    if day_data.get("is_holiday"):
                        continue

                    saturday = d_sun - timedelta(days=1)
                    monday   = d_sun + timedelta(days=1)

                    sat_absent = _day_absent(saturday)
                    mon_absent = (monday <= _today_ist) and _day_absent(monday)

                    # Count present days Mon-Sat of this week
                    present_count = 0
                    for offset in range(1, 7):  # Mon(-6) to Sat(-1)
                        wd = d_sun - timedelta(days=7 - offset)  # Mon=d_sun-6 ... Sat=d_sun-1
                        if wd > _today_ist:
                            continue  # Future day, don't count
                        if _day_present(wd):
                            present_count += 1

                    sunday_absent = False
                    absent_reason = ""

                    if sat_absent or mon_absent:
                        sunday_absent = True
                        absent_reason = "Sat/Mon absent"
                    elif present_count < min_days_for_sunday and d_sun <= _today_ist:
                        sunday_absent = True
                        absent_reason = f"Only {present_count}/{min_days_for_sunday} days present"

                    if sunday_absent:
                        day_data["status"] = -1.0  # Always Absent, never Absconding
                        day_data["status_text"] = f"Sunday (Absent — {absent_reason})"
                        day_data["is_sunday_present"] = False
                        absent_days += 1
                        total_days += 1
                    else:
                        day_data["status"] = 1
                        day_data["status_text"] = "Sunday (Present)"
                        day_data["is_sunday_present"] = True
                        full_days += 1
                        total_days += 1

            # ── Adjacent Absconding Rule: Saturday/Monday absent that caused Sunday absence → Absconding ──
            # If a working day (Saturday or Monday) was absent and that triggered the Sunday sandwich rule,
            # that working-day absence is upgraded to Absconding status.
            # EXCEPTION: If the day was manually edited/marked by an admin, do NOT override it.
            if enable_adjacent_absconding_rule:
                _days_by_date_abs = {d["date"]: d for d in days}
                for day_data in days:
                    d_sun = date.fromisoformat(day_data["date"])
                    if d_sun.weekday() != 6:  # Only Sundays
                        continue
                    # Only when Sunday was made absent by the sandwich rule
                    if day_data.get("is_sunday_present") is not False:
                        continue
                    saturday = d_sun - timedelta(days=1)
                    monday   = d_sun + timedelta(days=1)
                    sat_data = _days_by_date_abs.get(saturday.isoformat())
                    mon_data = _days_by_date_abs.get(monday.isoformat())
                    # Saturday absent (working day) → Absconding (only if not manually edited)
                    if (sat_data and sat_data.get("status") in [-1, -1.0]
                            and saturday.weekday() not in weekend_days
                            and not sat_data.get("is_manually_edited", False)):
                        sat_data["status"] = -2.0
                        sat_data["status_text"] = "Absconding"
                        absent_days -= 1
                        absconding_days += 1
                    # Monday absent (working day) → Absconding (only if not manually edited)
                    if (mon_data and mon_data.get("status") in [-1, -1.0]
                            and monday.weekday() not in weekend_days
                            and not mon_data.get("is_manually_edited", False)):
                        mon_data["status"] = -2.0
                        mon_data["status_text"] = "Absconding"
                        absent_days -= 1
                        absconding_days += 1

            # Calculate final attendance percentage (after Sunday rule updates counts)
            attendance_percentage = 0.0
            if total_days > 0:
                attended_days = full_days + (half_days * 0.5) + leave_days
                attendance_percentage = round((attended_days / total_days) * 100, 2)
            
            # ⚡ Resolve department name from department_id using lookup
            department_id = str(employee.get("department_id", ""))
            department_name = department_lookup.get(department_id, "Unknown Department")
            
            # ⚡ Use employee_id field instead of _id
            employee_id = employee.get("employee_id", user_emp_id)  # Fallback to _id if employee_id not set
            
            employee_calendar = {
                "employee_id": employee_id,
                "user_mongo_id": user_emp_id,  # MongoDB _id — used by frontend for history lookups
                "employee_name": employee_name,
                "employee_photo": employee.get("profile_picture"),
                "department_name": department_name,
                "role_name": employee.get("role_name"),
                "days": days,
                "stats": {
                    "total_days": total_days,
                    "full_days": full_days,
                    "half_days": half_days,
                    "absent_days": absent_days,
                    "absconding": absconding_days,  # Add absconding count for frontend
                    "holidays": leave_days,  # Schema expects 'holidays' field
                    "attendance_percentage": attendance_percentage
                }
            }
            employee_calendars.append(employee_calendar)
        
        # Calculate total processing time
        processing_time = round((time.time() - start_time) * 1000, 2)
        
        result = AttendanceCalendarResponse(
            year=year,
            month=month,
            month_name=month_name,
            employees=employee_calendars
        )
        
        print(f"✅ Calendar generated for {len(employees)} employees in {processing_time}ms")
        return result
        
        # ⚡ STEP 6: Simplified permission logic for bulk operations
        # Determine which employees to fetch based on permissions
        employees = []
        can_view_all = permissions.get("can_view_all", False)
        can_view_junior = permissions.get("can_view_junior", False)
        
        if employee_id:
            # Single employee view
            employee = await users_db.get_user(employee_id)
            if employee:
                employees = [employee]
        elif department_id:
            # Department view
            employees = await users_db.list_users({"department_id": department_id})
        elif can_view_all:
            # Super admin - show all employees
            employees = await users_db.list_users()
        elif can_view_junior:
            # Show subordinate employees  
            subordinate_user_ids = await get_subordinate_users_for_attendance(user_id, users_db, roles_db)
            allowed_user_ids = [user_id] + subordinate_user_ids
            all_users = await users_db.list_users()
            employees = [emp for emp in all_users if str(emp.get('_id')) in allowed_user_ids]
        else:
            # Regular user - only their own record
            employee = await users_db.get_user(user_id)
            if employee:
                employees = [employee]
        
        if not employees:
            return AttendanceCalendarResponse(
                year=year,
                month=month,
                month_name=month_name,
                employees=[],
                processing_time_ms=round((time.time() - start_time) * 1000, 2)
            )
        # Cache the optimized result
        await cache_response(cache_key, result, ttl=30)
        print(f"✅ Optimized calendar cached with key: {cache_key}")
        
        return result
        
    except Exception as e:
        error_time = time.time() - start_time
        # Error logged via middleware
        import traceback
        traceback.print_exc()
        from fastapi import status as fastapi_status
        raise HTTPException(
            status_code=fastapi_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get attendance calendar: {str(e)}"
        )

async def get_user_monthly_stats(user_id: str, year: int, month: int, attendance_db: AttendanceDB) -> Dict[str, Any]:
    """Get attendance statistics for a user using their _id"""
    try:
        # Create date range for the month
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)
        
        # Query attendance records using user_id (_id)
        query = {
            "user_id": user_id,
            "date": {
                "$gte": start_date.isoformat(),
                "$lt": end_date.isoformat()
            }
        }
        
        records = list(await attendance_db.collection.find(query))
        
        # Calculate stats
        total_days = len(records)
        full_days = len([r for r in records if r.get("status") == 1])
        half_days = len([r for r in records if r.get("status") == 0.5])
        absent_days = len([r for r in records if r.get("status") == -1])
        holidays = len([r for r in records if r.get("is_holiday", False)])
        
        # Calculate attendance percentage
        working_days = total_days - holidays
        if working_days > 0:
            present_days = full_days + (half_days * 0.5)
            attendance_percentage = round((present_days / working_days) * 100, 2)
        else:
            attendance_percentage = 0.0
        
        return {
            "total_days": total_days,
            "full_days": full_days,
            "half_days": half_days,
            "absent_days": absent_days,
            "holidays": holidays,
            "attendance_percentage": attendance_percentage
        }
        
    except Exception as e:
        # Error logged, returning safe defaults
        return {
            "total_days": 0,
            "full_days": 0,
            "half_days": 0,
            "absent_days": 0,
            "holidays": 0,
            "attendance_percentage": 0.0
        }

@router.post("/mark-self")
async def mark_self_attendance(
    attendance_data: AttendanceMarkRequest,
    user_id: str = Query(..., description="User _id marking their own attendance"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Mark self attendance with photo using user's _id"""
    try:
        # Get user info using _id
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if already marked today - use IST timezone
        from datetime import timezone, timedelta
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        today = datetime.now(ist_tz).date().isoformat()
        existing = await get_attendance_by_user_date(user_id, today, attendance_db)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attendance already marked for today"
            )
        
        # Save photo if provided
        photo_path = None
        if attendance_data.photo_data:
            photo_path = save_attendance_photo(attendance_data.photo_data, user_id, today)
        
        # Determine status based on time (example logic)
        now = get_ist_now()
        hour = now.hour
        status = 1  # Full day default
        
        if hour > 10:  # Late arrival = half day
            status = 0.5
        
        # Prepare attendance record using _id
        attendance_record = {
            "user_id": user_id,  # Use _id as user_id
            "employee_id": user.get("employee_id"),  # Optional employee_id if exists
            "date": today,
            "status": status,
            "comments": attendance_data.comments or "Self-marked attendance",
            "check_in_time": attendance_data.check_in_time or now.strftime("%H:%M:%S"),
            "is_holiday": False,
            "marked_by": user_id,
            "marked_at": get_ist_now(),
            "photo_path": photo_path,
            "created_at": get_ist_now(),
            "updated_at": get_ist_now()
        }
        
        # Add department info if available
        if user.get("department_id"):
            attendance_record["department_id"] = user.get("department_id")
        
        # Mark attendance
        attendance_id = await attendance_db.mark_attendance(attendance_record)
        
        return {
            "success": True,
            "message": "Self attendance marked successfully",
            "attendance_id": attendance_id,
            "status": status,
            "status_text": get_status_text(status)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Error logged via middleware
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark self attendance: {str(e)}"
        )

@router.get("/today")
# @cached_response(ttl=60)  # ⚡ Cache for 1 minute - today's attendance changes frequently
async def check_today_attendance(
    user_id: str = Query(..., description="User _id to check attendance for"),
    attendance_db: AttendanceDB = Depends(get_attendance_db)
):
    """Check if user has marked attendance today using their _id"""
    try:
        # Use the async method from AttendanceDB (it handles IST timezone internally)
        attendance = await attendance_db.get_today_attendance(user_id)
        
        return {
            "success": True,
            "has_marked_today": attendance is not None,
            "attendance": attendance if attendance else None
        }
        
    except Exception as e:
        # Error logged via middleware
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check today attendance: {str(e)}"
        )

@router.post("/mark")
async def mark_attendance(
    attendance_data: AttendanceCreate,
    user_id: str = Query(..., description="User _id marking attendance"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    attendance_history_db = Depends(get_attendance_history_db)
):
    """Mark attendance for an employee using their _id or employee_id"""
    try:
        # Check permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # Find employee by either _id or employee_id field
        employee = None
        target_user_id = None
        
        # First try to get user by _id (MongoDB ObjectId)
        try:
            employee = await users_db.get_user(attendance_data.employee_id)
            if employee:
                target_user_id = str(employee["_id"])
        except:
            pass
        
        # If not found, try to find by employee_id field
        if not employee:
            try:
                # Search for user with matching employee_id field
                users = await users_db.list_users()
                for user in users:
                    if user.get("employee_id") == attendance_data.employee_id:
                        employee = user
                        target_user_id = str(user["_id"])
                        break
            except Exception as e:
                print(f"Error searching by employee_id: {e}")
        
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee not found with ID: {attendance_data.employee_id}"
            )
        
        # If not admin and trying to mark for someone else, deny
        if not permissions.get("can_mark_all", False) and target_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to mark attendance for other employees"
            )
        
        # Prepare attendance data using resolved _id as primary key
        attendance_record = {
            "user_id": target_user_id,  # Use resolved _id as user_id
            "employee_id": employee.get("employee_id"),  # Store actual employee_id if exists
            "date": attendance_data.date,
            "status": attendance_data.status,
            "comments": attendance_data.comments or "",
            "check_in_time": attendance_data.check_in_time,
            "is_holiday": attendance_data.is_holiday or False,
            "marked_by": user_id,
            "marked_at": get_ist_now(),
            "created_at": get_ist_now(),
            "updated_at": get_ist_now()
        }
        
        # If admin is marking for another employee (manual override), flag as manually edited
        # so the adjacent-absconding rule does not override it during calendar generation
        if target_user_id != user_id:
            attendance_record["edited_by"] = user_id
            attendance_record["edited_at"] = get_ist_now()
        
        # Add department info if available
        if employee.get("department_id"):
            attendance_record["department_id"] = employee.get("department_id")
        
        # Mark attendance
        attendance_id = await attendance_db.mark_attendance(attendance_record)
        
        # Get admin info for history
        admin = await users_db.get_user(user_id)
        admin_name = admin.get("name") or admin.get("username", "Unknown Admin") if admin else "Unknown Admin"
        
        # Add history entry for new attendance record
        await attendance_history_db.add_history_entry(
            attendance_id=str(attendance_id),
            user_id=target_user_id,
            date=attendance_data.date,
            action_type="attendance_created",
            action_description=f"Attendance marked by {admin_name}",
            created_by=user_id,
            created_by_name=admin_name,
            new_value=get_status_text(attendance_data.status),
            reason=attendance_data.reason
        )
        
        # Invalidate calendar cache so the UI gets fresh data on next fetch
        try:
            invalidate_cache_pattern("get_calendar_attendance")
            invalidate_cache_pattern("get_attendance_calendar")
        except Exception:
            pass

        return {
            "success": True,
            "message": "Attendance marked successfully",
            "attendance_id": attendance_id,
            "employee_id": attendance_data.employee_id,
            "resolved_user_id": target_user_id,
            "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
            "status": get_status_text(attendance_data.status)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Error logged via middleware
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark attendance: {str(e)}"
        )

@router.post("/bulk-mark")
async def bulk_mark_attendance(
    bulk_data: BulkAttendanceCreate,
    user_id: str = Query(..., description="User _id marking bulk attendance"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Mark attendance for all employees in a department using their _ids"""
    try:
        # Check permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        if not permissions.get("can_mark_all", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to mark bulk attendance"
            )
        
        # Get department employees using their _ids
        department = await departments_db.get_department(bulk_data.department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
        
        # Get all users in the department
        employees = await users_db.list_users({"department_id": bulk_data.department_id})
        
        marked_count = 0
        errors = []
        
        for employee in employees:
            try:
                employee_id = str(employee["_id"])  # Use _id as primary identifier
                
                # Check if already marked for this date
                existing = await get_attendance_by_user_date(employee_id, bulk_data.date, attendance_db)
                if existing:
                    continue  # Skip if already marked
                
                # Prepare attendance record using _id
                attendance_record = {
                    "user_id": employee_id,  # Use _id as user_id
                    "employee_id": employee.get("employee_id"),  # Optional employee_id if exists
                    "date": bulk_data.date,
                    "status": bulk_data.status,
                    "comments": bulk_data.comments or "Bulk marked attendance",
                    "is_holiday": False,
                    "marked_by": user_id,
                    "marked_at": get_ist_now(),
                    "created_at": get_ist_now(),
                    "updated_at": get_ist_now(),
                    "department_id": bulk_data.department_id
                }
                
                # Mark attendance
                await attendance_db.mark_attendance(attendance_record)
                marked_count += 1
                
            except Exception as e:
                errors.append(f"Error marking for employee {employee.get('first_name', '')} {employee.get('last_name', '')}: {str(e)}")
        
        return {
            "success": True,
            "message": f"Bulk attendance marked for {marked_count} employees",
            "marked_count": marked_count,
            "total_employees": len(employees),
            "errors": errors if errors else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Error logged via middleware
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark bulk attendance: {str(e)}"
        )

async def get_attendance_by_user_date(user_id: str, date_str: str, attendance_db: AttendanceDB):
    """Get attendance record by user_id and date"""
    try:
        query = {"user_id": user_id, "date": date_str}
        record = await attendance_db.collection.find_one(query)
        if record:
            record["id"] = str(record["_id"])  # Map _id to id for response schema
            record["_id"] = str(record["_id"])  # Keep _id for backward compatibility
            
            # Add default values for missing fields to ensure frontend compatibility
            if record.get("check_in_time") is None:
                record["check_in_time"] = ""
            if record.get("check_out_time") is None:
                record["check_out_time"] = ""
            if record.get("total_working_hours") is None:
                record["total_working_hours"] = 0.0
            if record.get("check_in_photo_path") is None:
                record["check_in_photo_path"] = ""
            if record.get("check_out_photo_path") is None:
                record["check_out_photo_path"] = ""
            if record.get("check_in_geolocation") is None:
                record["check_in_geolocation"] = {"latitude": 0.0, "longitude": 0.0}
            elif isinstance(record.get("check_in_geolocation"), dict) and not record["check_in_geolocation"]:
                record["check_in_geolocation"] = {"latitude": 0.0, "longitude": 0.0}
            if record.get("check_out_geolocation") is None:
                record["check_out_geolocation"] = {"latitude": 0.0, "longitude": 0.0}
            elif isinstance(record.get("check_out_geolocation"), dict) and not record["check_out_geolocation"]:
                record["check_out_geolocation"] = {"latitude": 0.0, "longitude": 0.0}
        return record
    except Exception as e:
        # Error logged via middleware
        return None

@router.get("/stats/{target_user_id}")
@cached_response(ttl=120)  # ⚡ Cache for 2 minutes - stats change less frequently
async def get_attendance_stats(
    target_user_id: str,
    user_id: str = Query(..., description="User _id making the request"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get attendance statistics for a user using their _id"""
    try:
        # Check permissions - hierarchical support
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        can_view_all = permissions.get("can_view_all", False)
        
        # Check if user can view the target user's stats
        if target_user_id == user_id:
            # User can always view their own stats
            pass
        elif can_view_all:
            # User has permission to view all users' stats
            pass
        else:
            # Check if target user is a subordinate
            subordinate_user_ids = await get_subordinate_users_for_attendance(user_id, users_db, roles_db)
            if target_user_id not in subordinate_user_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this user's attendance statistics"
                )
        
        # Get user info
        user = await users_db.get_user(target_user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get attendance statistics using _id
        if start_date and end_date:
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            year = start_date_obj.year
            month = start_date_obj.month
            stats = await get_user_monthly_stats(target_user_id, year, month, attendance_db)
        else:
            # Current month stats
            now = get_ist_now()
            stats = await get_user_monthly_stats(target_user_id, now.year, now.month, attendance_db)
        
        return {
            "success": True,
            "user_id": target_user_id,
            "employee_id": user.get("employee_id"),  # Show employee_id if exists
            "employee_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "stats": AttendanceStats(**stats),
            "date_range": {
                "start_date": start_date,
                "end_date": end_date
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Error logged via middleware
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get attendance stats: {str(e)}"
        )

@router.get("/test")
async def test_attendance_endpoint(
    user_id: str = Query(..., description="User _id for testing"),
    users_db: UsersDB = Depends(get_users_db)
):
    """Test endpoint to check if basic functionality works"""
    try:
        # Get user info
        user = await users_db.get_user(user_id)
        if not user:
            return {"error": "User not found", "user_id": user_id}
        
        # Test basic functionality
        return {
            "success": True,
            "user_id": user_id,
            "user_found": True,
            "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "employee_id": user.get("employee_id", "Not set"),
            "department_id": user.get("department_id", "Not set")
        }
        
    except Exception as e:
        return {"error": str(e), "user_id": user_id}

@router.get("/test-calendar")
async def test_attendance_calendar(
    user_id: str = Query(..., description="User _id making the request"),
    users_db: UsersDB = Depends(get_users_db),
    departments_db: DepartmentsDB = Depends(get_departments_db)
):
    """Test calendar data creation"""
    try:
        # Logged via middleware
        
        # Get user
        employee = await users_db.get_user(user_id)
        # Debug info logged via middleware
        
        if not employee:
            return {"error": "User not found"}
        
        # Test creating calendar object
        user_emp_id = str(employee.get("_id", ""))
        first_name = employee.get('first_name', '')
        last_name = employee.get('last_name', '')
        employee_display_name = f"{first_name} {last_name}".strip()
        
        if not employee_display_name:
            employee_display_name = employee.get("name", "Unknown Employee")
        
        # Create test day
        test_day = AttendanceCalendarDay(
            date="2025-06-01",
            day=1,
            status=None,
            status_text=None,
            is_holiday=False,
            is_weekend=False,
            comments=None
        )
        
        # Create test stats
        test_stats = AttendanceStats(
            total_days=0,
            full_days=0,
            half_days=0,
            absent_days=0,
            holidays=0,
            attendance_percentage=0.0
        )
        
        # Logged via middleware
        # Logged via middleware
        
        # Resolve department name from department_id
        department_name = "Unknown Department"
        if employee.get("department_id"):
            try:
                department = await departments_db.get_department(str(employee["department_id"]))
                if department:
                    department_name = department.get("name", "Unknown Department")
            except Exception as e:
                pass
                # Error logged via middleware
        
        # Logged via middleware

        # Try to create the calendar object
        employee_calendar = EmployeeAttendanceCalendar(
            employee_id=user_emp_id,
            employee_name=employee_display_name,
            employee_photo=employee.get("profile_picture"),
            department_name=department_name,
            role_name=employee.get("role_name"),
            days=[test_day],
            stats=test_stats
        )
        
        return {
            "success": True,
            "employee_id": user_emp_id,
            "employee_name": employee_display_name,
            "department_name": department_name,
            "calendar": employee_calendar.dict()
        }
        
    except Exception as e:
        # Error logged via middleware
        import traceback
        traceback.print_exc()
        return {"error": str(e), "traceback": traceback.format_exc()}

async def check_approved_leave_for_date(employee_id: str, check_date: date, leaves_db = None) -> Optional[Dict[str, Any]]:
    """Check if employee has approved leave for specific date"""
    try:
        # Debug info logged via middleware
        if not leaves_db:
            from app.database import get_database_instances
            leaves_db = get_database_instances()["leaves"]
        
        # Get approved leaves that overlap with the check date
        leaves = await leaves_db.get_leaves_in_date_range(
            start_date=datetime.combine(check_date, datetime.min.time()),
            end_date=datetime.combine(check_date, datetime.max.time())
        )
        
        # Debug info logged via middleware
        
        # Filter for this specific employee and approved status
        for leave in leaves:
            # Debug info logged via middleware
            
            # Check both exact match and case-insensitive match
            if (leave.get("employee_id") == employee_id and 
                (leave.get("status") == "approved" or leave.get("status") == "Approved")):
                
                # Debug info logged via middleware
                
                # Check if the date falls within leave period
                from_date = leave.get("from_date")
                to_date = leave.get("to_date")
                
                # Debug info logged via middleware
                
                # Convert dates if they're strings
                if isinstance(from_date, str):
                    from_date = datetime.fromisoformat(from_date.replace('Z', '+00:00')).date()
                elif isinstance(from_date, datetime):
                    from_date = from_date.date()
                    
                if isinstance(to_date, str):
                    to_date = datetime.fromisoformat(to_date.replace('Z', '+00:00')).date()
                elif isinstance(to_date, datetime):
                    to_date = to_date.date()
                
                # Debug info logged via middleware
                
                if from_date <= check_date <= to_date:
                    # Debug info logged via middleware
                    
                    # Get approver name
                    approved_by_name = None
                    if leave.get("approved_by"):
                        users_db_instance = UsersDB()
                        approver = await users_db_instance.get_user(leave.get("approved_by"))
                        if approver:
                            approved_by_name = f"{approver.get('first_name', '')} {approver.get('last_name', '')}".strip()
                    
                    return {
                        "leave_id": str(leave.get("_id")),
                        "leave_type": leave.get("leave_type"),
                        "leave_type_display": leave.get("leave_type", "").replace("_", " ").title(),
                        "leave_reason": leave.get("reason"),
                        "leave_approved_by": leave.get("approved_by"),
                        "leave_approved_by_name": approved_by_name,
                        "approved_at": leave.get("approved_at"),
                        "approval_comments": leave.get("approval_comments"),
                        "from_date": leave.get("from_date"),
                        "to_date": leave.get("to_date"),
                        "duration_days": leave.get("duration_days"),
                        "status": leave.get("status"),
                        "created_at": leave.get("created_at"),
                        "attachments": leave.get("attachments", []),
                        "leave_details": {
                            "status_badge": leave.get("status", "").upper(),
                            "duration_text": f"{leave.get('duration_days', 0)} day(s)",
                            "approved_by_text": f"Approved by {approved_by_name}" if approved_by_name else "Approved",
                            "leave_summary": f"{leave.get('leave_type', '').replace('_', ' ').title()} - {leave.get('reason', 'No reason provided')}"
                        }
                    }
                    # Debug info logged via middleware
        
        # Debug info logged via middleware
        return None
        
    except Exception as e:
        # Error logged via middleware
        return None

@router.get("/leave-details/{employee_id}/{date}")
async def get_leave_details_for_date(
    employee_id: str,
    date: str,
    user_id: str = Query(..., description="User _id making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get leave details for a specific employee and date"""
    try:
        # Check permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # Allow access if user can view all OR it's their own record
        if not permissions.get("can_view_all", False) and employee_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view leave details"
            )
        
        # Parse date
        try:
            check_date = datetime.strptime(date, '%Y-%m-%d').date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        # Get leave info for the date
        leave_info = await check_approved_leave_for_date(employee_id, check_date)
        
        if not leave_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No approved leave found for this date"
            )
        
        # Get full leave details
        leaves_db_instance = await get_leaves_db()
        leave = await leaves_db_instance.get_leave(leave_info["leave_id"])
        if not leave:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leave record not found"
            )
        
        # Get employee details
        employee = await users_db.get_user(employee_id)
        employee_name = "Unknown Employee"
        if employee:
            employee_name = f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
        
        # Get additional employee details
        employee_details = {
            "employee_id": employee_id,
            "employee_name": employee_name,
            "email": employee.get("email", ""),
            "department_name": "Unknown Department",
            "role_name": employee.get("role_name", "Unknown Role"),
            "profile_picture": employee.get("profile_picture", "")
        }
        
        # Get department name
        if employee.get("department_id"):
            try:
                departments_db = DepartmentsDB()
                department = await departments_db.get_department(str(employee["department_id"]))
                if department:
                    employee_details["department_name"] = department.get("name", "Unknown Department")
            except Exception as e:
                logger.error(f"Error getting department: {e}")
                employee_details["department_name"] = "Unknown Department"
        
        # Format dates for display
        formatted_dates = {}
        if leave.get("from_date"):
            try:
                from_date_obj = leave["from_date"]
                if isinstance(from_date_obj, str):
                    from_date_obj = datetime.fromisoformat(from_date_obj.replace('Z', '+00:00'))
                formatted_dates["from_date_formatted"] = format_datetime_ist(from_date_obj)
            except:
                formatted_dates["from_date_formatted"] = str(leave.get("from_date", ""))
        
        if leave.get("to_date"):
            try:
                to_date_obj = leave["to_date"]
                if isinstance(to_date_obj, str):
                    to_date_obj = datetime.fromisoformat(to_date_obj.replace('Z', '+00:00'))
                formatted_dates["to_date_formatted"] = format_datetime_ist(to_date_obj)
            except:
                formatted_dates["to_date_formatted"] = str(leave.get("to_date", ""))
        
        if leave.get("approved_at"):
            try:
                approved_at_obj = leave["approved_at"]
                if isinstance(approved_at_obj, str):
                    approved_at_obj = datetime.fromisoformat(approved_at_obj.replace('Z', '+00:00'))
                formatted_dates["approved_at_formatted"] = format_datetime_ist(approved_at_obj)
            except:
                formatted_dates["approved_at_formatted"] = str(leave.get("approved_at", ""))
        
        if leave.get("created_at"):
            try:
                created_at_obj = leave["created_at"]
                if isinstance(created_at_obj, str):
                    created_at_obj = datetime.fromisoformat(created_at_obj.replace('Z', '+00:00'))
                formatted_dates["created_at_formatted"] = format_datetime_ist(created_at_obj)
            except:
                formatted_dates["created_at_formatted"] = str(leave.get("created_at", ""))
        
        # Return comprehensive leave information
        return {
            "success": True,
            "leave_details": {
                **leave_info,  # Include all the leave info from check_approved_leave_for_date
                "employee_details": employee_details,
                "formatted_dates": formatted_dates,
                "leave_id": str(leave.get("_id")),
                "leave_type_display": leave.get("leave_type", "").replace("_", " ").title(),
                "reason": leave.get("reason", ""),
                "duration_days": leave.get("duration_days", 0),
                "status": leave.get("status", ""),
                "attachments": leave.get("attachments", []),
                "approval_details": {
                    "approved_by": leave.get("approved_by"),
                    "approved_by_name": leave_info.get("leave_approved_by_name", ""),
                    "approved_at": leave.get("approved_at"),
                    "approval_comments": leave.get("approval_comments", "")
                }
            },
            "date": date,
            "employee_id": employee_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Error logged via middleware
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get leave details: {str(e)}"
        )

@router.get("/leave-summary/{employee_id}/{date}")
async def get_leave_summary_for_date(
    employee_id: str,
    date: str,
    user_id: str = Query(..., description="User _id making the request"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get leave summary for a specific employee and date"""
    try:
        # Check permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # Allow access if user can view all OR it's their own record
        if not permissions.get("can_view_all", False) and employee_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view leave summary"
            )
        
        # Parse date
        try:
            check_date = datetime.strptime(date, '%Y-%m-%d').date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        # Get leave info for the date
        leave_info = await check_approved_leave_for_date(employee_id, check_date)
        
        if not leave_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No approved leave found for this date"
            )
        
        return {
            "success": True,
            "employee_id": employee_id,
            "date": date,
            "leave_summary": {
                "leave_type": leave_info["leave_type_display"],
                "reason": leave_info["leave_reason"],
                "status": "Approved",
                "approved_by": leave_info["leave_approved_by_name"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Error logged via middleware
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get leave summary: {str(e)}"
        )

@router.get("/detail/{employee_id}/{date}")
@router.get("/details/{employee_id}/{date}")
async def get_attendance_details_for_date(
    employee_id: str,
    date: str,
    user_id: str = Query(..., alias="user_id", description="User _id making the request"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get attendance details for a specific employee and date"""
    try:
        # Debug info logged via middleware
        
        # Parse date first
        try:
            check_date = datetime.strptime(date, '%Y-%m-%d').date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        # Get employee details first - handle both _id and employee_id
        employee = None
        actual_user_id = None
        
        # First try to get user by _id (MongoDB ObjectId)
        try:
            employee = await users_db.get_user(employee_id)
            if employee:
                actual_user_id = str(employee["_id"])
        except:
            pass
        
        # If not found, try to find by employee_id field
        if not employee:
            try:
                # Search for user with matching employee_id field
                users = await users_db.list_users()
                for user in users:
                    if user.get("employee_id") == employee_id:
                        employee = user
                        actual_user_id = str(user["_id"])
                        break
            except Exception as e:
                print(f"Error searching by employee_id: {e}")
        
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee not found with ID: {employee_id}"
            )
        
        # Check permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # Allow access if user can view all OR it's their own record OR they can view junior
        can_view_all = permissions.get("can_view_all", False)
        can_view_junior = permissions.get("can_view_junior", False)
        is_own_record = actual_user_id == user_id
        
        can_access = False
        if can_view_all or is_own_record:
            can_access = True
        elif can_view_junior:
            # Check if target user is a subordinate
            subordinate_user_ids = await get_subordinate_users_for_attendance(user_id, users_db, roles_db)
            if actual_user_id in subordinate_user_ids:
                can_access = True
        
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view attendance details"
            )
        
        employee_name = f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
        if not employee_name:
            employee_name = "Unknown Employee"
        
        # Get attendance record using the actual MongoDB _id
        attendance_record = await get_attendance_by_user_date(actual_user_id, date, attendance_db)
        
        # Check for approved leave on this date using the actual MongoDB _id
        leave_info = await check_approved_leave_for_date(actual_user_id, check_date)
        
        # Debug info logged via middleware
        # Debug info logged via middleware
        
        # If there's a leave record, return leave details
        if leave_info:
            # Debug info logged via middleware
            
            # Get full leave details
            leaves_db_instance = await get_leaves_db()
            leave = await leaves_db_instance.get_leave(leave_info["leave_id"])
            if not leave:
                # Debug info logged via middleware
                # Fallback to leave_info data
                leave = leave_info
            
            # Get department name
            department_name = "Unknown Department"
            if employee.get("department_id"):
                try:
                    departments_db = DepartmentsDB()
                    department = await departments_db.get_department(str(employee["department_id"]))
                    if department:
                        department_name = department.get("name", "Unknown Department")
                except Exception as e:
                    logger.error(f"Error getting department: {e}")
                    # Error logged via middleware
            
            # Get approver name
            approved_by_name = leave_info.get("leave_approved_by_name", "Unknown")
            
            return {
                "success": True,
                "type": "leave",
                "employee": {
                    "employee_id": employee.get("employee_id", employee_id),  # Return actual employee_id field
                    "user_id": actual_user_id,  # Include the MongoDB _id for reference
                    "employee_name": employee_name,
                    "email": employee.get("email", ""),
                    "department_name": department_name,
                    "role_name": employee.get("role_name", "Unknown Role"),
                    "profile_picture": employee.get("profile_picture", "")
                },
                "leave_details": {
                    "leave_id": leave_info["leave_id"],
                    "leave_type": leave_info["leave_type"],
                    "leave_type_display": leave_info["leave_type_display"],
                    "from_date": leave.get("from_date"),
                    "to_date": leave.get("to_date"),
                    "duration_days": leave.get("duration_days", 1),
                    "reason": leave_info["leave_reason"],
                    "status": "approved",
                    "status_display": "Approved",
                    "approved_by": leave_info["leave_approved_by"],
                    "approved_by_name": approved_by_name,
                    "approved_at": leave.get("approved_at"),
                    "approval_comments": leave_info.get("approval_comments", ""),
                    "attachments": leave.get("attachments", []),
                    "created_at": leave.get("created_at"),
                    "leave_summary": f"{leave_info['leave_type_display']} - {leave_info['leave_reason']}"
                },
                "date": date,
                "status": "0",  # Leave status
                "status_text": f"Leave ({leave_info['leave_type_display']})"
            }
        
        # If there's an attendance record, return attendance details
        elif attendance_record:
            # Debug info logged via middleware
            
            # Compute status_reason from attendance data as fallback for overwritten comments
            raw_comments = attendance_record.get("comments", "")
            status_val = attendance_record.get("status")
            # If comments look like a generic checkout message, compute the real reason
            generic_checkout = raw_comments.lower().startswith("check-out") or raw_comments.lower().startswith("normal check") if raw_comments else True
            if generic_checkout and status_val == 0.5:
                ci_time = attendance_record.get("check_in_time", "")
                if ci_time:
                    try:
                        ci_parts = ci_time.split(":")
                        ci_hour, ci_min = int(ci_parts[0]), int(ci_parts[1])
                        settings_db = SettingsDB()
                        att_settings = await settings_db.get_attendance_settings()
                        deadline_str = att_settings.get("reporting_deadline", "10:15")
                        dl_parts = deadline_str.split(":")
                        dl_hour, dl_min = int(dl_parts[0]), int(dl_parts[1])
                        if (ci_hour > dl_hour) or (ci_hour == dl_hour and ci_min > dl_min):
                            raw_comments = "Late check-in - Half day"
                        else:
                            raw_comments = "Half day - Early checkout / insufficient hours"
                    except:
                        raw_comments = "Half day"

            # Build attendance object with id for frontend edit flow
            attendance_obj = {
                "id": attendance_record.get("id") or str(attendance_record.get("_id", "")),
                "employee_id": actual_user_id,
                "employee_name": employee_name,
                "date": attendance_record.get("date"),
                "status": attendance_record.get("status"),
                "status_text": get_status_text(attendance_record.get("status")),
                "check_in_time": attendance_record.get("check_in_time", ""),
                "check_out_time": attendance_record.get("check_out_time", ""),
                "total_working_hours": attendance_record.get("total_working_hours", 0.0),
                "comments": raw_comments,
                "marked_by": attendance_record.get("marked_by", ""),
                "is_holiday": attendance_record.get("is_holiday", False),
                "photo_path": attendance_record.get("photo_path", ""),
                "check_in_photo_path": attendance_record.get("check_in_photo_path", ""),
                "check_out_photo_path": attendance_record.get("check_out_photo_path", ""),
                "check_in_geolocation": attendance_record.get("check_in_geolocation", {}),
                "check_out_geolocation": attendance_record.get("check_out_geolocation", {})
            }
            
            return {
                "success": True,
                "type": "attendance",
                "attendance": attendance_obj,
                "employee": {
                    "employee_id": employee.get("employee_id", employee_id),
                    "user_id": actual_user_id,
                    "employee_name": employee_name,
                    "email": employee.get("email", ""),
                    "department_name": "Unknown Department",
                    "role_name": employee.get("role_name", "Unknown Role"),
                    "profile_picture": employee.get("profile_picture", "")
                },
                "attendance_details": attendance_obj,
                "date": date,
                "status": attendance_record.get("status"),
                "status_text": get_status_text(attendance_record.get("status"))
            }
        
        # No record found
        else:
            print(f"DEBUG: No attendance or leave record found for employee_id={employee_id} (user_id={actual_user_id}) on {date}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No attendance or leave record found for this date"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting attendance details for {employee_id} on {date}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get attendance details: {str(e)}"
        )
        if employee:
            employee_name = f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
        
        # Return detailed attendance information
        return {
            "success": True,
            "attendance": {
                "attendance_id": str(attendance_record["_id"]),
                "employee_id": employee_id,
                "employee_name": employee_name,
                "date": attendance_record.get("date"),
                "status": attendance_record.get("status"),
                "check_in_time": attendance_record.get("check_in_time"),
                "check_out_time": attendance_record.get("check_out_time"),
                "check_in_location": attendance_record.get("check_in_location"),
                "check_out_location": attendance_record.get("check_out_location"),
                "check_in_coordinates": attendance_record.get("check_in_coordinates"),
                "check_out_coordinates": attendance_record.get("check_out_coordinates"),
                "photo_path": attendance_record.get("photo_path"),
                "check_in_photo_path": attendance_record.get("check_in_photo_path"),
                "check_out_photo_path": attendance_record.get("check_out_photo_path"),
                "comments": attendance_record.get("comments"),
                "total_hours": attendance_record.get("total_hours"),
                "break_hours": attendance_record.get("break_hours"),
                "created_at": attendance_record.get("created_at"),
                "updated_at": attendance_record.get("updated_at")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting attendance details: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get attendance details: {str(e)}"
        )

@router.post("/check-in")
async def check_in_attendance(
    check_in_data: AttendanceCheckInRequest,
    user_id: str = Query(..., description="User _id checking in"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Check-in with photo and geolocation (required)"""
    try:
        # Get user info
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get attendance settings
        settings_db = SettingsDB()
        settings = await settings_db.get_attendance_settings()
        
        # Validate geofence if enabled
        if settings.get("geofence_enabled", False):
            office_location = {
                "latitude": settings.get("office_latitude"),
                "longitude": settings.get("office_longitude")
            }
            user_location = {
                "latitude": check_in_data.geolocation.latitude,
                "longitude": check_in_data.geolocation.longitude
            }
            
            if not validate_geofence(user_location, office_location, settings.get("geofence_radius", 100.0)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You are outside the allowed check-in area"
                )
        
        # ==== FACIAL VERIFICATION (if face descriptor provided) ====
        face_verification_result = None
        if check_in_data.face_descriptor:
            try:
                # Get registered face data
                registered_face = await attendance_db.get_employee_face_data(user_id)
                
                if registered_face:
                    # Verify face
                    import numpy as np
                    
                    current_descriptor = check_in_data.face_descriptor.get("descriptor", [])
                    
                    if len(current_descriptor) == 128:
                        # Compare with all registered samples
                        registered_descriptors = registered_face.get("face_descriptors", [])
                        
                        if registered_descriptors:
                            min_distance = float('inf')
                            for sample in registered_descriptors:
                                sample_desc = sample.get("descriptor", [])
                                if len(sample_desc) == 128:
                                    # Calculate Euclidean distance
                                    distance = np.linalg.norm(np.array(current_descriptor) - np.array(sample_desc))
                                    min_distance = min(min_distance, distance)
                            
                            threshold = 0.6
                            verified = min_distance < threshold
                            confidence = max(0, 1 - (min_distance / threshold))
                            
                            face_verification_result = {
                                "verified": verified,
                                "confidence": round(confidence, 3),
                                "distance": round(min_distance, 3)
                            }
                            
                            # Log verification attempt
                            log_data = {
                                "employee_id": user_id,
                                "verification_result": "success" if verified else "failure",
                                "confidence_score": confidence,
                                "threshold_used": threshold
                            }
                            await attendance_db.log_face_verification_attempt(log_data)
                            
                            # If facial verification is enforced in settings, reject on failure
                            if settings.get("enforce_facial_verification", False) and not verified:
                                raise HTTPException(
                                    status_code=status.HTTP_403_FORBIDDEN,
                                    detail=f"Facial verification failed. Confidence: {round(confidence*100, 1)}%"
                                )
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"Face verification error (non-blocking): {e}")
                # Don't block check-in if face verification fails (unless enforced)
                if settings.get("enforce_facial_verification", False):
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Face verification system error"
                    )
        
        # Check if already checked in today
        today = date.today().isoformat()
        existing = await attendance_db.get_attendance_detail(user_id, today)
        if existing and existing.get("check_in_time"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already checked in today"
            )
        
        # Save check-in photo
        check_in_photo_path = save_attendance_photo(
            check_in_data.photo_data, user_id, today, "checkin"
        )
        
        if not check_in_photo_path:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save check-in photo"
            )
        
        # Prepare check-in data with IST time
        ist_now = get_ist_now()
        check_in_time = ist_now.strftime("%H:%M:%S")
        
        # Get timing settings from database
        check_in_start_time = settings.get("check_in_start_time", "09:00")  # Default 9:00 AM
        # Grace deadline: check-in up to this time = Full Day; after = Half Day
        reporting_deadline = settings.get("reporting_deadline", "10:15")  # Default grace 10:15 AM
        check_out_start_time = settings.get("check_out_start_time", "17:00")  # Default 5:00 PM
        check_out_end_time = settings.get("check_out_end_time", "20:00")    # Default 8:00 PM
        
        # Determine if late check-in based on IST and settings
        check_in_time_obj = ist_now.time()
        start_threshold = datetime.strptime(check_in_start_time, "%H:%M").time()
        late_threshold = datetime.strptime(reporting_deadline, "%H:%M").time()  # 10:15 grace cutoff
        checkout_start = datetime.strptime(check_out_start_time, "%H:%M").time()
        checkout_end = datetime.strptime(check_out_end_time, "%H:%M").time()
        
        # Determine status based on check-in time
        if check_in_time_obj > checkout_end:
            # After 20:00 — mark ABSENT (working hours window closed)
            attendance_status = -1
            status_reason = f"Absent: check-in attempted after working hours (after {check_out_end_time})"
        elif check_in_time_obj < start_threshold:
            # Too early - mark as half day
            attendance_status = 0.5
            status_reason = "Early check-in before allowed time"
        elif check_in_time_obj <= late_threshold:
            # Within grace time (up to 10:15) — full day potential
            attendance_status = 1
            status_reason = "On-time check-in"
        elif check_in_time_obj <= checkout_start:
            # After grace time (10:15+) but before checkout — Late check-in: Half day
            attendance_status = 0.5
            status_reason = f"Late check-in after {reporting_deadline} - Half day"
        else:
            # After check-in window but before 20:00 — half day
            attendance_status = 0.5
            status_reason = "Check-in after allowed window - Half day"
        
        check_in_record = {
            "check_in_time": check_in_time,
            "check_in_photo_path": check_in_photo_path,
            "check_in_location": {
                "latitude": check_in_data.geolocation.latitude,
                "longitude": check_in_data.geolocation.longitude,
                "accuracy": check_in_data.geolocation.accuracy,
                "address": check_in_data.geolocation.address
            },
            "check_in_coordinates": {
                "latitude": check_in_data.geolocation.latitude,
                "longitude": check_in_data.geolocation.longitude
            },
            "comments": check_in_data.comments or status_reason,
            "status": attendance_status  # Set status based on timing
        }
        
        # Check-in employee
        attendance_id = await attendance_db.check_in_employee(user_id, check_in_record)
        
        # Format response with IST time
        formatted_time = format_datetime_ist(ist_now)
        
        # Determine response message based on status
        if attendance_status == 1:
            message = "Checked in successfully - Full day potential"
        elif attendance_status == 0.5:
            message = "Checked in - Half day marked (Late arrival or early check-in)"
        elif attendance_status == -1:
            message = "Checked in - Marked ABSENT (check-in after working hours ended)"
        else:
            message = "Checked in successfully"
        
        response = {
            "success": True,
            "message": message,
            "attendance_id": attendance_id,
            "check_in_time": check_in_time,
            "check_in_time_ist": formatted_time,
            "ist_time": ist_now.strftime("%Y-%m-%d %H:%M:%S"),
            "status_code": attendance_status,
            "status_text": get_status_text(attendance_status),
            "status_reason": status_reason,
            "location": {
                "latitude": check_in_data.geolocation.latitude,
                "longitude": check_in_data.geolocation.longitude,
                "address": check_in_data.geolocation.address
            }
        }
        
        # Add face verification result if available
        if face_verification_result:
            response["face_verification"] = face_verification_result
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error checking in: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check in: {str(e)}"
        )

@router.post("/check-out")
async def check_out_attendance(
    check_out_data: AttendanceCheckOutRequest,
    user_id: str = Query(..., description="User _id checking out"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Check-out with photo and geolocation (required)"""
    try:
        # Get user info
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get attendance settings
        settings_db = SettingsDB()
        settings = await settings_db.get_attendance_settings()
        
        # Check if checked in today
        today = date.today().isoformat()
        existing = await attendance_db.get_attendance_detail(user_id, today)
        if not existing or not existing.get("check_in_time"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No check-in record found for today"
            )
        
        if existing.get("check_out_time"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already checked out today"
            )
        
        # Validate geofence if enabled
        if settings.get("geofence_enabled", False):
            office_location = {
                "latitude": settings.get("office_latitude"),
                "longitude": settings.get("office_longitude")
            }
            user_location = {
                "latitude": check_out_data.geolocation.latitude,
                "longitude": check_out_data.geolocation.longitude
            }
            
            if not validate_geofence(user_location, office_location, settings.get("geofence_radius", 100.0)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You are outside the allowed check-out area"
                )
        
        # Save check-out photo
        check_out_photo_path = save_attendance_photo(
            check_out_data.photo_data, user_id, today, "checkout"
        )
        
        if not check_out_photo_path:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save check-out photo"
            )
        
        # Prepare check-out data with IST time
        ist_now = get_ist_now()
        check_out_time = ist_now.strftime("%H:%M:%S")
        
        # Get timing settings from database
        check_out_start_time = settings.get("check_out_start_time", "17:00")  # Default 5:00 PM
        check_out_end_time = settings.get("check_out_end_time", "20:00")    # Default 8:00 PM
        minimum_hours = settings.get("minimum_working_hours", 8.0)
        
        # Get current status from check-in (might be 1, 0.5, or -2)
        current_status = existing.get("status", 1)
        
        # Calculate working hours using IST times
        check_in_time_str = existing.get("check_in_time")
        check_out_time_obj = ist_now.time()
        checkout_start = datetime.strptime(check_out_start_time, "%H:%M").time()
        checkout_end = datetime.strptime(check_out_end_time, "%H:%M").time()
        
        if check_in_time_str:
            check_in_dt = datetime.strptime(f"{today} {check_in_time_str}", "%Y-%m-%d %H:%M:%S")
            check_out_dt = datetime.strptime(f"{today} {check_out_time}", "%Y-%m-%d %H:%M:%S")
            working_hours = (check_out_dt - check_in_dt).total_seconds() / 3600
            
            # Determine final status based on check-in status, working hours, and check-out time
            if check_out_time_obj > checkout_end:
                # After 20:00 — mark ABSENT regardless of hours worked
                final_status = -1
                status_reason = f"Absent: check-out after working hours (after {check_out_end_time})"
            elif current_status == -1:
                # Already auto-absent (e.g. checked in after 20:00)
                final_status = -1
                status_reason = "Absent: check-in was after working hours"
            elif current_status == -2:
                # Already marked absent due to very late check-in
                final_status = -2
                status_reason = "Marked absent due to very late check-in"
            elif check_out_time_obj < checkout_start:
                # Early check-out - half day regardless of hours worked
                final_status = 0.5
                status_reason = "Early check-out - Half day"
            else:
                # Normal check-out time window
                if working_hours >= minimum_hours:
                    final_status = max(current_status, 1) if current_status != -2 else -2
                elif working_hours >= minimum_hours / 2:
                    final_status = 0.5
                else:
                    final_status = 0.5
                status_reason = "Normal check-out"
                
            # Don't upgrade status if check-in was already penalized
            if current_status == 0.5 and final_status == 1:
                final_status = 0.5
                status_reason = "Half day maintained due to late check-in"
        else:
            working_hours = 0
            final_status = 0.5
            status_reason = "No valid check-in time"
        
        check_out_record = {
            "check_out_time": check_out_time,
            "check_out_photo_path": check_out_photo_path,
            "check_out_location": {
                "latitude": check_out_data.geolocation.latitude,
                "longitude": check_out_data.geolocation.longitude,
                "accuracy": check_out_data.geolocation.accuracy,
                "address": check_out_data.geolocation.address
            },
            "check_out_coordinates": {
                "latitude": check_out_data.geolocation.latitude,
                "longitude": check_out_data.geolocation.longitude
            },
            "comments": check_out_data.comments or status_reason,
            "total_working_hours": round(working_hours, 2),
            "status": final_status
        }
        
        # Check-out employee
        attendance_id = await attendance_db.check_out_employee(user_id, check_out_record)
        
        # Get updated attendance record to show final status
        updated_record = await attendance_db.get_attendance_detail(user_id, today)
        
        # Format response with IST time
        formatted_time = format_datetime_ist(ist_now)
        
        from app.schemas.attendance_schemas import get_status_text, format_working_hours
        
        # Determine response message based on final status
        if final_status == 1:
            message = "Checked out successfully - Full day completed"
        elif final_status == 0.5:
            message = "Checked out - Half day marked"
        elif final_status == -1:
            message = "Checked out - Marked ABSENT (outside working hours)"
        elif final_status == -2:
            message = "Checked out - Marked absent (due to very late check-in)"
        else:
            message = "Checked out successfully"
        
        return {
            "success": True,
            "message": message,
            "attendance_id": attendance_id,
            "check_out_time": check_out_time,
            "check_out_time_ist": formatted_time,
            "ist_time": ist_now.strftime("%Y-%m-%d %H:%M:%S"),
            "total_working_hours": round(working_hours, 2),
            "total_working_hours_formatted": format_working_hours(working_hours),
            "final_status": get_status_text(final_status),
            "status_code": final_status,
            "status_reason": status_reason,
            "check_in_status": get_status_text(current_status),
            "location": {
                "latitude": check_out_data.geolocation.latitude,
                "longitude": check_out_data.geolocation.longitude,
                "address": check_out_data.geolocation.address
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error checking out: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check out: {str(e)}"
        )

@router.put("/edit/{attendance_id}")
async def edit_attendance(
    attendance_id: str,
    edit_data: AttendanceEditRequest,
    admin_id: str = Query(..., description="ID of admin editing the attendance"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    attendance_history_db = Depends(get_attendance_history_db)
):
    """Edit attendance record (admin only)"""
    try:
        # Check admin permissions (support both old 'update' and new 'update_attendance')
        from app.utils.permissions import check_permission, PermissionManager
        perms_check = await PermissionManager.get_user_permissions(admin_id, users_db, roles_db)
        has_update = PermissionManager.has_permission(perms_check, "attendance", "update_attendance") or \
                     PermissionManager.has_permission(perms_check, "attendance", "update") or \
                     PermissionManager.has_permission(perms_check, "attendance", "view_all") or \
                     PermissionManager.has_permission(perms_check, "attendance", "all")
        if not has_update:
            from fastapi import HTTPException, status as http_status
            raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="You don't have permission to update_attendance attendance")
        
        # Validate attendance ID
        if not ObjectId.is_valid(attendance_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid attendance ID"
            )
        
        # Get existing record for history tracking
        existing_record = await attendance_db.collection.find_one({"_id": ObjectId(attendance_id)})
        if not existing_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance record not found"
            )
        
        # Get admin info for history
        admin = await users_db.get_user(admin_id)
        admin_name = admin.get("name") or admin.get("username", "Unknown Admin") if admin else "Unknown Admin"
        
        # Validate time formats if provided
        if edit_data.check_in_time:
            try:
                datetime.strptime(edit_data.check_in_time, "%H:%M:%S")
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid check-in time format. Use HH:MM:SS"
                )
        
        if edit_data.check_out_time:
            try:
                datetime.strptime(edit_data.check_out_time, "%H:%M:%S")
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid check-out time format. Use HH:MM:SS"
                )
        
        # Validate status if provided
        if edit_data.status is not None and edit_data.status not in [1.0, 0.5, 0.0, -1.0, -2.0]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status. Must be 1.0 (Full Day), 0.5 (Half Day), 0.0 (Leave), -1.0 (Absent), or -2.0 (Absconding)"
            )
        
        # Edit attendance
        success = await attendance_db.edit_attendance(
            attendance_id, 
            edit_data.dict(exclude_none=True), 
            admin_id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance record not found or no changes made"
            )
        
        # Add history entries for changes
        changes = []
        update_data = edit_data.dict(exclude_none=True)
        update_reason = update_data.pop('reason', None)  # Extract reason separately
        
        for field, new_value in update_data.items():
            old_value = existing_record.get(field)
            if old_value != new_value:
                changes.append(f"{field}: {old_value} → {new_value}")
        
        # Add summary history entry
        if changes:
            history_details = {"changes": changes}
            if update_reason:
                history_details["reason"] = update_reason
                
            await attendance_history_db.add_history_entry(
                attendance_id=attendance_id,
                user_id=str(existing_record.get("user_id")),
                date=existing_record.get("date"),
                action_type="attendance_edited",
                action_description=f"Attendance record edited by {admin_name}: {', '.join(changes)}",
                created_by=admin_id,
                created_by_name=admin_name,
                details=history_details,
                reason=update_reason
            )

        # Invalidate calendar cache so the UI gets fresh data on next fetch
        try:
            invalidate_cache_pattern("get_calendar_attendance")
            invalidate_cache_pattern("get_attendance_calendar")
        except Exception:
            pass

        return {
            "success": True,
            "message": "Attendance updated successfully",
            "updated_by": admin_id,
            "updated_at": get_ist_now().isoformat(),
            "changes": changes
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error editing attendance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to edit attendance: {str(e)}"
        )

@router.post("/check-out")
async def check_out_attendance(
    check_out_data: AttendanceCheckOutRequest,
    user_id: str = Query(..., description="User _id checking out"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Check-out with photo and geolocation (required)"""
    try:
        # Get user info
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if checked in today
        today = date.today().isoformat()
        existing = await attendance_db.get_attendance_detail(user_id, today)
        if not existing or not existing.get("check_in_time"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No check-in record found for today"
            )
        
        if existing.get("check_out_time"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already checked out today"
            )
        
        # Save check-out photo
        check_out_photo_path = save_attendance_photo(
            check_out_data.photo_data, user_id, today, "checkout"
        )
        
        if not check_out_photo_path:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save check-out photo"
            )
        
        # Prepare check-out data
        now = get_ist_now()
        check_out_time = now.strftime("%H:%M:%S")
        
        check_out_record = {
            "check_out_time": check_out_time,
            "check_out_photo_path": check_out_photo_path,
            "check_out_location": {
                "latitude": check_out_data.geolocation.latitude,
                "longitude": check_out_data.geolocation.longitude,
                "accuracy": check_out_data.geolocation.accuracy,
                "address": check_out_data.geolocation.address
            },
            "comments": check_out_data.comments
        }
        
        # Check-out employee
        attendance_id = await attendance_db.check_out_employee(user_id, check_out_record)
        
        # Get updated record to show working hours and status
        updated_record = await attendance_db.get_attendance_detail(user_id, today)
        
        # Format response with IST time
        formatted_time = format_datetime_ist(now)
        
        return {
            "success": True,
            "message": "Checked out successfully",
            "attendance_id": attendance_id,
            "check_out_time": check_out_time,
            "check_out_time_ist": formatted_time,
            "total_working_hours": updated_record.get("total_working_hours", 0),
            "status": updated_record.get("status"),
            "status_text": get_status_text(updated_record.get("status", 0)),
            "location": {
                "latitude": check_out_data.geolocation.latitude,
                "longitude": check_out_data.geolocation.longitude,
                "address": check_out_data.geolocation.address
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error checking out: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check out: {str(e)}"
        )

@router.put("/edit/{target_user_id}/{date}")
async def edit_attendance_record(
    target_user_id: str,
    date: str,
    edit_data: AttendanceEditRequest,
    user_id: str = Query(..., description="User _id making the request"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Edit attendance record (editable fields: check-in time, check-out time, comments)"""
    try:
        # Check permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # Allow editing if user can edit OR it's their own record (with restrictions)
        if not permissions.get("can_edit", False) and target_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to edit attendance"
            )
        
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        # Get existing record
        existing = await attendance_db.get_attendance_detail(target_user_id, date)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No attendance record found for this date"
            )
        
        # Prepare update data
        update_data = {}
        if edit_data.check_in_time is not None:
            update_data["check_in_time"] = edit_data.check_in_time
        if edit_data.check_out_time is not None:
            update_data["check_out_time"] = edit_data.check_out_time
        if edit_data.comments is not None:
            update_data["comments"] = edit_data.comments
        if edit_data.status is not None and permissions.get("can_edit", False):
            # Only allow status override for admins
            update_data["status"] = edit_data.status
        
        # Update record
        success = await attendance_db.update_attendance_record(target_user_id, date, update_data)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update attendance record"
            )
        
        # Get updated record
        updated_record = await attendance_db.get_attendance_detail(target_user_id, date)
        
        return {
            "success": True,
            "message": "Attendance record updated successfully",
            "updated_fields": list(update_data.keys()),
            "status": updated_record.get("status"),
            "status_text": get_status_text(updated_record.get("status", 0)),
            "total_working_hours": updated_record.get("total_working_hours")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error editing attendance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to edit attendance: {str(e)}"
        )

@router.get("/status/today")
async def get_today_attendance_status(
    user_id: str = Query(..., description="User _id to check status for"),
    attendance_db: AttendanceDB = Depends(get_attendance_db)
):
    """Get today's attendance status (checked in, checked out, etc.)"""
    try:
        today = date.today().isoformat()
        attendance = await attendance_db.get_attendance_detail(user_id, today)
        
        if not attendance:
            return {
                "success": True,
                "has_checked_in": False,
                "has_checked_out": False,
                "can_check_in": True,
                "can_check_out": False,
                "attendance": None
            }
        
        has_checked_in = bool(attendance.get("check_in_time"))
        has_checked_out = bool(attendance.get("check_out_time"))
        
        return {
            "success": True,
            "has_checked_in": has_checked_in,
            "has_checked_out": has_checked_out,
            "can_check_in": not has_checked_in,
            "can_check_out": has_checked_in and not has_checked_out,
            "attendance": {
                "id": str(attendance["_id"]),
                "check_in_time": attendance.get("check_in_time"),
                "check_out_time": attendance.get("check_out_time"),
                "total_working_hours": attendance.get("total_working_hours"),
                "status": attendance.get("status"),
                "status_text": get_status_text(attendance.get("status", 0)) if attendance.get("status") is not None else None
            }
        }
        
    except Exception as e:
        print(f"Error getting today's status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get today's status: {str(e)}"
        )

@router.get("/today/{user_id}")
async def get_today_attendance(
    user_id: str,
    requester_id: str = Query(..., description="ID of user requesting the data"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get today's attendance status for a user"""
    try:
        # Check permissions - user can view their own or admins can view all
        if user_id != requester_id:
            from app.utils.permissions import check_permission
            await check_permission(requester_id, "attendance", "show", users_db, roles_db)
        
        # Get today's attendance
        today = date.today().isoformat()
        attendance = await attendance_db.get_attendance_detail(user_id, today)
        
        if not attendance:
            return {
                "success": True,
                "has_attendance": False,
                "date": today,
                "date_formatted": format_datetime_ist(get_ist_now()).split(",")[0],
                "can_check_in": True,
                "can_check_out": False,
                "message": "No attendance record for today"
            }
        
        can_check_in = not attendance.get("check_in_time")
        can_check_out = attendance.get("check_in_time") and not attendance.get("check_out_time")
        
        return {
            "success": True,
            "has_attendance": True,
            "data": attendance,
            "can_check_in": can_check_in,
            "can_check_out": can_check_out,
            "message": "Today's attendance retrieved successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting today's attendance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get today's attendance: {str(e)}"
        )

@router.get("/status/current/{user_id}")
async def get_current_status(
    user_id: str,
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Get current check-in/out status for a user"""
    try:
        # Get user info
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get today's attendance
        today = date.today().isoformat()
        attendance = await attendance_db.get_attendance_detail(user_id, today)
        
        if not attendance:
            return {
                "success": True,
                "checked_in": False,
                "checked_out": False,
                "can_check_in": True,
                "can_check_out": False,
                "current_status": "Not checked in",
                "date": today
            }
        
        checked_in = bool(attendance.get("check_in_time"))
        checked_out = bool(attendance.get("check_out_time"))
        
        if checked_in and checked_out:
            current_status = f"Completed - {attendance.get('status_text', 'Unknown')}"
        elif checked_in:
            current_status = "Checked in - Awaiting checkout"
        else:
            current_status = "Not checked in"
        
        return {
            "success": True,
            "checked_in": checked_in,
            "checked_out": checked_out,
            "can_check_in": not checked_in,
            "can_check_out": checked_in and not checked_out,
            "current_status": current_status,
            "check_in_time": attendance.get("check_in_time"),
            "check_out_time": attendance.get("check_out_time"),
            "check_in_time_formatted": attendance.get("check_in_time_formatted"),
            "check_out_time_formatted": attendance.get("check_out_time_formatted"),
            "total_working_hours": attendance.get("total_working_hours", 0.0),
            "total_working_hours_formatted": attendance.get("total_working_hours_formatted", "0 hours"),
            "status": attendance.get("status_text", "Unknown"),
            "is_late": attendance.get("is_late", False),
            "is_early_departure": attendance.get("is_early_departure", False),
            "date": today
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting current status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get current status: {str(e)}"
        )

# ===== ATTENDANCE COMMENTS ENDPOINTS =====

@router.post("/comments/add")
async def add_attendance_comment(
    user_id: str = Query(..., description="Employee user ID for the attendance"),
    date: str = Query(..., description="Date of attendance (YYYY-MM-DD)"),
    content: str = Query(..., description="Comment content"),
    requester_id: str = Query(..., description="User ID making the request"),
    attendance_comments_db = Depends(get_attendance_comments_db),
    users_db: UsersDB = Depends(lambda: UsersDB()),
    roles_db: RolesDB = Depends(lambda: RolesDB()),
    attendance_db: AttendanceDB = Depends(lambda: AttendanceDB()),
    attendance_history_db = Depends(get_attendance_history_db)
):
    """Add a comment to an attendance record"""
    try:
        # Check permissions
        permissions = await get_user_permissions(requester_id, users_db, roles_db)
        if not permissions.get("can_edit") and requester_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to add comments to this attendance record"
            )
        
        # Get requester info
        requester = await users_db.get_user(requester_id)
        if not requester:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requester not found"
            )
        
        requester_name = requester.get("name") or requester.get("username", "Unknown User")
        
        # Get attendance record if exists
        attendance_record = await get_attendance_by_user_date(user_id, date, attendance_db)
        attendance_id = str(attendance_record["_id"]) if attendance_record else None
        
        # Add comment
        comment_id = await attendance_comments_db.add_comment(
            attendance_id=attendance_id,
            user_id=user_id,
            date=date,
            content=content,
            created_by=requester_id,
            created_by_name=requester_name
        )
        
        if not comment_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add comment"
            )
        
        # Add history entry
        await attendance_history_db.add_history_entry(
            attendance_id=attendance_id,
            user_id=user_id,
            date=date,
            action_type="comment_added",
            action_description=f"Comment added by {requester_name}",
            created_by=requester_id,
            created_by_name=requester_name,
            details={"comment_content": content[:100] + "..." if len(content) > 100 else content}
        )
        
        return {
            "success": True,
            "message": "Comment added successfully",
            "comment_id": comment_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding attendance comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add comment: {str(e)}"
        )

@router.get("/comments/{user_id}/{date}")
async def get_attendance_comments(
    user_id: str,
    date: str,
    requester_id: str = Query(..., description="User ID making the request"),
    attendance_comments_db = Depends(get_attendance_comments_db),
    users_db: UsersDB = Depends(lambda: UsersDB()),
    roles_db: RolesDB = Depends(lambda: RolesDB())
):
    """Get all comments for a specific attendance record"""
    try:
        # Check permissions
        permissions = await get_user_permissions(requester_id, users_db, roles_db)
        if not permissions.get("can_view_all") and requester_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view comments for this attendance record"
            )
        
        # Get comments
        comments = await attendance_comments_db.get_comments_by_attendance(user_id, date)
        
        return {
            "success": True,
            "comments": comments,
            "total": len(comments)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting attendance comments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get comments: {str(e)}"
        )

# ===== ATTENDANCE HISTORY ENDPOINTS =====

@router.get("/edit-counts")
async def get_edit_counts(
    user_ids: str = Query(..., description="Comma-separated MongoDB user _ids"),
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
    requester_id: str = Query(..., description="User _id making the request"),
    attendance_history_db = Depends(get_attendance_history_db),
    users_db: UsersDB = Depends(lambda: UsersDB()),
    roles_db: RolesDB = Depends(lambda: RolesDB())
):
    """Get attendance edit counts per employee for a date range (from DB, survives refresh)"""
    try:
        permissions = await get_user_permissions(requester_id, users_db, roles_db)
        if not permissions.get("can_view_all") and not permissions.get("can_view"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view edit counts"
            )

        uid_list = [uid.strip() for uid in user_ids.split(",") if uid.strip()]
        counts = await attendance_history_db.get_edit_counts_by_month(uid_list, start_date, end_date)

        return {
            "success": True,
            "counts": counts  # { mongo_user_id: count }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting edit counts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get edit counts: {str(e)}"
        )


@router.get("/history/{user_id}/{date}")
async def get_attendance_history(
    user_id: str,
    date: str,
    requester_id: str = Query(..., description="User ID making the request"),
    attendance_history_db = Depends(get_attendance_history_db),
    users_db: UsersDB = Depends(lambda: UsersDB()),
    roles_db: RolesDB = Depends(lambda: RolesDB())
):
    """Get all history entries for a specific attendance record"""
    try:
        # Check permissions
        permissions = await get_user_permissions(requester_id, users_db, roles_db)
        if not permissions.get("can_view_all") and requester_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view history for this attendance record"
            )
        
        # Get history
        history = await attendance_history_db.get_history_by_attendance(user_id, date)
        
        return {
            "success": True,
            "history": history,
            "total": len(history)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting attendance history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get history: {str(e)}"
        )

@router.get("/history/{user_id}")
async def get_user_attendance_history(
    user_id: str,
    requester_id: str = Query(..., description="User ID making the request"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(50, description="Maximum number of entries"),
    attendance_history_db = Depends(get_attendance_history_db),
    users_db: UsersDB = Depends(lambda: UsersDB()),
    roles_db: RolesDB = Depends(lambda: RolesDB())
):
    """Get attendance history for a user across multiple dates"""
    try:
        # Check permissions
        permissions = await get_user_permissions(requester_id, users_db, roles_db)
        if not permissions.get("can_view_all") and requester_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view history for this user"
            )
        
        # Get history
        history = await attendance_history_db.get_history_by_user(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
        
        return {
            "success": True,
            "history": history,
            "total": len(history)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting user attendance history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user history: {str(e)}"
        )

# Holiday Management APIs
@router.get("/settings")
async def get_attendance_settings(
    user_id: str = Query(..., description="User _id requesting settings"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get attendance settings and timing rules"""
    try:
        # Check permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # Get attendance settings
        settings_db = SettingsDB()
        settings = await settings_db.get_attendance_settings()
        
        # Format settings for frontend
        timing_rules = {
            "check_in_start_time": settings.get("check_in_start_time", "09:00"),
            "check_in_end_time": settings.get("check_in_end_time", "10:30"),
            "check_out_start_time": settings.get("check_out_start_time", "17:00"),
            "check_out_end_time": settings.get("check_out_end_time", "20:00"),
            "minimum_working_hours": settings.get("minimum_working_hours", 8.0),
            "weekend_days": settings.get("weekend_days", [5, 6]),  # Saturday, Sunday
            "geofence_enabled": settings.get("geofence_enabled", False),
            "geofence_radius": settings.get("geofence_radius", 100.0),
            "office_latitude": settings.get("office_latitude"),
            "office_longitude": settings.get("office_longitude")
        }
        
        # Status explanations
        status_rules = {
            "1": "Full Day - Check-in on time, check-out after minimum hours",
            "0.5": "Half Day - Late check-in, early check-out, or insufficient hours",
            "0": "Leave - Approved leave request",
            "-1": "Absent - No check-in or manual absent marking",
            "-2": "Absent - Very late check-in (next day also marked absent)",
            "L": "Leave - Approved leave request (displayed as 'L')"
        }
        
        return {
            "success": True,
            "timing_rules": timing_rules,
            "status_rules": status_rules,
            "permissions": permissions
        }
        
    except Exception as e:
        print(f"Error getting attendance settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get attendance settings: {str(e)}"
        )

@router.get("/refresh/{user_id}")
async def refresh_attendance(
    user_id: str,
    date: Optional[str] = Query(None, description="Date (YYYY-MM-DD), default today"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Refresh and get current attendance status"""
    try:
        target_date = date or get_ist_now().date().isoformat()
        
        # Get user info
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get current attendance record
        attendance_record = await attendance_db.get_attendance_detail(user_id, target_date)
        
        # Get current IST time
        ist_now = get_ist_now()
        
        response_data = {
            "user_id": user_id,
            "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "date": target_date,
            "current_ist_time": ist_now.strftime("%Y-%m-%d %H:%M:%S"),
            "has_attendance": attendance_record is not None,
            "attendance": attendance_record,
            "can_check_in": not (attendance_record and attendance_record.get("check_in_time")),
            "can_check_out": bool(attendance_record and attendance_record.get("check_in_time") and not attendance_record.get("check_out_time"))
        }
        
        if attendance_record:
            response_data.update({
                "status": attendance_record.get("status"),
                "status_text": attendance_record.get("status_text"),
                "check_in_time": attendance_record.get("check_in_time"),
                "check_out_time": attendance_record.get("check_out_time"),
                "total_working_hours": attendance_record.get("total_working_hours"),
                "is_late": attendance_record.get("is_late", False)
            })
        
        return {
            "success": True,
            "data": response_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error refreshing attendance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh attendance: {str(e)}"
        )

@router.get("/debug/{user_id}")
async def debug_attendance(
    user_id: str,
    date: Optional[str] = Query(None, description="Date (YYYY-MM-DD), default today"),
    attendance_db: AttendanceDB = Depends(get_attendance_db)
):
    """Debug endpoint to check attendance data"""
    try:
        target_date = date or get_ist_now().date().isoformat()
        
        # Get raw attendance record
        raw_record = await attendance_db.collection.find_one({
            "user_id": user_id,
            "date": target_date
        })
        
        if raw_record:
            raw_record["_id"] = str(raw_record["_id"])
        
        # Get formatted attendance record
        formatted_record = await attendance_db.get_attendance_detail(user_id, target_date)
        
        return {
            "success": True,
            "debug_info": {
                "user_id": user_id,
                "date": target_date,
                "raw_record": raw_record,
                "formatted_record": formatted_record,
                "has_record": raw_record is not None,
                "status_in_db": raw_record.get("status") if raw_record else None,
                "check_in_time": raw_record.get("check_in_time") if raw_record else None,
                "check_out_time": raw_record.get("check_out_time") if raw_record else None
            }
        }
        
    except Exception as e:
        print(f"Error in debug endpoint: {e}")
        return {
            "success": False,
            "error": str(e),
            "user_id": user_id,
            "date": target_date
        }

@router.get("/current-time")
async def get_current_ist_time():
    """Get current IST time for frontend synchronization"""
    try:
        ist_now = get_ist_now()
        
        return {
            "success": True,
            "utc_time": ist_now.strftime("%Y-%m-%d %H:%M:%S"),
            "ist_time": ist_now.strftime("%Y-%m-%d %H:%M:%S"),
            "ist_time_formatted": format_datetime_ist(ist_now),
            "date": ist_now.strftime("%Y-%m-%d"),
            "time": ist_now.strftime("%H:%M:%S"),
            "day_of_week": ist_now.strftime("%A"),
            "timestamp": int(ist_now.timestamp())
        }
    except Exception as e:
        print(f"Error getting current time: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get current time: {str(e)}"
        )

@router.get("/user-status")
async def get_user_attendance_status(
    user_id: str = Query(..., description="User _id to check status"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get current attendance status for user"""
    try:
        # Get user permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # Get today's attendance
        today = date.today().isoformat()
        today_attendance = await attendance_db.get_attendance_detail(user_id, today)
        
        # Get current IST time
        ist_now = get_ist_now()
        
        status_info = {
            "user_id": user_id,
            "today": today,
            "current_ist_time": ist_now.strftime("%Y-%m-%d %H:%M:%S"),
            "permissions": permissions,
            "has_checked_in": bool(today_attendance and today_attendance.get("check_in_time")),
            "has_checked_out": bool(today_attendance and today_attendance.get("check_out_time")),
            "can_check_in": not (today_attendance and today_attendance.get("check_in_time")),
            "can_check_out": bool(today_attendance and today_attendance.get("check_in_time") and not today_attendance.get("check_out_time")),
            "attendance_today": today_attendance
        }
        
        return {
            "success": True,
            "status": status_info
        }
        
    except Exception as e:
        print(f"Error getting user status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user status: {str(e)}"
        )

# Holiday Management APIs
@router.post("/holidays/add")
async def add_holiday(
    name: str = Query(..., description="Holiday name"),
    date: str = Query(..., description="Holiday date (YYYY-MM-DD)"),
    description: Optional[str] = Query(None, description="Holiday description"),
    user_id: str = Query(..., description="User ID adding the holiday"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    holidays_db = Depends(get_holidays_db)
):
    """Add a new holiday"""
    try:
        # Check permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        if not permissions.get("can_edit", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to add holidays"
            )
        
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        # Check if holiday already exists for this date
        existing_holiday = await holidays_db.get_holiday_by_date(date)
        if existing_holiday:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Holiday already exists for this date"
            )
        
        # Prepare holiday data
        holiday_data = {
            "name": name,
            "date": date,
            "description": description or "",
            "created_by": user_id
        }
        
        # Add holiday
        holiday_id = await holidays_db.add_holiday(holiday_data)

        # Invalidate calendar cache so the UI gets fresh data immediately
        try:
            invalidate_cache_pattern("get_calendar_attendance")
        except Exception:
            pass

        return {
            "success": True,
            "message": "Holiday added successfully",
            "holiday_id": holiday_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding holiday: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add holiday: {str(e)}"
        )

@router.get("/holidays")
async def get_holidays(
    year: Optional[int] = Query(None, description="Year to filter holidays"),
    month: Optional[int] = Query(None, description="Month to filter holidays (1-12)"),
    user_id: str = Query(..., description="User ID requesting holidays"),
    holidays_db = Depends(get_holidays_db)
):
    """Get holidays with optional year/month filtering"""
    try:
        if year and month:
            holidays = await holidays_db.get_holidays_by_month(year, month)
        elif year:
            holidays = await holidays_db.get_holidays_by_year(year)
        else:
            holidays = await holidays_db.get_all_holidays()
        
        return {
            "success": True,
            "holidays": holidays,
            "total": len(holidays)
        }
        
    except Exception as e:
        print(f"Error getting holidays: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get holidays: {str(e)}"
        )

@router.get("/holidays/{holiday_id}")
async def get_holiday(
    holiday_id: str,
    user_id: str = Query(..., description="User ID requesting holiday"),
    holidays_db = Depends(get_holidays_db)
):
    """Get a specific holiday by ID"""
    try:
        holiday = await holidays_db.get_holiday(holiday_id)
        if not holiday:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Holiday not found"
            )
        
        return {
            "success": True,
            "holiday": holiday
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting holiday: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get holiday: {str(e)}"
        )

@router.put("/holidays/{holiday_id}")
async def update_holiday(
    holiday_id: str,
    name: Optional[str] = Query(None, description="Holiday name"),
    date: Optional[str] = Query(None, description="Holiday date (YYYY-MM-DD)"),
    description: Optional[str] = Query(None, description="Holiday description"),
    user_id: str = Query(..., description="User ID updating the holiday"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    holidays_db = Depends(get_holidays_db)
):
    """Update an existing holiday"""
    try:
        # Check permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        if not permissions.get("can_edit", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update holidays"
            )
        
        # Check if holiday exists
        existing_holiday = await holidays_db.get_holiday(holiday_id)
        if not existing_holiday:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Holiday not found"
            )
        
        # Prepare update data
        update_data = {}
        if name is not None:
            update_data["name"] = name
        if date is not None:
            # Validate date format
            try:
                datetime.strptime(date, '%Y-%m-%d')
                update_data["date"] = date
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
        if description is not None:
            update_data["description"] = description
        
        update_data["updated_by"] = user_id
        
        # Update holiday
        success = await holidays_db.update_holiday(holiday_id, update_data)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update holiday"
            )
        
        return {
            "success": True,
            "message": "Holiday updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating holiday: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update holiday: {str(e)}"
        )

@router.delete("/holidays/{holiday_id}")
async def delete_holiday(
    holiday_id: str,
    user_id: str = Query(..., description="User ID deleting the holiday"),
    reset_attendance: bool = Query(False, description="Reset holiday attendance records to Absent"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    holidays_db = Depends(get_holidays_db),
    attendance_db: AttendanceDB = Depends(get_attendance_db)
):
    """Delete a holiday. If reset_attendance=True, all attendance records for that date with status H/SP are reset to A (absent)."""
    try:
        # Check permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        if not permissions.get("can_delete", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete holidays"
            )
        
        # Check if holiday exists
        existing_holiday = await holidays_db.get_holiday(holiday_id)
        if not existing_holiday:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Holiday not found"
            )

        holiday_date = existing_holiday.get("date")
        
        # Delete holiday
        success = await holidays_db.delete_holiday(holiday_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete holiday"
            )
        
        # Reset attendance records for that date that were marked as holiday
        reset_count = 0
        if reset_attendance and holiday_date:
            try:
                # Match both numeric 1.5 (stored by auto-mark) and legacy string "H"/"SP"
                result = await attendance_db.collection.update_many(
                    {"date": holiday_date, "$or": [
                        {"status": {"$in": [1.5, "H", "SP"]}},
                        {"is_holiday": True}
                    ]},
                    {"$set": {
                        "status": -1,  # Reset to Absent
                        "is_holiday": False,
                        "updated_at": get_ist_now(),
                        "updated_by": user_id
                    }}
                )
                reset_count = result.modified_count
            except Exception as re:
                print(f"Warning: failed to reset attendance for holiday date {holiday_date}: {re}")

        # Invalidate calendar cache so the UI gets fresh data immediately
        try:
            invalidate_cache_pattern("get_calendar_attendance")
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Holiday deleted successfully{f' — {reset_count} attendance record(s) reset' if reset_count else ''}",
            "reset_count": reset_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting holiday: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete holiday: {str(e)}"
        )

@router.get("/holidays/check/{date}")
async def check_holiday(
    date: str,
    user_id: str = Query(..., description="User ID checking the date"),
    holidays_db = Depends(get_holidays_db)
):
    """Check if a specific date is a holiday"""
    try:
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        is_holiday = await holidays_db.is_holiday(date)
        holiday_details = None
        
        if is_holiday:
            holiday_details = await holidays_db.get_holiday_by_date(date)
        
        return {
            "success": True,
            "is_holiday": is_holiday,
            "holiday": holiday_details
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error checking holiday: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check holiday: {str(e)}"
        )

@router.post("/check-in")
async def check_in_attendance(
    check_in_data: AttendanceCheckInRequest,
    user_id: str = Query(..., description="User _id checking in"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Check-in with photo and geolocation"""
    try:
        # Get user info
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if already checked in today - use IST timezone
        from datetime import timezone, timedelta
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        today = datetime.now(ist_tz).date().isoformat()
        existing = await get_attendance_by_user_date(user_id, today, attendance_db)
        
        if existing and existing.get("check_in_time"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already checked in today"
            )
        
        # Save photo if provided
        photo_path = None
        if check_in_data.photo_data:
            photo_path = save_attendance_photo(check_in_data.photo_data, user_id, today, "checkin")
        
        # Current time for check-in
        now = get_ist_now()
        check_in_time = now.strftime("%H:%M:%S")
        
        # Determine if late (after grace deadline from settings, default 10:15 AM)
        settings_db_2 = SettingsDB()
        settings_2 = await settings_db_2.get_attendance_settings()
        grace_deadline_str = settings_2.get("reporting_deadline", "10:15")
        late_threshold = datetime.strptime(grace_deadline_str, "%H:%M").time()
        is_late = now.time() > late_threshold
        
        # Prepare check-in data
        check_in_record = {
            "user_id": user_id,
            "date": today,
            "check_in_time": check_in_time,
            "check_in_photo_path": photo_path,
            "check_in_geolocation": check_in_data.geolocation.dict() if check_in_data.geolocation else {"latitude": 0.0, "longitude": 0.0},
            "comments": check_in_data.comments or "Web check-in",
            "status": 0.5 if is_late else 1.0,  # Half day if late, full day if on time
            "is_late": is_late,
            "marked_by": user_id,
            "marked_at": get_ist_now(),
            "created_at": get_ist_now(),
            "updated_at": get_ist_now()
        }
        
        # Add user details
        if user.get("department_id"):
            check_in_record["department_id"] = user.get("department_id")
        
        # Save attendance
        if existing:
            # Update existing record
            await attendance_db.collection.update_one(
                {"_id": existing["_id"]}, 
                {"$set": check_in_record}
            )
            attendance_id = existing["_id"]
        else:
            # Create new record
            attendance_id = await attendance_db.mark_attendance(check_in_record)
        
        return {
            "success": True,
            "message": f"Check-in successful{' (Late)' if is_late else ''}",
            "attendance_id": attendance_id,
            "check_in_time": check_in_time,
            "is_late": is_late,
            "status": "Half Day" if is_late else "Full Day"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during check-in: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check in: {str(e)}"
        )

@router.post("/check-out")
async def check_out_attendance(
    check_out_data: AttendanceCheckOutRequest,
    user_id: str = Query(..., description="User _id checking out"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Check-out with photo and geolocation"""
    try:
        # Get user info
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if checked in today - use IST timezone
        from datetime import timezone, timedelta
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        today = datetime.now(ist_tz).date().isoformat()
        existing = await get_attendance_by_user_date(user_id, today, attendance_db)
        
        if not existing or not existing.get("check_in_time"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No check-in record found. Please check-in first."
            )
        
        if existing.get("check_out_time"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already checked out today"
            )
        
        # Save photo if provided
        photo_path = None
        if check_out_data.photo_data:
            photo_path = save_attendance_photo(check_out_data.photo_data, user_id, today, "checkout")
        
        # Current time for check-out
        now = get_ist_now()
        check_out_time = now.strftime("%H:%M:%S")
        
        # Calculate working hours
        check_in_dt = datetime.strptime(f"{today} {existing['check_in_time']}", "%Y-%m-%d %H:%M:%S")
        check_out_dt = datetime.strptime(f"{today} {check_out_time}", "%Y-%m-%d %H:%M:%S")
        working_duration = check_out_dt - check_in_dt
        working_hours = working_duration.total_seconds() / 3600
        
        # Determine final status
        early_threshold = datetime.strptime("17:30", "%H:%M").time()
        is_early = now.time() < early_threshold
        is_late = existing.get("is_late", False)
        
        # Final status logic
        if is_late or working_hours < 4:
            final_status = 0.5  # Half day
        elif is_early and working_hours < 8:
            final_status = 0.5  # Half day
        elif working_hours >= 8:
            final_status = 1.0  # Full day
        else:
            final_status = 0.5  # Half day
        
        # Update attendance record – preserve check-in reason
        existing_comments = existing.get("comments", "")
        checkout_comment = check_out_data.comments or ""
        update_data = {
            "check_out_time": check_out_time,
            "check_out_photo_path": photo_path,
            "check_out_geolocation": check_out_data.geolocation.dict() if check_out_data.geolocation else {"latitude": 0.0, "longitude": 0.0},
            "total_working_hours": round(working_hours, 2),
            "status": final_status,
            "comments": existing_comments if existing_comments else checkout_comment,
            "checkout_comments": checkout_comment,
            "updated_at": get_ist_now()
        }
        
        await attendance_db.collection.update_one(
            {"_id": ObjectId(existing["_id"])},
            {"$set": update_data}
        )
        
        return {
            "success": True,
            "message": "Check-out successful",
            "check_out_time": check_out_time,
            "total_working_hours": round(working_hours, 2),
            "status": get_status_text(final_status)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during check-out: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check out: {str(e)}"
        )

# ============================================================================
# FACIAL RECOGNITION ENDPOINTS
# ============================================================================

@router.post("/face/register", response_model=Dict[str, Any])
async def register_employee_face(
    registration_data: Dict[str, Any],
    admin_user_id: str = Query(..., description="Admin user ID registering the face"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """
    Register employee's face for facial attendance
    Requires at least 3 face samples for accuracy
    """
    try:
        # Verify admin permissions
        admin_user = await users_db.get_user(admin_user_id)
        if not admin_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Admin user not found"
            )
        
        # Check admin permissions (allow admin, super admin, HR, manager, team leader)
        SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b"
        admin_roles = ["admin", "super admin", "hr", "human resources", "manager", "team leader", "tl"]
        is_self_registration = admin_user_id == employee_id
        is_authorized = (
            is_self_registration or
            admin_user.get("is_super_admin") or
            str(admin_user.get("role_id", "")) == SUPER_ADMIN_ROLE_ID or
            admin_user.get("role_name", "").lower() in admin_roles or
            admin_user.get("role", {}).get("name", "").lower() in admin_roles
        )
        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins, HR, or managers can register employee faces"
            )
        
        # Validate employee
        employee_id = registration_data.get("employee_id")
        if not employee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee ID is required"
            )
        
        employee = await users_db.get_user(employee_id)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        # Validate face descriptors
        face_descriptors = registration_data.get("face_descriptors", [])
        if len(face_descriptors) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least 3 face samples required for registration"
            )
        
        # Validate each descriptor has 128 dimensions
        for i, desc in enumerate(face_descriptors):
            if len(desc.get("descriptor", [])) != 128:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Face descriptor {i+1} must have exactly 128 dimensions"
                )
        
        # Save reference photo if provided
        photo_data = registration_data.get("photo_data")
        reference_photo_path = ""
        UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "media")
        if photo_data:
            # Create face photos directory
            face_photos_dir = os.path.join(UPLOAD_DIR, "face_photos")
            os.makedirs(face_photos_dir, exist_ok=True)
            
            # Save photo
            photo_filename = f"{employee_id}_reference_{get_ist_now().strftime('%Y%m%d_%H%M%S')}.jpg"
            photo_path = os.path.join(face_photos_dir, photo_filename)
            
            try:
                # Decode base64 and save
                if "base64," in photo_data:
                    photo_data = photo_data.split("base64,")[1]
                
                photo_bytes = base64.b64decode(photo_data)
                with open(photo_path, "wb") as f:
                    f.write(photo_bytes)
                
                reference_photo_path = photo_path
            except Exception as e:
                logger.warning(f"Failed to save reference photo: {e}")
        
        # Prepare face data for database
        face_data = {
            "employee_id": employee_id,
            "employee_name": employee.get("name", ""),
            "face_descriptors": face_descriptors,
            "reference_photo_path": reference_photo_path,
            "registered_by": admin_user_id
        }
        
        # Register face in database
        face_id = await attendance_db.register_employee_face(face_data)
        
        return {
            "success": True,
            "employee_id": employee_id,
            "face_id": face_id,
            "samples_count": len(face_descriptors),
            "registered_at": get_ist_now().isoformat(),
            "registered_by": admin_user_id,
            "message": f"Face registered successfully with {len(face_descriptors)} samples"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering face: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register face: {str(e)}"
        )


@router.get("/face/{employee_id}", response_model=Dict[str, Any])
async def get_employee_face_data(
    employee_id: str,
    user_id: str = Query(..., description="Requesting user ID"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Get employee's face registration data"""
    try:
        # Verify user permissions
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if user is requesting their own data or is admin
        is_own_data = user_id == employee_id
        is_admin = user.get("is_super_admin") or str(user.get("role_id", "")) == "685292be8d7cdc3a71c4829b" or user.get("role_name", "").lower() in ["admin", "super admin"]
        
        if not is_own_data and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own face data"
            )
        
        # Get face data
        face_data = await attendance_db.get_employee_face_data(employee_id)
        
        if not face_data:
            employee = await users_db.get_user(employee_id)
            return {
                "employee_id": employee_id,
                "employee_name": employee.get("name", "") if employee else "",
                "face_registered": False,
                "samples_count": 0,
                "registered_at": None,
                "last_updated": None,
                "reference_photo_url": None
            }
        
        # Return face data (without descriptors for security)
        return {
            "employee_id": face_data["employee_id"],
            "employee_name": face_data.get("employee_name", ""),
            "face_registered": True,
            "samples_count": face_data.get("samples_count", 0),
            "registered_at": face_data.get("registered_at"),
            "last_updated": face_data.get("last_updated"),
            "reference_photo_url": face_data.get("reference_photo_path", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting face data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get face data: {str(e)}"
        )


@router.post("/face/verify", response_model=Dict[str, Any])
async def verify_employee_face(
    verification_data: Dict[str, Any],
    attendance_db: AttendanceDB = Depends(get_attendance_db)
):
    """
    Verify employee face during check-in
    Uses Euclidean distance between face descriptors
    """
    try:
        employee_id = verification_data.get("employee_id")
        if not employee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee ID is required"
            )
        
        # Get face descriptor to verify
        face_descriptor = verification_data.get("face_descriptor", {})
        current_descriptor = face_descriptor.get("descriptor", [])
        
        if len(current_descriptor) != 128:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid face descriptor format"
            )
        
        # Get registered face data
        registered_face = await attendance_db.get_employee_face_data(employee_id)
        
        if not registered_face:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No face registered for this employee"
            )
        
        # Compare with all registered samples
        registered_descriptors = registered_face.get("face_descriptors", [])
        
        if not registered_descriptors:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No face samples found for this employee"
            )
        
        # Also handle case where ALL stored descriptors are invalid (empty from old broken registration)
        valid_descriptors = [s for s in registered_descriptors if len(s.get("descriptor", [])) == 128]
        if not valid_descriptors:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Face data is invalid or empty — please re-register the face"
            )
        
        # Calculate minimum distance across all valid samples
        import numpy as np
        
        min_distance = float('inf')
        for sample in valid_descriptors:
            sample_desc = sample.get("descriptor", [])
            if len(sample_desc) == 128:
                # Calculate Euclidean distance
                distance = np.linalg.norm(np.array(current_descriptor) - np.array(sample_desc))
                min_distance = min(min_distance, distance)
        
        # Threshold for real-world webcam conditions (0.6 is LFW benchmark; 0.8 is better for webcam)
        threshold = 0.8
        verified = min_distance < threshold
        # Confidence: 100% at distance 0, 0% at distance == threshold
        confidence = max(0.0, round(1 - (min_distance / threshold), 3))
        
        # Log verification attempt
        log_data = {
            "employee_id": employee_id,
            "verification_result": "success" if verified else "failure",
            "confidence_score": confidence,
            "threshold_used": threshold,
            "photo_path": verification_data.get("photo_data", "")[:100]  # Store partial for audit
        }
        await attendance_db.log_face_verification_attempt(log_data)
        
        return {
            "verified": verified,
            "confidence": confidence,
            "threshold": threshold,
            "distance": round(min_distance, 3),
            "employee_id": employee_id,
            "message": "Face verified successfully" if verified else f"Face verification failed (distance: {round(min_distance, 3)}, threshold: {threshold})"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying face: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify face: {str(e)}"
        )


@router.delete("/face/{employee_id}")
async def delete_employee_face(
    employee_id: str,
    admin_user_id: str = Query(..., description="Admin user ID deleting the face"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Delete employee's face registration"""
    try:
        # Verify admin permissions
        admin_user = await users_db.get_user(admin_user_id)
        if not admin_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Admin user not found"
            )
        
        SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b"
        _is_admin = (
            admin_user.get("is_super_admin") or
            str(admin_user.get("role_id", "")) == SUPER_ADMIN_ROLE_ID or
            admin_user.get("role_name", "").lower() in ["admin", "super admin"]
        )
        if not _is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can delete employee faces"
            )
        
        # Delete face data
        success = await attendance_db.delete_employee_face(employee_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Face registration not found"
            )
        
        return {
            "success": True,
            "message": "Face registration deleted successfully",
            "employee_id": employee_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting face: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete face: {str(e)}"
        )


@router.get("/face/list/all", response_model=Dict[str, Any])
async def list_all_registered_faces(
    user_id: str = Query(..., description="Requesting user ID"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Get list of all employees with registered faces (admin only)"""
    try:
        # Verify admin permissions
        user = await users_db.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if not (user.get("is_super_admin") or str(user.get("role_id", "")) == "685292be8d7cdc3a71c4829b" or user.get("role_name", "").lower() in ["admin", "super admin"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can view all registered faces"
            )
        
        # Get all registered faces
        faces = await attendance_db.get_all_registered_faces()
        
        # Format response
        face_list = []
        for face in faces:
            face_list.append({
                "employee_id": face.get("employee_id"),
                "employee_name": face.get("employee_name", ""),
                "samples_count": face.get("samples_count", 0),
                "registered_at": face.get("registered_at"),
                "last_updated": face.get("last_updated")
            })
        
        return {
            "success": True,
            "total_count": len(face_list),
            "faces": face_list
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing faces: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list faces: {str(e)}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Admin manual-trigger for auto-absent jobs
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/auto-absent/run-missing-checkout")
async def trigger_missing_checkout_job(
    user_id: str = Query(..., description="Admin user ID"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Manually trigger the end-of-day missing-checkout absent job (admin only)."""
    from app.utils.permissions import check_permission, PermissionManager
    # Accept both old 'all' and new 'leave_management'/'view_all' admin-level actions
    perms = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
    is_admin = PermissionManager.has_permission(perms, "attendance", "leave_management") or \
               PermissionManager.has_permission(perms, "attendance", "view_all") or \
               PermissionManager.has_permission(perms, "attendance", "all")
    if not is_admin:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin attendance permission required")
    from app.utils.attendance_auto_absent import run_missing_checkout_job
    await run_missing_checkout_job()
    return {"success": True, "message": "Missing-checkout absent job triggered successfully."}


@router.post("/auto-absent/run-daily-absent")
async def trigger_daily_absent_job(
    user_id: str = Query(..., description="Admin user ID"),
    for_date: str = Query(None, description="Date to run for (YYYY-MM-DD, default: yesterday)"),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
):
    """Manually trigger the midnight no-checkin absent job (admin only)."""
    from app.utils.permissions import check_permission, PermissionManager
    # Accept both old 'all' and new 'leave_management'/'view_all' admin-level actions
    perms = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
    is_admin = PermissionManager.has_permission(perms, "attendance", "leave_management") or \
               PermissionManager.has_permission(perms, "attendance", "view_all") or \
               PermissionManager.has_permission(perms, "attendance", "all")
    if not is_admin:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin attendance permission required")
    from app.utils.attendance_auto_absent import run_daily_absent_job
    from datetime import date as date_type
    target = None
    if for_date:
        try:
            target = date_type.fromisoformat(for_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    await run_daily_absent_job(target_date=target)
    return {"success": True, "message": f"Daily absent job triggered for {for_date or 'yesterday'}."}