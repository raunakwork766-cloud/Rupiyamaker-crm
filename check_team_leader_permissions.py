#!/usr/bin/env python3
"""
Team Leader Role Permission Checker and Fixer
This script checks if Team Leader roles have delete permission and removes it
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# MongoDB connection
MONGO_URI = "mongodb+srv://raunak:3GqXjkB2Q040w4YG@rupiyamakler.htepor1.mongodb.net/?retryWrites=true&w=majority&appName=rupiyamakler"
DATABASE_NAME = "crm_database"

async def check_and_fix_team_leader_permissions():
    """Check and fix Team Leader role permissions"""
    
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DATABASE_NAME]
    roles_collection = db.roles
    
    print("=" * 80)
    print("TEAM LEADER ROLE PERMISSION CHECKER")
    print("=" * 80)
    print()
    
    # Find all roles with "team leader" or "tl" in name (case insensitive)
    team_leader_roles = await roles_collection.find({
        "$or": [
            {"name": {"$regex": "team.*leader", "$options": "i"}},
            {"name": {"$regex": "^tl$", "$options": "i"}},
            {"name": {"$regex": "^tl ", "$options": "i"}}
        ]
    }).to_list(length=None)
    
    if not team_leader_roles:
        print("❌ No Team Leader roles found!")
        print("   Searching for ALL roles to help identify...")
        print()
        
        all_roles = await roles_collection.find({}).to_list(length=None)
        print(f"📋 Found {len(all_roles)} roles in database:")
        for role in all_roles:
            print(f"   - {role.get('name')} (ID: {role.get('_id')})")
        
        print()
        print("💡 If you see your Team Leader role above, edit this script and search for it manually")
        return
    
    print(f"✅ Found {len(team_leader_roles)} Team Leader role(s)")
    print()
    
    for role in team_leader_roles:
        role_name = role.get("name", "Unknown")
        role_id = role.get("_id")
        permissions = role.get("permissions", [])
        
        print(f"🔍 Checking Role: {role_name}")
        print(f"   ID: {role_id}")
        print(f"   Total Permissions: {len(permissions)}")
        print()
        
        # Find leads permission
        leads_permission = None
        leads_index = -1
        
        for idx, perm in enumerate(permissions):
            page = perm.get("page", "").lower()
            if page == "leads":
                leads_permission = perm
                leads_index = idx
                break
        
        if not leads_permission:
            print("   ⚠️  No Leads permission found")
            print()
            continue
        
        print("   📋 Current Leads Permissions:")
        actions = leads_permission.get("actions", [])
        
        if isinstance(actions, str):
            if actions == "*":
                print("      ⚠️  Actions: * (ALL permissions)")
            else:
                print(f"      - {actions}")
        elif isinstance(actions, list):
            for action in actions:
                icon = "❌" if action == "delete" else "✅"
                print(f"      {icon} {action}")
        
        print()
        
        # Check if delete permission exists
        has_delete = False
        if isinstance(actions, str) and actions == "*":
            has_delete = True
            print("   🚨 PROBLEM: Role has ALL (*) permissions (includes delete)")
        elif isinstance(actions, list) and "delete" in actions:
            has_delete = True
            print("   🚨 PROBLEM: Role has 'delete' permission")
        else:
            print("   ✅ GOOD: No delete permission found")
        
        print()
        
        if has_delete:
            print("   🔧 FIX AVAILABLE: Remove delete permission")
            response = input("   Do you want to remove delete permission? (yes/no): ")
            
            if response.lower() in ['yes', 'y']:
                # Remove delete from actions
                new_actions = []
                if isinstance(actions, list):
                    new_actions = [a for a in actions if a != "delete"]
                elif actions == "*":
                    # Convert * to explicit permissions without delete
                    new_actions = ["show", "create", "edit", "assign", "own", "junior", "all", "view_other"]
                
                # Update the permission
                new_permissions = permissions.copy()
                new_permissions[leads_index] = {
                    "page": "Leads",
                    "actions": new_actions
                }
                
                # Update in database
                result = await roles_collection.update_one(
                    {"_id": role_id},
                    {"$set": {"permissions": new_permissions}}
                )
                
                if result.modified_count > 0:
                    print("   ✅ SUCCESS: Delete permission removed!")
                    print()
                    print("   📋 New Leads Permissions:")
                    for action in new_actions:
                        print(f"      ✅ {action}")
                else:
                    print("   ❌ FAILED: Could not update role")
            else:
                print("   ⏭️  Skipped")
        
        print()
        print("-" * 80)
        print()
    
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print()
    print("✅ Check complete!")
    print()
    print("📝 Next Steps:")
    print("   1. If you removed delete permission, Team Leaders need to:")
    print("      - Logout completely")
    print("      - Clear browser cache (Ctrl+Shift+Delete)")
    print("      - Login again")
    print()
    print("   2. Verify in browser console (F12):")
    print("      localStorage.removeItem('userPermissions');")
    print("      localStorage.removeItem('userRoleId');")
    print()
    print("   3. Test: SELECT button should now be HIDDEN for Team Leaders")
    print()
    
    client.close()

if __name__ == "__main__":
    try:
        asyncio.run(check_and_fix_team_leader_permissions())
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
