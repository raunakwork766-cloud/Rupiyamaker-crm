from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from bson import ObjectId
from datetime import datetime, timedelta
import random
import string

class OTPDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db.otp_records
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for better performance
            await self.collection.create_index("user_id")
            await self.collection.create_index("created_at")
            await self.collection.create_index("expires_at")
            print("✓ OTP database indexes created successfully")
        except Exception as e:
            print(f"OTP index creation warning (may already exist): {e}")

    async def generate_otp(self):
        """Generate a 6-digit OTP"""
        return ''.join(random.choices(string.digits, k=6))

    async def create_otp(self, user_id, user_data):
        """Create a new OTP record for user login"""
        try:
            # Delete any existing OTP for this user
            await self.collection.delete_many({"user_id": user_id})
            
            # Generate new OTP
            otp_code = self.generate_otp()
            
            # Calculate expiry time (30 minutes from now)
            expiry_time = datetime.now() + timedelta(minutes=30)
            
            otp_record = {
                "user_id": user_id,
                "employee_first_name": user_data.get("first_name", ""),
                "employee_last_name": user_data.get("last_name", ""),
                "employee_id": user_data.get("employee_id", user_id),
                "otp_code": otp_code,
                "created_at": datetime.now(),
                "expires_at": expiry_time,
                "is_used": False,
                "attempts": 0,
                "max_attempts": 3
            }
            
            result = await self.collection.insert_one(otp_record)
            return str(result.inserted_id), otp_code
            
        except Exception as e:
            print(f"Error creating OTP: {e}")
            return None, None

    async def verify_otp(self, user_id, otp_code):
        """Verify OTP code for user"""
        try:
            # Find active OTP for user
            otp_record = await self.collection.find_one({
                "user_id": user_id,
                "is_used": False,
                "expires_at": {"$gt": datetime.now()}
            })
            
            if not otp_record:
                return False, "OTP not found or expired"
            
            # Check if max attempts exceeded
            if otp_record["attempts"] >= otp_record["max_attempts"]:
                return False, "Maximum OTP attempts exceeded"
            
            # Increment attempt count
            await self.collection.update_one(
                {"_id": otp_record["_id"]},
                {"$inc": {"attempts": 1}}
            )
            
            # Check if OTP matches
            if otp_record["otp_code"] == otp_code:
                # Mark OTP as used
                await self.collection.update_one(
                    {"_id": otp_record["_id"]},
                    {"$set": {"is_used": True, "used_at": datetime.now()}}
                )
                return True, "OTP verified successfully"
            else:
                return False, "Invalid OTP code"
                
        except Exception as e:
            print(f"Error verifying OTP: {e}")
            return False, "Error verifying OTP"

    async def cleanup_expired_otps(self):
        """Remove expired OTP records"""
        try:
            result = await self.collection.delete_many({
                "expires_at": {"$lt": datetime.now()}
            })
            print(f"Cleaned up {result.deleted_count} expired OTP records")
        except Exception as e:
            print(f"Error cleaning up expired OTPs: {e}")

    async def get_otp_record(self, user_id):
        """Get active OTP record for user"""
        try:
            return await self.collection.find_one({
                "user_id": user_id,
                "is_used": False,
                "expires_at": {"$gt": datetime.now()}
            })
        except Exception as e:
            print(f"Error getting OTP record: {e}")
            return None
