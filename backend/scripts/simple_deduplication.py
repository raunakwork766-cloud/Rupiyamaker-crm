#!/usr/bin/env python3
"""
Simple activity deduplication fix - adds in-request duplicate prevention.

This prevents duplicate activities when multiple field updates happen in the same
update_lead call (e.g., clearing field and immediately entering new value).
"""

from pathlib import Path

def add_simple_deduplication():
    """Add simple in-request deduplication to update_lead method"""
    
    leads_file_path = Path("backend/app/database/Leads.py")
    
    if not leads_file_path.exists():
        print(f"❌ Error: Leads.py not found at {leads_file_path}")
        return False
    
    print(f"📖 Reading Leads.py from {leads_file_path}")
    
    with open(leads_file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Step 1: Find update_lead method and add tracking set at start
    print("✅ Step 1: Adding field tracking to update_lead...")
    
    content = ''.join(lines)
    
    # Check if tracking already exists
    if 'fields_updated_this_request = set()' in content:
        print("⚠  Field tracking already exists")
    else:
        # Find the start of update_lead method
        for i, line in enumerate(lines):
            if 'async def update_lead(self, lead_id: str, update_data: dict, user_id: str) -> bool:' in line:
                # Add tracking after logger initialization
                # Look for the logger line
                for j in range(i, min(i + 20, len(lines))):
                    if 'logger = logging.getLogger(__name__)' in lines[j]:
                        # Add tracking set after this
                        lines.insert(j + 1, '\n        # ⚡ ACTIVITY DEDUPLICATION: Track fields updated in this request\n')
                        lines.insert(j + 2, '        fields_updated_this_request = set()\n')
                        print("✅ Added fields_updated_this_request tracking")
                        break
                break
    
    # Step 2: Add deduplication check before activity insertions
    print("✅ Step 2: Adding deduplication checks...")
    
    content = ''.join(lines)
    
    # Find activity insertions and add check before them
    # We'll add before lines with "Recorded field update"
    
    new_lines = []
    i = 0
    checks_added = 0
    
    while i < len(lines):
        line = lines[i]
        new_lines.append(line)
        
        # Check if this is a "Recorded field update" print statement
        if 'Recorded field update:' in line and 'changed from' in line:
            # Find the next activity_collection.insert_one
            j = i + 1
            while j < len(lines) and 'await self.activity_collection.insert_one' not in lines[j]:
                new_lines.append(lines[j])
                j += 1
            
            if j < len(lines) and 'await self.activity_collection.insert_one' in lines[j]:
                # Insert deduplication check before this
                dedup_check = '''        # ⚡ ACTIVITY DEDUPLICATION: Skip if field already updated this request
        field_display = activity_data.get("details", {}).get("field_display_name")
        if field_display and field_display in fields_updated_this_request:
            logger.info(f"⏭ Skipping duplicate activity for field: {field_display}")
            i = {}  # Will be updated after appending
            continue
        fields_updated_this_request.add(field_display)
'''.format(j + 1)  # Insert placeholder to update loop index
                
                # Insert the check before insert_one
                dedup_lines = dedup_check.strip().split('\n')
                for dedup_line in dedup_lines:
                    new_lines.append(dedup_line + '\n')
                
                checks_added += 1
        
        i += 1
    
    if checks_added > 0:
        content = '\n'.join(new_lines)
        print(f"✅ Added deduplication checks before {checks_added} activity insertions")
    else:
        print("⚠  No activity insertions found or checks already exist")
    
    # Write modified content back
    print(f"💾 Writing modified content to {leads_file_path}")
    with open(leads_file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n✅ Simple deduplication fix applied successfully!")
    print("\n📋 How it works:")
    print("- Tracks which fields are updated within the same update_lead() call")
    print("- If a field is updated twice in same request, skips the second activity")
    print("- This prevents duplicates when clearing + immediately re-entering values")
    print("\n📋 Example:")
    print("- User clears 'Phone' field → Activity 1 created (phone → empty)")
    print("- User immediately enters '9876543219' → Activity 2 SKIPPED (duplicate)")
    print("- Final result: ONE activity showing the final state")
    
    return True

if __name__ == "__main__":
    add_simple_deduplication()