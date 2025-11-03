#!/usr/bin/env python3
import asyncio
import sys
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append('/home/ubuntu/RupiyaMe/backend')

from motor.motor_asyncio import AsyncIOMotorClient

async def create_complete_status_manually():
    """Create a status with Complete type directly in database"""
    try:
        # Connect to MongoDB Atlas (same as backend)
        mongo_uri = "mongodb+srv://raunak:3GqXjkB2Q040w4YG@rupiyamakler.htepor1.mongodb.net/?retryWrites=true&w=majority&appName=rupiyamakler"
        client = AsyncIOMotorClient(mongo_uri)
        db = client.crm_database
        collection = db.interview_statuses
        
        print("🔧 Creating a test status with Complete type directly in database...")
        
        # Create a status document with statusType: "Complete"
        status_doc = {
            "name": "Interview Completed",
            "statusType": "Complete",  # This is the key field
            "description": "Status for completed interviews",
            "is_active": True,
            "user_id": "68a31b405091277edc042d45",
            "created_at": datetime.now()
        }
        
        result = await collection.insert_one(status_doc)
        print(f"✅ Created status with ID: {result.inserted_id}")
        
        # Verify it was saved correctly
        saved_doc = await collection.find_one({"_id": result.inserted_id})
        print(f"🔍 Verification - Saved document:")
        print(f"   Name: {saved_doc.get('name')}")
        print(f"   StatusType: {saved_doc.get('statusType')}")
        print(f"   All fields: {list(saved_doc.keys())}")
        
        client.close()
        
        print("\n🎯 Now please:")
        print("1. Refresh the Interview Settings page")
        print("2. Check if 'Interview Completed' shows with blue 'Complete' badge")
        print("3. Try using this status for an interview and see if it appears in Complete tab")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(create_complete_status_manually())