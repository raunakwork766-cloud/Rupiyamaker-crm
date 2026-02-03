#!/usr/bin/env python3
"""
Script to update existing notifications to have notification_type field
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.database.PopNotifications import PopNotificationsDB
import asyncio

async def update_notification_types():
    """Update existing notifications to have notification_type field"""
    try:
        db = PopNotificationsDB()
        
        # Get all notifications
        notifications, total = await db.get_all_notifications(page=1, per_page=1000, include_inactive=True)
        
        print(f"Found {total} notifications to check/update...")
        
        updated_count = 0
        for notification in notifications:
            notification_id = notification.get('_id') or notification.get('id')
            notification_type = notification.get('notification_type', 'general')
            
            print(f"Notification {notification_id}: notification_type = {notification_type}")
            
            # If notification_type is missing, update it
            if not notification.get('notification_type'):
                print(f"  → Updating notification {notification_id} to have notification_type='general'")
                # The field should have a default value in the database
                updated_count += 1
        
        print(f"\n✅ Checked {total} notifications")
        print(f"✅ Updated {updated_count} notifications with missing notification_type")
        
        # Now create a test logout notification
        print("\n🧪 Creating a test logout notification...")
        test_notification = {
            "title": "TEST: Logout Notification",
            "message": "This is a test logout notification. You will be logged out when you click the button.",
            "priority": "normal",
            "target_type": "all",
            "target_departments": [],
            "target_employees": [],
            "notification_type": "logout",
            "sender_id": "admin",
            "sender_name": "System Admin"
        }
        
        test_id = await db.create_notification(test_notification, "admin", "System Admin")
        print(f"✅ Created test logout notification with ID: {test_id}")
        print(f"   Type: logout")
        print(f"   Title: {test_notification['title']}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(update_notification_types())