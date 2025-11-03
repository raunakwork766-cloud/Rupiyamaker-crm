#!/usr/bin/env python3
"""
Script to fix remaining async issues in tasks routes by adding Request parameter
to all route functions that use database dependencies.
"""

import re
import sys

def fix_route_signatures(file_path):
    """Fix route function signatures to include Request parameter"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match route function definitions that use Depends()
    # but don't already have request: Request parameter
    pattern = r'(@router\.(get|post|put|delete|patch)\([^)]*\)\s*\n)(async def \w+\(\s*)((?:(?!\brequest:\s*Request\b)[^,)]+,?\s*)*)((?:.*?Depends\(.*?\).*?)*)(\):)'
    
    def replace_func(match):
        decorator = match.group(1)
        func_start = match.group(3)
        params_before = match.group(4)
        deps_params = match.group(5)
        func_end = match.group(6)
        
        # Check if this function uses database dependencies
        if 'Depends(' in deps_params:
            # Check if request: Request is already present
            if 'request: Request' not in params_before and 'request: Request' not in deps_params:
                # Add request: Request as the first parameter after function name
                if params_before.strip():
                    # There are other parameters, add request as first
                    params_before = params_before.rstrip(',\s')
                    if params_before:
                        new_params = f"\n    request: Request,\n    {params_before}"
                    else:
                        new_params = "\n    request: Request,\n    "
                else:
                    new_params = "\n    request: Request,\n    "
                    
                return f"{decorator}{func_start}{new_params}{deps_params}{func_end}"
        
        return match.group(0)
    
    # Apply the pattern
    content = re.sub(pattern, replace_func, content, flags=re.MULTILINE | re.DOTALL)
    
    # Additional patterns for edge cases
    patterns_to_fix = [
        # Routes that start with parameters but missing request
        (r'(@router\.(get|post|put|delete|patch)\([^)]*\)\s*\nasync def \w+\(\s*)(\w+: [^,]+,)((?:(?!\brequest:\s*Request\b).*?)*)(.*?Depends\(.*?\).*?)(\):)',
         r'\1request: Request,\n    \3\5\6'),
        
        # Routes with only dependencies, no other params
        (r'(@router\.(get|post|put|delete|patch)\([^)]*\)\s*\nasync def \w+\(\s*)((?:(?!\brequest:\s*Request\b).*?)*?)(.*?Depends\(.*?\).*?)(\s*\):)',
         r'\1request: Request,\n    \4\5'),
    ]
    
    for pattern, replacement in patterns_to_fix:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    
    # Write back the modified content
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Fixed route signatures in {file_path}")

if __name__ == "__main__":
    file_path = "/home/ubuntu/RupiyaMe/backend/app/routes/tasks.py"
    fix_route_signatures(file_path)
    print("Script completed!")
