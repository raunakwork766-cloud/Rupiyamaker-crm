#!/usr/bin/env python3
import asyncio
import sys
from datetime import datetime, timedelta

# Add the backend directory to the Python path
sys.path.append('/home/ubuntu/RupiyaMe/backend')

from motor.motor_asyncio import AsyncIOMotorClient

async def fix_recent_statuses():
    """Fix recently created statuses that are missing statusType"""
    try:
        # Connect to MongoDB Atlas
        mongo_uri = "mongodb+srv://raunak:3GqXjkB2Q040w4YG@rupiyamakler.htepor1.mongodb.net/?retryWrites=true&w=majority&appName=rupiyamakler"
        client = AsyncIOMotorClient(mongo_uri)
        db = client.crm_database
        collection = db.interview_statuses
        
        # Find statuses created in the last 5 minutes that don't have statusType
        five_minutes_ago = datetime.now() - timedelta(minutes=5)
        
        recent_without_type = await collection.find({
            "statusType": {"$exists": False},
            "created_at": {"$gte": five_minutes_ago}
        }).to_list(length=None)
        
        if recent_without_type:
            print(f"🔧 Found {len(recent_without_type)} recent statuses without statusType")
            
            for status in recent_without_type:
                # For now, let's assume if user creates a status, they want it as Complete
                # You can modify this logic based on naming patterns or other criteria
                result = await collection.update_one(
                    {"_id": status["_id"]},
                    {"$set": {"statusType": "Complete"}}
                )
                
                if result.modified_count > 0:
                    print(f"✅ Updated '{status['name']}' to statusType: Complete")
        else:
            print("ℹ️ No recent statuses found that need fixing")
            
        client.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_recent_statuses())