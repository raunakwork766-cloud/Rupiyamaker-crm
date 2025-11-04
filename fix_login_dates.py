#!/usr/bin/env python3
"""
Fix missing login_date fields in existing login leads
This script updates all login leads that don't have a login_date set
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGO_URI", "mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin")
DB_NAME = os.getenv("COMPANY_NAME", "crm_database")

async def fix_login_dates():
    """Update login_date for all login leads that don't have it"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    login_leads_collection = db['login_leads']
    
    print("🔍 Checking login leads for missing login_date fields...")
    
    # Find all login leads without login_date
    cursor = login_leads_collection.find({
        "$or": [
            {"login_date": {"$exists": False}},
            {"login_date": None},
            {"login_date": ""}
        ]
    })
    
    leads_to_update = await cursor.to_list(length=None)
    
    if not leads_to_update:
        print("✅ All login leads already have login_date set!")
        client.close()
        return
    
    print(f"📊 Found {len(leads_to_update)} login leads without login_date")
    print("🔧 Updating...")
    
    updated_count = 0
    for lead in leads_to_update:
        lead_id = lead['_id']
        
        # Use login_created_at if available, otherwise login_department_sent_date, otherwise created_at
        login_date = (
            lead.get('login_created_at') or 
            lead.get('login_department_sent_date') or 
            lead.get('created_at') or 
            datetime.utcnow().isoformat()
        )
        
        # Update the lead
        result = await login_leads_collection.update_one(
            {'_id': lead_id},
            {'$set': {'login_date': login_date}}
        )
        
        if result.modified_count > 0:
            updated_count += 1
            customer_name = f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip() or 'Unknown'
            print(f"  ✅ Updated lead {lead_id} ({customer_name}) - login_date: {login_date}")
    
    print(f"\n✅ Successfully updated {updated_count} login leads")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_login_dates())
