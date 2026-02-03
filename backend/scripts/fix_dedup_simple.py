#!/usr/bin/env python3
"""
Simple deduplication fix: Add tracking set to prevent duplicate activities
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
    
    # Add tracking set at the beginning of update_lead method
    tracking_addition = """        # ⚡ ACTIVITY DEDUPLICATION: Track fields to prevent duplicates
        # This set will track which fields have already created activities in this request
        fields_with_activity_created = set()
        
"""
    
    target_line = 'logger.info(f"🔵 ========== DATABASE update_lead START =========="'
    
    if target_line in content:
        content = content.replace(target_line, tracking_addition + target_line)
        print(f"✅ Added field tracking set")
    else:
        print(f"⚠️ Target line not found")
        return False
    
    # Now we need to manually add deduplication checks
    # Let's do this with specific, targeted replacements
    
    # For dynamic_fields: find the activity_data creation for nested fields
    # and add a check before it
    
    # We'll use search for a unique pattern and replace with the check + original
    
    # Pattern 1: Check before dynamic_fields activity creation
    # Find a unique line near where we create activity for nested fields
    search1 = """                        nested_display_name = nested_field.replace('_', ' ').title()
                        
                        # Format old and new values
                        old_val = nested_change.get("from", "Not Set")"""
    
    replace1 = """                        nested_display_name = nested_field.replace('_', ' ').title()
                        
                        # ⚡ ACTIVITY DEDUPLICATION: Skip if field already has activity
                        if nested_field in fields_with_activity_created:
                            logger.info(f"⏭ Skipping duplicate activity for: {nested_display_name}")
                            continue
                        
                        # Format old and new values
                        old_val = nested_change.get("from", "Not Set")"""
    
    if search1 in content:
        content = content.replace(search1, replace1)
        print(f"✅ Added dedup check for dynamic_fields")
    
    # Pattern 1b: Add tracking after dynamic_fields activity creation
    search1b = 'print(f"✅ Recorded field update: {nested_display_name} changed from \'{old_val}\' to \'{new_val}\'")'
    replace1b = '''print(f"✅ Recorded field update: {nested_display_name} changed from \'{old_val}\' to \'{new_val}\'")
                        # Track that we created activity for this field
                        fields_with_activity_created.add(nested_field)'''
    
    if search1b in content:
        content = content.replace(search1b, replace1b)
        print(f"✅ Added tracking for dynamic_fields")
    
    # Pattern 2: Check before regular field activity creation
    search2 = """                    field_display_name = field_name.replace('_', ' ').title()
                    
                    # Special handling for important questions field if it's at top level"""
    
    replace2 = """                    field_display_name = field_name.replace('_', ' ').title()
                    
                    # ⚡ ACTIVITY DEDUPLICATION: Skip if field already has activity
                    if field_name in fields_with_activity_created:
                        logger.info(f"⏭ Skipping duplicate activity for: {field_display_name}")
                        continue
                    
                    # Special handling for important questions field if it's at top level"""
    
    if search2 in content:
        content = content.replace(search2, replace2)
        print(f"✅ Added dedup check for regular fields")
    
    # Pattern 2b: Add tracking after regular field activity creation
    search2b = 'print(f"✅ Recorded field update: {field_display_name} changed from \'{old_val}\' to \'{new_val}\'")'
    
    # We need to be careful - there are multiple occurrences
    # Let's find the one that's NOT followed by another dedup comment
    
    # Count occurrences
    count = content.count(search2b)
    print(f"Found {count} occurrences of regular field activity")
    
    # We want to replace all regular field activity print statements
    # But we need to be careful about context
    
    # Let's split the file and do line-by-line processing
    lines = content.split('\n')
    new_lines = []
    i = 0
    modified_count = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this is a print statement for regular field update
        if 'print(f"✅ Recorded field update:' in line and 'changed from' in line and 'field_display_name' in line:
            # Check if it's for regular fields (not dynamic or process)
            # Look backwards to find context
            context_found = False
            for j in range(max(0, i-30), i):
                if 'regular field change (not nested)' in lines[j]:
                    context_found = True
                    break
                if 'nested process_data changes' in lines[j]:
                    context_found = True
                    break
                if 'field_name == "dynamic_fields"' in lines[j]:
                    break
            
            if context_found:
                # Add tracking after this line
                indent = '                    '
                new_lines.append(line)
                new_lines.append(f'{indent}# Track that we created activity for this field')
                new_lines.append(f'{indent}fields_with_activity_created.add(field_name)')
                modified_count += 1
                i += 1
                continue
        
        new_lines.append(line)
        i += 1
    
    content = '\n'.join(new_lines)
    
    if modified_count > 0:
        print(f"✅ Added tracking for regular fields ({modified_count} locations)")
    
    # Pattern 3: Check before process_data activity creation
    search3 = """                        process_display_name = field_labels.get(process_field, process_field.replace('_', ' ').title())
                        
                        # Format old and new values"""
    
    replace3 = """                        process_display_name = field_labels.get(process_field, process_field.replace('_', ' ').title())
                        
                        # ⚡ ACTIVITY DEDUPLICATION: Skip if field already has activity
                        if process_field in fields_with_activity_created:
                            logger.info(f"⏭ Skipping duplicate activity for: {process_display_name}")
                            continue
                        
                        # Format old and new values"""
    
    if search3 in content:
        content = content.replace(search3, replace3)
        print(f"✅ Added dedup check for process_data")
    
    # Pattern 3b: Add tracking after process_data activity creation
    search3b = 'print(f"✅ Recorded process field update: {process_display_name} changed from \'{old_val}\' to \'{new_val}\'")'
    replace3b = '''print(f"✅ Recorded process field update: {process_display_name} changed from \'{old_val}\' to \'{new_val}\'")
                        # Track that we created activity for this field
                        fields_with_activity_created.add(process_field)'''
    
    if search3b in content:
        content = content.replace(search3b, replace3b)
        print(f"✅ Added tracking for process_data")
    
    # Pattern 4: Check before important questions activity creation
    search4 = """                        question_text = question_map.get(question_id, f"Question {question_id}")
                        
                        # Get old and new responses"""
    
    replace4 = """                        question_text = question_map.get(question_id, f"Question {question_id}")
                        
                        # ⚡ ACTIVITY DEDUPLICATION: Skip if question already has activity
                        if question_id in fields_with_activity_created:
                            logger.info(f"⏭ Skipping duplicate activity for question: {question_text}")
                            continue
                        
                        # Get old and new responses"""
    
    if search4 in content:
        content = content.replace(search4, replace4)
        print(f"✅ Added dedup check for important questions")
    
    # Pattern 4b: Add tracking after important questions activity creation
    search4b = 'print(f"✅ Recorded important question update: {question_text} - {old_response} → {new_response}")'
    replace4b = '''print(f"✅ Recorded important question update: {question_text} - {old_response} → {new_response}")
                        # Track that we created activity for this field
                        fields_with_activity_created.add(question_id)'''
    
    if search4b in content:
        content = content.replace(search4b, replace4b)
        print(f"✅ Added tracking for important questions")
    
    # Write modified content back
    print(f"💾 Writing modified content to backend/app/database/Leads.py")
    
    with open(leads_file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ Deduplication fix applied successfully!")
    print(f"\n📋 How it works:")
    print(f"- Added tracking set: fields_with_activity_created")
    print(f"- Each field is checked against this set before creating activity")
    print(f"- If field already has activity, creation is skipped")
    print(f"- Field is added to set after activity is created")
    print(f"- This prevents duplicates from: top-level + dynamic_fields")
    
    return True

if __name__ == "__main__":
    fix()