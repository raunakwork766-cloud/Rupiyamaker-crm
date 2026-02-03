from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any, Union, Tuple
from bson import ObjectId
from datetime import datetime
import pymongo

class PopNotificationsDB:
    """
    Database class for Global Pop Notifications - separate from regular notifications
    Handles full-page notifications that require user acceptance
    """
    
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["pop_notifications"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for faster lookups and operations
            await self.collection.create_index([("created_at", -1)])
            await self.collection.create_index([("sender_id", 1)])
            await self.collection.create_index([("is_active", 1)])
            await self.collection.create_index([("accepted_by.user_id", 1)])
            print("✓ PopNotifications database indexes created successfully")
        except Exception as e:
            print(f"PopNotifications index creation warning (may already exist): {e}")
            
    async def calculate_current_target_users(self, notification: Dict[str, Any]) -> int:
        """
        Calculate the current number of targeted users for a notification
        This is used for dynamic acceptance stats calculation

        Args:
            notification: Notification document with targeting information

        Returns:
            int: Current number of users that should receive this notification
        """
        try:
            from app.database.Users import UsersDB
            users_db = UsersDB(self.db)

            target_type = notification.get("target_type", "all")

            if target_type == "all":
                # Count all active users - optimized with caching
                cache_key = "active_users_count"
                if not hasattr(self, '_user_count_cache'):
                    self._user_count_cache = {}

                if cache_key in self._user_count_cache:
                    cached_time, cached_count = self._user_count_cache[cache_key]
                    # Cache for 5 minutes to avoid repeated database queries
                    if (datetime.now() - cached_time).seconds < 300:
                        return cached_count

                active_users = await users_db.list_users({"status": {"$ne": "inactive"}})
                count = len(active_users)

                # Cache the result
                self._user_count_cache[cache_key] = (datetime.now(), count)
                return count

            elif target_type == "individual":
                # Count specific users (filter out inactive ones) - optimized
                target_employees = notification.get("target_employees", [])
                if not target_employees:
                    return 0

                # Use set for faster lookup and avoid repeated queries
                if not hasattr(self, '_user_status_cache'):
                    self._user_status_cache = {}

                active_count = 0
                users_to_check = []

                # Check cache first
                for user_id in target_employees:
                    if user_id in self._user_status_cache:
                        cached_time, is_active = self._user_status_cache[user_id]
                        if (datetime.now() - cached_time).seconds < 300:  # 5 minute cache
                            if is_active:
                                active_count += 1
                            continue

                    users_to_check.append(user_id)

                # Batch check users not in cache
                if users_to_check:
                    for user_id in users_to_check:
                        user = await users_db.get_user(user_id)
                        is_active = user and user.get("status") != "inactive"

                        # Cache the result
                        self._user_status_cache[user_id] = (datetime.now(), is_active)

                        if is_active:
                            active_count += 1

                return active_count

            elif target_type == "department":
                # Count users in target departments - optimized with caching
                target_departments = notification.get("target_departments", [])
                if not target_departments:
                    return 0

                # Create cache key for department combination
                dept_key = f"dept_{'_'.join(sorted(target_departments))}"
                if not hasattr(self, '_dept_count_cache'):
                    self._dept_count_cache = {}

                if dept_key in self._dept_count_cache:
                    cached_time, cached_count = self._dept_count_cache[dept_key]
                    if (datetime.now() - cached_time).seconds < 300:  # 5 minute cache
                        return cached_count

                # Count active users in target departments
                query = {
                    "status": {"$ne": "inactive"},
                    "$or": [
                        {"department_id": {"$in": target_departments}},
                        {"department": {"$in": target_departments}}
                    ]
                }
                department_users = await users_db.list_users(query)
                count = len(department_users)

                # Cache the result
                self._dept_count_cache[dept_key] = (datetime.now(), count)
                return count

            return 0

        except Exception as e:
            print(f"[ERROR] Failed to calculate current target users: {e}")
            # Fallback to stored count if calculation fails
            return notification.get("total_active_users", 0)
            
    async def create_notification(self, notification_data: Dict[str, Any], sender_id: str, sender_name: str) -> str:
        """
        Create a new global notification

        Args:
            notification_data: Dictionary containing notification information
            sender_id: ID of the user who sent the notification
            sender_name: Name of the sender

        Returns:
            str: Notification ID if successful, None if failed
        """
        try:
            now = datetime.now()

            # Generate a unique version for this notification
            version = f"{int(now.timestamp())}_{sender_id}"

            # Prepare notification data
            notification = {
                "title": notification_data.get("title"),
                "message": notification_data.get("message"),
                "content": notification_data.get("content"),  # Rich content if needed
                "priority": notification_data.get("priority", "normal"),  # low, normal, high, urgent
                "target_type": notification_data.get("target_type", "all"),  # all, department, individual
                "target_departments": notification_data.get("target_departments", []),  # List of department IDs
                "target_employees": notification_data.get("target_employees", []),  # List of user IDs
                "sender_id": sender_id,
                "sender_name": sender_name,
                "created_at": now,
                "is_active": True,  # Whether notification is still showing
                "accepted_by": [],  # List of users who accepted
                "total_active_users": 0,  # Will be set when notification is created
                "version": version,  # Version for instant change detection
                "metadata": notification_data.get("metadata", {}),  # Additional data
                "notification_type": notification_data.get("notification_type", "general")  # 'general' or 'logout'
            }
            
            # Insert notification
            result = await self.collection.insert_one(notification)
            
            if result.inserted_id:
                print(f"[DEBUG] Created pop notification: {result.inserted_id}")
                return str(result.inserted_id)
            else:
                print("[ERROR] Failed to create pop notification")
                return None
                
        except Exception as e:
            print(f"[ERROR] Failed to create pop notification: {e}")
            return None
            
    async def get_notification(self, notification_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific notification by ID"""
        try:
            notification = await self.collection.find_one({"_id": ObjectId(notification_id)})
            if notification:
                notification["_id"] = str(notification["_id"])
                return notification
            return None
        except Exception as e:
            print(f"[ERROR] Failed to get pop notification {notification_id}: {e}")
            return None
            
    async def get_active_notifications_for_user(self, user_id: str, user_department_id: str = None) -> List[Dict[str, Any]]:
        """
        Get all active notifications that the user should see and hasn't accepted yet
        
        Args:
            user_id: User ID
            user_department_id: User's department ID (for department-targeted notifications)
            
        Returns:
            List of active notifications
        """
        try:
            # Build query for notifications the user should see
            query = {
                "is_active": True,
                "accepted_by.user_id": {"$ne": user_id},
                "$or": [
                    # All users notifications
                    {"target_type": "all"},
                    # Individual targeting - user is in target list
                    {
                        "target_type": "individual",
                        "target_employees": {"$in": [user_id]}
                    }
                ]
            }
            
            # Add department targeting if user has a department
            if user_department_id:
                query["$or"].append({
                    "target_type": "department",
                    "target_departments": {"$in": [user_department_id]}
                })
            
            # Find notifications matching the criteria
            notifications = await self.collection.find(query).sort("created_at", -1).to_list(None)
            
            # Convert ObjectId to string
            for notification in notifications:
                notification["_id"] = str(notification["_id"])
                
            return notifications
            
        except Exception as e:
            print(f"[ERROR] Failed to get active notifications for user {user_id}: {e}")
            return []
            
    async def accept_notification(self, notification_id: str, user_id: str, user_name: str) -> bool:
        """
        Mark notification as accepted by a user
        
        Args:
            notification_id: Notification ID
            user_id: User who accepted
            user_name: Name of the user
            
        Returns:
            bool: Success status
        """
        try:
            now = datetime.now()
            
            # Check if user already accepted
            existing = await self.collection.find_one({
                "_id": ObjectId(notification_id),
                "accepted_by.user_id": user_id
            })
            
            if existing:
                return True  # Already accepted
                
            # Add user to accepted list
            result = await self.collection.update_one(
                {"_id": ObjectId(notification_id)},
                {
                    "$push": {
                        "accepted_by": {
                            "user_id": user_id,
                            "user_name": user_name,
                            "accepted_at": now
                        }
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"[ERROR] Failed to accept notification {notification_id} for user {user_id}: {e}")
            return False
            
    async def get_all_notifications(self, page: int = 1, per_page: int = 20, include_inactive: bool = False) -> Tuple[List[Dict[str, Any]], int]:
        """
        Get all notifications with pagination (for admin view)
        By default, only returns active notifications unless include_inactive=True
        
        Args:
            page: Page number
            per_page: Items per page
            include_inactive: If True, includes deactivated notifications
            
        Returns:
            Tuple of (notifications list, total count)
        """
        try:
            # Filter: only active notifications by default, or all if include_inactive=True
            if include_inactive:
                query = {}  # Show all notifications
            else:
                query = {"$or": [{"is_active": True}, {"is_active": {"$exists": False}}]}
            
            # Get total count
            total = await self.collection.count_documents(query)
            
            # Get notifications with pagination
            skip = (page - 1) * per_page
            notifications = await self.collection.find(query).sort("created_at", -1).skip(skip).limit(per_page).to_list(None)
            
            # Convert ObjectId to string and add acceptance stats
            for notification in notifications:
                notification["_id"] = str(notification["_id"])
                
                # Calculate acceptance statistics
                accepted_count = len(notification.get("accepted_by", []))
                
                # Calculate current targeted users dynamically instead of using stored count
                total_users = await self.calculate_current_target_users(notification)
                pending_count = max(0, total_users - accepted_count)
                
                notification["acceptance_stats"] = {
                    "accepted_count": accepted_count,
                    "pending_count": pending_count,
                    "total_users": total_users,
                    "acceptance_rate": (accepted_count / total_users * 100) if total_users > 0 else 0
                }
                
            return notifications, total
            
        except Exception as e:
            print(f"[ERROR] Failed to get all notifications: {e}")
            return [], 0
            
    async def deactivate_notification(self, notification_id: str) -> bool:
        """
        Deactivate a notification (stops showing to users)
        
        Args:
            notification_id: Notification ID
            
        Returns:
            bool: Success status
        """
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(notification_id)},
                {"$set": {"is_active": False, "deactivated_at": datetime.now()}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"[ERROR] Failed to deactivate notification {notification_id}: {e}")
            return False
            
    async def activate_notification(self, notification_id: str) -> bool:
        """
        Activate a notification (makes it show to users again)
        
        Args:
            notification_id: Notification ID
            
        Returns:
            bool: Success status
        """
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(notification_id)},
                {"$set": {"is_active": True}, "$unset": {"deactivated_at": ""}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"[ERROR] Failed to activate notification {notification_id}: {e}")
            return False
    
    async def delete_notification(self, notification_id: str) -> bool:
        """
        Permanently delete a notification from database
        
        Args:
            notification_id: Notification ID
            
        Returns:
            bool: Success status
        """
        try:
            result = await self.collection.delete_one(
                {"_id": ObjectId(notification_id)}
            )
            
            return result.deleted_count > 0
            
        except Exception as e:
            print(f"[ERROR] Failed to delete notification {notification_id}: {e}")
            return False
            
    async def update_total_users_count(self, notification_id: str, total_users: int) -> bool:
        """
        Update the total active users count for a notification
        
        Args:
            notification_id: Notification ID
            total_users: Total number of active users when notification was sent
            
        Returns:
            bool: Success status
        """
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(notification_id)},
                {"$set": {"total_active_users": total_users}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"[ERROR] Failed to update users count for notification {notification_id}: {e}")
            return False
            
    async def get_notification_history(self, notification_id: str) -> Dict[str, Any]:
        """
        Get detailed history of who accepted a notification
        
        Args:
            notification_id: Notification ID
            
        Returns:
            Dict with notification details and acceptance history
        """
        try:
            notification = await self.collection.find_one({"_id": ObjectId(notification_id)})
            
            if not notification:
                return {}
                
            notification["_id"] = str(notification["_id"])
            
            # Sort accepted_by list by acceptance time
            accepted_by = notification.get("accepted_by", [])
            accepted_by.sort(key=lambda x: x.get("accepted_at", datetime.min), reverse=True)
            notification["accepted_by"] = accepted_by
            
            # Add statistics
            accepted_count = len(accepted_by)
            
            # Calculate current targeted users dynamically instead of using stored count
            total_users = await self.calculate_current_target_users(notification)
            pending_count = max(0, total_users - accepted_count)
            
            notification["acceptance_stats"] = {
                "accepted_count": accepted_count,
                "pending_count": pending_count,
                "total_users": total_users,
                "acceptance_rate": (accepted_count / total_users * 100) if total_users > 0 else 0
            }
            
            return notification
            
        except Exception as e:
            print(f"[ERROR] Failed to get notification history {notification_id}: {e}")
            return {}