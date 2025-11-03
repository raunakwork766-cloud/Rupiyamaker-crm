import re

# Read the file
with open('app/routes/leaves.py', 'r') as f:
    content = f.read()

# Add dependency imports to function signatures that use database instances
functions_to_fix = [
    'create_leave',
    'list_leaves', 
    'get_leave',
    'update_leave',
    'approve_reject_leave',
    'get_leave_attachments',
    'upload_leave_attachment',
    'get_leave_statistics',
    'delete_leave',
    'get_leave_history',
    'delete_leave_attachment'
]

# Add leaves_db dependency to route functions
for func_name in functions_to_fix:
    # Find the function definition
    pattern = rf'(@router\.\w+.*?\n)(async def {func_name}\([^)]*?\)):' 
    def replacement(match):
        decorator = match.group(1)
        func_def = match.group(2)
        # Add leaves_db dependency if not already present
        if 'leaves_db:' not in func_def:
            # Find the closing parenthesis and add dependency before it
            if func_def.endswith('):'):
                if '(' in func_def and func_def.count('(') == func_def.count(')'):
                    # Check if there are already parameters
                    if '(' in func_def and not func_def.endswith('():'):
                        func_def = func_def[:-2] + ',\n    leaves_db: LeavesDB = Depends(get_leaves_db)\n):'
                    else:
                        func_def = func_def[:-2] + '\n    leaves_db: LeavesDB = Depends(get_leaves_db)\n):'
        return decorator + func_def
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Write back
with open('app/routes/leaves.py', 'w') as f:
    f.write(content)

print("✓ Dependencies updated in leaves routes")
