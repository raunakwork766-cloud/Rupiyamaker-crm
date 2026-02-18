#!/usr/bin/env python3
"""
Debug script to check applicant form data in database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "rupiyamaker"

async def main():
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    leads_collection = db['leads']
    
    # The lead ID from the console logs
    lead_id = "690f7852503acccf0c20cb65"
    
    print(f"🔍 Fetching lead: {lead_id}")
    print("=" * 80)
    
    # Get the lead
    lead = await leads_collection.find_one({"_id": lead_id})
    
    if not lead:
        print(f"❌ Lead {lead_id} not found!")
        return
    
    print(f"✅ Lead found!")
    print(f"First Name: {lead.get('first_name')}")
    print(f"Phone: {lead.get('phone')}")
    print()
    
    # Check dynamic_fields
    dynamic_fields = lead.get('dynamic_fields', {})
    print("📋 DYNAMIC FIELDS")
    print("=" * 80)
    print(f"Keys: {list(dynamic_fields.keys())}")
    print()
    
    # Check applicant_form
    if 'applicant_form' in dynamic_fields:
        print("✅ APPLICANT_FORM EXISTS")
        print("=" * 80)
        applicant_form = dynamic_fields['applicant_form']
        print(f"Keys in applicant_form: {list(applicant_form.keys())}")
        print()
        
        # Check for both naming conventions
        print("📝 Field Values:")
        print("-" * 80)
        print(f"referenceNameForLogin: {applicant_form.get('referenceNameForLogin')}")
        print(f"reference_name: {applicant_form.get('reference_name')}")
        print(f"aadharNumber: {applicant_form.get('aadharNumber')}")
        print(f"aadhar_number: {applicant_form.get('aadhar_number')}")
        print(f"panCard: {applicant_form.get('panCard')}")
        print(f"pan_number: {applicant_form.get('pan_number')}")
        print(f"mobileNumber: {applicant_form.get('mobileNumber')}")
        print(f"mobile_number: {applicant_form.get('mobile_number')}")
        print(f"customerName: {applicant_form.get('customerName')}")
        print(f"customer_name: {applicant_form.get('customer_name')}")
        print(f"salaryAccountBank: {applicant_form.get('salaryAccountBank')}")
        print(f"salary_bank_name: {applicant_form.get('salary_bank_name')}")
        print()
        
        print("📄 FULL APPLICANT_FORM DATA:")
        print("=" * 80)
        print(json.dumps(applicant_form, indent=2, default=str))
    else:
        print("❌ NO applicant_form in dynamic_fields!")
    
    print()
    
    # Check login_form (legacy)
    if 'login_form' in dynamic_fields:
        print("📝 LOGIN_FORM (Legacy) EXISTS")
        print("=" * 80)
        login_form = dynamic_fields['login_form']
        print(f"Keys: {list(login_form.keys())}")
        print(json.dumps(login_form, indent=2, default=str))
    else:
        print("ℹ️  No login_form (legacy) found")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
