#!/usr/bin/env python3
import asyncio
import sys

# Add the backend directory to the Python path
sys.path.append('/home/ubuntu/RupiyaMe/backend')

from motor.motor_asyncio import AsyncIOMotorClient

async def fix_latest_status():
    """Fix the most recently created status to have Complete type"""
    try:
        # Connect to MongoDB Atlas
        mongo_uri = "mongodb+srv://raunak:3GqXjkB2Q040w4YG@rupiyamakler.htepor1.mongodb.net/?retryWrites=true&w=majority&appName=rupiyamakler"
        client = AsyncIOMotorClient(mongo_uri)
        db = client.crm_database
        collection = db.interview_statuses
        
        # Find the most recently created status
        latest_status = await collection.find().sort("created_at", -1).limit(1).to_list(length=1)
        
        if latest_status:
            status = latest_status[0]
            print(f"📋 Latest status: '{status['name']}'")
            print(f"   Current statusType: {status.get('statusType', 'None')}")
            
            if not status.get('statusType') or status.get('statusType') == 'Open':
                # Update to Complete
                result = await collection.update_one(
                    {"_id": status["_id"]},
                    {"$set": {"statusType": "Complete"}}
                )
                
                if result.modified_count > 0:
                    print(f"✅ Updated '{status['name']}' to statusType: Complete")
                    print("🔄 Now refresh Interview Settings page to see the blue badge!")
                else:
                    print("❌ Failed to update status")
            else:
                print(f"ℹ️ Status already has statusType: {status['statusType']}")
        else:
            print("❌ No statuses found")
            
        client.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_latest_status())