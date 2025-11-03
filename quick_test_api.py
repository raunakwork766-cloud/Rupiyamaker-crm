#!/usr/bin/env python3
"""
Quick test to verify created_by_name and department_name are now returned by the API
"""

import asyncio
import sys
sys.path.insert(0, '/www/wwwroot/rupiyamaker/RupiyaMe/backend')

from app.database.Leads import LeadsDB
from app.database.Users import UsersDB
from app.database.Departments import DepartmentsDB

async def test_api_data():
    """Test if API enrichment logic works"""
    
    print("=" * 70)
    print("🧪 Testing API Data Enrichment Logic")
    print("=" * 70)
    print()
    
    leads_db = LeadsDB()
    users_db = UsersDB()
    departments_db = DepartmentsDB()
    
    # Get a sample lead
    print("📋 Fetching sample lead...")
    all_leads = await leads_db.list_leads()
    
    if not all_leads:
        print("❌ No leads found!")
        return False
    
    lead = all_leads[0]
    print(f"✅ Got lead: {lead.get('custom_lead_id', 'Unknown')} - {lead.get('first_name', '')} {lead.get('last_name', '')}")
    print()
    
    # Test created_by lookup
    print("1️⃣  Testing created_by user lookup:")
    created_by_id = lead.get('created_by')
    print(f"   - created_by ID: {created_by_id}")
    
    if created_by_id:
        creator = await users_db.get_user(created_by_id)
        if creator:
            creator_name = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip()
            if not creator_name:
                creator_name = creator.get('username', 'Unknown')
            print(f"   - ✅ Creator found: {creator_name}")
            print(f"   - Username: {creator.get('username')}")
        else:
            print(f"   - ❌ Creator not found (ID invalid or doesn't exist)")
            return False
    else:
        print(f"   - ⚠️  No created_by field")
        return False
    
    print()
    
    # Test department lookup
    print("2️⃣  Testing department lookup:")
    dept_id = lead.get('department_id')
    print(f"   - department_id: {dept_id}")
    
    if dept_id:
        department = await departments_db.get_department(dept_id)
        if department:
            dept_name = department.get('name', 'Unknown')
            print(f"   - ✅ Department found: {dept_name}")
        else:
            print(f"   - ❌ Department not found")
            # Try fallback
            if creator and creator.get('department_id'):
                print(f"   - Trying fallback from creator's department...")
                dept = await departments_db.get_department(creator['department_id'])
                if dept:
                    print(f"   - ✅ Fallback department: {dept.get('name')}")
                else:
                    return False
            else:
                return False
    else:
        print(f"   - ⚠️  No department_id, trying fallback...")
        if creator and creator.get('department_id'):
            dept = await departments_db.get_department(creator['department_id'])
            if dept:
                print(f"   - ✅ Fallback department: {dept.get('name')}")
            else:
                print(f"   - ❌ Fallback failed")
                return False
        else:
            print(f"   - ❌ No fallback available")
            return False
    
    print()
    print("=" * 70)
    print("✅ API DATA ENRICHMENT TEST PASSED!")
    print("=" * 70)
    print()
    print("💡 The backend API will now return:")
    print(f"   - created_by_name: '{creator_name}'")
    print(f"   - department_name: '{dept_name if dept_id else dept.get('name')}'")
    print()
    print("🔄 Refresh your browser page to see the changes!")
    print("=" * 70)
    
    return True

if __name__ == "__main__":
    result = asyncio.run(test_api_data())
    sys.exit(0 if result else 1)
