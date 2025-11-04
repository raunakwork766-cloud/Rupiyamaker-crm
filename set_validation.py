#!/usr/bin/env python3
"""
Manually set important_questions_validated to true for testing
"""

import asyncio
import sys
sys.path.insert(0, '/www/wwwroot/RupiyaMe/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from app.config import Config

async def set_validation(lead_id):
    """Set validation flag for a specific lead"""
    client = AsyncIOMotorClient(Config.MONGO_URI)
    db = client[Config.COMPANY_NAME]
    leads_collection = db["leads"]
    
    try:
        # Convert string ID to ObjectId
        obj_id = ObjectId(lead_id)
        
        # Get the lead first
        lead = await leads_collection.find_one({"_id": obj_id})
        if not lead:
            print(f"❌ Lead {lead_id} not found!")
            return
        
        print(f"\n📋 Lead Before Update:")
        print(f"  Name: {lead.get('first_name', '')} {lead.get('last_name', '')}")
        print(f"  Status: {lead.get('status')} / {lead.get('sub_status')}")
        print(f"  Validated: {lead.get('important_questions_validated', False)}")
        print(f"  Sent to Login: {lead.get('file_sent_to_login', False)}")
        
        # Update the lead
        result = await leads_collection.update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "important_questions_validated": True,
                    "question_responses": {
                        "test_question_1": True
                    }
                }
            }
        )
        
        if result.modified_count > 0:
            print(f"\n✅ Successfully updated lead {lead_id}")
            
            # Verify the update
            updated_lead = await leads_collection.find_one({"_id": obj_id})
            print(f"\n📋 Lead After Update:")
            print(f"  Validated: {updated_lead.get('important_questions_validated', False)}")
            print(f"  Question Responses: {updated_lead.get('question_responses', {})}")
        else:
            print(f"\n⚠️ No changes made to lead {lead_id}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python set_validation.py <lead_id>")
        print("\nExample lead IDs from database:")
        print("  68bad9333ca0f1831acc47b4  (RAUNAK KUMAR - already validated)")
        print("  68beda1346f14b762752cb2d  (MANOJ JEEVNANI - not validated)")
        print("  68d51e296fa465e7799c0f7e  (VEENA GOTTE - not validated)")
        sys.exit(1)
    
    lead_id = sys.argv[1]
    print(f"\n🔧 Setting validation flag for lead: {lead_id}\n")
    asyncio.run(set_validation(lead_id))
    print("\n✅ Done!\n")
