from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime, date
from enum import Enum

class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class LeaveType(str, Enum):
    PAID_LEAVE = "paid_leave"
    CASUAL_LEAVE = "casual_leave"
    SICK_LEAVE = "sick_leave"
    EMERGENCY_LEAVE = "emergency_leave"

class LeavesDB:
    """Database operations for Leaves collection"""
    
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["leaves"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for faster lookups
            await self.collection.create_index("employee_id")
            await self.collection.create_index("status")
            await self.collection.create_index("leave_type")
            await self.collection.create_index("from_date")
            await self.collection.create_index("created_at")
            print("✓ Leaves database indexes created successfully")
        except Exception as e:
            print(f"Leaves index creation warning (may already exist): {e}")
        
    async def create_leave(self, leave_data: dict) -> str:
        """Create a new leave application with timestamps"""
        leave_data["created_at"] = datetime.now()
        leave_data["updated_at"] = leave_data["created_at"]
        
        # Ensure default values
        if "status" not in leave_data:
            leave_data["status"] = LeaveStatus.PENDING
        if "attachments" not in leave_data:
            leave_data["attachments"] = []
            
        # Calculate leave duration in days
        if "from_date" in leave_data and "to_date" in leave_data:
            from_date = leave_data["from_date"]
            to_date = leave_data["to_date"]
            
            # Convert string dates to datetime objects if needed
            if isinstance(from_date, str):
                from_date = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            if isinstance(to_date, str):
                to_date = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
                
            # Calculate duration in days (inclusive)
            duration = (to_date.date() - from_date.date()).days + 1
            leave_data["duration_days"] = duration
            
        result = await self.collection.insert_one(leave_data)
        return str(result.inserted_id)
        
    async def get_leave(self, leave_id: str) -> Optional[dict]:
        """Get a leave by ID"""
        if not ObjectId.is_valid(leave_id):
            return None
        
        leave = await self.collection.find_one({"_id": ObjectId(leave_id)})
        if leave:
            leave["_id"] = str(leave["_id"])
        return leave
        
    async def list_leaves(self, filter_dict: dict = None, sort_by: str = "created_at", 
                   sort_order: int = -1, limit: int = None, skip: int = 0) -> List[dict]:
        """List leaves with optional filtering, sorting, and pagination"""
        filter_dict = filter_dict or {}
        
        cursor = self.collection.find(filter_dict).sort(sort_by, sort_order)
        
        if skip > 0:
            cursor = cursor.skip(skip)
        if limit:
            cursor = cursor.limit(limit)
            
        leaves = []
        async for leave in cursor:
            leave["_id"] = str(leave["_id"])
            leaves.append(leave)
        return leaves
        
    async def get_leaves_for_employee(self, employee_id: str) -> List[dict]:
        """Get all leaves for a specific employee"""
        return await self.list_leaves({"employee_id": employee_id})
        
    async def get_leaves_by_status(self, status: str) -> List[dict]:
        """Get leaves by status (pending, approved, rejected)"""
        return await self.list_leaves({"status": status})
        
    async def update_leave_status(self, leave_id: str, status: str, approved_by: str = None, 
                           rejection_reason: str = None, comments: str = None) -> bool:
        """Update leave status with approval/rejection details and comments"""
        if not ObjectId.is_valid(leave_id):
            return False
            
        update_data = {
            "status": status,
            "updated_at": datetime.now()
        }
        
        # Add comments if provided
        if comments:
            update_data["approval_comments"] = comments
        
        if status == LeaveStatus.APPROVED and approved_by:
            update_data["approved_by"] = approved_by
            update_data["approved_at"] = datetime.now()
        elif status == LeaveStatus.REJECTED:
            if approved_by:
                update_data["rejected_by"] = approved_by
            if rejection_reason:
                update_data["rejection_reason"] = rejection_reason
            update_data["rejected_at"] = datetime.now()
            
        result = await self.collection.update_one(
            {"_id": ObjectId(leave_id)}, 
            {"$set": update_data}
        )
        return result.modified_count > 0
        
    async def update_leave(self, leave_id: str, update_fields: dict) -> bool:
        """Update leave fields"""
        if not ObjectId.is_valid(leave_id):
            return False
            
        update_fields["updated_at"] = datetime.now()
        
        # Recalculate duration if dates are being updated
        if "from_date" in update_fields or "to_date" in update_fields:
            leave = self.get_leave(leave_id)
            if leave:
                from_date = update_fields.get("from_date", leave.get("from_date"))
                to_date = update_fields.get("to_date", leave.get("to_date"))
                
                if from_date and to_date:
                    if isinstance(from_date, str):
                        from_date = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
                    if isinstance(to_date, str):
                        to_date = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
                        
                    duration = (to_date.date() - from_date.date()).days + 1
                    update_fields["duration_days"] = duration
        
        result = await self.collection.update_one(
            {"_id": ObjectId(leave_id)}, 
            {"$set": update_fields}
        )
        return result.modified_count > 0
        
    async def delete_leave(self, leave_id: str) -> bool:
        """Delete a leave application"""
        if not ObjectId.is_valid(leave_id):
            return False
            
        result = await self.collection.delete_one({"_id": ObjectId(leave_id)})
        return result.deleted_count > 0
        
    async def count_leaves(self, filter_dict: dict = None) -> int:
        """Count leaves matching the filter"""
        filter_dict = filter_dict or {}
        return await self.collection.count_documents(filter_dict)
        
    async def get_leave_statistics(self, employee_id: str = None) -> Dict[str, int]:
        """Get leave statistics by status"""
        base_filter = {}
        if employee_id:
            base_filter["employee_id"] = employee_id
            
        result = {
            "pending": 0,
            "approved": 0,
            "rejected": 0,
            "total": 0
        }
        
        for status in [LeaveStatus.PENDING, LeaveStatus.APPROVED, LeaveStatus.REJECTED]:
            filter_dict = {**base_filter, "status": status}
            count = await self.count_leaves(filter_dict)
            result[status] = count
            result["total"] += count
            
        return result
        
    async def get_leaves_in_date_range(self, start_date: datetime, end_date: datetime) -> List[dict]:
        """Get leaves that overlap with the given date range"""
        filter_dict = {
            "$or": [
                # Leave starts within the range
                {"from_date": {"$gte": start_date, "$lte": end_date}},
                # Leave ends within the range
                {"to_date": {"$gte": start_date, "$lte": end_date}},
                # Leave spans the entire range
                {"from_date": {"$lte": start_date}, "to_date": {"$gte": end_date}}
            ]
        }
        return await self.list_leaves(filter_dict)

# Legacy support - leaves_db is now initialized in __init__.py
# Use get_database_instances() from app.database to get leaves_db instance
leaves_db = None  # Will be set by init_database() in __init__.py
