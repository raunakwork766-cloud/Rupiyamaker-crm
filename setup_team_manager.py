#!/usr/bin/env python3
"""
Quick Setup Script for Team Manager (rm006)
This script configures a user as Team Manager and links their team members.
"""

import os
import sys
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

# Load environment
load_dotenv()
MONGO_URI = os.getenv('MONGO_URI')
COMPANY_NAME = os.getenv('COMPANY_NAME', 'crm_database')

def main():
    print("=" * 60)
    print("Team Manager Setup Script")
    print("=" * 60)
    
    # Connect to database
    print(f"\n1. Connecting to database: {COMPANY_NAME}")
    try:
        client = MongoClient(MONGO_URI)
        db = client[COMPANY_NAME]
        print("   ✓ Connected successfully")
    except Exception as e:
        print(f"   ✗ Connection failed: {e}")
        return
    
    # Get team manager username
    manager_username = input("\n2. Enter Team Manager username (e.g., rm006): ").strip()
    
    # Find team manager
    manager = db.users.find_one({"username": manager_username})
    if not manager:
        print(f"   ✗ User '{manager_username}' not found")
        return
    
    manager_id = manager.get("_id")
    print(f"   ✓ Found user: {manager.get('name', manager_username)}")
    print(f"   Current designation: {manager.get('designation', 'Not set')}")
    
    # Update designation
    print(f"\n3. Setting designation to 'Team Manager'")
    db.users.update_one(
        {"_id": manager_id},
        {"$set": {"designation": "Team Manager"}}
    )
    print("   ✓ Designation updated")
    
    # Get team member usernames
    print(f"\n4. Enter team member usernames (comma-separated)")
    print(f"   Example: emp001, emp002, emp003")
    team_members_input = input("   Team members: ").strip()
    
    if team_members_input:
        team_member_usernames = [u.strip() for u in team_members_input.split(",")]
        
        # Find team members
        team_members = list(db.users.find({
            "username": {"$in": team_member_usernames}
        }))
        
        print(f"\n5. Found {len(team_members)} team members:")
        for member in team_members:
            print(f"   - {member.get('username')}: {member.get('name', 'Unknown')}")
        
        # Link team members
        if team_members:
            print(f"\n6. Linking team members to {manager_username}")
            result = db.users.update_many(
                {"username": {"$in": team_member_usernames}},
                {"$set": {"assigned_tl": manager_id}}
            )
            print(f"   ✓ Updated {result.modified_count} team members")
    else:
        print("\n   ⚠ No team members entered - skipping team linking")
    
    # Verify setup
    print(f"\n7. Verifying setup:")
    manager_updated = db.users.find_one({"_id": manager_id})
    print(f"   Team Manager: {manager_updated.get('username')}")
    print(f"   Designation: {manager_updated.get('designation')}")
    
    linked_members = list(db.users.find({"assigned_tl": manager_id}))
    print(f"   Team Members: {len(linked_members)}")
    for member in linked_members:
        print(f"     - {member.get('username')}: {member.get('name', 'Unknown')}")
    
    print("\n" + "=" * 60)
    print("✓ Setup Complete!")
    print("=" * 60)
    print("\nNext Steps:")
    print("1. Restart the backend if not already running")
    print("2. Login as", manager_username)
    print("3. Navigate to Leads page")
    print("4. Verify you can see all team leads")
    print("\nDebug: Check backend logs for:")
    print(f"  'User designation matches Team Manager: True'")
    print(f"  'Team Manager {manager_id} has {len(linked_members)} team members'")
    print()

if __name__ == "__main__":
    main()
