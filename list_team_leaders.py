#!/usr/bin/env python3
"""List all Team Leader users"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

MONGO_URI = "mongodb+srv://raunak:3GqXjkB2Q040w4YG@rupiyamakler.htepor1.mongodb.net/?retryWrites=true&w=majority&appName=rupiyamakler"
DATABASE_NAME = "crm_database"

async def list_team_leaders():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DATABASE_NAME]
    users_collection = db.users
    roles_collection = db.roles
    
    print("=" * 80)
    print("TEAM LEADER USERS LIST")
    print("=" * 80)
    print()
    
    # Find all Team Leader roles
    tl_roles = await roles_collection.find({
        "name": {"$regex": "team.*leader", "$options": "i"}
    }).to_list(length=None)
    
    if not tl_roles:
        print("❌ No Team Leader roles found")
        client.close()
        return
    
    tl_role_ids = [role["_id"] for role in tl_roles]
    
    print(f"✅ Found {len(tl_roles)} Team Leader role(s):")
    for role in tl_roles:
        print(f"   - {role['name']} (ID: {role['_id']})")
    print()
    
    # Find all users with these roles
    users = await users_collection.find({
        "role_id": {"$in": [str(rid) for rid in tl_role_ids]}
    }).to_list(length=None)
    
    print(f"✅ Found {len(users)} Team Leader user(s):")
    print()
    
    for idx, user in enumerate(users, 1):
        name = user.get("name", "Unknown")
        username = user.get("username", "N/A")
        designation = user.get("designation", "N/A")
        role_id = user.get("role_id")
        
        # Get role name
        role_name = "Unknown"
        for role in tl_roles:
            if str(role["_id"]) == role_id or role["_id"] == role_id:
                role_name = role["name"]
                break
        
        print(f"{idx}. {name}")
        print(f"   Username: {username}")
        print(f"   Designation: {designation}")
        print(f"   Role: {role_name}")
        print()
    
    # Also search by designation
    print("-" * 80)
    print("🔍 Also checking users with 'Team Leader' in designation:")
    print()
    
    designation_tls = await users_collection.find({
        "designation": {"$regex": "team.*leader", "$options": "i"}
    }).to_list(length=None)
    
    if designation_tls:
        print(f"✅ Found {len(designation_tls)} user(s) with Team Leader designation:")
        print()
        
        for idx, user in enumerate(designation_tls, 1):
            name = user.get("name", "Unknown")
            username = user.get("username", "N/A")
            designation = user.get("designation", "N/A")
            role_id = user.get("role_id")
            
            # Get role
            if role_id:
                if isinstance(role_id, str):
                    role_id_obj = ObjectId(role_id)
                else:
                    role_id_obj = role_id
                
                role = await roles_collection.find_one({"_id": role_id_obj})
                role_name = role.get("name", "Unknown") if role else "No Role"
                
                # Check if this role has delete permission
                has_delete = False
                if role and role.get("permissions"):
                    for perm in role.get("permissions", []):
                        if perm.get("page", "").lower() == "leads":
                            actions = perm.get("actions", [])
                            if isinstance(actions, list) and "delete" in actions:
                                has_delete = True
                            elif actions == "*":
                                has_delete = True
            else:
                role_name = "No Role"
                has_delete = False
            
            delete_icon = "🚨" if has_delete else "✅"
            print(f"{idx}. {name} {delete_icon}")
            print(f"   Username: {username}")
            print(f"   Designation: {designation}")
            print(f"   Role: {role_name}")
            if has_delete:
                print(f"   ⚠️  HAS DELETE PERMISSION!")
            print()
    else:
        print("❌ No users found with Team Leader designation")
    
    client.close()

if __name__ == "__main__":
    try:
        asyncio.run(list_team_leaders())
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
