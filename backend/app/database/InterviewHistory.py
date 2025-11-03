from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime

class InterviewHistoryDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["interview_history"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Add any required indexes here
            pass
        except Exception as e:
            pass
        
        # Create indexes for faster lookups
        await self.collection.create_index([("interview_id", 1)])
        await self.collection.create_index([("created_at", -1)])
        await self.collection.create_index([("action_type", 1)])
        await self.collection.create_index([("created_by", 1)])
        
    async def add_history_entry(self, interview_id: str, action_type: str, action_description: str, 
                         created_by: str, created_by_name: str, details: Dict = None) -> Optional[str]:
        """
        Add a history entry for an interview
        
        Args:
            interview_id: ID of the interview
            action_type: Type of action (created, updated, status_changed, comment_added, etc.)
            action_description: Human-readable description of the action
            created_by: User ID who performed the action
            created_by_name: Name of the user who performed the action
            details: Additional details about the action (optional)
            
        Returns:
            str: History entry ID if successful, None if failed
        """
        try:
            history_data = {
                "interview_id": ObjectId(interview_id) if ObjectId.is_valid(interview_id) else interview_id,
                "action_type": action_type,
                "action": action_description,
                "description": action_description,  # For compatibility
                "created_by": ObjectId(created_by) if ObjectId.is_valid(created_by) else created_by,
                "created_by_name": created_by_name,
                "created_at": datetime.now(),
                "details": details or {}
            }
            
            result = await self.collection.insert_one(history_data)
            return str(result.inserted_id)
            
        except Exception as e:
            return None
    
    async def get_history_by_interview(self, interview_id: str) -> List[Dict[str, Any]]:
        """
        Get all history entries for a specific interview
        
        Args:
            interview_id: ID of the interview
            
        Returns:
            List of history dictionaries ordered by creation time (newest first)
        """
        try:
            query = {"interview_id": ObjectId(interview_id) if ObjectId.is_valid(interview_id) else interview_id}
            history_entries = await self.collection.find(query).sort("created_at", -1).to_list(None)
            
            # Convert ObjectIds to strings for JSON serialization
            for entry in history_entries:
                entry["id"] = str(entry["_id"])
                entry["interview_id"] = str(entry["interview_id"])
                entry["created_by"] = str(entry["created_by"])
                # Remove the original _id field to avoid confusion
                del entry["_id"]
                
            return history_entries
            
        except Exception as e:
            return []
    
    async def get_history_entry(self, history_id: str) -> Optional[Dict[str, Any]]:
        """Get a single history entry by ID"""
        try:
            if not ObjectId.is_valid(history_id):
                return None
                
            entry = await self.collection.find_one({"_id": ObjectId(history_id)})
            if entry:
                entry["id"] = str(entry["_id"])
                entry["interview_id"] = str(entry["interview_id"])
                entry["created_by"] = str(entry["created_by"])
                # Remove the original _id field to avoid confusion
                del entry["_id"]
            return entry
            
        except Exception as e:
            return None
    
    async def delete_history_entry(self, history_id: str) -> bool:
        """
        Delete a history entry
        
        Args:
            history_id: ID of the history entry to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not ObjectId.is_valid(history_id):
                return False
                
            result = await self.collection.delete_one({"_id": ObjectId(history_id)})
            return result.deleted_count > 0
            
        except Exception as e:
            return False
    
    async def get_history_count_by_interview(self, interview_id: str) -> int:
        """Get count of history entries for an interview"""
        try:
            query = {"interview_id": ObjectId(interview_id) if ObjectId.is_valid(interview_id) else interview_id}
            return await self.collection.count_documents(query)
        except Exception as e:
            return 0
    
    async def add_interview_created(self, interview_id: str, created_by: str, created_by_name: str, candidate_name: str):
        """Add history entry for interview creation"""
        return await self.add_history_entry(
            interview_id=interview_id,
            action_type="created",
            action_description=f"INTERVIEW CREATED for candidate: {candidate_name}",
            created_by=created_by,
            created_by_name=created_by_name,
            details={"candidate_name": candidate_name}
        )
    
    async def add_interview_updated(self, interview_id: str, updated_by: str, updated_by_name: str, changes: Dict):
        """Add history entry for interview update"""
        change_desc = ", ".join([f"{k.upper()}" for k in changes.keys()])
        return await self.add_history_entry(
            interview_id=interview_id,
            action_type="updated",
            action_description=f"INTERVIEW UPDATED: {change_desc}",
            created_by=updated_by,
            created_by_name=updated_by_name,
            details={"changes": changes}
        )
    
    async def add_status_changed(self, interview_id: str, updated_by: str, updated_by_name: str, 
                          old_status: str, new_status: str):
        """Add history entry for status change"""
        return await self.add_history_entry(
            interview_id=interview_id,
            action_type="status_changed",
            action_description=f"STATUS CHANGED: {old_status} → {new_status}",
            created_by=updated_by,
            created_by_name=updated_by_name,
            details={"old_status": old_status, "new_status": new_status}
        )
    
    async def add_comment_added(self, interview_id: str, commented_by: str, commented_by_name: str, comment_text: str):
        """Add history entry for comment addition"""
        return await self.add_history_entry(
            interview_id=interview_id,
            action_type="comment_added",
            action_description=f"COMMENT ADDED by {commented_by_name}",
            created_by=commented_by,
            created_by_name=commented_by_name,
            details={"comment_preview": comment_text[:100] + "..." if len(comment_text) > 100 else comment_text}
        )
    
    async def add_field_changed(self, interview_id: str, updated_by: str, updated_by_name: str, 
                         field_name: str, old_value: str, new_value: str):
        """Add history entry for field change"""
        return await self.add_history_entry(
            interview_id=interview_id,
            action_type="field_changed",
            action_description=f"{field_name.upper()} CHANGED: {old_value} → {new_value}",
            created_by=updated_by,
            created_by_name=updated_by_name,
            details={"field_name": field_name, "old_value": old_value, "new_value": new_value}
        )
    
    async def add_interview_scheduled(self, interview_id: str, scheduled_by: str, scheduled_by_name: str, 
                               interview_date: str, interview_time: str):
        """Add history entry for interview scheduling"""
        return await self.add_history_entry(
            interview_id=interview_id,
            action_type="scheduled",
            action_description=f"INTERVIEW SCHEDULED for {interview_date} at {interview_time}",
            created_by=scheduled_by,
            created_by_name=scheduled_by_name,
            details={"interview_date": interview_date, "interview_time": interview_time}
        )
    
    async def add_interview_rescheduled(self, interview_id: str, rescheduled_by: str, rescheduled_by_name: str, 
                                 old_date: str, new_date: str, old_time: str, new_time: str):
        """Add history entry for interview rescheduling"""
        return await self.add_history_entry(
            interview_id=interview_id,
            action_type="rescheduled",
            action_description=f"INTERVIEW RESCHEDULED: {old_date} {old_time} → {new_date} {new_time}",
            created_by=rescheduled_by,
            created_by_name=rescheduled_by_name,
            details={"old_date": old_date, "new_date": new_date, "old_time": old_time, "new_time": new_time}
        )
    
    async def add_generic_entry(self, interview_id: str, action_type: str, action: str, description: str,
                               performed_by: str, performed_by_name: str, details: Dict = None):
        """Add a generic history entry"""
        return await self.add_history_entry(
            interview_id=interview_id,
            action_type=action_type,
            action_description=description,
            created_by=performed_by,
            created_by_name=performed_by_name,
            details=details or {}
        )
    
    async def get_interview_history(self, interview_id: str) -> List[Dict[str, Any]]:
        """
        Get all history entries for a specific interview (alias for get_history_by_interview)
        
        Args:
            interview_id: ID of the interview
            
        Returns:
            List of history dictionaries ordered by creation time (newest first)
        """
        return self.get_history_by_interview(interview_id)
