#!/usr/bin/env python3
import asyncio
import sys

# Add the backend directory to the Python path
sys.path.append('/home/ubuntu/RupiyaMe/backend')

from motor.motor_asyncio import AsyncIOMotorClient

async def add_status_type_field():
    """Add statusType field to existing status documents"""
    try:
        # Connect to MongoDB Atlas (same as backend)
        mongo_uri = "mongodb+srv://raunak:3GqXjkB2Q040w4YG@rupiyamakler.htepor1.mongodb.net/?retryWrites=true&w=majority&appName=rupiyamakler"
        client = AsyncIOMotorClient(mongo_uri)
        db = client.crm_database
        collection = db.interview_statuses
        
        print("🔧 Adding statusType field to existing status documents...")
        
        # Update all documents that don't have statusType field
        result = await collection.update_many(
            {"statusType": {"$exists": False}},  # Find docs without statusType
            {"$set": {"statusType": "Open"}}     # Add statusType: "Open" as default
        )
        
        print(f"✅ Updated {result.modified_count} documents with statusType field")
        
        # Verify the update
        documents = await collection.find({}).to_list(length=None)
        print(f"\n🔍 Verification - Found {len(documents)} status documents:")
        
        for i, doc in enumerate(documents):
            print(f"  {i+1}. {doc.get('name')}: statusType={doc.get('statusType')}")
            
        client.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(add_status_type_field())