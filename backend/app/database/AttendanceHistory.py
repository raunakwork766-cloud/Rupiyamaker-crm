from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime

class AttendanceHistoryDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["attendance_history"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Add any required indexes here
            pass
        except Exception as e:
            print(f"AttendanceHistoryDB index creation warning: {e}")
        
        # Create indexes for faster lookups
        await self.collection.create_index([("attendance_id", 1)])
        await self.collection.create_index([("user_id", 1)])
        await self.collection.create_index([("date", 1)])
        await self.collection.create_index([("created_at", -1)])
        await self.collection.create_index([("action_type", 1)])
        await self.collection.create_index([("created_by", 1)])
        
    async def add_history_entry(self, attendance_id: str, user_id: str, date: str, action_type: str, 
                         action_description: str, created_by: str, created_by_name: str, 
                         old_value: Any = None, new_value: Any = None, details: Dict = None) -> Optional[str]:
        """
        Add a history entry for attendance record
        
        Args:
            attendance_id: ID of the attendance record (optional if no record exists)
            user_id: ID of the employee
            date: Date of attendance (YYYY-MM-DD)
            action_type: Type of action (created, updated, status_changed, comment_added, etc.)
            action_description: Human-readable description of the action
            created_by: User ID who performed the action
            created_by_name: Name of the user who performed the action
            old_value: Previous value (for updates)
            new_value: New value (for updates)
            details: Additional details about the action (optional)
            
        Returns:
            str: History entry ID if successful, None if failed
        """
        try:
            print(f"[ATTENDANCE_HISTORY] Adding history entry for user {user_id} on {date}: {action_description}")
            
            history_data = {
                "attendance_id": ObjectId(attendance_id) if attendance_id and ObjectId.is_valid(attendance_id) else attendance_id,
                "user_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
                "date": date,
                "action_type": action_type,
                "action": action_description,
                "description": action_description,  # For compatibility
                "created_by": ObjectId(created_by) if ObjectId.is_valid(created_by) else created_by,
                "created_by_name": created_by_name,
                "created_at": datetime.now(),
                "old_value": old_value,
                "new_value": new_value,
                "details": details or {}
            }
            
            print(f"[ATTENDANCE_HISTORY] Inserting data: {history_data}")
            result = await self.collection.insert_one(history_data)
            print(f"[ATTENDANCE_HISTORY] History entry created with ID: {result.inserted_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating attendance history entry: {e}")
            return None
    
    async def get_history_by_attendance(self, user_id: str, date: str) -> List[Dict[str, Any]]:
        """
        Get all history entries for a specific user's attendance on a date
        
        Args:
            user_id: ID of the employee
            date: Date of attendance (YYYY-MM-DD)
            
        Returns:
            List[Dict]: List of history entries
        """
        try:
            query = {
                "user_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
                "date": date
            }
            
            cursor = self.collection.find(query).sort("created_at", -1)
            history = await cursor.to_list(None)
            
            # Convert ObjectIds to strings for JSON serialization
            for entry in history:
                entry["_id"] = str(entry["_id"])
                if isinstance(entry.get("attendance_id"), ObjectId):
                    entry["attendance_id"] = str(entry["attendance_id"])
                if isinstance(entry.get("user_id"), ObjectId):
                    entry["user_id"] = str(entry["user_id"])
                if isinstance(entry.get("created_by"), ObjectId):
                    entry["created_by"] = str(entry["created_by"])
                    
            return history
            
        except Exception as e:
            print(f"Error getting attendance history: {e}")
            return []
    
    async def get_history_by_attendance_id(self, attendance_id: str) -> List[Dict[str, Any]]:
        """
        Get all history entries for a specific attendance record
        
        Args:
            attendance_id: ID of the attendance record
            
        Returns:
            List[Dict]: List of history entries
        """
        try:
            if not attendance_id:
                return []
                
            query = {
                "attendance_id": ObjectId(attendance_id) if ObjectId.is_valid(attendance_id) else attendance_id
            }
            
            cursor = self.collection.find(query).sort("created_at", -1)
            history = await cursor.to_list(None)
            
            # Convert ObjectIds to strings for JSON serialization
            for entry in history:
                entry["_id"] = str(entry["_id"])
                if isinstance(entry.get("attendance_id"), ObjectId):
                    entry["attendance_id"] = str(entry["attendance_id"])
                if isinstance(entry.get("user_id"), ObjectId):
                    entry["user_id"] = str(entry["user_id"])
                if isinstance(entry.get("created_by"), ObjectId):
                    entry["created_by"] = str(entry["created_by"])
                    
            return history
            
        except Exception as e:
            print(f"Error getting attendance history by ID: {e}")
            return []
    
    async def get_history_by_user(self, user_id: str, start_date: str = None, end_date: str = None, 
                           limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get history entries for a specific user across multiple dates
        
        Args:
            user_id: ID of the employee
            start_date: Start date filter (YYYY-MM-DD, optional)
            end_date: End date filter (YYYY-MM-DD, optional)
            limit: Maximum number of entries to return
            
        Returns:
            List[Dict]: List of history entries
        """
        try:
            query = {
                "user_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
            }
            
            # Add date range filter if provided
            if start_date or end_date:
                date_filter = {}
                if start_date:
                    date_filter["$gte"] = start_date
                if end_date:
                    date_filter["$lte"] = end_date
                query["date"] = date_filter
            
            cursor = self.collection.find(query).sort("created_at", -1).limit(limit)
            history = await cursor.to_list(None)
            
            # Convert ObjectIds to strings for JSON serialization
            for entry in history:
                entry["_id"] = str(entry["_id"])
                if isinstance(entry.get("attendance_id"), ObjectId):
                    entry["attendance_id"] = str(entry["attendance_id"])
                if isinstance(entry.get("user_id"), ObjectId):
                    entry["user_id"] = str(entry["user_id"])
                if isinstance(entry.get("created_by"), ObjectId):
                    entry["created_by"] = str(entry["created_by"])
                    
            return history
            
        except Exception as e:
            print(f"Error getting user attendance history: {e}")
            return []

# Dependency function for FastAPI
async def get_attendance_history_db():
    from app.database import get_database_instances
    db_instances = get_database_instances()
    return db_instances.get("attendance_history") or AttendanceHistoryDB(db_instances["async_db"])
