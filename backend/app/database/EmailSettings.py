from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from bson import ObjectId
from datetime import datetime

class EmailSettingsDB:
    def __init__(self, database=None):
        # Use the provided database or default to the centralized async db
        if database is not None:
            self.db = database
        else:
            # Import async_db instead of sync db
            from app.database import async_db
            self.db = async_db
        self.collection = self.db.email_settings

    async def _async_to_list(self, cursor):
        """Convert async cursor to list"""
        result = []
        async for document in cursor:
            result.append(document)
        return result

    async def init_indexes(self):
        """Initialize database indexes"""
        try:
            # Create indexes for faster lookups
            await self.collection.create_index("email", unique=True)
            await self.collection.create_index("purpose")
        except Exception as e:
            print(f"EmailSettingsDB index creation warning: {e}")

    async def create_email_setting(self, email_data):
        """Create a new email setting"""
        try:
            email_setting = {
                "email": email_data["email"],
                "password": email_data["password"],
                "smtp_server": email_data.get("smtp_server", "smtp.gmail.com"),
                "smtp_port": email_data.get("smtp_port", 587),
                "use_ssl": email_data.get("use_ssl", True),
                "is_active": email_data.get("is_active", True),
                "purpose": email_data.get("purpose", "otp"),  # otp, notifications, etc.
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            result = await self.collection.insert_one(email_setting)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating email setting: {e}")
            return None

    async def get_email_settings(self):
        """Get all email settings"""
        try:
            return await self._async_to_list(self.collection.find({}))
        except Exception as e:
            print(f"Error getting email settings: {e}")
            return []

    async def get_active_otp_email(self):
        """Get active email setting for OTP"""
        try:
            return await self.collection.find_one({
                "purpose": "otp",
                "is_active": True
            })
        except Exception as e:
            print(f"Error getting active OTP email: {e}")
            return None

    async def update_email_setting(self, setting_id, update_data):
        """Update email setting"""
        try:
            update_data["updated_at"] = datetime.now()
            result = await self.collection.update_one(
                {"_id": ObjectId(setting_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating email setting: {e}")
            return False

    async def delete_email_setting(self, setting_id):
        """Delete email setting"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(setting_id)})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting email setting: {e}")
            return False

    async def get_email_setting(self, setting_id):
        """Get specific email setting by ID"""
        try:
            return await self.collection.find_one({"_id": ObjectId(setting_id)})
        except Exception as e:
            print(f"Error getting email setting: {e}")
            return None
