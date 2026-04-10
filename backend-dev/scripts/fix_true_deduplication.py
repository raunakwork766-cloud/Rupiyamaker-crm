#!/usr/bin/env python3
"""
Proper deduplication fix: Track which fields have been processed
to prevent creating duplicate activities for the same logical field
"""

from pathlib import Path

def fix():
    """Add field tracking to prevent duplicate activities"""
    
    leads_file_path = Path("backend/app/database/Leads.py")
    
    if not leads_file_path.exists():
        print(f"❌ Error: Leads.py not found")
        return False
    
    print(f"📖 Reading Leads.py...")
    
    with open(leads_file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add a tracking set at the beginning of update_lead method
    # This will track which fields have already created activities
    
    # Find the line where we log "DATABASE update_lead START"
    tracking_addition = """        # ⚡ ACTIVITY DEDUPLICATION: Track fields to prevent duplicates
        # This set will track which fields have already created activities in this request
        fields_with_activity_created = set()
        
"""
    
    target_line = 'logger.info(f"🔵 ========== DATABASE update_lead START =========="'
    
    if target_line in content:
        print(f"✅ Found target line: {target_line[:50]}...")
        content = content.replace(target_line, tracking_addition + target_line)
        print(f"✅ Added field tracking")
    else:
        print(f"⚠️ Target line not found")
        return False
    
    # Now modify each activity creation to check if field already has an activity
    # For dynamic fields: use the field name as key
    # For regular fields: use the field name as key
    
    # Pattern 1: dynamic_fields activities
    # Find: activity_data = {
    # Before it, add: if nested_field in fields_with_activity_created: continue
    # And after insert: fields_with_activity_created.add(nested_field)
    
    # Pattern 2: regular field activities
    # Find: activity_data = {
    # Before it, add: if field_name in fields_with_activity_created: continue
    # And after insert: fields_with_activity_created.add(field_name)
    
    # Pattern 3: process_data activities
    # Find: activity_data = {
    # Before it, add: if process_field in fields_with_activity_created: continue
    # And after insert: fields_with_activity_created.add(process_field)
    
    # Pattern 4: important question activities
    # Find: activity_data = {
    # Before it, add: if question_id in fields_with_activity_created: continue
    # And after insert: fields_with_activity_created.add(question_id)
    
    import re
    
    # Pattern 1: Dynamic fields activity
    pattern1 = r"(\s+)nested_field = nested_change\.get\(\"from\", \"Not Set\"\)\s+# Format old and new values"
    replacement1 = r'\1                    # ⚡ ACTIVITY DEDUPLICATION: Skip if field already has activity\n\1                    if nested_field in fields_with_activity_created:\n\1                        logger.info(f"⏭ Skipping duplicate activity for: {{nested_display_name}}")\n\1                        continue\n\1\n\2                    nested_field = nested_change.get("from", "Not Set")'
    
    content, count1 = re.subn(pattern1, replacement1, content)
    print(f"✅ Added dedup check for dynamic fields (replaced {count1} occurrences)")
    
    # Add tracking after dynamic fields insert
    pattern1b = r"(await self\.activity_collection\.insert_one\(activity_data\))\s+(print\(f\"✅ Recorded field update: {nested_display_name} changed from '{{old_val}}' to '{{new_val}}'\")"
    replacement1b = r'\1\n\2                    # Track that we created activity for this field\n\2                    fields_with_activity_created.add(nested_field)\n\3'
    
    content, count1b = re.subn(pattern1b, replacement1b, content)
    print(f"✅ Added tracking for dynamic fields (replaced {count1b} occurrences)")
    
    # Pattern 2: Regular fields activity
    pattern2 = r"(\s+)field_name = field_name\.replace\('_', ' '\.title\(\)\s+# Format field name for better readability"
    replacement2 = r'\1                    # ⚡ ACTIVITY DEDUPLICATION: Skip if field already has activity\n\1                    if field_name in fields_with_activity_created:\n\1                        logger.info(f"⏭ Skipping duplicate activity for: {{field_display_name}}")\n\1                        continue\n\1\n\2                    field_name = field_name.replace("_", " ").title()'
    
    content, count2 = re.subn(pattern2, replacement2, content)
    print(f"✅ Added dedup check for regular fields (replaced {count2} occurrences)")
    
    # Add tracking after regular fields insert
    pattern2b = r"(await self\.activity_collection\.insert_one\(activity_data\))\s+(print\(f\"✅ Recorded field update: {field_display_name} changed from '{{old_val}}' to '{{new_val}}'\")"
    replacement2b = r'\1\n\2                    # Track that we created activity for this field\n\2                    fields_with_activity_created.add(field_name)\n\3'
    
    content, count2b = re.subn(pattern2b, replacement2b, content)
    print(f"✅ Added tracking for regular fields (replaced {count2b} occurrences)")
    
    # Pattern 3: Process fields activity
    pattern3 = r"(\s+)process_display_name = field_labels\.get\(process_field, process_field\.replace\('_', ' '\.title\(\)\)\s+# Map snake_case field names to readable labels"
    replacement3 = r'\1                    # ⚡ ACTIVITY DEDUPLICATION: Skip if field already has activity\n\1                    if process_field in fields_with_activity_created:\n\1                        logger.info(f"⏭ Skipping duplicate activity for: {{process_display_name}}")\n\1                        continue\n\1\n\2                    process_display_name = field_labels.get(process_field, process_field.replace("_", " ").title())'
    
    content, count3 = re.subn(pattern3, replacement3, content)
    print(f"✅ Added dedup check for process fields (replaced {count3} occurrences)")
    
    # Add tracking after process fields insert
    pattern3b = r"(await self\.activity_collection\.insert_one\(activity_data\))\s+(print\(f\"✅ Recorded process field update: {process_display_name} changed from '{{old_val}}' to '{{new_val}}'\")"
    replacement3b = r'\1\n\2                    # Track that we created activity for this field\n\2                    fields_with_activity_created.add(process_field)\n\3'
    
    content, count3b = re.subn(pattern3b, replacement3b, content)
    print(f"✅ Added tracking for process fields (replaced {count3b} occurrences)")
    
    # Pattern 4: Important questions activity
    pattern4 = r"(\s+)question_text = question_map\.get\(question_id, f\"Question {{question_id}}\"\)\s+# Get all questions from database to get question text"
    replacement4 = r'\1                    # ⚡ ACTIVITY DEDUPLICATION: Skip if question already has activity\n\1                    if question_id in fields_with_activity_created:\n\1                        logger.info(f"⏭ Skipping duplicate activity for question: {{question_text}}")\n\1                        continue\n\1\n\2                    question_text = question_map.get(question_id, f"Question {question_id}")'
    
    content, count4 = re.subn(pattern4, replacement4, content)
    print(f"✅ Added dedup check for important questions (replaced {count4} occurrences)")
    
    # Add tracking after important questions insert
    pattern4b = r"(await self\.activity_collection\.insert_one\(activity_data\))\s+(print\(f\"✅ Recorded important question update: {{question_text}} - {{old_response}} → {{new_response}}'\")"
    replacement4b = r'\1\n\2                    # Track that we created activity for this field\n\2                    fields_with_activity_created.add(question_id)\n\3'
    
    content, count4b = re.subn(pattern4b, replacement4b, content)
    print(f"✅ Added tracking for important questions (replaced {count4b} occurrences)")
    
    # Write modified content back
    print(f"💾 Writing modified content to backend/app/database/Leads.py")
    
    with open(leads_file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    total_changes = count1 + count1b + count2 + count2b + count3 + count3b + count4 + count4b
    print(f"✅ Deduplication fix applied successfully!")
    print(f"📋 Total modifications: {total_changes}")
    print(f"\n📋 How it works:")
    print(f"- Added tracking set: fields_with_activity_created")
    print(f"- Each field is checked against this set before creating activity")
    print(f"- If field already has activity, creation is skipped")
    print(f"- Field is added to set after activity is created")
    print(f"- This prevents duplicates from: top-level + dynamic_fields")
    
    return True

if __name__ == "__main__":
    fix()