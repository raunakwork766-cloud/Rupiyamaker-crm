#!/usr/bin/env python3
"""
Script to safely remove print statements from Python files while preserving syntax
"""
import re
import sys

def remove_print_statements(file_path):
    """Remove print statements from a Python file while preserving indentation and structure"""
    
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    modified_lines = []
    
    for line in lines:
        # Match print statements (handling various formats)
        if re.match(r'^\s+print\s*\(.*\)\s*$', line):
            # Replace with a comment maintaining the same indentation
            indent = re.match(r'^(\s*)', line).group(1)
            modified_lines.append(f"{indent}# Removed print statement\n")
        else:
            modified_lines.append(line)
    
    # Write back to file
    with open(file_path, 'w') as f:
        f.writelines(modified_lines)
    
    print(f"✓ Removed print statements from {file_path}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 remove_prints.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    remove_print_statements(file_path)
