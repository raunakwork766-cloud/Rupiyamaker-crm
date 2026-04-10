#!/usr/bin/env python3
"""
Fix Team Winners Team Leader Role - Remove Delete Permissions
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import sys

# Add parent directory to path to import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import Config

# MongoDB connection settings from config
MONGODB_URL = Config.MONGO_URI
DATABASE_NAME = Config.COMPANY_NAME

async def fix_team_winners_role():
    """Find and fix Team Winners Team Leader role by removing delete permissions"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    roles_collection = db.roles
    
    print("=" * 80)
    print("FIXING TEAM WINNERS TEAM LEADER ROLE - REMOVE DELETE PERMISSIONS")
    print("=" * 80)
    print()
    
    # Search for the role (case-insensitive)
    role_name_pattern = "Team winners team leader"
    
    print(f"🔍 Searching for role: '{role_name_pattern}' (case-insensitive)...")
    print()
    
    # Try case-insensitive search
    role = await roles_collection.find_one({
        "name": {"$regex": "^team winners team leader$", "$options": "i"}
    })
    
    if not role:
        # Try broader search
        print("⚠️  Exact match not found. Searching for roles containing 'team winners'...")
        cursor = roles_collection.find({
            "name": {"$regex": "team winners", "$options": "i"}
        })
        
        roles = await cursor.to_list(length=100)
        
        if not roles:
            print("❌ No roles found containing 'team winners'")
            print()
            print("📋 Listing ALL roles in database:")
            print("-" * 80)
            
            all_roles = await roles_collection.find({}).to_list(length=100)
            if not all_roles:
                print("⚠️  No roles found in database!")
            else:
                for r in all_roles:
                    print(f"  • ID: {r.get('_id')}")
                    print(f"    Name: {r.get('name')}")
                    print(f"    Permissions: {len(r.get('permissions', []))} items")
                    print()
            
            return
        
        print(f"✅ Found {len(roles)} role(s) containing 'team winners':")
        print()
        
        for idx, r in enumerate(roles, 1):
            print(f"{idx}. Name: {r.get('name')}")
            print(f"   ID: {r.get('_id')}")
            print(f"   Permissions: {len(r.get('permissions', []))} items")
            print()
        
        # Use the first one if it's the only one, otherwise ask
        if len(roles) == 1:
            role = roles[0]
            print(f"✅ Using role: {role.get('name')}")
        else:
            print("⚠️  Multiple roles found. Using first one for safety.")
            role = roles[0]
    else:
        print(f"✅ Found role: {role.get('name')}")
    
    print()
    print("=" * 80)
    print("CURRENT PERMISSIONS:")
    print("=" * 80)
    print()
    
    permissions = role.get('permissions', [])
    
    if not permissions:
        print("⚠️  No permissions found for this role!")
        return
    
    has_delete = False
    for perm in permissions:
        page = perm.get('page', 'unknown')
        actions = perm.get('actions', [])
        
        if isinstance(actions, str):
            actions = [actions]
        
        print(f"📄 Page: {page}")
        print(f"   Actions: {', '.join(actions)}")
        
        if 'delete' in actions:
            print(f"   ⚠️  HAS DELETE PERMISSION")
            has_delete = True
        
        print()
    
    if not has_delete:
        print("✅ No delete permissions found! Role is already clean.")
        return
    
    print()
    print("=" * 80)
    print("FIXING PERMISSIONS - REMOVING DELETE")
    print("=" * 80)
    print()
    
    # Remove delete from all permissions
    new_permissions = []
    changes_made = 0
    
    for perm in permissions:
        page = perm.get('page', 'unknown')
        actions = perm.get('actions', [])
        
        if isinstance(actions, str):
            actions = [actions]
        
        # Filter out 'delete'
        original_count = len(actions)
        filtered_actions = [a for a in actions if a != 'delete']
        
        if len(filtered_actions) < original_count:
            changes_made += 1
            print(f"✂️  Removed 'delete' from page: {page}")
        
        # Only add back if there are still actions left
        if filtered_actions:
            new_permissions.append({
                'page': page,
                'actions': filtered_actions
            })
        else:
            print(f"⚠️  Page {page} has no actions left after removing delete, skipping...")
    
    print()
    print(f"📊 Summary:")
    print(f"   • Original permissions: {len(permissions)}")
    print(f"   • New permissions: {len(new_permissions)}")
    print(f"   • Changes made: {changes_made}")
    print()
    
    if changes_made == 0:
        print("✅ No changes needed!")
        return
    
    # Update the role
    result = await roles_collection.update_one(
        {"_id": role['_id']},
        {"$set": {"permissions": new_permissions}}
    )
    
    if result.modified_count > 0:
        print("✅ SUCCESS! Role updated successfully!")
        print()
        print("=" * 80)
        print("NEW PERMISSIONS:")
        print("=" * 80)
        print()
        
        for perm in new_permissions:
            page = perm.get('page', 'unknown')
            actions = perm.get('actions', [])
            print(f"📄 Page: {page}")
            print(f"   Actions: {', '.join(actions)}")
            print()
        
        print("=" * 80)
        print("✅ COMPLETE - Team Winners Team Leader role fixed!")
        print("=" * 80)
        print()
        print("⚠️  IMPORTANT: Users with this role need to:")
        print("   1. Log out completely")
        print("   2. Clear browser cache (Ctrl+F5)")
        print("   3. Log back in")
        print()
    else:
        print("⚠️  Warning: No documents were modified")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_team_winners_role())
