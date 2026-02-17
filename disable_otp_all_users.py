import asyncio
import sys
sys.path.append('/www/wwwroot/RupiyaMe/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import Config

async def disable_otp_for_all():
    """Disable OTP requirement for all users to allow easy login"""
    client = AsyncIOMotorClient(Config.MONGO_URI)
    db = client[Config.COMPANY_NAME]
    users_collection = db["users"]
    
    print("🔄 Disabling OTP requirement for all users...")
    print("=" * 50)
    
    # Count users with OTP required
    otp_required_count = await users_collection.count_documents({
        "$or": [
            {"otp_required": True},
            {"otp_required": {"$exists": False}}  # Default is True
        ]
    })
    
    print(f"📊 Found {otp_required_count} users with OTP required")
    
    # Update all users to disable OTP
    result = await users_collection.update_many(
        {},
        {
            "$set": {
                "otp_required": False
            }
        }
    )
    
    print(f"✅ Updated {result.modified_count} users")
    print("=" * 50)
    print("✅ OTP disabled for all users - Direct login with username/password now!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(disable_otp_for_all())
