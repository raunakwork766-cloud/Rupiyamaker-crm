#!/usr/bin/env python3
"""
Check if leads have proper important_questions_validated flag
"""

import asyncio
import sys
sys.path.insert(0, '/www/wwwroot/RupiyaMe/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import Config

async def check_leads():
    """Check leads with FILE COMPLETE status"""
    client = AsyncIOMotorClient(Config.MONGO_URI)
    db = client[Config.COMPANY_NAME]
    leads_collection = db["leads"]
    
    print("=" * 80)
    print("Checking Leads with FILE COMPLETE status")
    print("=" * 80)
    
    # Find leads with FILE COMPLETE status
    query = {
        "$or": [
            {"status": {"$regex": "file complete", "$options": "i"}},
            {"sub_status": {"$regex": "file complete", "$options": "i"}}
        ]
    }
    
    leads = await leads_collection.find(query).to_list(length=10)
    
    print(f"\nFound {len(leads)} leads with 'FILE COMPLETE' status\n")
    
    for lead in leads:
        print(f"Lead ID: {lead['_id']}")
        print(f"  Name: {lead.get('first_name', '')} {lead.get('last_name', '')}")
        print(f"  Phone: {lead.get('phone', 'N/A')}")
        print(f"  Status: {lead.get('status', 'N/A')}")
        print(f"  Sub Status: {lead.get('sub_status', 'N/A')}")
        print(f"  Important Questions Validated: {lead.get('important_questions_validated', False)}")
        print(f"  File Sent to Login: {lead.get('file_sent_to_login', False)}")
        print(f"  Question Responses: {lead.get('question_responses', {})}")
        print("-" * 80)
    
    # Also check all leads to see validation status
    print("\n" + "=" * 80)
    print("All Leads Validation Status Summary")
    print("=" * 80)
    
    all_leads = await leads_collection.find({}).to_list(length=None)
    
    validated_count = sum(1 for l in all_leads if l.get('important_questions_validated') == True)
    not_validated_count = len(all_leads) - validated_count
    
    print(f"\nTotal Leads: {len(all_leads)}")
    print(f"Validated: {validated_count}")
    print(f"Not Validated: {not_validated_count}")
    
    # Show recent leads with their validation status
    print("\n" + "=" * 80)
    print("Recent 5 Leads (sorted by updated_at)")
    print("=" * 80)
    
    recent_leads = await leads_collection.find({}).sort("updated_at", -1).limit(5).to_list(length=5)
    
    for lead in recent_leads:
        print(f"\nLead: {lead.get('first_name', '')} {lead.get('last_name', '')} ({lead.get('phone', 'N/A')})")
        print(f"  Status: {lead.get('status', 'N/A')} / {lead.get('sub_status', 'N/A')}")
        print(f"  Validated: {lead.get('important_questions_validated', False)}")
        print(f"  Sent to Login: {lead.get('file_sent_to_login', False)}")
        print(f"  Has Question Responses: {bool(lead.get('question_responses'))}")
    
    client.close()

if __name__ == "__main__":
    print("\nChecking lead validation status...\n")
    asyncio.run(check_leads())
    print("\n✅ Check completed!\n")
