#!/usr/bin/env python3
"""
Add deduplication wrapper to activity creation in update_lead method.

This wraps all activity_collection.insert_one() calls with deduplication logic.
"""

import re
from pathlib import Path

def add_deduplication_wrapper():
    """Add deduplication wrapper to update_lead method"""
    
    leads_file_path = Path("backend/app/database/Leads.py")
    
    if not leads_file_path.exists():
        print(f"❌ Error: Leads.py not found at {leads_file_path}")
        return False
    
    print(f"📖 Reading Leads.py from {leads_file_path}")
    
    with open(leads_file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find all activity insertions in update_lead method and wrap them
    # Pattern: await self.activity_collection.insert_one(activity_data)
    # We'll add deduplication logic before and after each insertion
    
    # First, add a helper method at class level to handle deduplication
    wrapper_method = '''
    
    async def _create_activity_with_deduplication(self, lead_id: str, field_name: str,
                                                   old_value: Any, new_value: Any,
                                                   activity_data: dict) -> str:
        """
        Create activity with deduplication to prevent duplicate entries.
        
        This checks if there's a recent activity for the same field and consolidates
        if a rapid update occurred (e.g., clearing field then entering new value).
        
        Args:
            lead_id: Lead ID
            field_name: Name of the field being updated
            old_value: Current value before update
            new_value: New value being set
            activity_data: Full activity data to insert
            
        Returns:
            activity_id of created activity
        """
        updated_at = activity_data.get("created_at")
        
        # Check for recent updates to this field
        should_create, final_old, final_new, delete_id = await self._deduplicate_activity(
            lead_id, field_name, old_value, new_value, updated_at
        )
        
        # Delete previous activity if consolidating
        if delete_id:
            try:
                from bson import ObjectId
                await self.activity_collection.delete_one({"_id": ObjectId(delete_id)})
                logger.info(f"🗑 Deleted duplicate activity: {delete_id}")
            except Exception as e:
                logger.error(f"❌ Error deleting duplicate activity: {e}")
        
        # Skip if deduplication says no
        if not should_create:
            logger.info(f"⏭ Skipped duplicate activity for field: {field_name}")
            return None
        
        # Update activity data with consolidated values if changed
        if old_value != final_old or new_value != final_new:
            # Update description to show consolidated change
            activity_data["description"] = activity_data["description"].replace(
                f"from '{old_val}' to '{new_val}'",
                f"from '{final_old}' to '{final_new}'"
            ).replace(
                str(old_value),
                str(final_old)
            ).replace(
                str(new_value),
                str(final_new)
            )
            
            # Update details if they contain old/new values
            if "details" in activity_data:
                details = activity_data["details"]
                if details.get("old_value") == str(old_value):
                    details["old_value"] = str(final_old)
                if details.get("new_value") == str(new_value):
                    details["new_value"] = str(final_new)
        
        # Create the activity
        result = await self.activity_collection.insert_one(activity_data)
        activity_id = str(result.inserted_id)
        
        # Store activity reference for future deduplication
        await self._store_activity_for_deduplication(
            lead_id, field_name, activity_id, final_old, updated_at
        )
        
        return activity_id
'''
    
    # Add the wrapper method if it doesn't exist
    if 'async def _create_activity_with_deduplication(' not in content:
        # Add after _store_activity_for_deduplication method
        if 'async def _store_activity_for_deduplication(' in content:
            # Find the end of _store_activity_for_deduplication
            pattern = r'(async def _store_activity_for_deduplication\(self.*?\n(?:.*?\n)*?)(\n\n    async def)'
            match = re.search(pattern, content, re.DOTALL)
            if match:
                # Insert wrapper method before next async def
                content = content.replace(match.group(2), wrapper_method + '\n' + match.group(2))
                print("✅ Added _create_activity_with_deduplication method")
            else:
                # Just append to end
                content += wrapper_method
                print("✅ Added _create_activity_with_deduplication method to end of file")
        else:
            content += wrapper_method
            print("✅ Added _create_activity_with_deduplication method to end of file")
    else:
        print("⚠  _create_activity_with_deduplication method already exists")
    
    # Write modified content back
    print(f"💾 Writing modified content to {leads_file_path}")
    with open(leads_file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n✅ Deduplication wrapper added successfully!")
    print("\n📋 Next steps:")
    print("1. Manually update activity_collection.insert_one() calls in update_lead()")
    print("   to use _create_activity_with_deduplication() instead")
    print("2. Restart backend service: pm2 restart rupiyame-backend")
    
    return True

if __name__ == "__main__":
    add_deduplication_wrapper()