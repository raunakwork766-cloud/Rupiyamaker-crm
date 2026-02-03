#!/usr/bin/env python3
"""
Simple fix: Skip creating activities when new_val is empty.
This prevents duplicate activities when clearing and immediately re-entering values.
"""

from pathlib import Path

def fix():
    """Add check to skip empty values"""
    
    leads_file_path = Path("backend/app/database/Leads.py")
    
    if not leads_file_path.exists():
        print(f"❌ Error: Leads.py not found")
        return False
    
    print(f"📖 Reading Leads.py...")
    
    with open(leads_file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple: add check before ALL activity insertions
    # Find all places where we insert activity and add a check
    
    # Pattern: print(f"... changed from '{old_val}' to '{new_val}'")
    # Right after this, add check
    
    lines = content.split('\n')
    new_lines = []
    checks_added = 0
    
    i = 0
    while i < len(lines):
        line = lines[i]
        new_lines.append(line)
        
        # Check if this is an activity insert for field updates
        # Look for: print(f"✅ Recorded field update: ... changed from ...
        if '✅ Recorded field update:' in line and 'changed from' in line and "await self.activity_collection.insert_one(activity_data)" in lines[i+1]:
            # Add deduplication check before the insert
            indent = '        '  # 8 spaces
            
            check_lines = [
                f"{indent}# ⚡ ACTIVITY DEDUPLICATION: Skip if new value is empty",
                f"{indent}# This prevents duplicate activities when field is cleared then immediately set",
                f"{indent}if not new_val or new_val in ['Not Set', '']:",
                f"{indent}    logger.info(f'⏭ Skipping empty field update: {{nested_display_name if 'nested_display_name' in locals() else field_display_name if 'field_display_name' in locals() else 'field'}}')",
                f"{indent}    continue",
                ""
            ]
            
            # Insert check lines before the await line
            for check_line in check_lines:
                new_lines.append(check_line)
            
            checks_added += 1
        
        i += 1
    
    if checks_added == 0:
        print("⚠ No activity insertions found to modify")
        return True
    
    # Write back
    print(f"💾 Writing modified content...")
    with open(leads_file_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))
    
    print(f"✅ Added {checks_added} deduplication checks")
    print("\n📋 How it works:")
    print("- When new_val is empty or 'Not Set', activity creation is skipped")
    print("- Only ONE activity is created: old_value → new_value")
    print("- No more: old_value → empty → new_value (2 activities)")
    
    return True

if __name__ == "__main__":
    fix()