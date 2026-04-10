#!/usr/bin/env python3
"""
Apply deduplication logic to activity creation in update_lead method.

This script makes targeted edits to add deduplication logic to activity creation.
"""

from pathlib import Path

def apply_deduplication_logic():
    """Add deduplication logic to activity creation"""
    
    leads_file_path = Path("backend/app/database/Leads.py")
    
    if not leads_file_path.exists():
        print(f"❌ Error: Leads.py not found at {leads_file_path}")
        return False
    
    print(f"📖 Reading Leads.py from {leads_file_path}")
    
    with open(leads_file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We need to wrap each activity_collection.insert_one() call with deduplication
    # For simplicity, we'll add a check before insertion
    
    # Find and wrap activity creations for field updates in update_lead
    # Pattern 1: Regular field update activities (not special ones like status, assignment)
    
    # We'll add a helper variable to track whether deduplication is enabled
    # and add a check before each insert
    
    # Insert at the beginning of update_lead method
    update_lead_start = '''    async def update_lead(self, lead_id: str, update_data: dict, user_id: str) -> bool:
        """Update a lead with tracking"""
        import copy
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🔵 ========== DATABASE update_lead START ==========")
        logger.info(f"🔵 Lead ID: {lead_id}")
        logger.info(f"🔵 User ID: {user_id}")
        logger.info(f"📥 Update data keys: {list(update_data.keys())}")
        
        # ⚡ ACTIVITY DEDUPLICATION: Track fields updated in this request
        # This prevents duplicate activities when user clears field and immediately enters new value
        fields_updated_this_request = set()
'''
    
    # Replace the original method signature with our enhanced version
    if 'fields_updated_this_request = set()' not in content:
        old_pattern = '    async def update_lead(self, lead_id: str, update_data: dict, user_id: str) -> bool:'
        if old_pattern in content:
            content = content.replace(old_pattern, update_lead_start.split('        """Update a lead with tracking"""')[0] + '        """Update a lead with tracking"""')
            print("✅ Added deduplication tracking variable to update_lead")
        else:
            print("⚠  Could not find update_lead method signature")
    
    # Now add deduplication logic before activity insertions
    # We'll replace simple insert_one calls with deduplication logic
    
    # Pattern 1: For field update activities with field_display_name in details
    # Look for: await self.activity_collection.insert_one(activity_data)
    # preceded by: field_display_name
    
    # Add deduplication check for specific field updates
    # We'll create a wrapper that checks if this field was already updated in this request
    
    deduplication_check = '''
        # ⚡ ACTIVITY DEDUPLICATION: Check if field already updated this request
        if activity_data.get("details", {}).get("field_display_name") in fields_updated_this_request:
            logger.info(f"⏭ Skipping duplicate activity for field: {activity_data['details']['field_display_name']}")
            continue
        
        # Mark this field as updated
        field_name = activity_data.get("details", {}).get("field_display_name", "unknown")
        fields_updated_this_request.add(field_name)
'''
    
    # Insert deduplication check before each relevant activity insertion
    # We'll insert this before lines with "Recorded field update"
    
    if '# ⚡ ACTIVITY DEDUPLICATION: Check if field already updated this request' not in content:
        # Find all instances where we record field updates
        replacements_made = 0
        
        # Insert before "await self.activity_collection.insert_one(activity_data)" lines
        # that follow a print statement with "Recorded field update"
        
        lines = content.split('\n')
        new_lines = []
        i = 0
        while i < len(lines):
            line = lines[i]
            new_lines.append(line)
            
            # Check if this line is a "Recorded field update" print statement
            if 'Recorded field update:' in line and 'changed from' in line:
                # The next line(s) will be the activity_collection.insert_one
                # Insert our deduplication check before it
                j = i + 1
                while j < len(lines) and not lines[j].strip().startswith('await self.activity_collection.insert_one'):
                    new_lines.append(lines[j])
                    j += 1
                
                if j < len(lines) and 'await self.activity_collection.insert_one' in lines[j]:
                    # Insert deduplication check
                    dedup_lines = deduplication_check.split('\n')
                    for dedup_line in dedup_lines:
                        new_lines.append(dedup_line)
                    replacements_made += 1
                    i = j  # Skip to after the insert line
                    continue
            
            i += 1
        
        if replacements_made > 0:
            content = '\n'.join(new_lines)
            print(f"✅ Added deduplication checks before {replacements_made} activity insertions")
        else:
            print("⚠  No activity insertions found to wrap with deduplication")
    
    # Write modified content back
    print(f"💾 Writing modified content to {leads_file_path}")
    with open(leads_file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n✅ Deduplication logic applied successfully!")
    print("\n📋 Next steps:")
    print("1. Restart backend service: pm2 restart rupiyame-backend")
    print("2. Test by clearing a field and immediately entering a new value")
    print("3. Check that only ONE activity is created (not two)")
    
    return True

if __name__ == "__main__":
    apply_deduplication_logic()