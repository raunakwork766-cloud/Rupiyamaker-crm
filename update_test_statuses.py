#!/usr/bin/env python3
import asyncio
import sys

# Add the backend directory to the Python path
sys.path.append('/home/ubuntu/RupiyaMe/backend')

from motor.motor_asyncio import AsyncIOMotorClient

async def update_test_statuses():
    """Update the test statuses to have Complete type"""
    try:
        # Connect to MongoDB Atlas (same as backend)
        mongo_uri = "mongodb+srv://raunak:3GqXjkB2Q040w4YG@rupiyamakler.htepor1.mongodb.net/?retryWrites=true&w=majority&appName=rupiyamakler"
        client = AsyncIOMotorClient(mongo_uri)
        db = client.crm_database
        collection = db.interview_statuses
        
        print("🔧 Updating test statuses to have Complete type...")
        
        # List of test status names to update to Complete
        test_names = ["fdhjgyfch", "fgnfhgjn", "jgfdsgdcvb", "TEST_COMPLETE_STATUS"]
        
        for name in test_names:
            result = await collection.update_one(
                {"name": name},
                {"$set": {"statusType": "Complete"}}
            )
            if result.modified_count > 0:
                print(f"✅ Updated '{name}' to statusType: Complete")
            else:
                print(f"⚠️ Status '{name}' not found or already updated")
        
        # Show all statuses and their types
        print("\n🔍 Current status list:")
        documents = await collection.find({}).to_list(length=None)
        
        for doc in documents:
            status_type = doc.get('statusType', 'None')
            badge = "🔵" if status_type == "Complete" else "🟢" if status_type == "Open" else "⚪"
            print(f"  {badge} {doc.get('name')}: {status_type}")
            
        client.close()
        
        print(f"\n🎯 Now you have multiple 'Complete' type statuses to test with!")
        print("Refresh Interview Settings to see the blue badges.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(update_test_statuses())