from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any, Union, Tuple
from bson import ObjectId
from datetime import datetime
import pymongo

class NotificationsDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["notifications"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for faster lookups and operations
            await self.collection.create_index([("created_at", -1)])
            await self.collection.create_index([("user_id", 1)])
            await self.collection.create_index([("read", 1)])
            await self.collection.create_index([("type", 1)])
            print("✓ Notifications database indexes created successfully")
        except Exception as e:
            print(f"Notifications index creation warning (may already exist): {e}")
        
    async def create_notification(self, notification_data: Dict[str, Any]) -> str:
        """
        Create a new notification
        
        Args:
            notification_data: Dictionary containing notification information
            
        Returns:
            str: Notification ID if successful, None if failed
        """
        try:
            # Add timestamps
            now = datetime.now()
            
            # Prepare notification data
            notification = {
                "user_id": notification_data.get("user_id"),
                "type": notification_data.get("type"),  # 'task', 'ticket', 'warning', etc.
                "title": notification_data.get("title"),
                "message": notification_data.get("message"),
                "link": notification_data.get("link"),
                "reference_id": notification_data.get("reference_id"),  # ID of the related item (task, ticket, etc.)
                "created_by": notification_data.get("created_by"),
                "created_by_name": notification_data.get("created_by_name"),
                "read": False,
                "created_at": now,
                "updated_at": now
            }
            
            # Check if user already has 5 or more notifications
            user_id = notification_data.get("user_id")
            count = await self.collection.count_documents({"user_id": user_id})
            
            # If user has 5 or more notifications, delete the oldest one
            if count >= 5:
                oldest = await self.collection.find_one(
                    {"user_id": user_id},
                    sort=[("created_at", 1)]
                )
                if oldest:
                    await self.collection.delete_one({"_id": oldest["_id"]})
            
            # Insert the new notification
            result = await self.collection.insert_one(notification)
            return str(result.inserted_id) if result.acknowledged else None
            
        except Exception as e:
            print(f"Error creating notification: {str(e)}")
            return None
    
    async def get_user_notifications(self, user_id: str, limit: int = 20, skip: int = 0, unread_only: bool = False) -> List[Dict[str, Any]]:
        """
        Get notifications for a specific user
        
        Args:
            user_id: User ID to get notifications for
            limit: Maximum number of notifications to return
            skip: Number of notifications to skip (for pagination)
            unread_only: If True, only return unread notifications
            
        Returns:
            List of notifications
        """
        try:
            query = {"user_id": user_id}
            if unread_only:
                query["read"] = False
                
            cursor = self.collection.find(
                query
            ).sort("created_at", -1).skip(skip).limit(limit)
            
            notifications = await cursor.to_list(None)
            
            # Convert ObjectId to string
            for notification in notifications:
                notification["_id"] = str(notification["_id"])
                
            return notifications
            
        except Exception as e:
            print(f"Error getting user notifications: {str(e)}")
            return []
    
    async def mark_notification_as_read(self, notification_id: str) -> bool:
        """
        Mark a notification as read
        
        Args:
            notification_id: ID of the notification to mark as read
            
        Returns:
            bool: True if successful, False if failed
        """
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(notification_id)},
                {"$set": {"read": True, "updated_at": datetime.now()}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error marking notification as read: {str(e)}")
            return False
    
    async def mark_all_notifications_as_read(self, user_id: str) -> int:
        """
        Mark all notifications for a user as read
        
        Args:
            user_id: User ID to mark all notifications as read for
            
        Returns:
            int: Number of notifications marked as read
        """
        try:
            result = await self.collection.update_many(
                {"user_id": user_id, "read": False},
                {"$set": {"read": True, "updated_at": datetime.now()}}
            )
            
            return result.modified_count
            
        except Exception as e:
            print(f"Error marking all notifications as read: {str(e)}")
            return 0
    
    async def delete_notification(self, notification_id: str) -> bool:
        """
        Delete a notification
        
        Args:
            notification_id: ID of the notification to delete
            
        Returns:
            bool: True if successful, False if failed
        """
        try:
            result = await self.collection.delete_one({"_id": ObjectId(notification_id)})
            return result.deleted_count > 0
            
        except Exception as e:
            print(f"Error deleting notification: {str(e)}")
            return False

    async def get_unread_count(self, user_id: str) -> int:
        """
        Get the number of unread notifications for a user
        
        Args:
            user_id: User ID to get unread count for
            
        Returns:
            int: Number of unread notifications
        """
        try:
            return await self.collection.count_documents({"user_id": user_id, "read": False})
            
        except Exception as e:
            print(f"Error getting unread notification count: {str(e)}")
            return 0
            
    async def create_task_notification(self, user_id: str, task_data: Dict[str, Any], created_by: str, created_by_name: str) -> str:
        """
        Create a notification for a task assignment
        
        Args:
            user_id: User ID to create notification for
            task_data: Task data
            created_by: User ID of the creator
            created_by_name: Name of the creator
            
        Returns:
            str: Notification ID if successful, None if failed
        """
        try:
            title = task_data.get("title") or task_data.get("subject") or "Task"
            due_date = task_data.get("due_date") or ""
            due_info = f" - Due: {due_date}" if due_date else ""
            
            notification_data = {
                "user_id": user_id,
                "type": "task",
                "title": f"New Task Assignment",
                "message": f"You were added to task '{title}'{due_info} by {created_by_name}",
                "link": f"/tasks?id={task_data.get('_id') or task_data.get('id')}",
                "reference_id": str(task_data.get("_id") or task_data.get("id")),
                "created_by": created_by,
                "created_by_name": created_by_name
            }
            
            return await self.create_notification(notification_data)
            
        except Exception as e:
            print(f"Error creating task notification: {str(e)}")
            return None
            
    async def create_ticket_notification(self, user_id: str, ticket_data: Dict[str, Any], created_by: str, created_by_name: str) -> str:
        """
        Create a notification for a ticket assignment
        
        Args:
            user_id: User ID to create notification for
            ticket_data: Ticket data
            created_by: User ID of the creator
            created_by_name: Name of the creator
            
        Returns:
            str: Notification ID if successful, None if failed
        """
        try:
            title = ticket_data.get("title") or ticket_data.get("subject") or "Ticket"
            
            notification_data = {
                "user_id": user_id,
                "type": "ticket",
                "title": f"New Ticket Assignment",
                "message": f"You were added to ticket '{title}' by {created_by_name}",
                "link": f"/tickets?id={ticket_data.get('_id') or ticket_data.get('id')}",
                "reference_id": str(ticket_data.get("_id") or ticket_data.get("id")),
                "created_by": created_by,
                "created_by_name": created_by_name
            }
            
            return await self.create_notification(notification_data)
            
        except Exception as e:
            print(f"Error creating ticket notification: {str(e)}")
            return None
            
    async def create_warning_notification(self, user_id: str, warning_data: Dict[str, Any], created_by: str, created_by_name: str) -> str:
        """
        Create a notification for a warning/penalty
        
        Args:
            user_id: User ID to create notification for
            warning_data: Warning data
            created_by: User ID of the creator
            created_by_name: Name of the creator
            
        Returns:
            str: Notification ID if successful, None if failed
        """
        try:
            reason = warning_data.get("reason") or "Not specified"
            amount = warning_data.get("penalty_amount")
            
            message = f"You received a penalty"
            if amount:
                message += f" of ₹{amount}"
            message += f" because: {reason}. By {created_by_name}"
            
            notification_data = {
                "user_id": user_id,
                "type": "warning",
                "title": f"Penalty Notice",
                "message": message,
                "link": "/profile/warnings",
                "reference_id": str(warning_data.get("_id") or warning_data.get("id")),
                "created_by": created_by,
                "created_by_name": created_by_name
            }
            
            return await self.create_notification(notification_data)
            
        except Exception as e:
            print(f"Error creating warning notification: {str(e)}")
            return None

    async def create_task_due_notification(self, user_id: str, task_data: Dict[str, Any]) -> str:
        """
        Create a notification for a due task
        
        Args:
            user_id: User ID to create notification for
            task_data: Task data
            
        Returns:
            str: Notification ID if successful, None if failed
        """
        try:
            title = task_data.get("title") or task_data.get("subject") or "Task"
            
            notification_data = {
                "user_id": user_id,
                "type": "task_due",
                "title": f"Task Due Soon",
                "message": f"Your task '{title}' is due soon or overdue",
                "link": f"/tasks?id={task_data.get('_id') or task_data.get('id')}",
                "reference_id": str(task_data.get("_id") or task_data.get("id")),
                "created_by": "system",
                "created_by_name": "System"
            }
            
            return await self.create_notification(notification_data)
            
        except Exception as e:
            print(f"Error creating task due notification: {str(e)}")
            return None
            
    async def create_task_overdue_notification(self, user_id: str, task_data: Dict[str, Any]) -> str:
        """
        Create a notification for an overdue task (high priority notification)
        
        Args:
            user_id: User ID to create notification for
            task_data: Task data
            
        Returns:
            str: Notification ID if successful, None if failed
        """
        try:
            title = task_data.get("title") or task_data.get("subject") or "Task"
            due_date = task_data.get("due_date", "Unknown")
            priority = task_data.get("priority", "")
            status = task_data.get("status", "")
            
            notification_data = {
                "user_id": user_id,
                "type": "task_overdue",  # Special type for overdue tasks
                "title": f"Task Overdue - Action Required",
                "message": f"URGENT: Your task '{title}' is overdue. Due date: {due_date}, Priority: {priority}, Status: {status}",
                "link": f"/tasks?id={task_data.get('_id') or task_data.get('id')}",
                "reference_id": str(task_data.get("_id") or task_data.get("id")),
                "created_by": "system",
                "created_by_name": "System",
                # Add task details for full-screen popup
                "details": {
                    "id": str(task_data.get("_id") or task_data.get("id")),
                    "title": title,
                    "due_date": due_date,
                    "priority": priority,
                    "status": status,
                    "description": task_data.get("description", ""),
                    "type": task_data.get("task_type", ""),
                }
            }
            
            return await self.create_notification(notification_data)
            
        except Exception as e:
            print(f"Error creating task overdue notification: {str(e)}")
            return None
            
    async def create_daily_tasks_summary_notification(self, user_id: str, tasks: List[Dict[str, Any]]) -> str:
        """
        Create a notification summarizing today's tasks
        
        Args:
            user_id: User ID to create notification for
            tasks: List of tasks due today
            
        Returns:
            str: Notification ID if successful, None if failed
        """
        try:
            if not tasks:
                return None
                
            today = datetime.now().strftime("%Y-%m-%d")
            num_tasks = len(tasks)
            
            # Create a summary of task priorities
            high_priority = sum(1 for t in tasks if t.get("priority", "").lower() in ["high", "urgent"])
            
            notification_data = {
                "user_id": user_id,
                "type": "daily_summary",
                "title": f"Today's Tasks Summary ({today})",
                "message": f"You have {num_tasks} tasks scheduled for today" + 
                          (f", including {high_priority} high priority tasks." if high_priority else "."),
                "link": "/tasks?date=today",
                "reference_id": f"daily-summary-{today}",
                "created_by": "system",
                "created_by_name": "System",
                # Add tasks for detailed view
                "details": {
                    "date": today,
                    "task_count": num_tasks,
                    "high_priority_count": high_priority,
                    "tasks": [{
                        "id": str(t.get("_id") or t.get("id")),
                        "title": t.get("title") or t.get("subject") or "Untitled Task",
                        "due_date": t.get("due_date", ""),
                        "priority": t.get("priority", ""),
                        "status": t.get("status", "")
                    } for t in tasks[:10]]  # Limit to 10 tasks in the notification
                }
            }
            
            return await self.create_notification(notification_data)
            
        except Exception as e:
            print(f"Error creating daily tasks summary notification: {str(e)}")
            return None
            
    async def delete_existing_overdue_notifications(self, user_id: str, task_id: str) -> int:
        """
        Delete existing overdue notifications for a specific task
        
        Args:
            user_id: User ID
            task_id: Task ID
            
        Returns:
            int: Number of deleted notifications
        """
        try:
            result = await self.collection.delete_many({
                "user_id": user_id,
                "type": "task_overdue",
                "reference_id": task_id
            })
            
            return result.deleted_count
            
        except Exception as e:
            print(f"Error deleting existing overdue notifications: {str(e)}")
            return 0

    async def create_lead_submission_notification(self, user_id: str, lead_data: Dict[str, Any]) -> str:
        """
        Create a notification for lead submission from public form
        
        Args:
            user_id: User ID to create notification for (assigned user)
            lead_data: Lead data from the public form
            
        Returns:
            str: Notification ID if successful, None if failed
        """
        try:
            # Extract customer name
            first_name = lead_data.get("first_name", "")
            last_name = lead_data.get("last_name", "")
            customer_name = f"{first_name} {last_name}".strip()
            if not customer_name:
                customer_name = "Customer"
            
            # Extract custom lead ID
            custom_lead_id = lead_data.get("custom_lead_id", "Lead")
            
            notification_data = {
                "user_id": user_id,
                "type": "lead_submission",
                "title": "New Lead Submission",
                "message": f"{custom_lead_id}: {customer_name} submitted form.",
                "link": f"/lead-crm?lead_id={lead_data.get('_id') or lead_data.get('id')}",
                "reference_id": str(lead_data.get("_id") or lead_data.get("id")),
                "created_by": "system",
                "created_by_name": "Public Form"
            }
            
            return await self.create_notification(notification_data)
            
        except Exception as e:
            print(f"Error creating lead submission notification: {str(e)}")
            return None

    async def create_leave_status_notification(self, user_id: str, leave_data: Dict[str, Any], status_changed_by: str, status_changed_by_name: str) -> str:
        """
        Create a notification for leave request status change
        
        Args:
            user_id: User ID to create notification for (employee who requested leave)
            leave_data: Leave request data
            status_changed_by: User ID who changed the status
            status_changed_by_name: Name of the user who changed the status
            
        Returns:
            str: Notification ID if successful, None if failed
        """
        try:
            status = leave_data.get("status", "").title()
            leave_type = leave_data.get("leave_type", "Leave").replace("_", " ").title()
            from_date = leave_data.get("from_date", "")
            to_date = leave_data.get("to_date", "")
            
            # Format date range
            date_range = ""
            if from_date and to_date:
                if from_date == to_date:
                    date_range = f" for {from_date}"
                else:
                    date_range = f" from {from_date} to {to_date}"
            
            notification_data = {
                "user_id": user_id,
                "type": "leave_status",
                "title": f"Leave Request {status}",
                "message": f"Your {leave_type} request{date_range} has been {status.lower()} by {status_changed_by_name}",
                "link": f"/leaves?id={leave_data.get('_id') or leave_data.get('id')}",
                "reference_id": str(leave_data.get("_id") or leave_data.get("id")),
                "created_by": status_changed_by,
                "created_by_name": status_changed_by_name
            }
            
            return await self.create_notification(notification_data)
            
        except Exception as e:
            print(f"Error creating leave status notification: {str(e)}")
            return None
