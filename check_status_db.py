#!/usr/bin/env python3
import asyncio
import os
import sys

# Add the backend directory to the Python path
sys.path.append('/home/ubuntu/RupiyaMe/backend')

from motor.motor_asyncio import AsyncIOMotorClient

async def check_status_documents():
    """Check what status documents look like in the database"""
    try:
        # Connect to MongoDB Atlas (same as backend)
        mongo_uri = "mongodb+srv://raunak:3GqXjkB2Q040w4YG@rupiyamakler.htepor1.mongodb.net/?retryWrites=true&w=majority&appName=rupiyamakler"
        client = AsyncIOMotorClient(mongo_uri)
        db = client.crm_database
        collection = db.interview_statuses
        
        print("🔍 Checking interview_statuses collection...")
        
        # Get all status documents
        documents = await collection.find({}).to_list(length=None)
        
        print(f"Found {len(documents)} status documents:")
        
        for i, doc in enumerate(documents):
            print(f"\nDocument {i+1}:")
            print(f"  _id: {doc.get('_id')}")
            print(f"  name: {doc.get('name')}")
            print(f"  statusType: {doc.get('statusType')}")
            print(f"  description: {doc.get('description')}")
            print(f"  user_id: {doc.get('user_id')}")
            print(f"  All fields: {list(doc.keys())}")
            
        client.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_status_documents())