from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from datetime import date, datetime
from enum import Enum

class AttendanceStatus(str, Enum):
    FULL_DAY = "1"
    HALF_DAY = "0.5"
    ABSENT = "-1"
    LEAVE = "0"

class GeolocationData(BaseModel):
    latitude: float = Field(..., description="Latitude coordinates")
    longitude: float = Field(..., description="Longitude coordinates")
    accuracy: Optional[float] = Field(None, description="GPS accuracy in meters")
    address: Optional[str] = Field(None, description="Formatted address")

class CheckInRequest(BaseModel):
    photo_data: str = Field(..., description="Base64 encoded photo data")
    geolocation: GeolocationData = Field(..., description="GPS coordinates")
    comments: Optional[str] = Field("", description="Optional comments")

class CheckOutRequest(BaseModel):
    photo_data: str = Field(..., description="Base64 encoded photo data")
    geolocation: GeolocationData = Field(..., description="GPS coordinates")
    comments: Optional[str] = Field("", description="Optional comments")

class AttendanceCheckInRequest(BaseModel):
    photo_data: str = Field(..., description="Base64 encoded photo data")
    geolocation: GeolocationData = Field(..., description="GPS coordinates")
    comments: Optional[str] = Field("", description="Optional comments")

class AttendanceCheckOutRequest(BaseModel):
    photo_data: str = Field(..., description="Base64 encoded photo data")
    geolocation: GeolocationData = Field(..., description="GPS coordinates")
    comments: Optional[str] = Field("", description="Optional comments")

class AttendanceEditRequest(BaseModel):
    check_in_time: Optional[str] = Field(None, description="Check-in time in HH:MM:SS format")
    check_out_time: Optional[str] = Field(None, description="Check-out time in HH:MM:SS format")
    status: Optional[float] = Field(None, description="Attendance status")
    comments: Optional[str] = Field(None, description="Comments")
    admin_comments: Optional[str] = Field(None, description="Admin comments for edit reason")

class AttendanceDetailResponse(BaseModel):
    id: str = Field(..., description="Attendance record ID")
    user_id: str = Field(..., description="User ID")
    user_name: str = Field(..., description="User name")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    date_formatted: str = Field(..., description="Date in DD Month YYYY format")
    check_in_time: Optional[str] = Field(None, description="Check-in time")
    check_out_time: Optional[str] = Field(None, description="Check-out time")
    check_in_time_formatted: Optional[str] = Field(None, description="Check-in time in IST format")
    check_out_time_formatted: Optional[str] = Field(None, description="Check-out time in IST format")
    total_working_hours: Optional[float] = Field(None, description="Total working hours")
    total_working_hours_formatted: Optional[str] = Field(None, description="Total working hours formatted")
    status: float = Field(..., description="Attendance status")
    status_text: str = Field(..., description="Status description")
    check_in_photo_path: Optional[str] = Field(None, description="Check-in photo path")
    check_out_photo_path: Optional[str] = Field(None, description="Check-out photo path")
    check_in_geolocation: Optional[Dict[str, Any]] = Field(None, description="Check-in GPS coordinates")
    check_out_geolocation: Optional[Dict[str, Any]] = Field(None, description="Check-out GPS coordinates")
    comments: Optional[str] = Field(None, description="Comments")
    admin_comments: Optional[str] = Field(None, description="Admin comments")
    is_late: bool = Field(False, description="Whether check-in was late")
    is_early_departure: bool = Field(False, description="Whether check-out was early")
    is_holiday: bool = Field(False, description="Whether the date is a holiday")
    can_edit: bool = Field(True, description="Whether attendance can be edited")

class AttendanceSettings(BaseModel):
    # Shift Timing Settings
    shift_start_time: str = Field("10:00", description="Shift start time (HH:MM)")
    shift_end_time: str = Field("19:00", description="Shift end time (HH:MM)")
    reporting_deadline: str = Field("10:15", description="Reporting deadline (HH:MM)")
    
    # Working Hours Settings
    full_day_working_hours: float = Field(9.0, description="Full day working hours")
    half_day_minimum_working_hours: float = Field(5.0, description="Minimum hours for half day")
    
    # Grace Period Settings
    grace_period_minutes: int = Field(30, description="Grace period in minutes after deadline")
    grace_usage_limit: int = Field(2, description="Maximum grace period usage per month")
    
    # Leave Rules
    pending_leave_auto_convert_days: int = Field(3, description="Days after which pending leave converts to absconding")
    absconding_penalty: int = Field(-1, description="Penalty for absconding")
    
    # Sunday Sandwich Rule
    enable_sunday_sandwich_rule: bool = Field(True, description="Enable Sunday sandwich rule")
    minimum_working_days_for_sunday: int = Field(5, description="Minimum working days (Mon-Sat) to keep Sunday as holiday")
    
    # Legacy fields (for backwards compatibility)
    check_in_time: str = Field("09:30", description="Standard check-in time (HH:MM) - legacy")
    check_out_time: str = Field("18:30", description="Standard check-out time (HH:MM) - legacy")
    total_working_hours: float = Field(9.0, description="Total working hours per day - legacy")
    late_arrival_threshold: str = Field("10:30", description="Late arrival threshold (HH:MM) - legacy")
    early_departure_threshold: str = Field("17:30", description="Early departure threshold (HH:MM) - legacy")
    minimum_working_hours_full_day: float = Field(8.0, description="Minimum hours for full day - legacy")
    minimum_working_hours_half_day: float = Field(4.0, description="Minimum hours for half day - legacy")
    overtime_threshold: float = Field(9.0, description="Overtime threshold in hours")
    weekend_days: List[int] = Field([5, 6], description="Weekend days (0=Monday, 6=Sunday)")
    allow_early_check_in: bool = Field(True, description="Allow early check-in before scheduled time")
    allow_late_check_out: bool = Field(True, description="Allow late check-out after scheduled time")
    require_photo: bool = Field(True, description="Whether photo is required for check-in/out")
    require_geolocation: bool = Field(True, description="Whether geolocation is required")
    geofence_enabled: bool = Field(False, description="Whether geofence validation is enabled")
    office_latitude: Optional[float] = Field(None, description="Office latitude")
    office_longitude: Optional[float] = Field(None, description="Office longitude")
    geofence_radius: float = Field(100.0, description="Geofence radius in meters")
    
class AttendanceSettingsUpdate(BaseModel):
    # New fields
    shift_start_time: Optional[str] = Field(None, description="Shift start time (HH:MM)")
    shift_end_time: Optional[str] = Field(None, description="Shift end time (HH:MM)")
    reporting_deadline: Optional[str] = Field(None, description="Reporting deadline (HH:MM)")
    full_day_working_hours: Optional[float] = Field(None, description="Full day working hours")
    half_day_minimum_working_hours: Optional[float] = Field(None, description="Minimum hours for half day")
    grace_period_minutes: Optional[int] = Field(None, description="Grace period in minutes")
    grace_usage_limit: Optional[int] = Field(None, description="Grace usage limit per month")
    pending_leave_auto_convert_days: Optional[int] = Field(None, description="Pending leave auto-convert days")
    absconding_penalty: Optional[int] = Field(None, description="Absconding penalty")
    enable_sunday_sandwich_rule: Optional[bool] = Field(None, description="Enable Sunday sandwich rule")
    minimum_working_days_for_sunday: Optional[int] = Field(None, description="Minimum working days for Sunday")
    
    # Legacy fields
    check_in_time: Optional[str] = Field(None, description="Standard check-in time (HH:MM)")
    check_out_time: Optional[str] = Field(None, description="Standard check-out time (HH:MM)")
    total_working_hours: Optional[float] = Field(None, description="Total working hours per day")
    late_arrival_threshold: Optional[str] = Field(None, description="Late arrival threshold (HH:MM)")
    early_departure_threshold: Optional[str] = Field(None, description="Early departure threshold (HH:MM)")
    minimum_working_hours_full_day: Optional[float] = Field(None, description="Minimum hours for full day")
    minimum_working_hours_half_day: Optional[float] = Field(None, description="Minimum hours for half day")
    overtime_threshold: Optional[float] = Field(None, description="Overtime threshold in hours")
    weekend_days: Optional[List[int]] = Field(None, description="Weekend days (0=Monday, 6=Sunday)")
    allow_early_check_in: Optional[bool] = Field(None, description="Allow early check-in before scheduled time")
    allow_late_check_out: Optional[bool] = Field(None, description="Allow late check-out after scheduled time")
    require_photo: Optional[bool] = Field(None, description="Whether photo is required for check-in/out")
    require_geolocation: Optional[bool] = Field(None, description="Whether geolocation is required")
    geofence_enabled: Optional[bool] = Field(None, description="Whether geofence validation is enabled")
    office_latitude: Optional[float] = Field(None, description="Office latitude")
    office_longitude: Optional[float] = Field(None, description="Office longitude")
    geofence_radius: Optional[float] = Field(None, description="Geofence radius in meters")

class AttendanceCreate(BaseModel):
    employee_id: str = Field(..., description="ID of the employee")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    status: float = Field(..., description="Attendance status: 1 = Full Day, 0.5 = Half Day, 0 = Leave, -1 = Absent")
    comments: Optional[str] = Field("", description="Optional comments")
    check_in_time: Optional[str] = Field(None, description="Check-in time")
    check_out_time: Optional[str] = Field(None, description="Check-out time")
    check_in_photo_path: Optional[str] = Field(None, description="Check-in photo path")
    check_out_photo_path: Optional[str] = Field(None, description="Check-out photo path")
    check_in_geolocation: Optional[Dict[str, Any]] = Field(None, description="Check-in GPS coordinates")
    check_out_geolocation: Optional[Dict[str, Any]] = Field(None, description="Check-out GPS coordinates")
    total_working_hours: Optional[float] = Field(None, description="Total working hours")
    is_holiday: Optional[bool] = Field(False, description="Whether the date is a holiday")
    
    @validator('status')
    def validate_status(cls, v):
        if v not in [1, 0.5, -1, 0]:
            raise ValueError('Status must be 1 (Full Day), 0.5 (Half Day), 0 (Leave), or -1 (Absent)')
        return v
    
    @validator('date')
    def validate_date(cls, v):
        try:
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')

class AttendanceUpdate(BaseModel):
    status: Optional[float] = Field(None, description="Attendance status")
    comments: Optional[str] = Field(None, description="Comments")
    check_in_time: Optional[str] = Field(None, description="Check-in time")
    check_out_time: Optional[str] = Field(None, description="Check-out time")
    check_in_photo_path: Optional[str] = Field(None, description="Check-in photo path")
    check_out_photo_path: Optional[str] = Field(None, description="Check-out photo path")
    check_in_geolocation: Optional[Dict[str, Any]] = Field(None, description="Check-in GPS coordinates")
    check_out_geolocation: Optional[Dict[str, Any]] = Field(None, description="Check-out GPS coordinates")
    total_working_hours: Optional[float] = Field(None, description="Total working hours")
    is_holiday: Optional[bool] = Field(None, description="Whether the date is a holiday")
    
    @validator('status')
    def validate_status(cls, v):
        if v is not None and v not in [1, 0.5, -1, 0]:
            raise ValueError('Status must be 1 (Full Day), 0.5 (Half Day), 0 (Leave), or -1 (Absent)')
        return v

class BulkAttendanceCreate(BaseModel):
    department_id: str = Field(..., description="ID of the department")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    status: float = Field(..., description="Attendance status for all employees")
    comments: Optional[str] = Field("", description="Comments for bulk attendance")
    
    @validator('status')
    def validate_status(cls, v):
        if v not in [1, 0.5, -1, 0]:
            raise ValueError('Status must be 1 (Full Day), 0.5 (Half Day), 0 (Leave), or -1 (Absent)')
        return v
    
    @validator('date')
    def validate_date(cls, v):
        try:
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')

class AttendanceResponse(BaseModel):
    id: str = Field(..., description="Attendance record ID")
    employee_id: str = Field(..., description="Employee ID")
    employee_name: str = Field(..., description="Employee name")
    department_id: Optional[str] = Field(None, description="Department ID")
    department_name: str = Field(..., description="Department name")
    date: str = Field(..., description="Attendance date")
    status: float = Field(..., description="Attendance status")
    status_text: str = Field(..., description="Human readable status")
    comments: str = Field(..., description="Comments")
    marked_by: Optional[str] = Field(None, description="ID of user who marked attendance")
    marked_at: Optional[datetime] = Field(None, description="When attendance was marked")
    photo_path: Optional[str] = Field(None, description="Path to attendance photo")
    check_in_time: Optional[str] = Field(None, description="Check-in time")
    is_holiday: bool = Field(False, description="Whether the date is a holiday")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

class AttendanceDetailResponse(BaseModel):
    id: str = Field(..., description="Attendance record ID")
    user_id: str = Field(..., description="User ID")
    employee_name: str = Field(..., description="Employee name")
    department_name: Optional[str] = Field(None, description="Department name")
    date: str = Field(..., description="Date")
    check_in_time: Optional[str] = Field(None, description="Check-in time")
    check_out_time: Optional[str] = Field(None, description="Check-out time")
    check_in_display: Optional[str] = Field(None, description="Formatted check-in time for display")
    check_out_display: Optional[str] = Field(None, description="Formatted check-out time for display")
    working_hours: Optional[float] = Field(None, description="Total working hours")
    status: float = Field(..., description="Attendance status")
    status_text: Optional[str] = Field(None, description="Status in text format")
    is_late: Optional[bool] = Field(False, description="Whether check-in was late")
    check_in_photo: Optional[str] = Field(None, description="Check-in photo path")
    check_out_photo: Optional[str] = Field(None, description="Check-out photo path")
    check_in_geolocation: Optional[GeolocationData] = Field(None, description="Check-in geolocation")
    check_out_geolocation: Optional[GeolocationData] = Field(None, description="Check-out geolocation")
    check_in_comments: Optional[str] = Field(None, description="Check-in comments")
    check_out_comments: Optional[str] = Field(None, description="Check-out comments")
    is_editable: Optional[bool] = Field(True, description="Whether the record can be edited")

class TodayAttendanceResponse(BaseModel):
    has_checked_in: bool = Field(..., description="Whether user has checked in today")
    has_checked_out: bool = Field(..., description="Whether user has checked out today")
    attendance_details: Optional[AttendanceDetailResponse] = Field(None, description="Today's attendance details if exists")
    can_check_in: bool = Field(..., description="Whether user can check in now")
    can_check_out: bool = Field(..., description="Whether user can check out now")

class AttendanceStats(BaseModel):
    total_days: int = Field(0, description="Total days with attendance records")
    full_days: int = Field(0, description="Number of full days")
    half_days: int = Field(0, description="Number of half days")
    absent_days: int = Field(0, description="Number of absent days")
    absconding: int = Field(0, description="Number of absconding days")
    holidays: int = Field(0, description="Number of holidays")
    attendance_percentage: float = Field(0, description="Attendance percentage")

class MonthlyAttendanceRequest(BaseModel):
    year: Optional[int] = Field(None, description="Year (default: current year)")
    month: Optional[int] = Field(None, description="Month (default: current month)")
    employee_id: Optional[str] = Field(None, description="Employee ID (for individual view)")
    department_id: Optional[str] = Field(None, description="Department ID (for department view)")
    
    @validator('month')
    def validate_month(cls, v):
        if v is not None and (v < 1 or v > 12):
            raise ValueError('Month must be between 1 and 12')
        return v

class AttendanceCalendarDay(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    day: int = Field(..., description="Day of month")
    status: Optional[float] = Field(None, description="Attendance status")
    status_text: Optional[str] = Field(None, description="Human readable status")
    is_holiday: bool = Field(False, description="Whether the date is a holiday")
    is_weekend: bool = Field(False, description="Whether the date is a weekend")
    comments: Optional[str] = Field(None, description="Comments")
    photo_path: Optional[str] = Field(None, description="Path to attendance photo")
    # Leave integration fields
    leave_id: Optional[str] = Field(None, description="Leave application ID if on leave")
    leave_type: Optional[str] = Field(None, description="Type of leave if applicable")
    leave_reason: Optional[str] = Field(None, description="Reason for leave if applicable")
    leave_approved_by: Optional[str] = Field(None, description="Who approved the leave")
    leave_approved_by_name: Optional[str] = Field(None, description="Name of leave approver")

class EmployeeAttendanceCalendar(BaseModel):
    employee_id: str = Field(..., description="Employee ID (_id)")
    employee_name: str = Field(..., description="Employee name")
    employee_photo: Optional[str] = Field(None, description="Employee photo URL")
    department_name: str = Field(default="Unknown Department", description="Department name")
    role_name: Optional[str] = Field(None, description="Role name")
    days: List[AttendanceCalendarDay] = Field(..., description="Attendance data for each day")
    stats: AttendanceStats = Field(..., description="Monthly attendance statistics")

class AttendanceListResponse(BaseModel):
    success: bool = Field(True, description="Whether the request was successful")
    attendance: List[AttendanceResponse] = Field(..., description="List of attendance records")
    total: int = Field(..., description="Total number of records")
    page: int = Field(1, description="Current page number")
    per_page: int = Field(10, description="Records per page")
    total_pages: int = Field(..., description="Total number of pages")

class AttendanceCalendarResponse(BaseModel):
    success: bool = Field(True, description="Whether the request was successful")
    year: int = Field(..., description="Year")
    month: int = Field(..., description="Month")
    month_name: str = Field(..., description="Month name")
    employees: List[EmployeeAttendanceCalendar] = Field(..., description="Employee attendance data")
    department_stats: Optional[AttendanceStats] = Field(None, description="Department-wide statistics")

class AttendancePermissions(BaseModel):
    can_view_own: bool = Field(True, description="Can view own attendance")
    can_view_all: bool = Field(False, description="Can view all employees attendance")
    can_mark_own: bool = Field(True, description="Can mark own attendance")
    can_mark_all: bool = Field(False, description="Can mark attendance for all employees")
    can_edit: bool = Field(False, description="Can edit attendance records")
    can_delete: bool = Field(False, description="Can delete attendance records")
    can_export: bool = Field(False, description="Can export attendance data")

class AttendanceMarkRequest(BaseModel):
    photo_data: Optional[str] = Field(None, description="Base64 encoded photo data")
    check_in_time: Optional[str] = Field(None, description="Check-in time")
    comments: Optional[str] = Field("", description="Optional comments")

def calculate_working_hours(check_in_time: str, check_out_time: str) -> float:
    """Calculate working hours between check-in and check-out times"""
    try:
        from datetime import datetime
        
        # Parse time strings
        check_in = datetime.strptime(check_in_time, "%H:%M:%S")
        check_out = datetime.strptime(check_out_time, "%H:%M:%S")
        
        # Handle overnight work (check_out next day)
        if check_out < check_in:
            from datetime import timedelta
            check_out += timedelta(days=1)
        
        # Calculate difference in hours
        time_diff = check_out - check_in
        hours = time_diff.total_seconds() / 3600
        return round(hours, 2)
    except:
        return 0.0

def determine_attendance_status(check_in_time: str, check_out_time: str, settings: dict) -> float:
    """Determine attendance status based on check-in/out times and settings"""
    try:
        from datetime import datetime
        
        # Parse times
        check_in_dt = datetime.strptime(check_in_time, "%H:%M:%S").time()
        late_threshold = datetime.strptime(settings.get("late_arrival_threshold", "10:30"), "%H:%M").time()
        
        total_working_hours = 0.0
        if check_out_time:
            total_working_hours = calculate_working_hours(check_in_time, check_out_time)
            early_departure_threshold = datetime.strptime(settings.get("early_departure_threshold", "17:30"), "%H:%M").time()
            check_out_dt = datetime.strptime(check_out_time, "%H:%M:%S").time()
            
            # Check for early departure
            if check_out_dt < early_departure_threshold:
                return 0.5  # Half day for early departure
        
        # Check for late arrival
        if check_in_dt > late_threshold:
            return 0.5  # Half day for late arrival
        
        # Check total working hours if check-out is done
        if check_out_time and total_working_hours > 0:
            min_full_day_hours = settings.get("minimum_working_hours_full_day", 8.0)
            min_half_day_hours = settings.get("minimum_working_hours_half_day", 4.0)
            
            if total_working_hours >= min_full_day_hours:
                return 1.0  # Full day
            elif total_working_hours >= min_half_day_hours:
                return 0.5  # Half day
            else:
                return -1  # Absent (insufficient hours)
        
        # If only check-in is done, determine based on check-in time
        return 0.5 if check_in_dt > late_threshold else 1.0
        
    except Exception as e:
        print(f"Error determining attendance status: {e}")
        return 1.0  # Default to full day

def format_datetime_ist(dt: datetime) -> str:
    """Format datetime to IST format like '08 August 2004, 13:16'"""
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

def format_time_ist(time_str: str, date_str: str = None) -> str:
    """Format time string to IST with date context"""
    try:
        from datetime import datetime, timedelta
        
        if date_str:
            dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M:%S")
        else:
            # Use today's date
            from datetime import date
            today = date.today()
            dt = datetime.strptime(f"{today} {time_str}", "%Y-%m-%d %H:%M:%S")
        
        return format_datetime_ist(dt)
    except:
        return time_str

def get_status_text(status: float) -> str:
    """Get status description from numeric status"""
    status_map = {
        1.0: "Full Day",
        0.5: "Half Day", 
        0.0: "Leave",
        -1.0: "Absent",
        -2.0: "Absconding",
        1.5: "Holiday"
    }
    return status_map.get(status, "Unknown")

def format_working_hours(hours: float) -> str:
    """Format working hours to readable format"""
    if hours == 0:
        return "0 hours"
    
    total_minutes = int(hours * 60)
    hours_part = total_minutes // 60
    minutes_part = total_minutes % 60
    
    if hours_part == 0:
        return f"{minutes_part} minutes"
    elif minutes_part == 0:
        return f"{hours_part} hours"
    else:
        return f"{hours_part} hours {minutes_part} minutes"

# ============= Paid Leave Management Schemas =============

class EmployeeLeaveBalance(BaseModel):
    """Employee leave balance information"""
    employee_id: str = Field(..., description="Employee ID")
    employee_name: str = Field(..., description="Employee name")
    employee_code: Optional[str] = Field(None, description="Employee code")
    department: Optional[str] = Field(None, description="Department name")
    
    # Leave Balances
    paid_leaves_total: int = Field(0, description="Total paid leaves allocated per year")
    paid_leaves_used: int = Field(0, description="Paid leaves used")
    paid_leaves_remaining: int = Field(0, description="Paid leaves remaining")
    
    earned_leaves_total: int = Field(0, description="Total earned leaves")
    earned_leaves_used: int = Field(0, description="Earned leaves used")
    earned_leaves_remaining: int = Field(0, description="Earned leaves remaining")
    
    sick_leaves_total: int = Field(0, description="Total sick leaves per year")
    sick_leaves_used: int = Field(0, description="Sick leaves used")
    sick_leaves_remaining: int = Field(0, description="Sick leaves remaining")
    
    casual_leaves_total: int = Field(0, description="Total casual leaves per year")
    casual_leaves_used: int = Field(0, description="Casual leaves used")
    casual_leaves_remaining: int = Field(0, description="Casual leaves remaining")
    
    # Leave cycle
    leave_cycle_start: Optional[str] = Field(None, description="Leave cycle start date (YYYY-MM-DD)")
    leave_cycle_end: Optional[str] = Field(None, description="Leave cycle end date (YYYY-MM-DD)")
    last_updated: Optional[datetime] = Field(None, description="Last update timestamp")


class LeaveBalanceUpdate(BaseModel):
    """Update leave balance for an employee"""
    employee_id: str = Field(..., description="Employee ID")
    
    # Optional updates for each leave type
    paid_leaves_total: Optional[int] = Field(None, ge=0, description="Total paid leaves")
    earned_leaves_total: Optional[int] = Field(None, ge=0, description="Total earned leaves") 
    sick_leaves_total: Optional[int] = Field(None, ge=0, description="Total sick leaves")
    casual_leaves_total: Optional[int] = Field(None, ge=0, description="Total casual leaves")
    
    # Leave cycle dates
    leave_cycle_start: Optional[str] = Field(None, description="Leave cycle start date")
    leave_cycle_end: Optional[str] = Field(None, description="Leave cycle end date")
    
    # Admin details
    updated_by: str = Field(..., description="Admin user ID who updated")
    update_reason: Optional[str] = Field(None, description="Reason for update")


class LeaveAllocation(BaseModel):
    """Allocate leaves to an employee"""
    employee_id: str = Field(..., description="Employee ID")
    leave_type: str = Field(..., description="Leave type: paid, earned, sick, casual")
    quantity: int = Field(..., gt=0, description="Number of leaves to allocate")
    reason: str = Field(..., min_length=5, description="Reason for allocation")
    allocated_by: str = Field(..., description="Admin user ID")
    valid_from: Optional[str] = Field(None, description="Valid from date (YYYY-MM-DD)")
    valid_until: Optional[str] = Field(None, description="Valid until date (YYYY-MM-DD)")
    
    @validator('leave_type')
    def validate_leave_type(cls, v):
        allowed_types = ['paid', 'earned', 'sick', 'casual']
        if v.lower() not in allowed_types:
            raise ValueError(f'Leave type must be one of: {", ".join(allowed_types)}')
        return v.lower()


class LeaveDeduction(BaseModel):
    """Deduct leaves from an employee"""
    employee_id: str = Field(..., description="Employee ID")
    leave_type: str = Field(..., description="Leave type: paid, earned, sick, casual")
    quantity: int = Field(..., gt=0, description="Number of leaves to deduct")
    reason: str = Field(..., min_length=5, description="Reason for deduction")
    deducted_by: str = Field(..., description="Admin user ID")
    
    @validator('leave_type')
    def validate_leave_type(cls, v):
        allowed_types = ['paid', 'earned', 'sick', 'casual']
        if v.lower() not in allowed_types:
            raise ValueError(f'Leave type must be one of: {", ".join(allowed_types)}')
        return v.lower()


class LeaveHistory(BaseModel):
    """Leave transaction history"""
    id: str = Field(..., description="Transaction ID")
    employee_id: str = Field(..., description="Employee ID")
    employee_name: str = Field(..., description="Employee name")
    leave_type: str = Field(..., description="Leave type")
    transaction_type: str = Field(..., description="allocation or deduction")
    quantity: int = Field(..., description="Number of leaves")
    reason: str = Field(..., description="Reason for transaction")
    performed_by: str = Field(..., description="Admin user ID")
    performed_by_name: str = Field(..., description="Admin user name")
    timestamp: datetime = Field(..., description="Transaction timestamp")
    balance_before: int = Field(..., description="Balance before transaction")
    balance_after: int = Field(..., description="Balance after transaction")


class BulkLeaveAllocation(BaseModel):
    """Bulk allocate leaves to multiple employees"""
    employee_ids: List[str] = Field(..., min_items=1, description="List of employee IDs")
    leave_type: str = Field(..., description="Leave type")
    quantity: int = Field(..., gt=0, description="Number of leaves")
    reason: str = Field(..., min_length=5, description="Reason for allocation")
    allocated_by: str = Field(..., description="Admin user ID")
    
    @validator('leave_type')
    def validate_leave_type(cls, v):
        allowed_types = ['paid', 'earned', 'sick', 'casual']
        if v.lower() not in allowed_types:
            raise ValueError(f'Leave type must be one of: {", ".join(allowed_types)}')
        return v.lower()


class LeaveConfigDefaults(BaseModel):
    """Default leave configuration for new employees"""
    paid_leaves_per_year: int = Field(12, ge=0, description="Default paid leaves per year")
    earned_leaves_per_year: int = Field(15, ge=0, description="Default earned leaves per year")
    sick_leaves_per_year: int = Field(7, ge=0, description="Default sick leaves per year")
    casual_leaves_per_year: int = Field(5, ge=0, description="Default casual leaves per year")
    leave_cycle_start_month: int = Field(1, ge=1, le=12, description="Leave cycle start month (1-12)")
    leave_cycle_start_day: int = Field(1, ge=1, le=31, description="Leave cycle start day")
    carry_forward_enabled: bool = Field(False, description="Allow carry forward of unused leaves")
    max_carry_forward: int = Field(5, ge=0, description="Maximum leaves that can be carried forward")