"""
Recurring Task Scheduler
Handles automatic creation of recurring task instances
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
import traceback

from app.database.Tasks import TasksDB
from app.database.TaskHistory import TaskHistoryDB
from app.database import get_database_instances

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RecurringTaskScheduler:
    """
    Scheduler service for managing recurring tasks
    """
    
    def __init__(self):
        # Get database instances from initialized state
        db_instances = get_database_instances()
        self.tasks_db = db_instances.get("tasks")
        self.task_history_db = None  # TaskHistoryDB needs to be added to init_database
        self.is_running = False
        self.check_interval = 300  # Check every 5 minutes
    
    async def start(self):
        """Start the recurring task scheduler"""
        if self.is_running:
            logger.warning("Scheduler is already running")
            return
        
        self.is_running = True
        logger.info("Starting recurring task scheduler...")
        
        while self.is_running:
            try:
                await self.process_pending_tasks()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                logger.error(traceback.format_exc())
                await asyncio.sleep(self.check_interval)
    
    def stop(self):
        """Stop the recurring task scheduler"""
        logger.info("Stopping recurring task scheduler...")
        self.is_running = False
    
    async def process_pending_tasks(self):
        """Process and create instances for all pending recurring tasks"""
        try:
            db_instances = get_database_instances()
            
            # Get pending recurring tasks
            pending_tasks = await db_instances["tasks"].get_pending_recurring_tasks()
            
            for task in pending_tasks:
                # Create new instance of the recurring task
                new_task_id = await db_instances["tasks"].create_recurring_instance(task, db_instances["task_history"])
                
                if new_task_id:
                    print(f"Created recurring task instance: {new_task_id}")
                    
                    # Update the next occurrence time
                    await db_instances["tasks"].update_next_occurrence(task["_id"])
                    
        except Exception as e:
            print(f"Error processing pending recurring tasks: {e}")
    
    async def create_task_instance(self, parent_task: Dict[str, Any]):
        """Create a new instance of a recurring task"""
        try:
            parent_id = str(parent_task["_id"])
            subject = parent_task.get("subject", "Recurring Task")
            
            logger.info(f"Creating instance for recurring task: {subject} (ID: {parent_id})")
            
            # Create the new instance
            new_task_id = self.tasks_db.create_recurring_instance(
                parent_task=parent_task,
                task_history_db=self.task_history_db
            )
            
            if new_task_id:
                logger.info(f"Successfully created recurring task instance: {new_task_id}")
                
                # Optional: Send notifications here
                await self.notify_task_created(new_task_id, parent_task)
            else:
                logger.error(f"Failed to create instance for recurring task {parent_id}")
                
        except Exception as e:
            logger.error(f"Error creating task instance: {e}")
            logger.error(traceback.format_exc())
    
    async def notify_task_created(self, task_id: str, parent_task: Dict[str, Any]):
        """
        Send notifications when a recurring task instance is created
        This can be extended to send emails, Slack messages, etc.
        """
        try:
            # For now, just log the creation
            assigned_to = parent_task.get("assigned_to", [])
            subject = parent_task.get("subject", "Recurring Task")
            
            logger.info(f"Recurring task '{subject}' created with ID: {task_id}")
            
            if assigned_to:
                logger.info(f"Task assigned to: {assigned_to}")
            
            # TODO: Implement actual notification system
            # - Email notifications
            # - In-app notifications
            # - Slack/Teams integration
            
        except Exception as e:
            logger.error(f"Error sending notifications: {e}")
    
    def get_scheduler_status(self) -> Dict[str, Any]:
        """Get current scheduler status"""
        return {
            "is_running": self.is_running,
            "check_interval": self.check_interval,
            "last_check": datetime.now().isoformat()
        }
    
    def update_check_interval(self, interval_seconds: int):
        """Update how frequently the scheduler checks for pending tasks"""
        if interval_seconds < 60:  # Minimum 1 minute
            interval_seconds = 60
        elif interval_seconds > 3600:  # Maximum 1 hour
            interval_seconds = 3600
            
        self.check_interval = interval_seconds
        logger.info(f"Updated check interval to {interval_seconds} seconds")

# Global scheduler instance
recurring_scheduler = RecurringTaskScheduler()

async def start_scheduler():
    """Start the global scheduler instance"""
    await recurring_scheduler.start()

def stop_scheduler():
    """Stop the global scheduler instance"""
    recurring_scheduler.stop()

def get_scheduler():
    """Get the global scheduler instance"""
    return recurring_scheduler
