from fastapi import APIRouter, HTTPException, Depends, Query, Path, Body, Response
from typing import Dict, List, Optional, Any
from app.database.Notifications import NotificationsDB
from app.database.Users import UsersDB
from app.database import get_database_instances
from datetime import datetime
from pydantic import BaseModel, Field

router = APIRouter()

# Dependencies to get DB instances
async def get_notifications_db():
    db_instances = get_database_instances()
    return db_instances["notifications"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

# Schema definitions
class NotificationBase(BaseModel):
    type: str
    title: str
    message: str
    link: Optional[str] = None
    reference_id: Optional[str] = None

class NotificationCreate(NotificationBase):
    user_id: str
    created_by: str

class NotificationResponse(NotificationBase):
    id: str = Field(alias="_id")
    user_id: str
    created_by: str
    created_by_name: Optional[str] = None
    read: bool
    created_at: datetime

class NotificationCountResponse(BaseModel):
    unread_count: int

@router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    user_id: str = Query(..., description="User ID to get notifications for"),
    limit: int = Query(20, description="Maximum number of notifications to return"),
    skip: int = Query(0, description="Number of notifications to skip (for pagination)"),
    unread_only: bool = Query(False, description="If true, only return unread notifications"),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Get notifications for a specific user"""
    try:
        notifications = await notifications_db.get_user_notifications(
            user_id=user_id,
            limit=limit,
            skip=skip,
            unread_only=unread_only
        )
        
        return notifications
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get notifications: {str(e)}")

@router.post("/notifications/read/{notification_id}")
async def mark_notification_as_read(
    notification_id: str = Path(..., description="ID of the notification to mark as read"),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Mark a notification as read"""
    try:
        success = await notifications_db.mark_notification_as_read(notification_id)
        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True, "message": "Notification marked as read"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mark notification as read: {str(e)}")

@router.post("/notifications/read-all")
async def mark_all_notifications_as_read(
    user_id: str = Query(..., description="User ID to mark all notifications as read for"),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Mark all notifications for a user as read"""
    try:
        count = await notifications_db.mark_all_notifications_as_read(user_id)
        return {"success": True, "count": count, "message": f"{count} notifications marked as read"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mark notifications as read: {str(e)}")

@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str = Path(..., description="ID of the notification to delete"),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Delete a notification"""
    try:
        success = await notifications_db.delete_notification(notification_id)
        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True, "message": "Notification deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete notification: {str(e)}")

@router.get("/notifications/count", response_model=NotificationCountResponse)
async def get_unread_count(
    user_id: str = Query(..., description="User ID to get unread count for"),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Get the number of unread notifications for a user"""
    try:
        count = await notifications_db.get_unread_count(user_id)
        return {"unread_count": count}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get unread count: {str(e)}")

@router.post("/notifications/test")
async def create_test_notification(
    notification: Dict[str, Any] = Body(..., description="Notification data"),
    notifications_db: NotificationsDB = Depends(get_notifications_db)
):
    """Create a test notification (for development only)"""
    try:
        notification_id = await notifications_db.create_notification(notification)
        if not notification_id:
            raise HTTPException(status_code=500, detail="Failed to create notification")
        
        return {"success": True, "notification_id": notification_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create test notification: {str(e)}")
        
@router.post("/test/overdue-task")
async def create_test_overdue_task_notification(
    user_id: str = Query(..., description="User ID to create notification for"),
    notifications_db: NotificationsDB = Depends(get_notifications_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """Create a test overdue task notification for popup testing (for development only)"""
    try:
        # Get a user
        user = await users_db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Create a mock overdue task
        from datetime import datetime, timedelta
        mock_task = {
            "_id": "test_task_id_" + datetime.now().strftime("%Y%m%d%H%M%S"),
            "title": "Test Overdue Task for Popup",
            "due_date": (datetime.now() - timedelta(hours=2)).isoformat(),
            "priority": "High",
            "status": "In Progress",
            "description": "This is a test overdue task created for testing popup notifications. This task is automatically generated and not real.",
            "type": "Test Task"
        }
        
        # Create notification
        notification_id = await notifications_db.create_task_overdue_notification(user_id, mock_task)
        if not notification_id:
            raise HTTPException(status_code=500, detail="Failed to create test overdue task notification")
        
        return {
            "success": True, 
            "notification_id": notification_id,
            "message": "Test overdue task notification created. Refresh notifications in UI to see popup."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create test notification: {str(e)}")
