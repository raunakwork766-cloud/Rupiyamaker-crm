#!/usr/bin/env python3
"""Update existing login lead to add login_date and fix status"""
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

client = MongoClient("mongodb://localhost:27017/")
db = client["rupiyame"]
login_leads = db["login_leads"]

# Find the existing login lead
login_lead_id = "6908a9158896fdb268de8e7e"

# Update it with login_date and new status
result = login_leads.update_one(
    {"_id": ObjectId(login_lead_id)},
    {
        "$set": {
            "login_date": datetime.now().isoformat(),
            "status": "NEW LOGIN",
            "sub_status": "Pending Review"
        }
    }
)

print(f"Updated {result.modified_count} document(s)")

# Fetch and display
updated_lead = login_leads.find_one({"_id": ObjectId(login_lead_id)})
if updated_lead:
    print(f"\nUpdated Login Lead:")
    print(f"   ID: {updated_lead['_id']}")
    print(f"   Status: {updated_lead.get('status')}")
    print(f"   Sub-status: {updated_lead.get('sub_status')}")
    print(f"   Login Date: {updated_lead.get('login_date')}")
    print(f"   Login Created At: {updated_lead.get('login_created_at')}")

client.close()
