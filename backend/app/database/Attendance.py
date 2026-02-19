from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, date
import pytz
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config

# Define IST timezone for consistent date/time handling
IST = pytz.timezone('Asia/Kolkata')

class AttendanceDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
            
        self.collection = self.db['attendance']
        self.users_collection = self.db['users']
        self.departments_collection = self.db['departments']
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Drop old employee_id based unique index if it exists
            try:
                await self.collection.drop_index([("employee_id", 1), ("date", 1)])
                print("✓ Dropped old employee_id+date unique index")
            except Exception as e:
                print(f"Note: Old index might not exist: {e}")
            
            # Create new indexes for better performance using user_id
            await self.collection.create_index([("user_id", 1), ("date", 1)], unique=True, background=True)
            await self.collection.create_index([("date", 1)], background=True)
            await self.collection.create_index([("department_id", 1)], background=True)
            await self.collection.create_index([("status", 1)], background=True)
            # ⚡ COMPOUND INDEXES for common query patterns
            await self.collection.create_index([("department_id", 1), ("date", 1)], background=True)
            await self.collection.create_index([("user_id", 1), ("status", 1)], background=True)
            await self.collection.create_index([("date", 1), ("status", 1)], background=True)
            print("✓ Attendance database indexes created successfully")
        except Exception as e:
            print(f"Attendance index creation warning (may already exist): {e}")

    async def _async_to_list(self, cursor):
        """Convert async cursor to list"""
        result = []
        async for document in cursor:
            result.append(document)
        return result

    async def mark_attendance(self, attendance_data: Dict[str, Any]) -> str:
        """Mark attendance for an employee using user_id (_id)"""
        try:
            # Use user_id as primary key, fallback to employee_id for backward compatibility
            user_id = attendance_data.get("user_id") or attendance_data.get("employee_id")
            if not user_id:
                raise ValueError("user_id or employee_id is required")
            
            # Ensure unique attendance per user per day
            existing = await self.collection.find_one({
                "user_id": user_id,
                "date": attendance_data["date"]
            })
            
            if existing:
                # Update existing attendance
                update_data = {
                    "status": attendance_data["status"],
                    "comments": attendance_data.get("comments", ""),
                    "marked_by": attendance_data.get("marked_by"),
                    "marked_at": datetime.now(),
                    "photo_path": attendance_data.get("photo_path"),
                    "updated_at": datetime.now()
                }
                
                await self.collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": update_data}
                )
                return str(existing["_id"])
            else:
                # Create new attendance record using user_id as primary identifier
                attendance_doc = {
                    "user_id": user_id,  # Primary identifier (_id)
                    "employee_id": attendance_data.get("employee_id"),  # Optional for display
                    "employee_name": attendance_data.get("employee_name", ""),
                    "department_id": attendance_data.get("department_id"),
                    "department_name": attendance_data.get("department_name", ""),
                    "date": attendance_data["date"],
                    "status": attendance_data["status"],  # 1 = Full Day, 0.5 = Half Day, -1 = Absent
                    "comments": attendance_data.get("comments", ""),
                    "marked_by": attendance_data.get("marked_by"),
                    "marked_at": datetime.now(),
                    "photo_path": attendance_data.get("photo_path"),
                    "check_in_time": attendance_data.get("check_in_time"),
                    "is_holiday": attendance_data.get("is_holiday", False),
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                }
                
                result = await self.collection.insert_one(attendance_doc)
                return str(result.inserted_id)
                
        except Exception as e:
            print(f"Error marking attendance: {e}")
            raise

    async def get_attendance(self, attendance_id: str) -> Optional[Dict[str, Any]]:
        """Get attendance record by ID"""
        try:
            attendance = await self.collection.find_one({"_id": ObjectId(attendance_id)})
            if attendance:
                attendance["_id"] = str(attendance["_id"])
            return attendance
        except Exception as e:
            print(f"Error getting attendance: {e}")
            return None

    async def get_employee_attendance(self, employee_id: str, start_date: date = None, end_date: date = None) -> List[Dict[str, Any]]:
        """Get attendance records for a specific employee using user_id (_id)"""
        try:
            # Query using user_id (which is the _id) with fallback to employee_id for backward compatibility
            query = {
                "$or": [
                    {"user_id": employee_id},
                    {"employee_id": employee_id}
                ]
            }
            
            if start_date and end_date:
                query["date"] = {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            elif start_date:
                query["date"] = {"$gte": start_date.isoformat()}
            elif end_date:
                query["date"] = {"$lte": end_date.isoformat()}
            
            attendance_records = await self._async_to_list(self.collection.find(query).sort("date", -1))
            
            for record in attendance_records:
                record["_id"] = str(record["_id"])
                
            return attendance_records
        except Exception as e:
            print(f"Error getting employee attendance: {e}")
            return []
    
    async def get_bulk_employee_attendance(self, employee_ids: List[str], start_date: date = None, end_date: date = None) -> Dict[str, Dict[str, Any]]:
        """⚡ OPTIMIZED: Get attendance records for multiple employees in one query"""
        try:
            # Build date range query
            query = {}
            if start_date and end_date:
                query["date"] = {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            elif start_date:
                query["date"] = {"$gte": start_date.isoformat()}
            elif end_date:
                query["date"] = {"$lte": end_date.isoformat()}
            
            # Query for all employees at once with user_id fallback
            query["$or"] = [
                {"user_id": {"$in": employee_ids}},
                {"employee_id": {"$in": employee_ids}}
            ]
            
            # Single database query for all employees
            attendance_records = await self._async_to_list(
                self.collection.find(query).sort("date", -1)
            )
            
            # Organize by employee_id -> date -> record
            employee_attendance = {}
            for record in attendance_records:
                record["_id"] = str(record["_id"])
                
                # Use user_id primarily, fallback to employee_id
                emp_id = record.get("user_id") or record.get("employee_id")
                if not emp_id:
                    continue
                    
                if emp_id not in employee_attendance:
                    employee_attendance[emp_id] = {}
                
                record_date = record.get("date")
                if record_date:
                    employee_attendance[emp_id][record_date] = record
            
            return employee_attendance
            
        except Exception as e:
            print(f"Error getting bulk employee attendance: {e}")
            return {}

    async def get_department_attendance(self, department_id: str, date_filter: date = None) -> List[Dict[str, Any]]:
        """Get attendance records for a department"""
        try:
            query = {"department_id": department_id}
            
            if date_filter:
                query["date"] = date_filter.isoformat()
            
            attendance_records = await self._async_to_list(self.collection.find(query).sort([("date", -1), ("employee_name", 1)]))
            
            for record in attendance_records:
                record["_id"] = str(record["_id"])
                
            return attendance_records
        except Exception as e:
            print(f"Error getting department attendance: {e}")
            return []

    async def get_all_attendance(self, start_date: date = None, end_date: date = None, department_id: str = None) -> List[Dict[str, Any]]:
        """Get all attendance records with optional filters"""
        try:
            query = {}
            
            if start_date and end_date:
                query["date"] = {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            elif start_date:
                query["date"] = {"$gte": start_date.isoformat()}
            elif end_date:
                query["date"] = {"$lte": end_date.isoformat()}
                
            if department_id:
                query["department_id"] = department_id
            
            attendance_records = await self._async_to_list(self.collection.find(query).sort([("date", -1), ("employee_name", 1)]))
            
            for record in attendance_records:
                record["_id"] = str(record["_id"])
                
            return attendance_records
        except Exception as e:
            print(f"Error getting all attendance: {e}")
            return []

    async def get_attendance_stats(self, employee_id: str, start_date: date = None, end_date: date = None) -> Dict[str, Any]:
        """Get attendance statistics for an employee"""
        try:
            # Build query
            query = {"employee_id": employee_id}
            
            if start_date and end_date:
                query["date"] = {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            elif start_date:
                query["date"] = {"$gte": start_date.isoformat()}
            elif end_date:
                query["date"] = {"$lte": end_date.isoformat()}
            
            # Get all matching records
            records = await self._async_to_list(self.collection.find(query))
            
            if not records:
                return {
                    "total_days": 0,
                    "full_days": 0,
                    "half_days": 0,
                    "absent_days": 0,
                    "holidays": 0,
                    "attendance_percentage": 0.0
                }
            
            # Calculate stats
            total_days = len(records)
            full_days = len([r for r in records if r.get("status") == 1])
            half_days = len([r for r in records if r.get("status") == 0.5])
            absent_days = len([r for r in records if r.get("status") == -1])
            holidays = len([r for r in records if r.get("is_holiday") == True])
            
            # Calculate attendance percentage
            working_days = total_days - holidays
            attended_days = full_days + (half_days * 0.5)
            
            if working_days > 0:
                attendance_percentage = round((attended_days / working_days) * 100, 2)
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
            print(f"Error getting attendance stats: {e}")
            return {
                "total_days": 0,
                "full_days": 0,
                "half_days": 0,
                "absent_days": 0,
                "holidays": 0,
                "attendance_percentage": 0.0
            }

    async def mark_bulk_attendance(self, department_id: str, date_filter: date, status: float, marked_by: str, comments: str = "") -> int:
        """Mark attendance for all employees in a department"""
        try:
            # Get all employees in the department
            employees = []
            async for employee in self.users_collection.find({"department_id": department_id}):
                employees.append(employee)
            
            marked_count = 0
            for employee in employees:
                attendance_data = {
                    "employee_id": str(employee["_id"]),
                    "employee_name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip(),
                    "department_id": department_id,
                    "department_name": employee.get("department_name", ""),
                    "date": date_filter.isoformat(),
                    "status": status,
                    "comments": comments,
                    "marked_by": marked_by
                }
                
                self.mark_attendance(attendance_data)
                marked_count += 1
                
            return marked_count
        except Exception as e:
            print(f"Error marking bulk attendance: {e}")
            raise

    async def delete_attendance(self, attendance_id: str) -> bool:
        """Delete an attendance record"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(attendance_id)})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting attendance: {e}")
            return False

    async def get_monthly_attendance(self, employee_id: str = None, department_id: str = None, year: int = None, month: int = None) -> List[Dict[str, Any]]:
        """Get monthly attendance data for calendar view"""
        try:
            if not year:
                year = datetime.now().year
            if not month:
                month = datetime.now().month
                
            # Create date range for the month
            start_date = date(year, month, 1)
            if month == 12:
                end_date = date(year + 1, 1, 1)
            else:
                end_date = date(year, month + 1, 1)
            
            query = {
                "date": {
                    "$gte": start_date.isoformat(),
                    "$lt": end_date.isoformat()
                }
            }
            
            # Only filter by employee_id if provided and if there are records with employee_id
            if employee_id:
                # Try to find if any records have employee_id field
                sample_record = await self.collection.find_one({"employee_id": {"$exists": True}})
                if sample_record:
                    query["employee_id"] = employee_id
                else:
                    # If no records with employee_id, return empty list for now
                    # In the future, attendance records should be created with employee_id
                    return []
                    
            if department_id:
                query["department_id"] = department_id
                
            # Sort by date only to avoid errors with missing employee_id field
            attendance_records = await self._async_to_list(self.collection.find(query).sort([("date", 1)]))
            
            for record in attendance_records:
                record["_id"] = str(record["_id"])
                
            return attendance_records
        except Exception as e:
            print(f"Error getting monthly attendance: {e}")
            return []

    async def count_attendance(self, query: Dict[str, Any] = None) -> int:
        """Count attendance records"""
        try:
            if query is None:
                query = {}
            return await self.collection.count_documents(query)
        except Exception as e:
            print(f"Error counting attendance: {e}")
            return 0

    async def check_in(self, check_in_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check-in functionality with photo and geolocation"""
        try:
            user_id = check_in_data.get("user_id")
            if not user_id:
                raise ValueError("user_id is required")
            
            # Use IST timezone for consistent date calculation
            ist_now = datetime.now(IST)
            today = ist_now.date().isoformat()
            current_time = ist_now
            
            # Check if user already checked in today
            existing = await self.collection.find_one({
                "user_id": user_id,
                "date": today
            })
            
            if existing and existing.get("check_in_time"):
                raise ValueError("User has already checked in today")
            
            # Get user details
            user = await self.users_collection.find_one({"_id": ObjectId(user_id)})
            if not user:
                raise ValueError("User not found")
            
            # Get department details
            department = None
            if user.get("department_id"):
                department = await self.departments_collection.find_one({"_id": ObjectId(user["department_id"])})
            
            # Calculate status based on check-in time (10:30 AM threshold)
            check_in_time = current_time.time()
            late_threshold = datetime.strptime("10:30", "%H:%M").time()
            is_late = check_in_time > late_threshold
            
            # Prepare check-in record
            check_in_record = {
                "user_id": user_id,
                "employee_id": user_id,  # For backward compatibility
                "employee_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "department_id": user.get("department_id"),
                "department_name": department.get("name", "") if department else "",
                "date": today,
                "check_in_time": current_time.isoformat(),
                "check_in_photo": check_in_data.get("photo_path"),
                "check_in_geolocation": check_in_data.get("geolocation", {}),
                "check_in_comments": check_in_data.get("comments", ""),
                "is_late": is_late,
                "status": 0.5 if is_late else None,  # Half day if late, will be calculated on checkout
                "created_at": current_time,
                "updated_at": current_time
            }
            
            if existing:
                # Update existing record
                await self.collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": check_in_record}
                )
                attendance_id = str(existing["_id"])
            else:
                # Create new record
                result = await self.collection.insert_one(check_in_record)
                attendance_id = str(result.inserted_id)
            
            return {
                "attendance_id": attendance_id,
                "check_in_time": current_time.isoformat(),
                "is_late": is_late,
                "status": "Late Check-in" if is_late else "On Time",
                "message": "Check-in successful"
            }
            
        except Exception as e:
            print(f"Error during check-in: {e}")
            raise

    async def check_out(self, check_out_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check-out functionality with photo and geolocation"""
        try:
            user_id = check_out_data.get("user_id")
            if not user_id:
                raise ValueError("user_id is required")
            
            # Use IST timezone for consistent date calculation
            ist_now = datetime.now(IST)
            today = ist_now.date().isoformat()
            current_time = ist_now
            
            # Find today's attendance record
            attendance = await self.collection.find_one({
                "user_id": user_id,
                "date": today
            })
            
            if not attendance:
                raise ValueError("No check-in record found for today. Please check-in first.")
            
            if attendance.get("check_out_time"):
                raise ValueError("User has already checked out today")
            
            if not attendance.get("check_in_time"):
                raise ValueError("Cannot check-out without checking in first")
            
            # Calculate working hours
            check_in_time = datetime.fromisoformat(attendance["check_in_time"])
            check_out_time = current_time
            working_duration = check_out_time - check_in_time
            working_hours = working_duration.total_seconds() / 3600
            
            # Determine final attendance status based on working hours and check times
            final_status = self._calculate_final_status(
                check_in_time, 
                check_out_time, 
                working_hours,
                attendance.get("is_late", False)
            )
            
            # Update attendance record with check-out data
            update_data = {
                "check_out_time": current_time.isoformat(),
                "check_out_photo": check_out_data.get("photo_path"),
                "check_out_geolocation": check_out_data.get("geolocation", {}),
                "check_out_comments": check_out_data.get("comments", ""),
                "working_hours": round(working_hours, 2),
                "status": final_status,
                "updated_at": current_time
            }
            
            await self.collection.update_one(
                {"_id": attendance["_id"]},
                {"$set": update_data}
            )
            
            return {
                "attendance_id": str(attendance["_id"]),
                "check_out_time": current_time.isoformat(),
                "working_hours": round(working_hours, 2),
                "status": self._get_status_text(final_status),
                "message": "Check-out successful"
            }
            
        except Exception as e:
            print(f"Error during check-out: {e}")
            raise

    def _calculate_final_status(self, check_in_time: datetime, check_out_time: datetime, working_hours: float, is_late: bool) -> float:
        """Calculate final attendance status based on working hours and timings"""
        # Standard working hours configuration (can be moved to settings)
        FULL_DAY_HOURS = 8.0
        HALF_DAY_HOURS = 4.0
        
        # If already marked as late (checked in after 10:30 AM), maximum is half day
        if is_late:
            return 0.5
        
        # Check if user left early (before 5:30 PM)
        early_departure_threshold = datetime.combine(check_out_time.date(), datetime.strptime("17:30", "%H:%M").time())
        is_early_departure = check_out_time < early_departure_threshold
        
        if is_early_departure and working_hours < FULL_DAY_HOURS:
            return 0.5
        
        # Calculate based on working hours
        if working_hours >= FULL_DAY_HOURS:
            return 1.0  # Full day
        elif working_hours >= HALF_DAY_HOURS:
            return 0.5  # Half day
        else:
            return -1   # Absent (insufficient hours)

    def _get_status_text(self, status: float) -> str:
        """Convert status number to text"""
        status_map = {
            1.0: "Full Day",
            0.5: "Half Day",
            0: "Leave",
            -1: "Absent"
        }
        return status_map.get(status, "Unknown")

    async def get_today_attendance(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get today's attendance record for a user"""
        try:
            # Use IST timezone for consistent date calculation
            ist_now = datetime.now(IST)
            today = ist_now.date().isoformat()
            attendance = await self.collection.find_one({
                "user_id": user_id,
                "date": today
            })
            
            if attendance:
                attendance["_id"] = str(attendance["_id"])
                
                # Add calculated fields for display
                if attendance.get("check_in_time") and attendance.get("check_out_time"):
                    try:
                        # Handle both time strings and datetime strings
                        check_in_str = attendance["check_in_time"]
                        check_out_str = attendance["check_out_time"]
                        
                        # If it's just a time string (HH:MM:SS), combine with today's date
                        if len(check_in_str) <= 8 and ':' in check_in_str:
                            check_in = datetime.combine(ist_now.date(), datetime.strptime(check_in_str, "%H:%M:%S").time())
                        else:
                            check_in = datetime.fromisoformat(check_in_str)
                            
                        if len(check_out_str) <= 8 and ':' in check_out_str:
                            check_out = datetime.combine(ist_now.date(), datetime.strptime(check_out_str, "%H:%M:%S").time())
                        else:
                            check_out = datetime.fromisoformat(check_out_str)
                            
                        duration = check_out - check_in
                        attendance["working_hours"] = round(duration.total_seconds() / 3600, 2)
                    except Exception as e:
                        print(f"Error calculating working hours: {e}")
                        attendance["working_hours"] = 0.0
                
                # Format times for display
                if attendance.get("check_in_time"):
                    try:
                        check_in_str = attendance["check_in_time"]
                        # If it's just a time string (HH:MM:SS), combine with today's date
                        if len(check_in_str) <= 8 and ':' in check_in_str:
                            check_in_dt = datetime.combine(ist_now.date(), datetime.strptime(check_in_str, "%H:%M:%S").time())
                        else:
                            check_in_dt = datetime.fromisoformat(check_in_str)
                        attendance["check_in_display"] = check_in_dt.strftime("%d %B %Y, %H:%M")
                    except Exception as e:
                        print(f"Error formatting check_in_time: {e}")
                        attendance["check_in_display"] = attendance["check_in_time"]
                
                if attendance.get("check_out_time"):
                    try:
                        check_out_str = attendance["check_out_time"]
                        # If it's just a time string (HH:MM:SS), combine with today's date
                        if len(check_out_str) <= 8 and ':' in check_out_str:
                            check_out_dt = datetime.combine(ist_now.date(), datetime.strptime(check_out_str, "%H:%M:%S").time())
                        else:
                            check_out_dt = datetime.fromisoformat(check_out_str)
                        attendance["check_out_display"] = check_out_dt.strftime("%d %B %Y, %H:%M")
                    except Exception as e:
                        print(f"Error formatting check_out_time: {e}")
                        attendance["check_out_display"] = attendance["check_out_time"]
            
            return attendance
        except Exception as e:
            print(f"Error getting today's attendance: {e}")
            return None

    async def update_attendance_record(self, attendance_id: str, update_data: Dict[str, Any], updated_by: str) -> bool:
        """Update an existing attendance record (for editing functionality)"""
        try:
            update_data["updated_at"] = datetime.now()
            update_data["updated_by"] = updated_by
            
            # Recalculate working hours if times are updated
            if "check_in_time" in update_data or "check_out_time" in update_data:
                # Get current record
                current = await self.collection.find_one({"_id": ObjectId(attendance_id)})
                if current:
                    check_in_str = update_data.get("check_in_time", current.get("check_in_time"))
                    check_out_str = update_data.get("check_out_time", current.get("check_out_time"))
                    
                    if check_in_str and check_out_str:
                        check_in_time = datetime.fromisoformat(check_in_str)
                        check_out_time = datetime.fromisoformat(check_out_str)
                        working_duration = check_out_time - check_in_time
                        working_hours = working_duration.total_seconds() / 3600
                        
                        # Recalculate status
                        is_late = check_in_time.time() > datetime.strptime("10:30", "%H:%M").time()
                        final_status = self._calculate_final_status(check_in_time, check_out_time, working_hours, is_late)
                        
                        update_data["working_hours"] = round(working_hours, 2)
                        update_data["status"] = final_status
                        update_data["is_late"] = is_late
            
            result = await self.collection.update_one(
                {"_id": ObjectId(attendance_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating attendance record: {e}")
            return False

    async def get_attendance_settings(self) -> Dict[str, Any]:
        """Get attendance settings from settings collection"""
        try:
            # Try to get from settings collection
            settings_collection = self.db['settings']
            settings = await settings_collection.find_one({"type": "attendance_settings"})
            
            if settings:
                return settings.get("data", {})
            
            # Return default settings if not found
            return {
                "check_in_time": "09:30",
                "check_out_time": "18:30", 
                "total_working_hours": 9.0,
                "late_arrival_threshold": "10:30",
                "early_departure_threshold": "17:30",
                "minimum_working_hours_full_day": 8.0,
                "minimum_working_hours_half_day": 4.0
            }
        except Exception as e:
            print(f"Error getting attendance settings: {e}")
            return {
                "check_in_time": "09:30",
                "check_out_time": "18:30", 
                "total_working_hours": 9.0,
                "late_arrival_threshold": "10:30",
                "early_departure_threshold": "17:30",
                "minimum_working_hours_full_day": 8.0,
                "minimum_working_hours_half_day": 4.0
            }
    
    async def update_attendance_settings(self, settings_data: Dict[str, Any]) -> bool:
        """Update attendance settings"""
        try:
            settings_collection = self.db['settings']
            
            update_doc = {
                "type": "attendance_settings",
                "data": settings_data,
                "updated_at": datetime.now()
            }
            
            result = await settings_collection.update_one(
                {"type": "attendance_settings"},
                {"$set": update_doc},
                upsert=True
            )
            return True
        except Exception as e:
            print(f"Error updating attendance settings: {e}")
            return False

    async def check_in_employee(self, user_id: str, check_in_data: Dict[str, Any]) -> str:
        """Check-in employee with photo and geolocation"""
        try:
            # Use IST timezone for consistent date calculation
            ist_now = datetime.now(IST)
            today = ist_now.date().isoformat()
            
            # Check if attendance record exists for today
            existing = await self.collection.find_one({
                "user_id": user_id,
                "date": today
            })
            
            if existing:
                # Update existing record with check-in data
                update_data = {
                    "check_in_time": check_in_data["check_in_time"],
                    "check_in_photo_path": check_in_data["check_in_photo_path"],
                    "check_in_geolocation": check_in_data["check_in_location"],
                    "comments": check_in_data.get("comments", ""),
                    "updated_at": datetime.now(IST)
                }
                
                await self.collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": update_data}
                )
                return str(existing["_id"])
            else:
                # Create new attendance record
                user_info = await self.users_collection.find_one({"_id": ObjectId(user_id)})
                if not user_info:
                    raise ValueError("User not found")
                
                department_info = None
                if user_info.get("department_id"):
                    department_info = await self.departments_collection.find_one({"_id": ObjectId(user_info["department_id"])})
                
                attendance_doc = {
                    "user_id": user_id,
                    "employee_id": user_info.get("employee_id", ""),
                    "employee_name": f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip(),
                    "department_id": user_info.get("department_id"),
                    "department_name": department_info.get("name", "") if department_info else "",
                    "date": today,
                    "check_in_time": check_in_data["check_in_time"],
                    "check_in_photo_path": check_in_data["check_in_photo_path"],
                    "check_in_geolocation": check_in_data["check_in_location"],
                    "check_out_time": None,
                    "check_out_photo_path": None,
                    "check_out_geolocation": None,
                    "total_working_hours": 0.0,
                    "status": 1.0,  # Will be updated on check-out
                    "comments": check_in_data.get("comments", ""),
                    "admin_comments": "",
                    "is_holiday": False,
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                }
                
                result = await self.collection.insert_one(attendance_doc)
                return str(result.inserted_id)
                
        except Exception as e:
            print(f"Error checking in employee: {e}")
            raise

    async def check_out_employee(self, user_id: str, check_out_data: Dict[str, Any]) -> str:
        """Check-out employee with photo and geolocation"""
        try:
            from app.schemas.attendance_schemas import calculate_working_hours, determine_attendance_status
            from app.database.Settings import SettingsDB
            
            today = date.today().isoformat()
            
            # Find existing attendance record for today
            existing = await self.collection.find_one({
                "user_id": user_id,
                "date": today
            })
            
            if not existing:
                raise ValueError("No check-in record found for today")
            
            if existing.get("check_out_time"):
                raise ValueError("Already checked out today")
            
            # Get attendance settings
            settings_db = SettingsDB()
            settings = await settings_db.get_attendance_settings()
            
            # Calculate working hours
            check_in_time = existing["check_in_time"]
            check_out_time = check_out_data["check_out_time"]
            total_working_hours = calculate_working_hours(check_in_time, check_out_time)
            
            # Determine final attendance status
            final_status = determine_attendance_status(check_in_time, check_out_time, settings)
            
            # Update attendance record with check-out data
            update_data = {
                "check_out_time": check_out_time,
                "check_out_photo_path": check_out_data["check_out_photo_path"],
                "check_out_geolocation": check_out_data["check_out_location"],
                "total_working_hours": total_working_hours,
                "status": final_status,
                "comments": check_out_data.get("comments", existing.get("comments", "")),
                "updated_at": datetime.now()
            }
            
            await self.collection.update_one(
                {"_id": existing["_id"]},
                {"$set": update_data}
            )
            
            return str(existing["_id"])
            
        except Exception as e:
            print(f"Error checking out employee: {e}")
            raise

    async def get_attendance_detail(self, user_id: str, date_str: str) -> Optional[Dict[str, Any]]:
        """Get detailed attendance record for a user on a specific date"""
        try:
            attendance = await self.collection.find_one({
                "user_id": user_id,
                "date": date_str
            })
            
            if attendance:
                attendance["_id"] = str(attendance["_id"])
                
                # Add formatted data for display
                from app.schemas.attendance_schemas import format_datetime_ist, get_status_text, format_working_hours
                from datetime import datetime
                
                # Format date
                try:
                    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                    months = [
                        "January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"
                    ]
                    attendance["date_formatted"] = f"{date_obj.day:02d} {months[date_obj.month - 1]} {date_obj.year}"
                except:
                    attendance["date_formatted"] = date_str
                
                # Format times
                if attendance.get("check_in_time"):
                    check_in_dt = datetime.strptime(f"{date_str} {attendance['check_in_time']}", "%Y-%m-%d %H:%M:%S")
                    attendance["check_in_time_formatted"] = format_datetime_ist(check_in_dt)
                
                if attendance.get("check_out_time"):
                    check_out_dt = datetime.strptime(f"{date_str} {attendance['check_out_time']}", "%Y-%m-%d %H:%M:%S")
                    attendance["check_out_time_formatted"] = format_datetime_ist(check_out_dt)
                
                # Format status
                attendance["status_text"] = get_status_text(attendance.get("status", 1.0))
                
                # Format working hours
                total_hours = attendance.get("total_working_hours", 0.0)
                attendance["total_working_hours_formatted"] = format_working_hours(total_hours)
                
                # Check if late/early
                if attendance.get("check_in_time"):
                    from app.database.Settings import SettingsDB
                    settings_db = SettingsDB()
                    settings = await settings_db.get_attendance_settings()
                    
                    check_in_time_obj = datetime.strptime(attendance["check_in_time"], "%H:%M:%S").time()
                    late_threshold = datetime.strptime(settings.get("late_arrival_threshold", "10:30"), "%H:%M").time()
                    attendance["is_late"] = check_in_time_obj > late_threshold
                    
                    if attendance.get("check_out_time"):
                        check_out_time_obj = datetime.strptime(attendance["check_out_time"], "%H:%M:%S").time()
                        early_threshold = datetime.strptime(settings.get("early_departure_threshold", "17:30"), "%H:%M").time()
                        attendance["is_early_departure"] = check_out_time_obj < early_threshold
                    else:
                        attendance["is_early_departure"] = False
                else:
                    attendance["is_late"] = False
                    attendance["is_early_departure"] = False
                
                # Add user name
                user_info = await self.users_collection.find_one({"_id": ObjectId(user_id)})
                if user_info:
                    attendance["user_name"] = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
                else:
                    attendance["user_name"] = "Unknown User"
                
                attendance["can_edit"] = True  # Default to editable
                
            return attendance
            
        except Exception as e:
            print(f"Error getting attendance detail: {e}")
            return None

    async def edit_attendance(self, attendance_id: str, edit_data: Dict[str, Any], edited_by: str) -> bool:
        """Edit attendance record with admin validation"""
        try:
            from app.schemas.attendance_schemas import calculate_working_hours, determine_attendance_status
            from app.database.Settings import SettingsDB
            
            # Get existing record
            existing = await self.collection.find_one({"_id": ObjectId(attendance_id)})
            if not existing:
                raise ValueError("Attendance record not found")
            
            # Prepare update data
            update_data = {
                "updated_at": datetime.now(),
                "edited_by": edited_by,
                "edited_at": datetime.now()
            }
            
            # Update fields if provided
            for field in ["check_in_time", "check_out_time", "comments", "admin_comments"]:
                if field in edit_data and edit_data[field] is not None:
                    update_data[field] = edit_data[field]
            
            # Recalculate working hours and status if times are updated
            check_in_time = edit_data.get("check_in_time") or existing.get("check_in_time")
            check_out_time = edit_data.get("check_out_time") or existing.get("check_out_time")
            
            if check_in_time and check_out_time:
                # Get settings
                settings_db = SettingsDB()
                settings = await settings_db.get_attendance_settings()
                
                # Calculate new working hours and status
                total_working_hours = calculate_working_hours(check_in_time, check_out_time)
                final_status = determine_attendance_status(check_in_time, check_out_time, settings)
                
                update_data["total_working_hours"] = total_working_hours
                update_data["status"] = edit_data.get("status", final_status)
            elif "status" in edit_data:
                update_data["status"] = edit_data["status"]
            
            # Update record
            result = await self.collection.update_one(
                {"_id": ObjectId(attendance_id)},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error editing attendance: {e}")
            raise
    # Face Recognition Methods
    async def register_employee_face(self, face_data: Dict[str, Any]) -> str:
        """Register employee's face descriptors"""
        try:
            face_collection = self.db['employee_faces']
            
            # Check if face already registered
            existing = await face_collection.find_one({"employee_id": face_data["employee_id"]})
            
            if existing:
                # Update existing face data
                update_data = {
                    "face_descriptors": face_data["face_descriptors"],
                    "samples_count": len(face_data["face_descriptors"]),
                    "reference_photo_path": face_data.get("reference_photo_path"),
                    "last_updated": datetime.now(),
                    "updated_by": face_data.get("registered_by")
                }
                
                await face_collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": update_data}
                )
                return str(existing["_id"])
            else:
                # Create new face registration
                face_doc = {
                    "employee_id": face_data["employee_id"],
                    "employee_name": face_data.get("employee_name", ""),
                    "face_descriptors": face_data["face_descriptors"],
                    "samples_count": len(face_data["face_descriptors"]),
                    "reference_photo_path": face_data.get("reference_photo_path"),
                    "registered_at": datetime.now(),
                    "registered_by": face_data.get("registered_by"),
                    "last_updated": datetime.now(),
                    "is_active": True
                }
                
                result = await face_collection.insert_one(face_doc)
                return str(result.inserted_id)
                
        except Exception as e:
            print(f"Error registering employee face: {e}")
            raise

    async def get_employee_face_data(self, employee_id: str) -> Optional[Dict[str, Any]]:
        """Get employee's registered face descriptors"""
        try:
            face_collection = self.db['employee_faces']
            face_data = await face_collection.find_one({"employee_id": employee_id, "is_active": True})
            
            if face_data:
                face_data["_id"] = str(face_data["_id"])
                
            return face_data
            
        except Exception as e:
            print(f"Error getting employee face data: {e}")
            return None

    async def delete_employee_face(self, employee_id: str) -> bool:
        """Delete/deactivate employee's face registration"""
        try:
            face_collection = self.db['employee_faces']
            result = await face_collection.update_one(
                {"employee_id": employee_id},
                {"$set": {"is_active": False, "deleted_at": datetime.now()}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error deleting employee face: {e}")
            return False

    async def get_all_registered_faces(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Get all employees with registered faces"""
        try:
            face_collection = self.db['employee_faces']
            query = {"is_active": True}
            
            if filters:
                query.update(filters)
            
            cursor = face_collection.find(query).sort("registered_at", -1)
            faces = await self._async_to_list(cursor)
            
            for face in faces:
                face["_id"] = str(face["_id"])
            
            return faces
            
        except Exception as e:
            print(f"Error getting registered faces: {e}")
            return []

    async def log_face_verification_attempt(self, log_data: Dict[str, Any]) -> str:
        """Log face verification attempts for audit trail"""
        try:
            log_collection = self.db['face_verification_logs']
            
            log_doc = {
                "employee_id": log_data["employee_id"],
                "verification_result": log_data["verification_result"],  # success/failure
                "confidence_score": log_data.get("confidence_score", 0.0),
                "threshold_used": log_data.get("threshold_used", 0.6),
                "photo_path": log_data.get("photo_path"),
                "timestamp": datetime.now(),
                "ip_address": log_data.get("ip_address"),
                "device_info": log_data.get("device_info")
            }
            
            result = await log_collection.insert_one(log_doc)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error logging face verification: {e}")
            return ""