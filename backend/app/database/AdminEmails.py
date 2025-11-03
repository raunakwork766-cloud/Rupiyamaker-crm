from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from bson import ObjectId
from datetime import datetime

class AdminEmailsDB:
    def __init__(self, database=None):
        # Use the provided database or default to the centralized async db
        if database is not None:
            self.db = database
        else:
            # Import async_db instead of sync db
            from app.database import async_db
            self.db = async_db
        self.collection = self.db.admin_emails

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
        except Exception as e:
            print(f"AdminEmailsDB index creation warning: {e}")

    async def create_admin_email(self, admin_email_data):
        """Create a new admin email"""
        try:
            # Set default values for simplified admin email
            admin_email_doc = {
                "email": admin_email_data.get("email"),
                "receive_otp": True,  # Default to receiving OTP
                "is_active": True,    # Default to active
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            result = await self.collection.insert_one(admin_email_doc)
            if result.inserted_id:
                return str(result.inserted_id)
            return None
        except Exception as e:
            print(f"Error creating admin email: {e}")
            return None

    async def get_admin_email_by_id(self, admin_email_id):
        """Get admin email by ID"""
        try:
            admin_email = await self.collection.find_one({"_id": ObjectId(admin_email_id)})
            return admin_email
        except Exception as e:
            print(f"Error getting admin email by ID: {e}")
            return None

    async def get_all_admin_emails(self):
        """Get all admin emails"""
        try:
            cursor = self.collection.find({}).sort("created_at", -1)
            return await cursor.to_list(None)
        except Exception as e:
            print(f"Error getting admin emails: {e}")
            return []

    async def get_admin_emails(self):
        """Get all admin emails"""
        try:
            return await self._async_to_list(self.collection.find({}))
        except Exception as e:
            print(f"Error getting admin emails: {e}")
            return []

    async def get_active_otp_admin_emails(self):
        """Get all active admin emails that should receive OTP codes"""
        try:
            return await self._async_to_list(self.collection.find({
                "is_active": True,
                "receive_otp": True
            }))
        except Exception as e:
            print(f"Error getting active OTP admin emails: {e}")
            return []

    async def update_admin_email(self, email_id, update_data):
        """Update admin email settings"""
        try:
            update_data["updated_at"] = datetime.now()
            result = await self.collection.update_one(
                {"_id": ObjectId(email_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating admin email: {e}")
            return False

    async def delete_admin_email(self, email_id):
        """Delete admin email"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(email_id)})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting admin email: {e}")
            return False

    async def get_admin_email(self, email_id):
        """Get specific admin email by ID"""
        try:
            return await self.collection.find_one({"_id": ObjectId(email_id)})
        except Exception as e:
            print(f"Error getting admin email: {e}")
            return None

    async def get_admin_email_by_address(self, email_address):
        """Get admin email by email address"""
        try:
            return await self.collection.find_one({"email": email_address})
        except Exception as e:
            print(f"Error getting admin email by address: {e}")
            return None

    async def get_admin_email_by_email(self, email):
        """Get admin email by email address (alias for consistency)"""
        try:
            return await self.collection.find_one({"email": email})
        except Exception as e:
            print(f"Error getting admin email by email: {e}")
            return None
