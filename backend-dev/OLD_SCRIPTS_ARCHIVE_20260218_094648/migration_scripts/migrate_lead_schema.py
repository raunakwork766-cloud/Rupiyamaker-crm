#!/usr/bin/env python3
"""
Database migration script for reassignment functionality

This script ensures that all existing lead records have the required fields
for the enhanced reassignment functionality including:
- data_code/dataCode fields
- campaign_name/campaignName fields
- reassignment tracking fields
- activity history arrays
- field change history

Run this script before using the enhanced reassignment features.
"""

import sys
import os

# Add the backend app directory to the Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.join(backend_dir, 'app')
sys.path.insert(0, backend_dir)

def run_migration():
    """Run the database migration for reassignment functionality"""
    try:
        print("🔄 Starting lead schema migration for enhanced reassignment...")
        print("="*70)
        
        # Import the LeadsDB class
        from app.database.Leads import LeadsDB
        
        # Initialize the database connection
        leads_db = LeadsDB()
        
        # Run the schema migration
        print("📊 Analyzing existing lead records...")
        updates_made = leads_db.ensure_lead_schema_fields()
        
        print("\n" + "="*70)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print(f"📈 Updated {updates_made} lead records with missing schema fields")
        print("="*70)
        
        # Verify the migration by checking a few records
        print("\n🔍 Verifying migration results...")
        
        # Get a sample of leads to verify the schema
        sample_leads = leads_db.collection.find({}, {
            "data_code": 1, "dataCode": 1, 
            "campaign_name": 1, "campaignName": 1,
            "reassignment_status": 1, "activities": 1,
            "field_history": 1
        }).limit(5)
        
        sample_count = 0
        for lead in sample_leads:
            sample_count += 1
            print(f"   Lead {sample_count}:")
            print(f"     - data_code: {'✓' if 'data_code' in lead else '✗'}")
            print(f"     - dataCode: {'✓' if 'dataCode' in lead else '✗'}")
            print(f"     - campaign_name: {'✓' if 'campaign_name' in lead else '✗'}")
            print(f"     - campaignName: {'✓' if 'campaignName' in lead else '✗'}")
            print(f"     - reassignment_status: {'✓' if 'reassignment_status' in lead else '✗'}")
            print(f"     - activities: {'✓' if 'activities' in lead else '✗'}")
            print(f"     - field_history: {'✓' if 'field_history' in lead else '✗'}")
        
        if sample_count == 0:
            print("   ⚠️  No leads found in database")
        else:
            print(f"   ✅ Verified {sample_count} sample leads")
        
        print("\n🎉 Migration verification completed!")
        print("\n📋 NEXT STEPS:")
        print("   1. Restart the backend server to load the enhanced API")
        print("   2. Test the frontend reassignment functionality")
        print("   3. Verify activity logging and field updates work correctly")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {str(e)}")
        print("   Make sure you're running this script from the backend directory")
        print("   and that all dependencies are installed.")
        return False
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        print("   Check the database connection and try again.")
        return False

def check_requirements():
    """Check if all requirements are met before running migration"""
    print("🔍 Checking migration requirements...")
    
    # Check if we can import required modules
    try:
        import pymongo
        print("   ✅ PyMongo available")
    except ImportError:
        print("   ❌ PyMongo not available - install with: pip install pymongo")
        return False
    
    try:
        from app.database import db
        print("   ✅ Database connection available")
    except ImportError as e:
        print(f"   ❌ Database connection failed: {str(e)}")
        return False
    
    # Check if leads collection exists
    try:
        from app.database.Leads import LeadsDB
        leads_db = LeadsDB()
        count = leads_db.collection.count_documents({})
        print(f"   ✅ Found {count} leads in database")
    except Exception as e:
        print(f"   ❌ Cannot access leads collection: {str(e)}")
        return False
    
    print("   ✅ All requirements met!")
    return True

if __name__ == "__main__":
    print("🗃️  Lead Schema Migration for Enhanced Reassignment")
    print("="*70)
    print("This script will update existing lead records to support:")
    print("   • Enhanced reassignment status tracking")
    print("   • Data code and campaign name field updates")
    print("   • Activity history and field change tracking")
    print("   • Dual naming convention support (snake_case/camelCase)")
    print()
    
    if not check_requirements():
        print("\n❌ Requirements check failed. Please fix the issues above.")
        sys.exit(1)
    
    print("\n⚠️  WARNING: This migration will modify your database.")
    print("   It's recommended to backup your database before proceeding.")
    
    confirm = input("\nProceed with migration? (y/N): ")
    
    if confirm.lower() in ['y', 'yes']:
        print("\n🚀 Starting migration...")
        success = run_migration()
        sys.exit(0 if success else 1)
    else:
        print("Migration cancelled.")
        sys.exit(0)
