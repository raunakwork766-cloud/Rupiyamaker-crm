#!/usr/bin/env python3
"""Check MongoDB collections and find roles"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb+srv://raunak:3GqXjkB2Q040w4YG@rupiyamakler.htepor1.mongodb.net/?retryWrites=true&w=majority&appName=rupiyamakler"
DATABASE_NAME = "crm_database"

async def check_collections():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DATABASE_NAME]
    
    print("=" * 80)
    print("MONGODB COLLECTIONS CHECK")
    print("=" * 80)
    print()
    
    # List all collections
    collections = await db.list_collection_names()
    print(f"📋 Found {len(collections)} collections:")
    print()
    
    for coll_name in sorted(collections):
        count = await db[coll_name].count_documents({})
        print(f"   📦 {coll_name}: {count} documents")
        
        # If this looks like a roles collection, show sample
        if "role" in coll_name.lower():
            print(f"      👀 Sample document from {coll_name}:")
            sample = await db[coll_name].find_one({})
            if sample:
                print(f"         Keys: {list(sample.keys())}")
                if 'name' in sample:
                    print(f"         Name: {sample.get('name')}")
                if 'permissions' in sample:
                    perms = sample.get('permissions', [])
                    if isinstance(perms, list):
                        print(f"         Permissions count: {len(perms)}")
                        if perms:
                            print(f"         First permission: {perms[0]}")
    
    print()
    print("=" * 80)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_collections())
