"""
Global Pop Notification Routes

This module handles all global notification operations including:
- Sending notifications (admin/permission required)
- Viewing notifications for users
- Accepting notifications
- Managing notification history and statistics

Permission Rules:
- Users with "notification" "send" permission can send notifications
- Super admins can send notifications
- Users with "notification" "view" permission can view the notifications management page
- All users receive and can accept notifications
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Path
from fastapi.security import HTTPBearer
from typing import List, Optional

from app.database.PopNotifications import PopNotificationsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.utils.database_dependencies import (
    get_pop_notifications_db, get_users_db, get_roles_db
)
from app.schemas.pop_notification_schemas import (
    PopNotificationCreate, PopNotificationResponse, PopNotificationListResponse,
    PopNotificationAccept, PopNotificationHistory, PopNotificationUpdate,
    PopNotificationStats, UserNotificationStatus, NotificationDeactivate
)
from app.utils.permissions import PermissionManager
from app.utils.common_utils import get_current_user_id

router = APIRouter(prefix="/pop-notifications", tags=["pop-notifications"])
security = HTTPBearer()

async def get_user_details(user_id: str, users_db: UsersDB):
    """Get user details for display"""
    user = await users_db.get_user(user_id)
    if user:
        # Format user name (first_name + last_name)
        first_name = user.get("first_name", "")
        last_name = user.get("last_name", "")
        name = f"{first_name} {last_name}".strip()
        if not name:
            name = user.get("username", "Unknown")
        return {
            "id": user_id,
            "name": name,
        }
    return {"id": user_id, "name": "Unknown"}

async def count_target_users(notification_data: dict, users_db: UsersDB) -> int:
    """Count how many users will receive this notification based on targeting"""
    try:
        target_type = notification_data.get("target_type", "all")
        
        if target_type == "all":
            # Count all active users
            active_users = await users_db.list_users({"status": {"$ne": "inactive"}})
            return len(active_users)
            
        elif target_type == "individual":
            # Count specific users (filter out inactive ones)
            target_employees = notification_data.get("target_employees", [])
            if not target_employees:
                return 0
            
            # Check which target users are active
            active_count = 0
            for user_id in target_employees:
                user = await users_db.get_user(user_id)
                if user and user.get("status") != "inactive":
                    active_count += 1
            return active_count
            
        elif target_type == "department":
            # Count users in target departments
            target_departments = notification_data.get("target_departments", [])
            if not target_departments:
                return 0
            
            # Count active users in target departments
            query = {
                "status": {"$ne": "inactive"},
                "$or": [
                    {"department_id": {"$in": target_departments}},
                    {"department": {"$in": target_departments}}
                ]
            }
            department_users = await users_db.list_users(query)
            return len(department_users)
            
        return 0
        
    except Exception as e:
        print(f"[ERROR] Failed to count target users: {e}")
        return 0

async def get_user_details_fixed(user_id: str, users_db: UsersDB):
    """Get user details for display"""
    user = await users_db.get_user(user_id)
    if user:
        # Format user name (first_name + last_name)
        first_name = user.get("first_name", "")
        last_name = user.get("last_name", "")
        name = f"{first_name} {last_name}".strip()
        if not name:
            name = user.get("username", "Unknown")
        return {
            "id": user_id,
            "name": name,
            "username": user.get("username", ""),
            "email": user.get("email", "")
        }
    return {"id": user_id, "name": "Unknown"}

async def check_send_permission(current_user_id: str, users_db: UsersDB, roles_db: RolesDB) -> bool:
    """
    Check if user can send notifications
    - notification:send permission
    - Super admin (page: *, action: *)
    """
    try:
        # Check for notification send permission
        has_send_permission = await PermissionManager.check_permission(
            current_user_id, "notification", "send", users_db, roles_db, raise_error=False
        )
        
        if has_send_permission:
            return True
            
        # Check for super admin permission
        has_super_admin = await PermissionManager.check_permission(
            current_user_id, "*", "*", users_db, roles_db, raise_error=False
        )
        
        return has_super_admin
        
    except Exception as e:
        print(f"[ERROR] Failed to check send permission for user {current_user_id}: {e}")
        return False

async def check_view_permission(current_user_id: str, users_db: UsersDB, roles_db: RolesDB) -> bool:
    """
    Check if user can view notification management page
    - notification:view permission
    - Super admin (page: *, action: *)
    """
    try:
        # Check for notification view permission
        has_view_permission = await PermissionManager.check_permission(
            current_user_id, "notification", "view", users_db, roles_db, raise_error=False
        )
        
        if has_view_permission:
            return True
            
        # Check for super admin permission
        has_super_admin = await PermissionManager.check_permission(
            current_user_id, "*", "*", users_db, roles_db, raise_error=False
        )
        
        return has_super_admin
        
    except Exception as e:
        print(f"[ERROR] Failed to check view permission for user {current_user_id}: {e}")
        return False

@router.post("/", response_model=PopNotificationResponse)
async def send_notification(
    notification_data: PopNotificationCreate,
    current_user_id: str = Depends(get_current_user_id),
    pop_notifications_db: PopNotificationsDB = Depends(get_pop_notifications_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Send a global notification to all users
    
    Requires 'notification:send' permission or super admin access.
    """
    try:
        # Check permissions
        can_send = await check_send_permission(current_user_id, users_db, roles_db)
        if not can_send:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to send notifications"
            )
        
        # Get sender details
        sender_details = await get_user_details_fixed(current_user_id, users_db)
        sender_name = sender_details.get("name", "Unknown")
        
        # Create notification
        notification_id = await pop_notifications_db.create_notification(
            notification_data.dict(), current_user_id, sender_name
        )
        
        if not notification_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create notification"
            )
        
        # Count target users based on notification targeting
        total_target_users = await count_target_users(notification_data.dict(), users_db)
        
        # Update notification with total users count
        await pop_notifications_db.update_total_users_count(notification_id, total_target_users)
        
        # Get the created notification
        notification = await pop_notifications_db.get_notification(notification_id)
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created notification"
            )
        
        return PopNotificationResponse(**notification)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send notification: {str(e)}"
        )

@router.get("/my-notifications", response_model=List[PopNotificationResponse])
async def get_my_active_notifications(
    current_user_id: str = Depends(get_current_user_id),
    pop_notifications_db: PopNotificationsDB = Depends(get_pop_notifications_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """
    Get active notifications for the current user (notifications they haven't accepted yet)
    
    This endpoint is used by the frontend to show full-page notifications.
    """
    try:
        # Get user details to determine department for targeting
        user = await users_db.get_user(current_user_id)
        user_department_id = None
        if user:
            user_department_id = user.get("department_id") or user.get("department")
            
        notifications = await pop_notifications_db.get_active_notifications_for_user(
            current_user_id, user_department_id
        )
        
        # Convert to response schema
        response_notifications = []
        for notification in notifications:
            response_notifications.append(PopNotificationResponse(**notification))
        
        return response_notifications
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notifications: {str(e)}"
        )

@router.post("/accept", response_model=dict)
async def accept_notification(
    accept_data: PopNotificationAccept,
    current_user_id: str = Depends(get_current_user_id),
    pop_notifications_db: PopNotificationsDB = Depends(get_pop_notifications_db),
    users_db: UsersDB = Depends(get_users_db)
):
    """
    Accept a notification
    
    Once accepted, the notification will no longer show as a full-page modal for this user.
    """
    try:
        # Get user details
        user_details = await get_user_details(current_user_id, users_db)
        user_name = user_details.get("name", "Unknown")
        
        # Accept the notification
        success = await pop_notifications_db.accept_notification(
            accept_data.notification_id, current_user_id, user_name
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to accept notification"
            )
        
        return {"message": "Notification accepted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to accept notification: {str(e)}"
        )

@router.get("/", response_model=PopNotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=500, description="Items per page"),
    include_inactive: bool = Query(False, description="Include deactivated notifications"),
    current_user_id: str = Depends(get_current_user_id),
    pop_notifications_db: PopNotificationsDB = Depends(get_pop_notifications_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    List all notifications (admin view)
    
    Requires 'notification:view' permission or super admin access.
    Shows all notifications with acceptance statistics.
    By default, only shows active notifications. Set include_inactive=true to see deactivated ones.
    """
    try:
        # Check permissions
        can_view = await check_view_permission(current_user_id, users_db, roles_db)
        if not can_view:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view notifications"
            )
        
        # Get notifications with pagination
        notifications, total = await pop_notifications_db.get_all_notifications(page, per_page, include_inactive)
        
        # Calculate pagination info
        total_pages = (total + per_page - 1) // per_page
        
        # Convert to response schema
        response_notifications = []
        for notification in notifications:
            response_notifications.append(PopNotificationResponse(**notification))
        
        return PopNotificationListResponse(
            notifications=response_notifications,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list notifications: {str(e)}"
        )

@router.get("/{notification_id}", response_model=PopNotificationResponse)
async def get_notification(
    notification_id: str,
    current_user_id: str = Depends(get_current_user_id),
    pop_notifications_db: PopNotificationsDB = Depends(get_pop_notifications_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get a specific notification with details
    
    Requires 'notification:view' permission or super admin access.
    """
    try:
        # Check permissions
        can_view = await check_view_permission(current_user_id, users_db, roles_db)
        if not can_view:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view notifications"
            )
        
        # Get notification
        notification = await pop_notifications_db.get_notification(notification_id)
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        return PopNotificationResponse(**notification)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification: {str(e)}"
        )

@router.get("/{notification_id}/history", response_model=PopNotificationHistory)
async def get_notification_history(
    notification_id: str,
    current_user_id: str = Depends(get_current_user_id),
    pop_notifications_db: PopNotificationsDB = Depends(get_pop_notifications_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get detailed history of who accepted a notification
    
    Requires 'notification:view' permission or super admin access.
    Shows who accepted the notification and when.
    """
    try:
        # Check permissions
        can_view = await check_view_permission(current_user_id, users_db, roles_db)
        if not can_view:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view notification history"
            )
        
        # Get notification history
        history = await pop_notifications_db.get_notification_history(notification_id)
        if not history:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )

        # Get users who should receive this notification based on targeting
        try:
            target_type = history.get("target_type", "all")
            
            if target_type == "all":
                # Get all active users
                target_users = await users_db.get_active_users()
            elif target_type == "individual":
                # Get only the targeted employees
                target_employees = history.get("target_employees", [])
                target_users = []
                for user_id in target_employees:
                    user = await users_db.get_user(user_id)
                    if user and user.get("status") != "inactive":
                        target_users.append(user)
            elif target_type == "department":
                # Get users in target departments
                target_departments = history.get("target_departments", [])
                if target_departments:
                    query = {
                        "status": {"$ne": "inactive"},
                        "$or": [
                            {"department_id": {"$in": target_departments}},
                            {"department": {"$in": target_departments}}
                        ]
                    }
                    target_users = await users_db.list_users(query)
                else:
                    target_users = []
            else:
                target_users = []
                
        except Exception as e:
            print(f"[ERROR] Failed to get target users: {e}")
            target_users = []

        # Build set of user_ids who accepted
        accepted_by = history.get("accepted_by", [])
        accepted_ids = set(a.get("user_id") for a in accepted_by)

        pending_users = []
        for user in target_users:
            uid = str(user.get("_id") or user.get("id") or "")
            if not uid:
                continue
            if uid in accepted_ids:
                continue
            # Format name
            name = (user.get("first_name") or "") + (" " + user.get("last_name") if user.get("last_name") else "")
            name = name.strip() or user.get("username") or user.get("email") or "Unknown"
            pending_users.append({
                "user_id": uid,
                "user_name": name
            })

        # Attach pending_users - stats are calculated correctly in the database method
        history["pending_users"] = pending_users

        return PopNotificationHistory(**history)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification history: {str(e)}"
        )

@router.post("/{notification_id}/deactivate")
async def deactivate_notification(
    notification_id: str,
    deactivate_data: NotificationDeactivate,
    current_user_id: str = Depends(get_current_user_id),
    pop_notifications_db: PopNotificationsDB = Depends(get_pop_notifications_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Deactivate a notification (stops showing to users)
    
    Requires 'notification:send' permission or super admin access.
    """
    try:
        # Check permissions
        can_send = await check_send_permission(current_user_id, users_db, roles_db)
        if not can_send:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to deactivate notifications"
            )
        
        # Get notification to check if exists
        notification = await pop_notifications_db.get_notification(notification_id)
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        # Deactivate notification
        success = await pop_notifications_db.deactivate_notification(notification_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to deactivate notification"
            )
        
        return {"message": "Notification deactivated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deactivate notification: {str(e)}"
        )

@router.post("/{notification_id}/activate")
async def activate_notification(
    notification_id: str,
    activate_data: NotificationDeactivate,  # Reuse the same schema (just reason field)
    current_user_id: str = Depends(get_current_user_id),
    pop_notifications_db: PopNotificationsDB = Depends(get_pop_notifications_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Activate a notification (makes it show to users again)
    
    Requires 'notification:send' permission or super admin access.
    """
    try:
        # Check permissions
        can_send = await check_send_permission(current_user_id, users_db, roles_db)
        if not can_send:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to activate notifications"
            )
        
        # Get notification to check if exists
        notification = await pop_notifications_db.get_notification(notification_id)
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        # Activate notification (set is_active to True)
        success = await pop_notifications_db.activate_notification(notification_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to activate notification"
            )
        
        return {"message": "Notification activated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate notification: {str(e)}"
        )

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user_id: str = Depends(get_current_user_id),
    pop_notifications_db: PopNotificationsDB = Depends(get_pop_notifications_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Permanently delete a notification from database
    
    Requires 'notification:send' permission or super admin access.
    """
    try:
        # Check permissions
        can_send = await check_send_permission(current_user_id, users_db, roles_db)
        if not can_send:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete notifications"
            )
        
        # Get notification to check if exists
        notification = await pop_notifications_db.get_notification(notification_id)
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        # Delete notification permanently
        success = await pop_notifications_db.delete_notification(notification_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete notification"
            )
        
        return {"message": "Notification deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete notification: {str(e)}"
        )

@router.get("/stats/overview", response_model=PopNotificationStats)
async def get_notification_stats(
    current_user_id: str = Depends(get_current_user_id),
    pop_notifications_db: PopNotificationsDB = Depends(get_pop_notifications_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    Get notification statistics overview
    
    Requires 'notification:view' permission or super admin access.
    """
    try:
        # Check permissions
        can_view = await check_view_permission(current_user_id, users_db, roles_db)
        if not can_view:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view notification statistics"
            )
        
        # Get recent notifications for overview
        recent_notifications, total = await pop_notifications_db.get_all_notifications(1, 5)
        
        # Calculate statistics
        active_count = len([n for n in recent_notifications if n.get("is_active", False)])
        inactive_count = len([n for n in recent_notifications if not n.get("is_active", True)])
        
        # Calculate average acceptance rate
        total_acceptance_rates = []
        for notification in recent_notifications:
            stats = notification.get("acceptance_stats", {})
            if stats.get("total_users", 0) > 0:
                total_acceptance_rates.append(stats.get("acceptance_rate", 0))
        
        avg_acceptance_rate = sum(total_acceptance_rates) / len(total_acceptance_rates) if total_acceptance_rates else 0
        
        # Convert recent notifications to response schema
        recent_response = []
        for notification in recent_notifications:
            recent_response.append(PopNotificationResponse(**notification))
        
        return PopNotificationStats(
            total_notifications=total,
            active_notifications=active_count,
            inactive_notifications=inactive_count,
            avg_acceptance_rate=avg_acceptance_rate,
            recent_notifications=recent_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification statistics: {str(e)}"
        )

# TODO: Fix path parameter issue and re-enable this endpoint
# @router.get("/user/{user_id}/status", response_model=UserNotificationStatus)
# async def get_user_notification_status(
#     user_id: str = Path(..., description="User ID"),
#     current_user_id: str = Depends(get_current_user_id),
#     pop_notifications_db: PopNotificationsDB = Depends(get_pop_notifications_db),
#     users_db: UsersDB = Depends(get_users_db),
#     roles_db: RolesDB = Depends(get_roles_db)
# ):
#     """
#     Get notification status for a specific user
#     
#     Requires 'notification:view' permission or super admin access.
#     Shows pending notifications and acceptance history for the user.
#     """
#     try:
#         # Check permissions
#         can_view = await check_view_permission(current_user_id, users_db, roles_db)
#         if not can_view:
#             raise HTTPException(
#                 status_code=status.HTTP_403_FORBIDDEN,
#                 detail="You don't have permission to view user notification status"
#             )
#         
#         # Verify user exists
#         user = await users_db.get_user(user_id)
#         if not user:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail="User not found"
#             )
#         
#         # Get pending notifications for user
#         pending_notifications = await pop_notifications_db.get_active_notifications_for_user(user_id)
#         
#         # Get all notifications to calculate total sent and accepted
#         all_notifications, total_sent = await pop_notifications_db.get_all_notifications(1, 1000)  # Get all
#         
#         # Count accepted notifications by this user
#         accepted_count = 0
#         for notification in all_notifications:
#             accepted_by = notification.get("accepted_by", [])
#             if any(acceptance.get("user_id") == user_id for acceptance in accepted_by):
#                 accepted_count += 1
#         
#         # Convert pending notifications to response schema
#         pending_response = []
#         for notification in pending_notifications:
#             pending_response.append(PopNotificationResponse(**notification))
#         
#         return UserNotificationStatus(
#             user_id=user_id,
#             pending_notifications=pending_response,
#             accepted_count=accepted_count,
#             total_sent=total_sent
#         )
#         
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to get user notification status: {str(e)}"
#         )