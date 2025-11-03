#!/usr/bin/env python3
"""
Debug script to test leads permissions for Team Achievers Team Leader role
"""
import sys
import os
sys.path.append('/www/wwwroot/RupiyaMe/backend')

import asyncio
from app.database import get_database_instances
from app.utils.permissions import get_lead_visibility_filter, PermissionManager

async def debug_user_permissions():
    """Debug function to check user permissions"""
    
    # Initialize database
    from app.database import init_database
    db_instances = await init_database()
    users_db = db_instances["users"]
    roles_db = db_instances["roles"]
    
    # Find users with "Team Achievers Team Leader" role or similar
    print("🔍 Searching for Team Achievers Team Leader role...")
    
    # Find roles containing "team" and "achiever"
    roles = await roles_db.list_roles()
    team_achiever_roles = []
    
    for role in roles:
        role_name = role.get('name', '').lower()
        if 'team' in role_name and 'achiever' in role_name:
            team_achiever_roles.append(role)
            print(f"📋 Found role: {role.get('name')} (ID: {role.get('_id')})")
            print(f"   Permissions: {role.get('permissions', [])}")
    
    if not team_achiever_roles:
        print("❌ No 'Team Achievers' roles found. Checking all roles with 'team' in name...")
        for role in roles:
            role_name = role.get('name', '').lower()
            if 'team' in role_name:
                print(f"📋 Found team role: {role.get('name')} (ID: {role.get('_id')})")
                # Check if this role has leads permissions
                permissions = role.get('permissions', [])
                leads_perms = []
                for perm in permissions:
                    if isinstance(perm, dict) and perm.get('page', '').lower() == 'leads':
                        leads_perms.append(perm)
                if leads_perms:
                    print(f"   Leads permissions: {leads_perms}")
                    team_achiever_roles.append(role)
    
    # Find users with these roles
    print("\n🔍 Finding users with team leader roles...")
    for role in team_achiever_roles:
        role_id = str(role.get('_id'))
        users = await users_db.find_users_by_role(role_id)
        
        print(f"\n👥 Users with role '{role.get('name')}':")
        for user in users:
            user_id = str(user.get('_id'))
            print(f"   User: {user.get('first_name')} {user.get('last_name')} (ID: {user_id})")
            print(f"   Employee ID: {user.get('employee_id', 'N/A')}")
            print(f"   Designation: {user.get('designation', 'N/A')}")
            
            # Test permission visibility filter
            print(f"   🔍 Testing visibility filter...")
            try:
                visibility_filter = await get_lead_visibility_filter(user_id, users_db, roles_db)
                print(f"   Visibility filter result: {visibility_filter}")
                
                # Test user permissions
                user_permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
                print(f"   User permissions: {user_permissions}")
                
                # Check specifically for leads 'all' permission
                has_all = False
                for perm in user_permissions:
                    if perm.get('page', '').lower() == 'leads':
                        actions = perm.get('actions', [])
                        if actions == '*' or (isinstance(actions, list) and 'all' in actions) or (isinstance(actions, str) and actions.lower() == 'all'):
                            has_all = True
                            break
                
                print(f"   ✅ Has 'all' leads permission: {has_all}")
                
            except Exception as e:
                print(f"   ❌ Error testing permissions: {e}")

if __name__ == "__main__":
    asyncio.run(debug_user_permissions())