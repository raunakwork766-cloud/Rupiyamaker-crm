from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime

class TaskHistoryDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["task_history"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Add any required indexes here
            pass
        except Exception as e:
            print(f"TaskHistoryDB index creation warning: {e}")
        
        # Create indexes for faster lookups
        await self.collection.create_index([("task_id", 1)])
        await self.collection.create_index([("created_at", -1)])
        await self.collection.create_index([("action_type", 1)])
        await self.collection.create_index([("created_by", 1)])
        
    async def add_history_entry(self, task_id: str, action_type: str, action_description: str, 
                         created_by: str, created_by_name: str, details: Dict = None) -> Optional[str]:
        """
        Add a history entry for a task
        
        Args:
            task_id: ID of the task
            action_type: Type of action (created, updated, status_changed, comment_added, assigned, etc.)
            action_description: Human-readable description of the action
            created_by: User ID who performed the action
            created_by_name: Name of the user who performed the action
            details: Additional details about the action (optional)
            
        Returns:
            str: History entry ID if successful, None if failed
        """
        try:
            print(f"[TASK_HISTORY] Adding history entry for task {task_id}: {action_description}")
            
            history_data = {
                "task_id": ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id,
                "action_type": action_type,
                "action": action_description,
                "description": action_description,  # For compatibility
                "created_by": ObjectId(created_by) if ObjectId.is_valid(created_by) else created_by,
                "created_by_name": created_by_name,
                "created_at": datetime.now(),
                "details": details or {}
            }
            
            print(f"[TASK_HISTORY] Inserting data: {history_data}")
            result = await self.collection.insert_one(history_data)
            print(f"[TASK_HISTORY] History entry created with ID: {result.inserted_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"[TASK_HISTORY] Error creating history entry: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def get_history_by_task(self, task_id: str) -> List[Dict[str, Any]]:
        """
        Get all history entries for a specific task
        
        Args:
            task_id: ID of the task
            
        Returns:
            List of history dictionaries ordered by creation time (newest first)
        """
        try:
            query = {"task_id": ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id}
            history_entries = []
            async for entry in self.collection.find(query).sort("created_at", -1):
                # Convert ObjectIds to strings for JSON serialization
                entry["id"] = str(entry["_id"])
                entry["task_id"] = str(entry["task_id"])
                entry["created_by"] = str(entry["created_by"])
                history_entries.append(entry)
                # Remove the original _id field to avoid confusion
                del entry["_id"]
                
            print(f"DEBUG: Found {len(history_entries)} history entries for task {task_id}")
            return history_entries
            
        except Exception as e:
            print(f"Error retrieving history for task {task_id}: {e}")
            return []
    
    async def get_history_entry(self, history_id: str) -> Optional[Dict[str, Any]]:
        """Get a single history entry by ID"""
        try:
            if not ObjectId.is_valid(history_id):
                print(f"Invalid ObjectId format: {history_id}")
                return None
                
            entry = await self.collection.find_one({"_id": ObjectId(history_id)})
            if entry:
                entry["id"] = str(entry["_id"])
                entry["task_id"] = str(entry["task_id"])
                entry["created_by"] = str(entry["created_by"])
                # Remove the original _id field to avoid confusion
                del entry["_id"]
            return entry
            
        except Exception as e:
            print(f"Error in get_history_entry for ID {history_id}: {str(e)}")
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
            print(f"Error deleting history entry {history_id}: {e}")
            return False
    
    async def get_history_count_by_task(self, task_id: str) -> int:
        """Get count of history entries for a task"""
        try:
            query = {"task_id": ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id}
            return await self.collection.count_documents(query)
        except Exception as e:
            print(f"Error counting history entries for task {task_id}: {e}")
            return 0
    
    async def add_task_created(self, task_id: str, created_by: str, created_by_name: str, task_title: str):
        """Add history entry for task creation"""
        return await self.add_history_entry(
            task_id=task_id,
            action_type="created",
            action_description=f"Task Created - {task_title}",
            created_by=created_by,
            created_by_name=created_by_name,
            details={"task_title": task_title}
        )
    
    async def add_task_updated(self, task_id: str, updated_by: str, updated_by_name: str, changes: Dict):
        """Add history entry for task update"""
        change_list = []
        for field, change_info in changes.items():
            if isinstance(change_info, dict) and 'old' in change_info and 'new' in change_info:
                if field == 'assigned_to':
                    old_names = ', '.join(change_info['old']) if change_info['old'] else 'None'
                    new_names = ', '.join(change_info['new']) if change_info['new'] else 'None'
                    change_list.append(f"Assignment: {old_names} → {new_names}")
                elif field == 'status':
                    change_list.append(f"Status: {change_info['old']} → {change_info['new']}")
                elif field == 'priority':
                    change_list.append(f"Priority: {change_info['old']} → {change_info['new']}")
                elif field == 'subject':
                    change_list.append(f"Title changed")
                elif field == 'task_details':
                    change_list.append(f"Description updated")
                elif field == 'due_date':
                    change_list.append(f"Due Date: {change_info['old']} → {change_info['new']}")
                else:
                    change_list.append(f"{field.replace('_', ' ').title()} updated")
            else:
                change_list.append(f"{field.replace('_', ' ').title()} updated")
        
        change_desc = "; ".join(change_list) if change_list else "Fields updated"
        return await self.add_history_entry(
            task_id=task_id,
            action_type="updated",
            action_description=f"Task Updated - {change_desc}",
            created_by=updated_by,
            created_by_name=updated_by_name,
            details={"changes": changes, "change_summary": change_desc}
        )
    
    async def add_status_changed(self, task_id: str, updated_by: str, updated_by_name: str, 
                          old_status: str, new_status: str):
        """Add history entry for status change"""
        return await self.add_history_entry(
            task_id=task_id,
            action_type="status_changed",
            action_description=f"Status Changed - {old_status} → {new_status}",
            created_by=updated_by,
            created_by_name=updated_by_name,
            details={"old_status": old_status, "new_status": new_status}
        )
    
    async def add_comment_added(self, task_id: str, commented_by: str, commented_by_name: str, comment_text: str):
        """Add history entry for comment addition"""
        comment_preview = comment_text[:100] + "..." if len(comment_text) > 100 else comment_text
        return await self.add_history_entry(
            task_id=task_id,
            action_type="comment_added",
            action_description=f"Comment Added - {comment_preview}",
            created_by=commented_by,
            created_by_name=commented_by_name,
            details={"comment_preview": comment_preview, "comment_length": len(comment_text)}
        )
    
    async def add_assignment_changed(self, task_id: str, updated_by: str, updated_by_name: str, 
                              old_assignees: List[str], new_assignees: List[str]):
        """Add history entry for assignment change"""
        old_list = ', '.join(old_assignees) if old_assignees else 'None'
        new_list = ', '.join(new_assignees) if new_assignees else 'None'
        return await self.add_history_entry(
            task_id=task_id,
            action_type="assignment_changed",
            action_description=f"Assignment Changed - {old_list} → {new_list}",
            created_by=updated_by,
            created_by_name=updated_by_name,
            details={"old_assignees": old_assignees, "new_assignees": new_assignees}
        )
    
    async def add_attachment_added(self, task_id: str, uploaded_by: str, uploaded_by_name: str, filename: str):
        """Add history entry for attachment upload"""
        return await self.add_history_entry(
            task_id=task_id,
            action_type="attachment_added",
            action_description=f"Attachment Added - {filename}",
            created_by=uploaded_by,
            created_by_name=uploaded_by_name,
            details={"filename": filename}
        )
    
    async def get_task_history(self, task_id: str) -> List[Dict[str, Any]]:
        """
        Get all history entries for a specific task (alias for get_history_by_task)
        
        Args:
            task_id: ID of the task
            
        Returns:
            List of history dictionaries ordered by creation time (newest first)
        """
        return await self.get_history_by_task(task_id)
