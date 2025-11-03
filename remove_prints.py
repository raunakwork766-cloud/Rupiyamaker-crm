#!/usr/bin/env python3
"""
Simple script to remove print statements from attendance.py
"""
import re

def remove_print_statements(file_path):
    """Remove print statements from the file"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    modified_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this line contains a print statement
        stripped = line.strip()
        if stripped.startswith('print('):
            # Find the indentation level
            indent = len(line) - len(line.lstrip())
            spaces = ' ' * indent
            
            # Replace with a comment
            if 'DEBUG' in line or 'Found' in line or 'Processing' in line:
                modified_lines.append(f"{spaces}# Debug info logged via middleware")
            elif 'Error' in line or 'ERROR' in line:
                modified_lines.append(f"{spaces}# Error logged via middleware")
            elif 'Warning' in line:
                modified_lines.append(f"{spaces}# Warning logged via middleware")
            elif 'Auto-created' in line or 'Successfully' in line:
                modified_lines.append(f"{spaces}# Operation logged via middleware")
            else:
                modified_lines.append(f"{spaces}# Logged via middleware")
        else:
            modified_lines.append(line)
        
        i += 1
    
    # Write back to file
    with open(file_path, 'w') as f:
        f.write('\n'.join(modified_lines))
    
    print(f"✅ Removed all print statements from {file_path}")

if __name__ == "__main__":
    remove_print_statements("/home/soheru/Rupiyamakers/backend/app/routes/attendance.py")
