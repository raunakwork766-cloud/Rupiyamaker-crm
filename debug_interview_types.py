#!/usr/bin/env python3

import asyncio
import sys
import os
from bson import ObjectId

# Add the backend directory to the Python path
sys.path.append('/home/ubuntu/RupiyaMe/backend')

async def debug_interview_types():
    """Debug interview types in the database"""
    try:
        # Import the database functions
        from app.database.InterviewSettings import get_collections
        
        print("🔍 DEBUGGING INTERVIEW TYPES DATABASE")
        print("=" * 50)
        
        collections = get_collections()
        interview_types_collection = collections["interview_types"]
        
        # Check if the specific interview type exists
        target_id = "6898d2d64c7b27c3a2e4fa40"
        target_user = "68a31b405091277edc042d45"
        
        print(f"🎯 Looking for interview type ID: {target_id}")
        print(f"🎯 For user ID: {target_user}")
        print()
        
        # Check if it exists with the target user
        specific = await interview_types_collection.find_one({
            "_id": ObjectId(target_id),
            "user_id": target_user
        })
        
        if specific:
            print("✅ FOUND: Interview type exists for the target user:")
            print(f"   - ID: {specific['_id']}")
            print(f"   - Name: {specific.get('name', 'N/A')}")
            print(f"   - User ID: {specific.get('user_id', 'N/A')}")
        else:
            print("❌ NOT FOUND: Interview type not found for target user")
            
            # Check if it exists with any user
            any_user = await interview_types_collection.find_one({
                "_id": ObjectId(target_id)
            })
            
            if any_user:
                print("⚠️ FOUND WITH DIFFERENT USER:")
                print(f"   - ID: {any_user['_id']}")
                print(f"   - Name: {any_user.get('name', 'N/A')}")
                print(f"   - Actual User ID: {any_user.get('user_id', 'N/A')}")
                print(f"   - Expected User ID: {target_user}")
            else:
                print("❌ COMPLETELY NOT FOUND: Interview type doesn't exist at all")
        
        print()
        print("📋 ALL INTERVIEW TYPES FOR TARGET USER:")
        print("-" * 40)
        
        user_types = await interview_types_collection.find({"user_id": target_user}).to_list(length=None)
        
        if user_types:
            for i, itype in enumerate(user_types, 1):
                print(f"{i}. ID: {itype['_id']} | Name: {itype.get('name', 'N/A')}")
        else:
            print("❌ No interview types found for this user")
        
        print()
        print("📋 RECENT INTERVIEW TYPES (ALL USERS):")
        print("-" * 40)
        
        recent_types = await interview_types_collection.find().sort("created_at", -1).limit(5).to_list(length=None)
        
        if recent_types:
            for i, itype in enumerate(recent_types, 1):
                print(f"{i}. ID: {itype['_id']} | Name: {itype.get('name', 'N/A')} | User: {itype.get('user_id', 'N/A')}")
        else:
            print("❌ No interview types found in database")
            
    except Exception as e:
        print(f"💥 ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_interview_types())
