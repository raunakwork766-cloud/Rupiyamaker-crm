#!/usr/bin/env python3
"""
Script to remove duplicate 'request: Request,' parameters from function signatures.
"""

import re

def remove_duplicate_requests(file_path):
    """Remove duplicate request: Request parameters from function signatures"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match multiple request: Request parameters in function signatures
    # This will find function definitions and remove duplicate request parameters
    pattern = r'(async def \w+\([^)]*?)(request: Request,\s*)(.*?)(request: Request,\s*)(.*?\):)'
    
    def replace_func(match):
        func_start = match.group(1)
        first_request = match.group(2)
        middle_params = match.group(3)
        duplicate_request = match.group(4)  # This is the duplicate we want to remove
        end_params = match.group(5)
        
        # Return without the duplicate request parameter
        return f"{func_start}{first_request}{middle_params}{end_params}"
    
    # Apply the pattern repeatedly until no more duplicates
    while re.search(pattern, content, flags=re.MULTILINE | re.DOTALL):
        content = re.sub(pattern, replace_func, content, flags=re.MULTILINE | re.DOTALL)
    
    # Also handle cases where there might be more than 2 duplicates
    # Pattern for 3 or more request parameters
    pattern2 = r'(request: Request,\s*)(request: Request,\s*)'
    while re.search(pattern2, content):
        content = re.sub(pattern2, r'\1', content)
    
    # Write back the modified content
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Removed duplicate request parameters from {file_path}")

if __name__ == "__main__":
    file_path = "/home/ubuntu/RupiyaMe/backend/app/routes/tasks.py"
    remove_duplicate_requests(file_path)
    print("Duplicate removal completed!")
