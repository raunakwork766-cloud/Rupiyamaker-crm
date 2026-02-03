#!/usr/bin/env python3
"""
Simple script to patch Leads.py with activity deduplication functionality.

This script will:
1. Add activity_updates_collection initialization
2. Add TTL indexes for auto-cleanup
3. Add _deduplicate_activity() method
4. Add _store_activity_for_deduplication() method

Usage: cd backend && python scripts/fix_activity_deduplication.py
"""

import re
from pathlib import Path

def apply_deduplication_fix():
    """Apply activity deduplication fix to Leads.py"""
    
    leads_file_path = Path("backend/app/database/Leads.py")
    
    if not leads_file_path.exists():
        print(f"❌ Error: Leads.py not found at {leads_file_path}")
        return False
    
    print(f"📖 Reading Leads.py from {leads_file_path}")
    
    with open(leads_file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    content = ''.join(lines)
    
    # Step 1: Add activity_updates_collection to __init__
    print("✅ Step 1: Checking if activity_updates_collection exists...")
    
    if 'self.activity_updates_collection = self.db["lead_activity_updates"]' not in content:
        # Find the line with counters_collection
        for i, line in enumerate(lines):
            if 'self.counters_collection = self.db["counters"]' in line:
                # Insert after this line
                lines.insert(i + 1, '\n        # Activity deduplication collection - tracks recent updates to prevent duplicate activities\n')
                lines.insert(i + 2, '        self.activity_updates_collection = self.db["lead_activity_updates"]\n')
                print("✅ Added activity_updates_collection to __init__")
                break
    else:
        print("⚠️  activity_updates_collection already exists in __init__")
    
    # Step 2: Add indexes in _create_optimized_indexes
    print("✅ Step 2: Checking if deduplication indexes exist...")
    
    content = ''.join(lines)
    
    if 'activity_updates_collection.create_index' not in content:
        # Find the line after activity collection indexes
        for i, line in enumerate(lines):
            if 'await self.documents_collection.create_index([("lead_id", 1)], background=True)' in line:
                # Insert deduplication indexes after this
                lines.insert(i + 1, '\n            # ⚡ ACTIVITY DEDUPLICATION INDEX\n')
                lines.insert(i + 2, '            # Create TTL index for activity_updates (auto-cleanup after 10 seconds)\n')
                lines.insert(i + 3, '            await self.activity_updates_collection.create_index(\n')
                lines.insert(i + 4, '                [("created_at", 1)],\n')
                lines.insert(i + 5, '                expireAfterSeconds=10,\n')
                lines.insert(i + 6, '                background=True\n')
                lines.insert(i + 7, '            )\n')
                lines.insert(i + 8, '            # Create compound index for efficient lookups\n')
                lines.insert(i + 9, '            await self.activity_updates_collection.create_index(\n')
                lines.insert(i + 10, '                [("lead_id", 1), ("field_name", 1), ("created_at", 1)],\n')
                lines.insert(i + 11, '                background=True\n')
                lines.insert(i + 12, '            )\n')
                print("✅ Added deduplication indexes to _create_optimized_indexes")
                break
    else:
        print("⚠️  Deduplication indexes already exist")
    
    # Step 3: Add deduplication methods at the end of the class
    content = ''.join(lines)
    
    if 'async def _deduplicate_activity(' not in content:
        # Add methods at the end of the class
        dedup_methods = '''
    
    async def _deduplicate_activity(self, lead_id: str, field_name: str, 
                                  old_value: Any, new_value: Any, 
                                  updated_at: datetime) -> Tuple[bool, Any, Any, Optional[str]]:
        """
        Check if there's a recent activity for same field and consolidate updates.
        
        This prevents duplicate activities when a user clears a field and immediately
        enters a new value. Instead of creating two activities:
        - old_value → empty
        - empty → new_value
        
        We create ONE activity:
        - old_value → new_value
        
        Args:
            lead_id: Lead ID being updated
            field_name: Name of field being updated
            old_value: Current value before this update
            new_value: New value being set
            updated_at: Timestamp of this update
            
        Returns:
            Tuple of (should_create_activity, final_old_value, final_new_value, delete_activity_id)
            where delete_activity_id is MongoDB _id of activity to delete (if any)
        """
        from datetime import timedelta
        
        # Look for recent update to same field within last 10 seconds
        cutoff_time = updated_at - timedelta(seconds=10)
        
        try:
            recent_update = await self.activity_updates_collection.find_one({
                "lead_id": lead_id,
                "field_name": field_name,
                "created_at": {"$gte": cutoff_time}
            })
            
            if recent_update:
                # There's a recent update - consolidate
                # Use original old_value from first update and current new_value
                final_old_value = recent_update.get("original_old_value")
                final_new_value = new_value
                activity_id_to_delete = recent_update.get("activity_id")
                
                logger.info(f"🔄 DEDUPLICATE: Consolidating field '{field_name}' update: "
                          f"{final_old_value} → {new_value} (deleting previous activity)")
                
                # Delete recent update tracker
                await self.activity_updates_collection.delete_one({
                    "_id": recent_update["_id"]
                })
                
                # Return the activity_id to delete
                return (True, final_old_value, final_new_value, activity_id_to_delete)
            else:
                # No recent update - this is a fresh change
                # This is FIRST update for this field in window
                logger.info(f"📝 FIRST UPDATE: Field '{field_name}' changed: {old_value} → {new_value}")
                
                return (True, old_value, new_value, None)
                
        except Exception as e:
            logger.error(f"❌ Error in _deduplicate_activity: {e}")
            # On error, create activity anyway to avoid losing data
            return (True, old_value, new_value, None)
    
    async def _store_activity_for_deduplication(self, lead_id: str, field_name: str, 
                                               activity_id: str, old_value: Any, 
                                               updated_at: datetime):
        """
        Store activity reference after creation for future deduplication.
        
        Args:
            lead_id: Lead ID
            field_name: Name of field
            activity_id: The MongoDB _id of created activity
            old_value: Original old value (for consolidation reference)
            updated_at: Timestamp when activity was created
        """
        try:
            await self.activity_updates_collection.insert_one({
                "lead_id": lead_id,
                "field_name": field_name,
                "activity_id": activity_id,
                "original_old_value": old_value,
                "created_at": updated_at
            })
            logger.info(f"💾 Stored activity reference for deduplication: {field_name} → {activity_id}")
        except Exception as e:
            logger.error(f"❌ Error storing activity for deduplication: {e}")
'''
        # Append to the file
        lines.append(dedup_methods)
        print("✅ Added deduplication methods to LeadsDB class")
    else:
        print("⚠️  Deduplication methods already exist")
    
    # Write modified content back to file
    print(f"💾 Writing modified content to {leads_file_path}")
    with open(leads_file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print("\n✅ Activity deduplication fix applied successfully!")
    print("\n📋 Next steps:")
    print("1. Restart backend service: pm2 restart rupiyame-backend")
    print("2. Test by clearing a field and immediately entering a new value")
    print("3. Check that only ONE activity is created (not two)")
    
    return True

if __name__ == "__main__":
    apply_deduplication_fix()