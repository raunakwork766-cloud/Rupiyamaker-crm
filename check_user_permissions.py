#!/usr/bin/env python3
"""Find specific user and their permissions"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

MONGO_URI = "mongodb+srv://raunak:3GqXjkB2Q040w4YG@rupiyamakler.htepor1.mongodb.net/?retryWrites=true&w=majority&appName=rupiyamakler"
DATABASE_NAME = "crm_database"

async def find_user_permissions():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DATABASE_NAME]
    users_collection = db.users
    roles_collection = db.roles
    
    print("=" * 80)
    print("USER PERMISSION CHECKER")
    print("=" * 80)
    print()
    
    # Search for user (case insensitive)
    search_name = input("Enter username to search (e.g., KAJAL RAJPUT): ").strip()
    
    if not search_name:
        search_name = "KAJAL"
    
    print(f"\n🔍 Searching for users matching: {search_name}")
    print()
    
    users = await users_collection.find({
        "$or": [
            {"name": {"$regex": search_name, "$options": "i"}},
            {"username": {"$regex": search_name, "$options": "i"}},
            {"email": {"$regex": search_name, "$options": "i"}}
        ]
    }).to_list(length=20)
    
    if not users:
        print(f"❌ No users found matching '{search_name}'")
        client.close()
        return
    
    print(f"✅ Found {len(users)} user(s):")
    print()
    
    for user in users:
        name = user.get("name", "Unknown")
        username = user.get("username", "N/A")
        email = user.get("email", "N/A")
        designation = user.get("designation", "N/A")
        role_id = user.get("role_id")
        user_id = user.get("_id")
        
        print(f"👤 User: {name}")
        print(f"   Username: {username}")
        print(f"   Email: {email}")
        print(f"   Designation: {designation}")
        print(f"   User ID: {user_id}")
        print(f"   Role ID: {role_id}")
        print()
        
        if role_id:
            # Get role details
            if isinstance(role_id, str):
                role_id_obj = ObjectId(role_id)
            else:
                role_id_obj = role_id
            
            role = await roles_collection.find_one({"_id": role_id_obj})
            
            if role:
                role_name = role.get("name", "Unknown")
                permissions = role.get("permissions", [])
                
                print(f"   🎭 Role: {role_name}")
                print(f"   📋 Total Permissions: {len(permissions)}")
                print()
                
                # Find leads permission
                leads_perm = None
                for perm in permissions:
                    if perm.get("page", "").lower() == "leads":
                        leads_perm = perm
                        break
                
                if leads_perm:
                    print("   📋 Leads Permissions:")
                    actions = leads_perm.get("actions", [])
                    
                    if isinstance(actions, str):
                        if actions == "*":
                            print("      🚨 ALL permissions (*)")
                        else:
                            print(f"      - {actions}")
                    elif isinstance(actions, list):
                        has_delete = False
                        for action in actions:
                            icon = "🚨" if action == "delete" else "✅"
                            if action == "delete":
                                has_delete = True
                            print(f"      {icon} {action}")
                        
                        if has_delete:
                            print()
                            print("      ⚠️  WARNING: User has DELETE permission!")
                        else:
                            print()
                            print("      ✅ User does NOT have delete permission")
                else:
                    print("   ⚠️  No Leads permission found for this role")
                
                # Show all permissions
                print()
                print("   📋 All Permissions:")
                for perm in permissions:
                    page = perm.get("page", "Unknown")
                    actions = perm.get("actions", [])
                    if isinstance(actions, list):
                        actions_str = ", ".join(actions[:5])
                        if len(actions) > 5:
                            actions_str += f"... (+{len(actions)-5} more)"
                    else:
                        actions_str = str(actions)
                    print(f"      - {page}: {actions_str}")
            else:
                print(f"   ❌ Role not found (ID: {role_id})")
        else:
            print("   ⚠️  No role assigned to this user")
        
        print()
        print("-" * 80)
        print()
    
    client.close()

if __name__ == "__main__":
    try:
        asyncio.run(find_user_permissions())
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
