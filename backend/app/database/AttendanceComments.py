from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime

class AttendanceCommentsDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["attendance_comments"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Add any required indexes here
            pass
        except Exception as e:
            print(f"AttendanceCommentsDB index creation warning: {e}")
        
        # Create indexes for faster lookups
        await self.collection.create_index([("attendance_id", 1)])
        await self.collection.create_index([("user_id", 1)])
        await self.collection.create_index([("date", 1)])
        await self.collection.create_index([("created_at", -1)])
        await self.collection.create_index([("created_by", 1)])
        
    async def add_comment(self, attendance_id: str, user_id: str, date: str, content: str, 
                   created_by: str, created_by_name: str) -> Optional[str]:
        """
        Add a comment to attendance record
        
        Args:
            attendance_id: ID of the attendance record (optional if no record exists)
            user_id: ID of the employee
            date: Date of attendance (YYYY-MM-DD)
            content: Comment content
            created_by: User ID who created the comment
            created_by_name: Name of the user who created the comment
            
        Returns:
            str: Comment ID if successful, None if failed
        """
        try:
            comment_data = {
                "attendance_id": ObjectId(attendance_id) if attendance_id and ObjectId.is_valid(attendance_id) else attendance_id,
                "user_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
                "date": date,
                "content": content.strip(),
                "created_by": ObjectId(created_by) if ObjectId.is_valid(created_by) else created_by,
                "created_by_name": created_by_name,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            result = await self.collection.insert_one(comment_data)
            print(f"DEBUG: Attendance comment created with ID: {result.inserted_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating attendance comment: {e}")
            return None
    
    async def get_comments_by_attendance(self, user_id: str, date: str) -> List[Dict[str, Any]]:
        """
        Get all comments for a specific user's attendance on a date
        
        Args:
            user_id: ID of the employee
            date: Date of attendance (YYYY-MM-DD)
            
        Returns:
            List[Dict]: List of comments
        """
        try:
            query = {
                "user_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
                "date": date
            }
            
            comments = list(self.collection.find(query).sort("created_at", 1))
            
            # Convert ObjectIds to strings for JSON serialization
            for comment in comments:
                comment["_id"] = str(comment["_id"])
                if isinstance(comment.get("attendance_id"), ObjectId):
                    comment["attendance_id"] = str(comment["attendance_id"])
                if isinstance(comment.get("user_id"), ObjectId):
                    comment["user_id"] = str(comment["user_id"])
                if isinstance(comment.get("created_by"), ObjectId):
                    comment["created_by"] = str(comment["created_by"])
                    
            return comments
            
        except Exception as e:
            print(f"Error getting attendance comments: {e}")
            return []
    
    async def get_comments_by_attendance_id(self, attendance_id: str) -> List[Dict[str, Any]]:
        """
        Get all comments for a specific attendance record
        
        Args:
            attendance_id: ID of the attendance record
            
        Returns:
            List[Dict]: List of comments
        """
        try:
            if not attendance_id:
                return []
                
            query = {
                "attendance_id": ObjectId(attendance_id) if ObjectId.is_valid(attendance_id) else attendance_id
            }
            
            comments = list(self.collection.find(query).sort("created_at", 1))
            
            # Convert ObjectIds to strings for JSON serialization
            for comment in comments:
                comment["_id"] = str(comment["_id"])
                if isinstance(comment.get("attendance_id"), ObjectId):
                    comment["attendance_id"] = str(comment["attendance_id"])
                if isinstance(comment.get("user_id"), ObjectId):
                    comment["user_id"] = str(comment["user_id"])
                if isinstance(comment.get("created_by"), ObjectId):
                    comment["created_by"] = str(comment["created_by"])
                    
            return comments
            
        except Exception as e:
            print(f"Error getting attendance comments by ID: {e}")
            return []
    
    async def update_comment(self, comment_id: str, content: str, updated_by: str) -> bool:
        """
        Update an existing comment
        
        Args:
            comment_id: ID of the comment to update
            content: New comment content
            updated_by: User ID who updated the comment
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(comment_id) if ObjectId.is_valid(comment_id) else comment_id},
                {
                    "$set": {
                        "content": content.strip(),
                        "updated_at": datetime.now(),
                        "updated_by": ObjectId(updated_by) if ObjectId.is_valid(updated_by) else updated_by
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error updating attendance comment: {e}")
            return False
    
    async def delete_comment(self, comment_id: str, deleted_by: str) -> bool:
        """
        Delete a comment (soft delete by marking as deleted)
        
        Args:
            comment_id: ID of the comment to delete
            deleted_by: User ID who deleted the comment
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(comment_id) if ObjectId.is_valid(comment_id) else comment_id},
                {
                    "$set": {
                        "deleted": True,
                        "deleted_at": datetime.now(),
                        "deleted_by": ObjectId(deleted_by) if ObjectId.is_valid(deleted_by) else deleted_by
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error deleting attendance comment: {e}")
            return False

# Dependency function for FastAPI
async def get_attendance_comments_db():
    from app.database import get_database_instances
    db_instances = get_database_instances()
    return db_instances.get("attendance_comments") or AttendanceCommentsDB(db_instances["async_db"])
