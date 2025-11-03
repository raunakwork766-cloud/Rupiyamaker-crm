#!/usr/bin/env python3
import re

# Read the file
with open('/home/ubuntu/RupiyaMe/backend/app/routes/users.py', 'r') as f:
    content = f.read()

# List of patterns to fix
patterns = [
    # Fix remaining if statements and standalone calls
    (r'(\s+)if users_db\.get_user_by_username\(', r'\1if await users_db.get_user_by_username('),
    (r'(\s+)if user\.email and users_db\.get_user_by_email\(', r'\1if user.email and await users_db.get_user_by_email('),
    (r'(\s+)if users_db\.get_user_by_email\(', r'\1if await users_db.get_user_by_email('),
    (r'(\s+)if not users_db\.get_user\(', r'\1if not await users_db.get_user('),
    (r'(\s+)if users_db\.get_user\(', r'\1if await users_db.get_user('),
]

# Apply patterns
for pattern, replacement in patterns:
    content = re.sub(pattern, replacement, content)

# Write back to file
with open('/home/ubuntu/RupiyaMe/backend/app/routes/users.py', 'w') as f:
    f.write(content)

print("Fixed remaining async calls in users.py")
