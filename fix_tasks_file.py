#!/usr/bin/env python3
"""
Fix tasks.py for async Motor MongoDB
"""
import re

def fix_tasks_file():
    """Apply fixes to tasks.py for async Motor compatibility"""
    print("Fixing tasks.py file...")
    
    # Read the file
    with open('tasks.py', 'r') as f:
        content = f.read()
    
    # Fix 1: Remove await from get_visible_tasks_filter calls
    content = re.sub(
        r'visibility_filter = await tasks_db\.get_visible_tasks_filter\(', 
        r'visibility_filter = tasks_db.get_visible_tasks_filter(', 
        content
    )
    
    # Fix 2: Add await to collection.count_documents calls
    content = re.sub(
        r'(\w+_db)\.collection\.count_documents\(', 
        r'await \1.collection.count_documents(', 
        content
    )
    
    # Fix 3: Add await to collection.find_one calls
    content = re.sub(
        r'(\w+)_task = tasks_db\.collection\.find_one\(', 
        r'\1_task = await tasks_db.collection.find_one(', 
        content
    )
    
    # Fix 4: Convert find() calls to async pattern
    content = re.sub(
        r'(\w+) = (\w+_db)\.collection\.find\((.*?)\)\.sort\((.*?)\)\.limit\((\d+)\)',
        r'\1 = await \2.collection.find(\3).sort(\4).limit(\5).to_list(length=\5)', 
        content
    )
    
    # Save the modified file
    with open('tasks.py', 'w') as f:
        f.write(content)
    
    print("✅ All fixes applied successfully!")

if __name__ == "__main__":
    fix_tasks_file()
