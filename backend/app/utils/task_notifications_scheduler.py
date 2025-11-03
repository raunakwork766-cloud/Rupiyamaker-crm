"""
Task Notifications Scheduler
Handles checking for overdue tasks and sending notifications
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
import traceback

from app.database.Tasks import TasksDB
from app.database.Users import UsersDB
from app.database.Notifications import NotificationsDB

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TaskNotificationsScheduler:
    """
    Scheduler service for managing task notifications
    """
    
    def __init__(self):
        self.tasks_db = TasksDB()
        self.users_db = UsersDB()
        self.notifications_db = NotificationsDB()
        self.is_running = False
        self.check_interval = 900  # Check every 15 minutes
        self.daily_summary_time = "09:00"  # Send daily summary at 9 AM
        self.last_daily_summary_date = None
    
    async def start(self):
        """Start the task notifications scheduler"""
        if self.is_running:
            logger.warning("Task notifications scheduler is already running")
            return
        
        self.is_running = True
        logger.info("Starting task notifications scheduler...")
        
        while self.is_running:
            try:
                # Check for overdue tasks
                await self.process_overdue_tasks()
                
                # Check if we need to send daily task summaries
                await self.process_daily_task_summaries()
                
                # Wait for next check interval
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in task notifications scheduler: {e}")
                logger.error(traceback.format_exc())
                await asyncio.sleep(self.check_interval)
    
    def stop(self):
        """Stop the task notifications scheduler"""
        logger.info("Stopping task notifications scheduler...")
        self.is_running = False
    
    async def process_overdue_tasks(self):
        """Check for overdue tasks and send notifications"""
        try:
            logger.info("Checking for overdue tasks...")
            
            # Get all active users (fallback to list_users if get_active_users is not available)
            try:
                users = await self.users_db.get_active_users()
            except AttributeError:
                logger.warning("get_active_users method not found, using list_users with filter instead")
                users = await self.users_db.list_users({"is_disabled": {"$ne": True}})
            
            for user in users:
                if not user:
                    continue
                user_id = str(user.get("_id") or "")
                
                # Get overdue tasks for this user
                overdue_tasks = await self.tasks_db.get_overdue_tasks_for_user(user_id)
                
                if overdue_tasks:
                    logger.info(f"Found {len(overdue_tasks)} overdue tasks for user {user_id}")
                    
                    # Process each overdue task
                    for task in overdue_tasks:
                        # Only send notification if task is overdue by less than 24 hours
                        # to avoid spamming users with notifications for old tasks
                        due_date = task.get("due_date")
                        if due_date:
                            try:
                                due_date_dt = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
                                hours_overdue = (datetime.now() - due_date_dt).total_seconds() / 3600
                                
                                # Only notify if overdue by less than 24 hours or high priority
                                is_high_priority = task.get("priority", "").lower() in ["high", "urgent"]
                                if hours_overdue < 24 or is_high_priority:
                                    # For testing purposes, delete any existing overdue notifications for this task
                                    # This will ensure a new unread notification is created which will trigger the popup
                                    task_id = str(task.get("_id") or task.get("id"))
                                    self.notifications_db.delete_existing_overdue_notifications(user_id, task_id)
                                    
                                    # Create a new overdue notification
                                    self.notifications_db.create_task_overdue_notification(user_id, task)
                                    logger.info(f"Created overdue notification for task {task_id} for user {user_id}")
                            except Exception as date_err:
                                logger.error(f"Error parsing due date for task {task.get('_id')}: {date_err}")
                                
        except Exception as e:
            logger.error(f"Error processing overdue tasks: {e}")
            logger.error(traceback.format_exc())
    
    async def process_daily_task_summaries(self):
        """Send daily summaries of today's tasks"""
        try:
            now = datetime.now()
            today = now.strftime("%Y-%m-%d")
            
            # Check if we already sent the summary today
            if self.last_daily_summary_date == today:
                return
            
            # Check if it's the right time to send daily summaries
            target_hour, target_minute = map(int, self.daily_summary_time.split(":"))
            if now.hour == target_hour and now.minute < target_minute + 15:  # Within 15 minutes of target time
                logger.info(f"Sending daily task summaries at {now}")
                
                # Get all active users (fallback to list_users if get_active_users is not available)
                try:
                    users = self.users_db.get_active_users()
                except AttributeError:
                    logger.warning("get_active_users method not found, using list_users with filter instead")
                    users = self.users_db.list_users({"is_disabled": {"$ne": True}})
                
                for user in users:
                    if not user:
                        continue
                    user_id = str(user.get("_id") or "")
                    
                    # Get today's tasks for this user
                    today_tasks = self.tasks_db.get_tasks_due_on_date(user_id, today)
                    
                    if today_tasks:
                        logger.info(f"Found {len(today_tasks)} tasks due today for user {user_id}")
                        
                        # Create daily summary notification
                        self.notifications_db.create_daily_tasks_summary_notification(user_id, today_tasks)
                        logger.info(f"Created daily summary notification for user {user_id}")
                
                # Update the last summary date
                self.last_daily_summary_date = today
        
        except Exception as e:
            logger.error(f"Error processing daily task summaries: {e}")
            logger.error(traceback.format_exc())
    
    def get_scheduler_status(self) -> Dict[str, Any]:
        """Get current scheduler status"""
        return {
            "is_running": self.is_running,
            "check_interval": self.check_interval,
            "daily_summary_time": self.daily_summary_time,
            "last_daily_summary_date": self.last_daily_summary_date,
            "last_check": datetime.now().isoformat()
        }
    
    def update_check_interval(self, interval_seconds: int):
        """Update how frequently the scheduler checks for tasks"""
        if interval_seconds < 300:  # Minimum 5 minutes
            interval_seconds = 300
        elif interval_seconds > 3600:  # Maximum 1 hour
            interval_seconds = 3600
            
        self.check_interval = interval_seconds
        logger.info(f"Updated check interval to {interval_seconds} seconds")

# Global scheduler instance
task_notifications_scheduler = TaskNotificationsScheduler()

async def start_task_notifications_scheduler():
    """Start the global task notifications scheduler"""
    await task_notifications_scheduler.start()

def stop_task_notifications_scheduler():
    """Stop the global task notifications scheduler"""
    task_notifications_scheduler.stop()

def get_task_notifications_scheduler():
    """Get the global task notifications scheduler"""
    return task_notifications_scheduler
