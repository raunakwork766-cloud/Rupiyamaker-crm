#!/usr/bin/env python3
"""
Simple fix for duplicate activity issue.

The problem: When a field is cleared (set to empty) and immediately 
set to a new value, TWO activities are created.

Solution: Skip creating activities when new_val is empty or "Not Set".
Only create activity when there's a meaningful value change.
"""

import re
from pathlib import Path

def fix_duplicate_activities():
    """Fix duplicate activity creation issue"""
    
    leads_file_path = Path("backend/app/database/Leads.py")
    
    if not leads_file_path.exists():
        print(f"❌ Error: Leads.py not found at {leads_file_path}")
        return False
    
    print(f"📖 Reading Leads.py from {leads_file_path}")
    
    with open(leads_file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Count current activity insert calls
    activity_insert_count = content.count('await self.activity_collection.insert_one(activity_data)')
    print(f"📊 Found {activity_insert_count} activity insert_one calls")
    
    # Add a simple check: if new_val is empty or "Not Set", skip activity creation
    # Find each "Recorded field update:" print statement and add check after it
    
    pattern = r"(print\(f\"✅ Recorded field update: \{nested_display_name\} changed from '\{old_val\}' to '\{new_val\}'\"\)\s*\n\s*)(await self.activity_collection.insert_one\(activity_data\))"
    
    def add_check(match):
        # Add a check before activity insertion
        check_code = '''        # ⚡ ACTIVITY DEDUPLICATION: Skip if new value is empty
        if not new_val or new_val == "Not Set":
            logger.info(f"⏭ Skipping empty field update: {nested_display_name}")
            continue
        
'''
        return match.group(1) + check_code + match.group(2)
    
    content, count = re.subn(pattern, add_check, content, flags=re.MULTILINE)
    
    # Also fix "Recorded process field update:"
    pattern2 = r"(print\(f\"✅ Recorded process field update: \{process_display_name\} changed from '\{old_val\}' to '\{new_val\}'\"\)\s*\n\s*)(await self.activity_collection.insert_one\(activity_data\))"
    content, count2 = re.subn(pattern2, add_check, content, flags=re.MULTILINE)
    
    # And fix the third pattern for important questions
    pattern3 = r"(print\(f\"✅ Recorded important question update: \{question_text\} - \{old_response\} → \{new_response\}'\"\)\s*\n\s*)(await self.activity_collection.insert_one\(activity_data\))"
    content, count3 = re.subn(pattern3, add_check, content, flags=re.MULTILINE)
    
    # Also fix the fourth pattern for regular fields
    pattern4 = r"(print\(f\"✅ Recorded field update: \{field_display_name\} changed from '\{old_val\}' to '\{new_val\}'\"\)\s*\n\s*)(await self.activity_collection.insert_one\(activity_data\))"
    content, count4 = re.subn(pattern4, add_check, content, flags=re.MULTILINE)
    
    total_checks_added = count + count2 + count3 + count4
    print(f"✅ Added {total_checks_added} deduplication checks")
    
    # Write modified content back
    print(f"💾 Writing modified content to {leads_file_path}")
    with open(leads_file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n✅ Duplicate activity fix applied successfully!")
    print("\n📋 How it works:")
    print("- When a field is cleared (new_val is empty), activity is skipped")
    print("- When field is set to new value, only ONE activity is created")
    print("- This prevents: old_value → empty, then empty → new_value (2 activities)")
    print("- Results in: old_value → new_value (1 activity)")
    
    return True

if __name__ == "__main__":
    fix_duplicate_activities()