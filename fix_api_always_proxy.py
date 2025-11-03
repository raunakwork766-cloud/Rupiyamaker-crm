#!/usr/bin/env python3
import os
import re

# Directory to search
src_dir = '/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src'

# Pattern to find
pattern1 = re.compile(r"const API_BASE_URL = import\.meta\.env\.DEV \? '/api' : 'https://rupiyamaker\.com:8049';")
pattern2 = re.compile(r"const API_BASE_URL = import\.meta\.env\.DEV \? '/api' : \(import\.meta\.env\.VITE_API_URL \|\| 'https://rupiyamaker\.com:8049'\);")

# Replacement
replacement = "const API_BASE_URL = '/api'; // Always use API proxy"

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        content = pattern1.sub(replacement, content)
        content = pattern2.sub(replacement, content)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Fixed: {filepath}")
            return True
        return False
    except Exception as e:
        print(f"❌ Error fixing {filepath}: {e}")
        return False

# Walk through all files
fixed_count = 0
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.js', '.jsx')):
            filepath = os.path.join(root, file)
            if fix_file(filepath):
                fixed_count += 1

print(f"\n🎉 Total files fixed: {fixed_count}")
