#!/usr/bin/env python3
"""Check what question responses are stored for the lead"""
from pymongo import MongoClient
from bson import ObjectId
import json

def check_lead():
    client = MongoClient("mongodb://localhost:27017/")
    db = client["rupiyame"]
    leads = db["leads"]
    
    lead_id = "69089b5eb88dcedf541f6e4f"
    
    lead = leads.find_one({"_id": ObjectId(lead_id)})
    
    if lead:
        print(f"Lead: {lead.get('first_name')} {lead.get('last_name')}")
        print(f"Status: {lead.get('status')}")
        print(f"Sub-status: {lead.get('sub_status')}")
        print(f"Important questions validated: {lead.get('important_questions_validated')}")
        print(f"\nQuestion responses:")
        print(json.dumps(lead.get('question_responses', {}), indent=2, default=str))
        print(f"\nImportant question (old format):")
        print(json.dumps(lead.get('importantquestion', {}), indent=2, default=str))
        print(f"\nDynamic fields important questions:")
        if 'dynamic_fields' in lead and lead['dynamic_fields']:
            print(json.dumps(lead['dynamic_fields'].get('important_questions', {}), indent=2, default=str))
    else:
        print("Lead not found")
    
    client.close()

if __name__ == "__main__":
    check_lead()
