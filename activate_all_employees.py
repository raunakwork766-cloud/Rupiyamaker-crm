import asyncio
import sys
sys.path.append('/www/wwwroot/RupiyaMe/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import Config

async def activate_all_employees():
    """Activate all inactive employees"""
    client = AsyncIOMotorClient(Config.MONGO_URI)
    db = client[Config.COMPANY_NAME]
    users_collection = db["users"]
    
    print("🔄 Activating all inactive employees...")
    print("=" * 50)
    
    # Count inactive employees
    inactive_count = await users_collection.count_documents({
        "is_employee": True,
        "employee_status": "inactive"
    })
    
    print(f"📊 Found {inactive_count} inactive employees")
    
    if inactive_count == 0:
        print("✅ All employees are already active!")
        client.close()
        return
    
    # Update all inactive employees to active
    result = await users_collection.update_many(
        {
            "is_employee": True,
            "employee_status": "inactive"
        },
        {
            "$set": {
                "employee_status": "active"
            }
        }
    )
    
    print(f"✅ Activated {result.modified_count} employees")
    
    # Verify
    active_count = await users_collection.count_documents({
        "is_employee": True,
        "employee_status": "active"
    })
    
    print(f"📊 Total active employees now: {active_count}")
    print("=" * 50)
    print("✅ All employees can now login!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(activate_all_employees())
