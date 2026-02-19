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
        
        for perm in permissions:
            if perm.get("page") == module:
                actions = perm.get("actions", [])
                if isinstance(actions, str):
                    actions = [actions]
                
                if "all" in actions or "*" in actions:
                    has_all = True
                elif "junior" in actions:
                    has_junior = True
        
        # Determine permission level
        if has_all:
            return {"permission_level": "all", "is_super_admin": False}
        elif has_junior:
            return {"permission_level": "junior", "is_super_admin": False}
        else:
            return {"permission_level": "own", "is_super_admin": False}
            
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
        timestamp = datetime.now().strftime("%H%M%S")
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
                "can_mark_all": False,
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
                "can_mark_all": False,
                "can_edit": False,
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
            year = datetime.now().year
        if not month:
            month = datetime.now().month
        
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
        
        # ⚡ STEP 2: Determine employees to show based on permissions
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
        
        # ⚡ STEP 5: Ultra-fast calendar generation using lookups
        employee_calendars = []
        days_in_month = calendar.monthrange(year, month)[1]
        
        for employee in employees:
            user_emp_id = str(employee.get("_id", ""))
            if not user_emp_id:
                continue
            
            employee_name = f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
            
            # Get pre-fetched data for this employee
            employee_attendance = attendance_lookup.get(user_emp_id, {})
            employee_leaves = leave_lookup.get(user_emp_id, {})
            
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
                
                if leave_info:
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
                    
                    status_text = get_status_text(status) if status is not None else None
                    comments = attendance_record.get("comments", "")
                    photo_path = attendance_record.get("photo_path")
                    
                    if attendance_record.get("leave_id"):
                        leave_id = attendance_record.get("leave_id")
                    
                    total_days += 1
                    if status == 1 or status == 1.0:
                        full_days += 1
                    elif status == 0.5:
                        half_days += 1
                    elif status == 0 or status == 0.0:
                        leave_days += 1
                    elif status == -1 or status == -1.0:
                        absent_days += 1
                    elif status == -2 or status == -2.0:
                        absconding_days += 1
                        
                elif not is_weekend and not is_holiday:
                    # No attendance record for working day
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
                    "comments": comments,
                    "photo_path": photo_path,
                    "leave_id": leave_id,
                    "leave_type": leave_type,
                    "leave_reason": leave_reason,
                    "leave_approved_by": leave_approved_by,
                    "leave_approved_by_name": leave_approved_by_name
                }
                days.append(day_data)
            
            # Calculate final attendance percentage
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
        now = datetime.now()
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
            "marked_at": datetime.now(),
            "photo_path": photo_path,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
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
    roles_db: RolesDB = Depends(get_roles_db)
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
            "marked_at": datetime.now(),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # Add department info if available
        if employee.get("department_id"):
            attendance_record["department_id"] = employee.get("department_id")
        
        # Mark attendance
        attendance_id = await attendance_db.mark_attendance(attendance_record)
        
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
                    "marked_at": datetime.now(),
                    "created_at": datetime.now(),
                    "updated_at": datetime.now(),
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
            now = datetime.now()
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
    requester_id: str = Query(..., description="User _id making the request"),
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
        permissions = await get_user_permissions(requester_id, users_db, roles_db)
        
        # Allow access if user can view all OR it's their own record OR they can view junior
        can_view_all = permissions.get("can_view_all", False)
        can_view_junior = permissions.get("can_view_junior", False)
        is_own_record = actual_user_id == requester_id
        
        can_access = False
        if can_view_all or is_own_record:
            can_access = True
        elif can_view_junior:
            # Check if target user is a subordinate
            subordinate_user_ids = await get_subordinate_users_for_attendance(requester_id, users_db, roles_db)
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
            
            return {
                "success": True,
                "type": "attendance",
                "employee": {
                    "employee_id": employee.get("employee_id", employee_id),  # Return actual employee_id field
                    "user_id": actual_user_id,  # Include the MongoDB _id for reference
                    "employee_name": employee_name,
                    "email": employee.get("email", ""),
                    "department_name": "Unknown Department",
                    "role_name": employee.get("role_name", "Unknown Role"),
                    "profile_picture": employee.get("profile_picture", "")
                },
                "attendance_details": {
                    "id": attendance_record.get("id"),
                    "date": attendance_record.get("date"),
                    "status": attendance_record.get("status"),
                    "status_text": get_status_text(attendance_record.get("status")),
                    "check_in_time": attendance_record.get("check_in_time", ""),
                    "check_out_time": attendance_record.get("check_out_time", ""),
                    "total_working_hours": attendance_record.get("total_working_hours", 0.0),
                    "comments": attendance_record.get("comments", ""),
                    "marked_by": attendance_record.get("marked_by", ""),
                    "is_holiday": attendance_record.get("is_holiday", False),
                    "photo_path": attendance_record.get("photo_path", ""),
                    "check_in_photo_path": attendance_record.get("check_in_photo_path", ""),
                    "check_out_photo_path": attendance_record.get("check_out_photo_path", ""),
                    "check_in_geolocation": attendance_record.get("check_in_geolocation", {}),
                    "check_out_geolocation": attendance_record.get("check_out_geolocation", {})
                },
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
        utc_now = datetime.now()
        ist_now = utc_now + timedelta(hours=5, minutes=30)  # Convert to IST
        check_in_time = ist_now.strftime("%H:%M:%S")
        
        # Get timing settings from database
        check_in_start_time = settings.get("check_in_start_time", "09:00")  # Default 9:00 AM
        check_in_end_time = settings.get("check_in_end_time", "10:30")    # Default 10:30 AM
        check_out_start_time = settings.get("check_out_start_time", "17:00")  # Default 5:00 PM
        check_out_end_time = settings.get("check_out_end_time", "20:00")    # Default 8:00 PM
        
        # Determine if late check-in based on IST and settings
        check_in_time_obj = ist_now.time()
        start_threshold = datetime.strptime(check_in_start_time, "%H:%M").time()
        late_threshold = datetime.strptime(check_in_end_time, "%H:%M").time()
        checkout_start = datetime.strptime(check_out_start_time, "%H:%M").time()
        checkout_end = datetime.strptime(check_out_end_time, "%H:%M").time()
        
        # Determine status based on check-in time
        if check_in_time_obj < start_threshold:
            # Too early - mark as half day
            attendance_status = 0.5
            status_reason = "Early check-in before allowed time"
        elif check_in_time_obj <= late_threshold:
            # On time - full day potential
            attendance_status = 1
            status_reason = "On-time check-in"
        elif check_in_time_obj <= checkout_start:
            # Late but within half-day window
            attendance_status = 0.5
            status_reason = "Late check-in - Half day"
        else:
            # Too late - mark as absent for next day as well
            attendance_status = -2
            status_reason = "Very late check-in - Marked absent"
            
            # Mark next day as absent too if it's a working day
            next_day = (datetime.now().date() + timedelta(days=1)).isoformat()
            try:
                # Check if next day is not weekend
                next_day_obj = datetime.strptime(next_day, '%Y-%m-%d').date()
                weekend_days = settings.get("weekend_days", [5, 6])  # Saturday, Sunday
                if next_day_obj.weekday() not in weekend_days:
                    # Auto-mark next day as absent
                    next_day_record = {
                        "user_id": user_id,
                        "date": next_day,
                        "status": -2,
                        "comments": f"Auto-marked absent due to very late check-in on {date.today().isoformat()}",
                        "marked_by": "system",
                        "marked_at": datetime.now(),
                        "is_holiday": False,
                        "created_at": datetime.now(),
                        "updated_at": datetime.now()
                    }
                    await attendance_db.mark_attendance(next_day_record)
            except Exception as e:
                print(f"Error auto-marking next day absent: {e}")
        
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
        elif attendance_status == -2:
            message = "Checked in - Marked absent (Very late arrival, next day also marked absent)"
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
        utc_now = datetime.now()
        ist_now = utc_now + timedelta(hours=5, minutes=30)  # Convert to IST
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
            if current_status == -2:
                # Already marked absent due to very late check-in
                final_status = -2
                status_reason = "Marked absent due to very late check-in"
            elif check_out_time_obj < checkout_start:
                # Early check-out - half day regardless of hours worked
                final_status = 0.5
                status_reason = "Early check-out - Half day"
            elif check_out_time_obj > checkout_end:
                # Late check-out but within working day
                if working_hours >= minimum_hours:
                    final_status = max(current_status, 1) if current_status != -2 else -2
                else:
                    final_status = 0.5
                status_reason = "Late check-out"
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

@router.get("/detail/{user_id}/{date_str}", response_model=AttendanceDetailResponse)
async def get_attendance_detail(
    user_id: str,
    date_str: str,
    requester_id: str = Query(..., description="ID of user requesting the detail"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get detailed attendance for a user on a specific date with IST formatting"""
    try:
        # Validate date format
        try:
            datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        # Check permissions - user can view their own or admins can view all
        if user_id != requester_id:
            from app.utils.permissions import check_permission
            await check_permission(requester_id, "attendance", "show", users_db, roles_db)
        
        # Get attendance detail
        attendance = await attendance_db.get_attendance_detail(user_id, date_str)
        if not attendance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance record not found for the specified date"
            )
        
        return attendance
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting attendance detail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get attendance detail: {str(e)}"
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
        # Check admin permissions
        from app.utils.permissions import check_permission
        await check_permission(admin_id, "attendance", "edit", users_db, roles_db)
        
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
        if edit_data.status is not None and edit_data.status not in [1.0, 0.5, 0.0, -1.0]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status. Must be 1.0 (Full Day), 0.5 (Half Day), 0.0 (Leave), or -1.0 (Absent)"
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
        
        for field, new_value in update_data.items():
            old_value = existing_record.get(field)
            if old_value != new_value:
                changes.append(f"{field}: {old_value} → {new_value}")
                
                # Add individual history entry for each change
                await attendance_history_db.add_history_entry(
                    attendance_id=attendance_id,
                    user_id=str(existing_record.get("user_id")),
                    date=existing_record.get("date"),
                    action_type="field_updated",
                    action_description=f"{field.replace('_', ' ').title()} updated by {admin_name}",
                    created_by=admin_id,
                    created_by_name=admin_name,
                    old_value=old_value,
                    new_value=new_value
                )
        
        # Add summary history entry
        if changes:
            await attendance_history_db.add_history_entry(
                attendance_id=attendance_id,
                user_id=str(existing_record.get("user_id")),
                date=existing_record.get("date"),
                action_type="attendance_edited",
                action_description=f"Attendance record edited by {admin_name}: {', '.join(changes)}",
                created_by=admin_id,
                created_by_name=admin_name,
                details={"changes": changes}
            )

        return {
            "success": True,
            "message": "Attendance updated successfully",
            "updated_by": admin_id,
            "updated_at": datetime.now().isoformat(),
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
        now = datetime.now()
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

@router.get("/detail/{target_user_id}/{date}")
async def get_attendance_detail(
    target_user_id: str,
    date: str,
    user_id: str = Query(..., description="User _id making the request"),
    attendance_db: AttendanceDB = Depends(get_attendance_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get detailed attendance record for a specific user and date"""
    try:
        # Check permissions
        permissions = await get_user_permissions(user_id, users_db, roles_db)
        
        # Allow access if user can view all OR it's their own record
        if not permissions.get("can_view_all", False) and target_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view attendance details"
            )
        
        # Get user info
        user = await users_db.get_user(target_user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )
        
        # Get attendance detail
        attendance = await attendance_db.get_attendance_detail(target_user_id, date)
        
        if not attendance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No attendance record found for this date"
            )
        
        # Get attendance settings for expected working hours
        settings_db = SettingsDB()
        settings = await settings_db.get_attendance_settings()
        
        # Format response
        response_data = {
            "id": str(attendance["_id"]),
            "employee_id": target_user_id,
            "employee_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "date": date,
            "status": attendance.get("status"),
            "status_text": get_status_text(attendance.get("status", 0)),
            "check_in_time": attendance.get("check_in_time"),
            "check_out_time": attendance.get("check_out_time"),
            "check_in_photo_path": attendance.get("check_in_photo_path"),
            "check_out_photo_path": attendance.get("check_out_photo_path"),
            "check_in_location": attendance.get("check_in_location"),
            "check_out_location": attendance.get("check_out_location"),
            "total_working_hours": attendance.get("total_working_hours"),
            "expected_working_hours": settings.get("minimum_working_hours", 8.0),
            "comments": attendance.get("comments", ""),
            "marked_by": attendance.get("marked_by"),
            "marked_at": attendance.get("marked_at"),
            "is_holiday": attendance.get("is_holiday", False),
            "created_at": attendance.get("created_at"),
            "updated_at": attendance.get("updated_at")
        }
        
        return {
            "success": True,
            "attendance": response_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting attendance detail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get attendance detail: {str(e)}"
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
                "date_formatted": format_datetime_ist(datetime.now()).split(",")[0],
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
        target_date = date or datetime.now().date().isoformat()
        
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
        utc_now = datetime.now()
        ist_now = utc_now + timedelta(hours=5, minutes=30)
        
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
        target_date = date or datetime.now().date().isoformat()
        
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
        utc_now = datetime.now()
        ist_now = utc_now + timedelta(hours=5, minutes=30)
        
        return {
            "success": True,
            "utc_time": utc_now.strftime("%Y-%m-%d %H:%M:%S"),
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
        utc_now = datetime.now()
        ist_now = utc_now + timedelta(hours=5, minutes=30)
        
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
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    holidays_db = Depends(get_holidays_db)
):
    """Delete a holiday"""
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
        
        # Delete holiday
        success = await holidays_db.delete_holiday(holiday_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete holiday"
            )
        
        return {
            "success": True,
            "message": "Holiday deleted successfully"
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
        now = datetime.now()
        check_in_time = now.strftime("%H:%M:%S")
        
        # Determine if late (after 10:30 AM)
        late_threshold = datetime.strptime("10:30", "%H:%M").time()
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
            "marked_at": datetime.now(),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
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
        now = datetime.now()
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
        
        # Update attendance record
        update_data = {
            "check_out_time": check_out_time,
            "check_out_photo_path": photo_path,
            "check_out_geolocation": check_out_data.geolocation.dict() if check_out_data.geolocation else {"latitude": 0.0, "longitude": 0.0},
            "total_working_hours": round(working_hours, 2),
            "status": final_status,
            "comments": existing.get("comments", "") + (f" | Check-out: {check_out_data.comments}" if check_out_data.comments else ""),
            "updated_at": datetime.now()
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
        
        # Check admin permissions (must be admin or super admin)
        if not admin_user.get("is_super_admin") and admin_user.get("role_name", "").lower() not in ["admin", "super admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can register employee faces"
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
        if photo_data:
            # Create face photos directory
            face_photos_dir = os.path.join(Config.UPLOAD_DIR, "face_photos")
            os.makedirs(face_photos_dir, exist_ok=True)
            
            # Save photo
            photo_filename = f"{employee_id}_reference_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
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
            "registered_at": datetime.now().isoformat(),
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
        is_admin = user.get("is_super_admin") or user.get("role_name", "").lower() in ["admin", "super admin"]
        
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
            return {
                "verified": False,
                "confidence": 0.0,
                "threshold": 0.6,
                "employee_id": employee_id,
                "message": "No face registered for this employee"
            }
        
        # Compare with all registered samples
        registered_descriptors = registered_face.get("face_descriptors", [])
        
        if not registered_descriptors:
            return {
                "verified": False,
                "confidence": 0.0,
                "threshold": 0.6,
                "employee_id": employee_id,
                "message": "No face samples found"
            }
        
        # Calculate minimum distance across all samples
        import numpy as np
        
        min_distance = float('inf')
        for sample in registered_descriptors:
            sample_desc = sample.get("descriptor", [])
            if len(sample_desc) == 128:
                # Calculate Euclidean distance
                distance = np.linalg.norm(np.array(current_descriptor) - np.array(sample_desc))
                min_distance = min(min_distance, distance)
        
        # Face-API.js typically uses 0.6 as threshold for Euclidean distance
        threshold = 0.6
        verified = min_distance < threshold
        confidence = max(0, 1 - (min_distance / threshold))  # Convert distance to confidence score
        
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
            "confidence": round(confidence, 3),
            "threshold": threshold,
            "employee_id": employee_id,
            "message": "Face verified successfully" if verified else f"Face verification failed (distance: {round(min_distance, 3)})"
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
        
        if not admin_user.get("is_super_admin") and admin_user.get("role_name", "").lower() not in ["admin", "super admin"]:
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
        
        if not user.get("is_super_admin") and user.get("role_name", "").lower() not in ["admin", "super admin"]:
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