from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any, Union, Tuple, Set
from bson import ObjectId
from datetime import datetime, timedelta
import os
from pathlib import Path
import shutil
import uuid
import pymongo
from app.utils.permission_helpers import is_super_admin_permission

class TasksDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
            
        # Core collections
        self.collection = self.db["tasks"]
        
        # Note: Index creation will be done in init_indexes()
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Single field indexes for faster lookups
            await self.collection.create_index([("created_at", -1)])
            await self.collection.create_index([("created_by", 1)])
            await self.collection.create_index([("assigned_to", 1)])
            await self.collection.create_index([("status", 1)])
            await self.collection.create_index([("task_type", 1)])
            await self.collection.create_index([("due_date", 1)])
            await self.collection.create_index([("lead_id", 1)])
            await self.collection.create_index([("loan_type", 1)])
            
            # Compound indexes for common query patterns (PERFORMANCE BOOST)
            await self.collection.create_index([("status", 1), ("created_at", -1)])
            await self.collection.create_index([("assigned_to", 1), ("status", 1)])
            await self.collection.create_index([("created_by", 1), ("created_at", -1)])
            await self.collection.create_index([("due_date", 1), ("status", 1)])
            await self.collection.create_index([("lead_id", 1), ("status", 1)])
            
            print("✓ Tasks database indexes created successfully")
        except Exception as e:
            print(f"Tasks index creation warning (may already exist): {e}")
    
    async def _async_to_list(self, cursor):
        """Convert async cursor to list"""
        return await cursor.to_list(None)
        
    async def create_task(self, task_data: Dict[str, Any]) -> str:
        """
        Create a new task
        
        Args:
            task_data: Dictionary containing task information
            
        Returns:
            str: Task ID if successful, None if failed
        """
        try:
            # Add timestamps
            now = datetime.now()
            
            # Process recurring configuration
            is_recurring = task_data.get("is_recurring", False)
            recurring_config = task_data.get("recurring_config", None)
            parent_recurring_task_id = task_data.get("parent_recurring_task_id", None)
            next_occurrence = None
            
            # Calculate next occurrence if this is a recurring task
            if is_recurring and recurring_config:
                next_occurrence = await self.calculate_next_occurrence(
                    recurring_config.get("pattern"),
                    recurring_config.get("interval", 1),
                    now
                )
            
            task_data.update({
                "created_at": now,
                "updated_at": now,
                "attachments": [],  # Initialize empty attachments array
                "recurring_config": recurring_config,  # Add recurring configuration
                "is_recurring": is_recurring,  # Flag for recurring tasks
                "parent_recurring_task_id": parent_recurring_task_id,  # Reference to the original recurring task
                "next_occurrence": next_occurrence  # When the next instance should be created
            })
            
            # Ensure assigned_to is always a list
            if "assigned_to" in task_data:
                if isinstance(task_data["assigned_to"], str):
                    task_data["assigned_to"] = [task_data["assigned_to"]]
            else:
                task_data["assigned_to"] = []
                
            # Convert ObjectId fields if they exist
            if "lead_id" in task_data and task_data["lead_id"]:
                if ObjectId.is_valid(task_data["lead_id"]):
                    task_data["lead_id"] = ObjectId(task_data["lead_id"])
                    
            if "created_by" in task_data and ObjectId.is_valid(task_data["created_by"]):
                task_data["created_by"] = ObjectId(task_data["created_by"])
            
            # Convert assigned_to user IDs to ObjectIds
            if "assigned_to" in task_data and task_data["assigned_to"]:
                assigned_to_objects = []
                for user_id in task_data["assigned_to"]:
                    if ObjectId.is_valid(user_id):
                        assigned_to_objects.append(ObjectId(user_id))
                    else:
                        assigned_to_objects.append(user_id)
                task_data["assigned_to"] = assigned_to_objects
            
            result = await self.collection.insert_one(task_data)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating task: {e}")
            return None
    
    async def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get a single task by ID"""
        try:
            if not ObjectId.is_valid(task_id):
                return None
                
            task = await self.collection.find_one({"_id": ObjectId(task_id)})
            return task
        except Exception as e:
            print(f"Error in get_task for ID {task_id}: {str(e)}")
            return None
    
    async def list_tasks(self, filter_dict: Dict[str, Any] = None, skip: int = 0, limit: int = 50, sort_by: str = "created_at", sort_order: int = -1) -> List[Dict[str, Any]]:
        """
        List tasks with optional filtering, pagination and sorting
        
        Args:
            filter_dict: MongoDB filter dictionary
            skip: Number of documents to skip
            limit: Maximum number of documents to return
            sort_by: Field to sort by
            sort_order: Sort order (1 for ascending, -1 for descending)
            
        Returns:
            List of task documents
        """
        if filter_dict is None:
            filter_dict = {}
            
        try:
            cursor = self.collection.find(filter_dict).sort(sort_by, sort_order).skip(skip).limit(limit)
            tasks = await cursor.to_list(None)
            return tasks
            
        except Exception as e:
            print(f"Error listing tasks: {e}")
            return []
    
    async def calculate_next_occurrence(self, pattern: str, interval: int = 1, now=None) -> datetime:
        """
        Calculate the next occurrence date based on recurring pattern
        
        Args:
            pattern: Recurring pattern (daily, weekly, monthly, yearly)
            interval: Number of intervals to add (e.g., every 2 days)
            now: Current date (defaults to datetime.now())
            
        Returns:
            datetime: Next occurrence date
        """
        if not now:
            now = datetime.now()
            
        if pattern == "daily":
            return now + timedelta(days=interval)
        elif pattern == "weekly":
            return now + timedelta(weeks=interval)
        elif pattern == "monthly":
            # Add months by calculating the number of days
            # This is a simplified approach - more sophisticated handling might be needed
            # for month boundaries, leap years, etc.
            new_month = now.month + interval
            new_year = now.year + (new_month - 1) // 12
            new_month = ((new_month - 1) % 12) + 1
            
            # Handle day-of-month issues (e.g., Jan 31 -> Feb 28)
            day = min(now.day, [31, 29 if new_year % 4 == 0 and (new_year % 100 != 0 or new_year % 400 == 0) else 28, 
                            31, 30, 31, 30, 31, 31, 30, 31, 30, 31][new_month-1])
            
            return datetime(new_year, new_month, day, 
                           now.hour, now.minute, now.second, now.microsecond)
        elif pattern == "yearly":
            return datetime(now.year + interval, now.month, now.day, 
                           now.hour, now.minute, now.second, now.microsecond)
        else:
            # Default to daily if pattern is not recognized
            return now + timedelta(days=interval)
            
    async def configure_recurring_task(self, task_id: str, recurring_config: Dict[str, Any], user_id: str) -> bool:
        """
        Configure a task as recurring
        
        Args:
            task_id: Task ID to configure
            recurring_config: Recurring configuration
            user_id: User making the change
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not ObjectId.is_valid(task_id):
            return False
            
        try:
            task = await self.get_task(task_id)
            if not task:
                return False
                
            now = datetime.now()
            next_occurrence = await self.calculate_next_occurrence(
                recurring_config.get("pattern"),
                recurring_config.get("interval", 1),
                now
            )
            
            update_data = {
                "is_recurring": True,
                "recurring_config": recurring_config,
                "next_occurrence": next_occurrence,
                "updated_at": now,
                "updated_by": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
            }
            
            result = await self.collection.update_one(
                {"_id": ObjectId(task_id)},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error configuring recurring task: {e}")
            return False
            
    async def create_recurring_instance(self, task_id: str) -> str:
        """
        Create a new instance of a recurring task
        
        Args:
            task_id: Parent recurring task ID
            
        Returns:
            str: New task ID if successful, None otherwise
        """
        try:
            parent_task = await self.get_task(task_id)
            if not parent_task or not parent_task.get("is_recurring"):
                return None
                
            # Create a new task based on the parent
            new_task = {k: v for k, v in parent_task.items() if k not in ["_id", "created_at", "updated_at"]}
            
            # Set relationship to parent
            new_task["parent_recurring_task_id"] = str(parent_task["_id"])
            new_task["is_recurring"] = False  # Only the parent maintains the recurring flag
            new_task["next_occurrence"] = None
            
            # Calculate due date for the new instance based on the recurring pattern
            if parent_task.get("due_date"):
                try:
                    # Parse the parent's due date
                    parent_due_date = datetime.strptime(parent_task["due_date"], "%Y-%m-%d")
                    
                    # Calculate the new due date based on recurring config
                    recurring_config = parent_task.get("recurring_config", {})
                    pattern = recurring_config.get("pattern")
                    interval = recurring_config.get("interval", 1)
                    
                    if pattern == "daily":
                        new_due_date = parent_due_date + timedelta(days=interval)
                    elif pattern == "weekly":
                        new_due_date = parent_due_date + timedelta(weeks=interval)
                    elif pattern == "monthly":
                        # Simple month addition (not handling month boundaries perfectly)
                        new_month = parent_due_date.month + interval
                        new_year = parent_due_date.year + (new_month - 1) // 12
                        new_month = ((new_month - 1) % 12) + 1
                        
                        # Handle day-of-month issues
                        day = min(parent_due_date.day, [31, 29 if new_year % 4 == 0 and (new_year % 100 != 0 or new_year % 400 == 0) else 28, 
                                        31, 30, 31, 30, 31, 31, 30, 31, 30, 31][new_month-1])
                        
                        new_due_date = datetime(new_year, new_month, day)
                    elif pattern == "yearly":
                        new_due_date = datetime(parent_due_date.year + interval, parent_due_date.month, parent_due_date.day)
                    else:
                        # Default to daily if pattern not recognized
                        new_due_date = parent_due_date + timedelta(days=interval)
                        
                    # Format the new due date as string
                    new_task["due_date"] = new_due_date.strftime("%Y-%m-%d")
                    
                except Exception as e:
                    print(f"Error calculating new due date: {e}")
            
            # Create the new task instance
            new_task_id = await self.create_task(new_task)
            
            # Update the next occurrence date for the parent task
            now = datetime.now()
            next_occurrence = await self.calculate_next_occurrence(
                parent_task.get("recurring_config", {}).get("pattern"),
                parent_task.get("recurring_config", {}).get("interval", 1),
                now
            )
            
            await self.collection.update_one(
                {"_id": ObjectId(task_id)},
                {"$set": {
                    "next_occurrence": next_occurrence,
                    "updated_at": now
                }}
            )
            
            return new_task_id
            
        except Exception as e:
            print(f"Error creating recurring task instance: {e}")
            return None
            
    async def get_due_recurring_tasks(self) -> List[Dict[str, Any]]:
        """
        Get all recurring tasks that need a new instance created
        
        Returns:
            List of task documents
        """
        try:
            now = datetime.now()
            
            # Find recurring tasks where next_occurrence is in the past
            filter_dict = {
                "is_recurring": True,
                "next_occurrence": {"$lte": now}
            }
            
            cursor = self.collection.find(filter_dict)
            tasks = await cursor.to_list(None)
            print(f"DEBUG: Found {len(tasks)} recurring tasks due for new instances")
            return tasks
            
        except Exception as e:
            print(f"Error getting due recurring tasks: {e}")
            return []
            
    async def get_recurring_instances(self, parent_task_id: str) -> List[Dict[str, Any]]:
        """
        Get all instances of a recurring task
        
        Args:
            parent_task_id: Parent recurring task ID
            
        Returns:
            List of task documents
        """
        try:
            if not ObjectId.is_valid(parent_task_id):
                return []
                
            filter_dict = {
                "parent_recurring_task_id": parent_task_id
            }
            
            cursor = self.collection.find(filter_dict).sort("created_at", 1)
            tasks = await cursor.to_list(None)
            return tasks
            
        except Exception as e:
            print(f"Error getting recurring instances: {e}")
            return []
            
    async def update_task(self, task_id: str, update_data: Dict[str, Any], user_id: str) -> bool:
        """
        Update a task
        
        Args:
            task_id: Task ID to update
            update_data: Data to update
            user_id: User making the update
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not ObjectId.is_valid(task_id):
            return False
            
        try:
            # Add update timestamp and user
            update_data.update({
                "updated_at": datetime.now(),
                "updated_by": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
            })
            
            # Handle recurring configuration updates
            if "is_recurring" in update_data or "recurring_config" in update_data:
                is_recurring = update_data.get("is_recurring")
                recurring_config = update_data.get("recurring_config")
                
                if is_recurring and recurring_config:
                    next_occurrence = await self.calculate_next_occurrence(
                        recurring_config.get("pattern"),
                        recurring_config.get("interval", 1),
                        datetime.now()
                    )
                    update_data["next_occurrence"] = next_occurrence
                    
            # Handle assigned_to field conversion
            if "assigned_to" in update_data:
                if isinstance(update_data["assigned_to"], str):
                    update_data["assigned_to"] = [update_data["assigned_to"]]
                    
                # Convert to ObjectIds
                assigned_to_objects = []
                for user_id_item in update_data["assigned_to"]:
                    if ObjectId.is_valid(user_id_item):
                        assigned_to_objects.append(ObjectId(user_id_item))
                    else:
                        assigned_to_objects.append(user_id_item)
                update_data["assigned_to"] = assigned_to_objects
            
            result = await self.collection.update_one(
                {"_id": ObjectId(task_id)},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error updating task: {e}")
            return False
    
    async def delete_task(self, task_id: str, user_id: str) -> bool:
        """
        Delete a task (soft delete by marking as deleted)
        
        Args:
            task_id: Task ID to delete
            user_id: User requesting deletion
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not ObjectId.is_valid(task_id):
            return False
            
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(task_id)},
                {"$set": {
                    "is_deleted": True,
                    "deleted_at": datetime.now(),
                    "deleted_by": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
                }}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error deleting task: {e}")
            return False
    
    async def get_tasks_by_lead(self, lead_id: str) -> List[Dict[str, Any]]:
        """Get all tasks for a specific lead"""
        try:
            if ObjectId.is_valid(lead_id):
                lead_object_id = ObjectId(lead_id)
            else:
                lead_object_id = lead_id
                
            cursor = self.collection.find({
                "lead_id": lead_object_id,
                "is_deleted": {"$ne": True}
            }).sort("created_at", -1)
            
            tasks = await cursor.to_list(None)
            return tasks
            
        except Exception as e:
            print(f"Error getting tasks by lead: {e}")
            return []
    
    async def get_tasks_by_user(self, user_id: str, include_created: bool = True, include_assigned: bool = True) -> List[Dict[str, Any]]:
        """Get all tasks for a specific user (created by or assigned to)"""
        try:
            if ObjectId.is_valid(user_id):
                user_object_id = ObjectId(user_id)
            else:
                user_object_id = user_id
                
            filter_conditions = []
            
            if include_created:
                filter_conditions.append({"created_by": user_object_id})
                
            if include_assigned:
                filter_conditions.append({"assigned_to": user_object_id})
                filter_conditions.append({"assigned_to": {"$in": [user_object_id]}})
            
            if not filter_conditions:
                return []
                
            cursor = self.collection.find({
                "$or": filter_conditions,
                "is_deleted": {"$ne": True}
            }).sort("created_at", -1)
            
            tasks = await cursor.to_list(None)
            
            return tasks
            
        except Exception as e:
            print(f"Error getting tasks by user: {e}")
            return []
    
    async def get_visible_tasks_filter(self,
                                user_id: str,
                                user_role: dict,
                                user_permissions: List[dict],
                                roles_db,
                                extra_filters: dict = None) -> dict:
        """
        Get filter criteria for visible tasks for a user based on permissions and hierarchy
        
        Args:
            user_id: User requesting tasks
            user_role: User's role record
            user_permissions: User's permissions list
            roles_db: Roles database instance for hierarchy lookup
            extra_filters: Optional additional filters to apply
            
        Returns:
            dict: MongoDB filter criteria for visible tasks
        """
        print(f"DEBUG: Generating task visibility filter for user {user_id}")
        print(f"DEBUG: Extra filters: {extra_filters}")
        
        # Initialize filter dict with extra filters if provided
        result_filter = {"is_deleted": {"$ne": True}}  # Always exclude deleted tasks
        if extra_filters:
            result_filter.update(extra_filters)
        
        # Check if user is a super admin - can see everything
        is_super_admin = any(
            (is_super_admin_permission(perm))
            for perm in user_permissions
        )
        
        # Check for task admin permissions - includes "all" permissions
        is_task_admin = any(
            (perm.get("page") == "tasks" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "all" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "all" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        # Check for junior permission - includes "all" permissions
        has_view_junior = any(
            (perm.get("page") in ["tasks", "*", "any"] and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "junior" or
              perm.get("actions") == "all" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "junior" in perm.get("actions") or "all" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        # Verify basic view permission first - includes "all" permissions
        has_view_permission = any(
            (perm.get("page") in ["tasks", "*", "any"] and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "show" or
              perm.get("actions") == "all" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "show" in perm.get("actions") or "all" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        print(f"DEBUG: Permission status - super_admin: {is_super_admin}, task_admin: {is_task_admin}, junior: {has_view_junior}, basic_view: {has_view_permission}")
        
        # If user doesn't have basic view permission, they can't see any tasks
        if not has_view_permission:
            print(f"DEBUG: User {user_id} has no view permission, returning empty filter")
            return {"_id": {"$exists": False}}  # This will return no results
        
        # Super admins can see all tasks
        if is_super_admin or is_task_admin:
            print(f"DEBUG: User {user_id} is admin, showing all tasks")
            return result_filter
        
        # Regular users with view or junior permission will get filtered results
        filter_conditions = []
        
        # Convert user_id to ObjectId for comparison
        user_object_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        
        # All users can see their own created tasks
        filter_conditions.append({"created_by": user_object_id})
        print(f"DEBUG: Adding created_by filter for user {user_id}")
        
        # All users can see tasks assigned to them (handle both string and array formats)
        filter_conditions.append({"assigned_to": user_object_id})  # Direct match
        filter_conditions.append({"assigned_to": {"$in": [user_object_id]}})  # Array match
        print(f"DEBUG: Adding assigned_to filters for user {user_id}")
            
        # Users with junior permission have extended visibility
        if has_view_junior:
            print(f"DEBUG: User {user_id} has junior permission, adding junior filters")
            
            # Get all subordinates using the same logic as leads
            subordinate_ids = await self._get_all_subordinate_ids(user_id, roles_db)
            print(f"DEBUG: Found subordinate IDs: {subordinate_ids}")
            
            if subordinate_ids:
                subordinate_object_ids = []
                for sub_id in subordinate_ids:
                    if ObjectId.is_valid(sub_id):
                        subordinate_object_ids.append(ObjectId(sub_id))
                    else:
                        subordinate_object_ids.append(sub_id)
                        
                print(f"DEBUG: Found {len(subordinate_object_ids)} subordinates")
                
                # Can see tasks created by subordinates
                filter_conditions.append({"created_by": {"$in": subordinate_object_ids}})
                
                # Can see tasks assigned to subordinates
                filter_conditions.append({"assigned_to": {"$in": subordinate_object_ids}})
            else:
                print(f"DEBUG: No subordinates found for user {user_id}")
        
        # Build the final filter
        if filter_conditions:
            or_condition = {"$or": filter_conditions}
            print(f"DEBUG: Final OR conditions count: {len(filter_conditions)}")
            
            final_filter = {"$and": [result_filter, or_condition]}
        else:
            # Fallback - should not happen given our checks above
            print(f"DEBUG: No filter conditions generated, using default")
            final_filter = {"$and": [
                result_filter,
                {"$or": [
                    {"created_by": user_object_id}, 
                    {"assigned_to": user_object_id}, 
                    {"assigned_to": {"$in": [user_object_id]}}
                ]}
            ]}
            
        print(f"DEBUG: Final task filter for user {user_id}: {final_filter}")
        return final_filter
    
    async def _get_all_subordinate_ids(self, manager_id: str, roles_db) -> Set[str]:
        """
        Get all users who report to this manager (any level deep)
        Reuses the same logic from LeadsDB
        """
        from app.database.Users import UsersDB
        users_db = UsersDB()
        
        print(f"DEBUG: Looking for subordinates of user {manager_id}")
        
        # Get manager's role first
        manager_user = await users_db.get_user(manager_id)
        if not manager_user or not manager_user.get("role_id"):
            print(f"DEBUG: Manager user {manager_id} not found or has no role")
            return set()
            
        manager_role_id = manager_user.get("role_id")
        print(f"DEBUG: Manager {manager_id} has role ID: {manager_role_id}")
        
        # Get all subordinate roles
        subordinate_roles = await roles_db.get_all_subordinate_roles(manager_role_id)
        subordinate_role_ids = [str(role["_id"]) for role in subordinate_roles]
        print(f"DEBUG: Found {len(subordinate_roles)} subordinate roles: {subordinate_role_ids}")
        
        # Get users with these roles
        subordinate_users = set()
        for role_id in subordinate_role_ids:
            users = await users_db.get_users_by_role(role_id)
            user_ids = [str(user["_id"]) for user in users]
            print(f"DEBUG: Role {role_id} has {len(users)} users: {user_ids}")
            subordinate_users.update(user_ids)
            
        print(f"DEBUG: Total subordinate users for {manager_id}: {subordinate_users}")
        return subordinate_users
    
    # ========= Task Attachments Management =========
    
    def create_task_media_path(self, task_id: str) -> str:
        """Create directory path for task attachments"""
        base_path = Path("media/tasks")
        task_path = base_path / task_id
        os.makedirs(task_path, exist_ok=True)
        return str(task_path)
    
    async def add_attachment(self, attachment_data: Dict[str, Any]) -> str:
        """Add an attachment to a task by embedding it in the task document"""
        try:
            print(f"[DEBUG] Adding attachment with data: {attachment_data}")
            
            task_id = attachment_data.get("task_id")
            if not task_id or not ObjectId.is_valid(task_id):
                print(f"[ERROR] Invalid task_id: {task_id}")
                return None
            
            # Generate a unique ID for the attachment
            attachment_id = str(ObjectId())
            
            # Add timestamps and ID
            now = datetime.now()
            embedded_attachment = {
                "_id": attachment_id,
                "file_name": attachment_data.get("file_name"),
                "file_path": attachment_data.get("file_path"),
                "file_type": attachment_data.get("file_type"),
                "file_size": attachment_data.get("file_size"),
                "mime_type": attachment_data.get("mime_type"),
                "uploaded_by": ObjectId(attachment_data["uploaded_by"]) if ObjectId.is_valid(attachment_data.get("uploaded_by", "")) else attachment_data.get("uploaded_by"),
                "created_at": now,
                "updated_at": now
            }
            
            print(f"[DEBUG] Embedded attachment data: {embedded_attachment}")
            
            # Add the attachment to the task's attachments array
            result = await self.collection.update_one(
                {"_id": ObjectId(task_id)},
                {
                    "$push": {"attachments": embedded_attachment},
                    "$set": {"updated_at": now}
                }
            )
            
            if result.modified_count > 0:
                print(f"[DEBUG] Successfully added attachment with ID: {attachment_id}")
                return attachment_id
            else:
                print(f"[ERROR] Failed to add attachment to task {task_id}")
                return None
                
        except Exception as e:
            print(f"[ERROR] Error adding task attachment: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def get_task_attachments(self, task_id: str) -> List[Dict[str, Any]]:
        """Get all attachments for a task from the embedded attachments array"""
        try:
            print(f"[DEBUG] Getting attachments for task: {task_id}")
            
            if not ObjectId.is_valid(task_id):
                print(f"[ERROR] Invalid task_id: {task_id}")
                return []
            
            # Get the task document
            task = await self.collection.find_one(
                {"_id": ObjectId(task_id)},
                {"attachments": 1}  # Only fetch the attachments field
            )
            
            if not task:
                print(f"[DEBUG] Task not found: {task_id}")
                return []
            
            attachments = task.get("attachments", [])
            print(f"[DEBUG] Found {len(attachments)} attachments for task {task_id}")
            
            # Sort by created_at descending (newest first)
            attachments.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
            
            for att in attachments:
                print(f"[DEBUG] Attachment: {att.get('file_name')} - {att.get('_id')}")
            
            return attachments
            
        except Exception as e:
            print(f"[ERROR] Error getting task attachments: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    async def delete_attachment(self, attachment_id: str, user_id: str) -> bool:
        """Delete a task attachment from the embedded attachments array"""
        try:
            print(f"[DEBUG] Deleting attachment: {attachment_id}")
            
            # Find the task containing this attachment
            task = await self.collection.find_one(
                {"attachments._id": attachment_id},
                {"attachments": 1}
            )
            
            if not task:
                print(f"[ERROR] Attachment not found: {attachment_id}")
                return False
            
            # Find the specific attachment to get file path for deletion
            attachment_to_delete = None
            for att in task.get("attachments", []):
                if att.get("_id") == attachment_id:
                    attachment_to_delete = att
                    break
            
            if not attachment_to_delete:
                print(f"[ERROR] Attachment not found in task: {attachment_id}")
                return False
            
            # Delete file if exists
            if "file_path" in attachment_to_delete:
                file_path = Path(attachment_to_delete["file_path"])
                if file_path.exists():
                    file_path.unlink()
                    print(f"[DEBUG] Deleted file: {file_path}")
            
            # Remove attachment from the task's attachments array
            result = await self.collection.update_one(
                {"attachments._id": attachment_id},
                {
                    "$pull": {"attachments": {"_id": attachment_id}},
                    "$set": {"updated_at": datetime.now()}
                }
            )
            
            success = result.modified_count > 0
            print(f"[DEBUG] Attachment deletion {'successful' if success else 'failed'}")
            return success
            
        except Exception as e:
            print(f"[ERROR] Error deleting task attachment: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def get_attachment(self, attachment_id: str) -> Dict[str, Any]:
        """Get a specific attachment by ID from embedded attachments"""
        try:
            print(f"[DEBUG] Getting attachment: {attachment_id}")
            
            # Find the task containing this attachment
            task = await self.collection.find_one(
                {"attachments._id": attachment_id},
                {"attachments": 1, "_id": 1}
            )
            
            if not task:
                print(f"[ERROR] Task with attachment not found: {attachment_id}")
                return None
            
            # Find the specific attachment
            for attachment in task.get("attachments", []):
                if attachment.get("_id") == attachment_id:
                    # Add task_id to the attachment for compatibility
                    attachment["task_id"] = task["_id"]
                    print(f"[DEBUG] Found attachment: {attachment.get('file_name')}")
                    return attachment
            
            print(f"[ERROR] Attachment not found in task: {attachment_id}")
            return None
            
        except Exception as e:
            print(f"[ERROR] Error getting attachment: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def repeat_task(self, task_id: str, user_id: str, task_history_db=None) -> Optional[str]:
        """
        Create a repeat/copy of an existing task
        
        Args:
            task_id: ID of the task to repeat
            user_id: User ID creating the repeated task
            task_history_db: Task history database instance for logging
            
        Returns:
            str: New task ID if successful, None if failed
        """
        try:
            # Get the original task
            original_task = await self.get_task(task_id)
            if not original_task:
                print(f"Original task not found: {task_id}")
                return None
            
            # Create new task data from original, excluding certain fields
            now = datetime.now()
            new_task_data = {
                "subject": f"[REPEAT] {original_task.get('subject', '')}",
                "task_details": original_task.get("task_details", ""),
                "task_type": original_task.get("task_type"),
                "priority": original_task.get("priority", "medium"),
                "status": "Pending",  # Reset to pending
                "assigned_to": [ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id],  # Assign to creator
                "created_by": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
                "due_date": original_task.get("due_date"),
                "lead_id": original_task.get("lead_id"),
                "loan_type": original_task.get("loan_type"),
                "created_at": now,
                "updated_at": now,
                "attachments": [],  # Don't copy attachments
                "original_task_id": ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
            }
            
            # Create the new task
            new_task_id = await self.create_task(new_task_data)
            
            if new_task_id and task_history_db:
                # Log the repeat action in both tasks' history
                try:
                    from app.database.Users import UsersDB
                    users_db = UsersDB()
                    user = await users_db.get_user(user_id)
                    user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else "Unknown User"
                    if not user_name:
                        user_name = user.get('username', 'Unknown User')
                    
                    # Log in original task history
                    await task_history_db.add_history_entry(
                        task_id=task_id,
                        action_type="task_repeated",
                        action_description=f"Task repeated as new task {new_task_id}",
                        created_by=user_id,
                        created_by_name=user_name,
                        details={"new_task_id": new_task_id}
                    )
                    
                    # Log in new task history
                    await task_history_db.add_history_entry(
                        task_id=new_task_id,
                        action_type="task_created_from_repeat",
                        action_description=f"Task created as repeat of task {task_id}",
                        created_by=user_id,
                        created_by_name=user_name,
                        details={"original_task_id": task_id}
                    )
                except Exception as e:
                    print(f"Failed to log repeat task history: {e}")
            
            return new_task_id
            
        except Exception as e:
            print(f"Error repeating task: {e}")
            return None
    
    async def create_recurring_task(self, task_data: Dict[str, Any], recurring_config: Dict[str, Any]) -> Optional[str]:
        """
        Create a recurring task with scheduling configuration
        
        Args:
            task_data: Basic task data
            recurring_config: Recurring configuration with pattern, interval, etc.
            
        Returns:
            str: Task ID if successful, None if failed
        """
        try:
            # Calculate next occurrence based on recurring config
            next_occurrence = self._calculate_next_occurrence(recurring_config)
            
            # Add recurring configuration to task data
            task_data.update({
                "is_recurring": True,
                "recurring_config": recurring_config,
                "next_occurrence": next_occurrence
            })
            
            # Create the task
            task_id = await self.create_task(task_data)
            
            if task_id:
                print(f"Created recurring task {task_id} with next occurrence: {next_occurrence}")
            
            return task_id
            
        except Exception as e:
            print(f"Error creating recurring task: {e}")
            return None
    
    def _calculate_next_occurrence(self, recurring_config: Dict[str, Any]) -> datetime:
        """Calculate the next occurrence based on recurring configuration"""
        now = datetime.now()
        pattern = recurring_config.get("pattern", "daily")  # daily, weekly, monthly, yearly
        interval = recurring_config.get("interval", 1)  # every N days/weeks/months
        
        if pattern == "daily":
            return now + timedelta(days=interval)
        elif pattern == "weekly":
            return now + timedelta(weeks=interval)
        elif pattern == "monthly":
            # Add months (approximation)
            return now + timedelta(days=30 * interval)
        elif pattern == "yearly":
            return now + timedelta(days=365 * interval)
        else:
            return now + timedelta(days=1)  # Default to daily
    
    async def get_pending_recurring_tasks(self) -> List[Dict[str, Any]]:
        """Get all recurring tasks that are due for creation"""
        try:
            now = datetime.now()
            
            # Find recurring tasks where next_occurrence is due
            cursor = self.collection.find({
                "is_recurring": True,
                "next_occurrence": {"$lte": now},
                "is_deleted": {"$ne": True}
            })
            
            return await cursor.to_list(length=None)
            
        except Exception as e:
            print(f"Error getting pending recurring tasks: {e}")
            return []
    
    async def create_recurring_instance(self, parent_task: Dict[str, Any], task_history_db=None) -> Optional[str]:
        """
        Create a new instance of a recurring task
        
        Args:
            parent_task: The original recurring task
            task_history_db: Task history database instance
            
        Returns:
            str: New task ID if successful, None if failed
        """
        try:
            parent_id = str(parent_task["_id"])
            recurring_config = parent_task.get("recurring_config", {})
            
            # Create new task instance data
            new_task_data = {
                "subject": parent_task.get("subject", ""),
                "task_details": parent_task.get("task_details", ""),
                "task_type": parent_task.get("task_type"),
                "priority": parent_task.get("priority", "medium"),
                "status": "Pending",  # Always start as pending
                "assigned_to": parent_task.get("assigned_to", []),
                "created_by": parent_task.get("created_by"),
                "due_date": parent_task.get("due_date"),
                "lead_id": parent_task.get("lead_id"),
                "loan_type": parent_task.get("loan_type"),
                "parent_recurring_task_id": ObjectId(parent_id),
                "is_recurring": False,  # Instance is not recurring itself
                "recurring_config": None
            }
            
            # Create the new instance
            new_task_id = await self.create_task(new_task_data)
            
            if new_task_id:
                # Update parent task's next occurrence
                next_occurrence = self._calculate_next_occurrence(recurring_config)
                await self.collection.update_one(
                    {"_id": ObjectId(parent_id)},
                    {
                        "$set": {
                            "next_occurrence": next_occurrence,
                            "updated_at": datetime.now()
                        }
                    }
                )
                
                # Log history if available
                if task_history_db:
                    try:
                        from app.database.Users import UsersDB
                        users_db = UsersDB()
                        
                        # Log in parent task history
                        await task_history_db.add_history_entry(
                            task_id=parent_id,
                            action_type="recurring_instance_created",
                            action_description=f"Recurring instance created: {new_task_id}",
                            created_by=str(parent_task.get("created_by", "")),
                            created_by_name="System",
                            details={"instance_task_id": new_task_id, "next_occurrence": next_occurrence.isoformat()}
                        )
                        
                        # Log in new instance history
                        await task_history_db.add_history_entry(
                            task_id=new_task_id,
                            action_type="created_from_recurring",
                            action_description=f"Created from recurring task: {parent_id}",
                            created_by=str(parent_task.get("created_by", "")),
                            created_by_name="System",
                            details={"parent_task_id": parent_id}
                        )
                    except Exception as e:
                        print(f"Failed to log recurring task history: {e}")
                
                print(f"Created recurring instance {new_task_id} from parent {parent_id}")
                print(f"Next occurrence scheduled for: {next_occurrence}")
            
            return new_task_id
            
        except Exception as e:
            print(f"Error creating recurring instance: {e}")
            return None
    
    async def update_next_occurrence(self, task_id: str) -> bool:
        """
        Update the next occurrence time for a recurring task
        
        Args:
            task_id: ID of the recurring task to update
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if isinstance(task_id, str) and ObjectId.is_valid(task_id):
                task_id = ObjectId(task_id)
            elif not isinstance(task_id, ObjectId):
                return False
            
            # Get the task to access its recurring config
            task = await self.collection.find_one({"_id": task_id})
            if not task or not task.get("is_recurring"):
                return False
            
            # Calculate next occurrence
            recurring_config = task.get("recurring_config", {})
            next_occurrence = self._calculate_next_occurrence(recurring_config)
            
            # Update the task
            result = await self.collection.update_one(
                {"_id": task_id},
                {
                    "$set": {
                        "next_occurrence": next_occurrence,
                        "updated_at": datetime.now()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error updating next occurrence: {e}")
            return False
    
    async def update_recurring_config(self, task_id: str, recurring_config: Dict[str, Any], user_id: str) -> bool:
        """
        Update the recurring configuration for a task
        
        Args:
            task_id: Task ID to update
            recurring_config: New recurring configuration
            user_id: User making the update
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not ObjectId.is_valid(task_id):
                return False
            
            # Calculate next occurrence with new config
            next_occurrence = self._calculate_next_occurrence(recurring_config)
            
            update_data = {
                "is_recurring": True,
                "recurring_config": recurring_config,
                "next_occurrence": next_occurrence,
                "updated_at": datetime.now(),
                "updated_by": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
            }
            
            result = await self.collection.update_one(
                {"_id": ObjectId(task_id)},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error updating recurring config: {e}")
            return False
    
    async def stop_recurring_task(self, task_id: str, user_id: str) -> bool:
        """
        Stop a recurring task from creating future instances
        
        Args:
            task_id: Task ID to stop
            user_id: User making the change
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not ObjectId.is_valid(task_id):
                return False
            
            result = await self.collection.update_one(
                {"_id": ObjectId(task_id)},
                {
                    "$set": {
                        "is_recurring": False,
                        "next_occurrence": None,
                        "updated_at": datetime.now(),
                        "updated_by": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error stopping recurring task: {e}")
            return False

# Add methods for task notifications
async def get_overdue_tasks_for_user(self, user_id: str) -> List[Dict[str, Any]]:
    """
    Get all overdue tasks for a specific user that are not completed or cancelled
    
    Args:
        user_id: User ID to get overdue tasks for
        
    Returns:
        List[Dict[str, Any]]: List of overdue tasks
    """
    try:
        now = datetime.now().isoformat()
        
        tasks = []
        async for doc in self.collection.find({
            "assigned_to": user_id,
            "due_date": {"$lt": now},
            "status": {"$nin": ["Completed", "Cancelled"]}
        }):
            tasks.append(doc)
        
        # Convert ObjectId to string for each task
        for task in tasks:
            if '_id' in task:
                task['_id'] = str(task['_id'])
                
        return tasks
        
    except Exception as e:
        print(f"Error getting overdue tasks: {str(e)}")
        return []
        
async def get_tasks_due_on_date(self, user_id: str, date_str: str) -> List[Dict[str, Any]]:
    """
    Get all tasks due on a specific date for a user
    
    Args:
        user_id: User ID to get tasks for
        date_str: Date string in format YYYY-MM-DD
        
    Returns:
        List[Dict[str, Any]]: List of tasks due on the specified date
    """
    try:
        # Build date range for the whole day
        start_date = f"{date_str}T00:00:00.000Z"
        end_date = f"{date_str}T23:59:59.999Z"
        
        tasks = []
        async for doc in self.collection.find({
            "assigned_to": user_id,
            "due_date": {"$gte": start_date, "$lte": end_date},
            "status": {"$nin": ["Completed", "Cancelled"]}
        }):
            tasks.append(doc)
        
        # Convert ObjectId to string for each task
        for task in tasks:
            if '_id' in task:
                task['_id'] = str(task['_id'])
                
        return tasks
        
    except Exception as e:
        print(f"Error getting tasks due on date: {str(e)}")
        return []

# Global instance
TasksDB.get_overdue_tasks_for_user = get_overdue_tasks_for_user
TasksDB.get_tasks_due_on_date = get_tasks_due_on_date
tasks_db = TasksDB()
