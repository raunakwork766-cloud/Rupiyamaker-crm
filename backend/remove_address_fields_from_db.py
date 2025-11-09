#!/usr/bin/env python3
"""
Migration script to remove address-related fields from MongoDB collections
This will remove: pincode, city, postal_code, pin_code, address, and related dynamic_fields
"""

import sys
import os
from datetime import datetime

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.database import db

def remove_address_fields():
    """Remove address-related fields from all leads and users in the database"""
    
    if db is None:
        print("❌ ERROR: Database connection not available")
        return
    
    print("=" * 80)
    print("MIGRATION: Removing address-related fields from database")
    print("=" * 80)
    print(f"Started at: {datetime.now()}")
    print()
    
    # Define the fields to remove
    fields_to_unset = {
        # Top-level fields
        'pincode': '',
        'city': '',
        'postal_code': '',
        'pin_code': '',
        'address': '',
        'permanent_address': '',
        'current_address': '',
        'permanent_city': '',
        'current_city': '',
        'permanent_pincode': '',
        'current_pincode': '',
        'permanent_postal_code': '',
        'current_postal_code': '',
        'permanent_state': '',
        'current_state': '',
        'permanent_country': '',
        'current_country': '',
        
        # Dynamic fields - remove the entire address object to avoid conflicts
        'dynamic_fields.pincode': '',
        'dynamic_fields.city': '',
        'dynamic_fields.postal_code': '',
        'dynamic_fields.address': '',  # This will remove the entire address object
    }
    
    # Update leads collection
    print("Processing 'leads' collection...")
    leads_collection = db['leads']
    
    # Count documents before
    total_leads = leads_collection.count_documents({})
    print(f"  Total leads: {total_leads}")
    
    # Find leads with address fields
    leads_with_address = leads_collection.count_documents({
        '$or': [
            {'pincode': {'$exists': True}},
            {'city': {'$exists': True}},
            {'postal_code': {'$exists': True}},
            {'pin_code': {'$exists': True}},
            {'address': {'$exists': True}},
            {'dynamic_fields.pincode': {'$exists': True}},
            {'dynamic_fields.city': {'$exists': True}},
            {'dynamic_fields.postal_code': {'$exists': True}},
            {'dynamic_fields.address': {'$exists': True}},
        ]
    })
    print(f"  Leads with address fields: {leads_with_address}")
    
    if leads_with_address > 0:
        # Remove the fields
        result = leads_collection.update_many(
            {},
            {'$unset': fields_to_unset}
        )
        print(f"  ✅ Updated {result.modified_count} leads")
    else:
        print(f"  ℹ️  No leads to update")
    
    print()
    
    # Update login_leads collection
    print("Processing 'login_leads' collection...")
    login_leads_collection = db['login_leads']
    
    # Count documents before
    total_login_leads = login_leads_collection.count_documents({})
    print(f"  Total login leads: {total_login_leads}")
    
    # Find login leads with address fields
    login_leads_with_address = login_leads_collection.count_documents({
        '$or': [
            {'pincode': {'$exists': True}},
            {'city': {'$exists': True}},
            {'postal_code': {'$exists': True}},
            {'pin_code': {'$exists': True}},
            {'address': {'$exists': True}},
            {'dynamic_fields.pincode': {'$exists': True}},
            {'dynamic_fields.city': {'$exists': True}},
            {'dynamic_fields.postal_code': {'$exists': True}},
            {'dynamic_fields.address': {'$exists': True}},
        ]
    })
    print(f"  Login leads with address fields: {login_leads_with_address}")
    
    if login_leads_with_address > 0:
        # Remove the fields
        result = login_leads_collection.update_many(
            {},
            {'$unset': fields_to_unset}
        )
        print(f"  ✅ Updated {result.modified_count} login leads")
    else:
        print(f"  ℹ️  No login leads to update")
    
    print()
    
    # Update users/employees collection
    print("Processing 'users' collection...")
    users_collection = db['users']
    
    # Count documents before
    total_users = users_collection.count_documents({})
    print(f"  Total users: {total_users}")
    
    # Find users with address fields
    users_with_address = users_collection.count_documents({
        '$or': [
            {'permanent_address': {'$exists': True}},
            {'current_address': {'$exists': True}},
            {'permanent_city': {'$exists': True}},
            {'current_city': {'$exists': True}},
            {'permanent_pincode': {'$exists': True}},
            {'current_pincode': {'$exists': True}},
            {'permanent_state': {'$exists': True}},
            {'current_state': {'$exists': True}},
            {'permanent_country': {'$exists': True}},
            {'current_country': {'$exists': True}},
            {'address': {'$exists': True}},
        ]
    })
    print(f"  Users with address fields: {users_with_address}")
    
    if users_with_address > 0:
        # Remove the fields
        result = users_collection.update_many(
            {},
            {'$unset': fields_to_unset}
        )
        print(f"  ✅ Updated {result.modified_count} users")
    else:
        print(f"  ℹ️  No users to update")
    
    print()
    print("=" * 80)
    print("MIGRATION COMPLETED")
    print("=" * 80)
    print(f"Finished at: {datetime.now()}")
    print()
    print("Summary:")
    print(f"  - Processed {total_leads} leads")
    print(f"  - Processed {total_login_leads} login leads")
    print(f"  - Processed {total_users} users")
    print()
    print("All address-related fields have been removed from the database.")
    print()

if __name__ == '__main__':
    try:
        remove_address_fields()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
