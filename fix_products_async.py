#!/usr/bin/env python3

import re

def fix_products_async():
    """Fix all async methods in Products.py to use await"""
    
    file_path = "/home/ubuntu/RupiyaMe/backend/app/database/Products.py"
    
    with open(file_path, 'r') as file:
        content = file.read()
    
    # Define patterns to fix
    patterns = [
        # Basic database operations
        (r'(\s+)result = self\.([a-zA-Z_]+_collection)\.insert_one\(', r'\1result = await self.\2.insert_one('),
        (r'(\s+)result = self\.([a-zA-Z_]+_collection)\.update_one\(', r'\1result = await self.\2.update_one('),
        (r'(\s+)result = self\.([a-zA-Z_]+_collection)\.delete_one\(', r'\1result = await self.\2.delete_one('),
        (r'(\s+)result = self\.([a-zA-Z_]+_collection)\.find_one\(', r'\1result = await self.\2.find_one('),
        (r'(\s+)return self\.([a-zA-Z_]+_collection)\.find_one\(', r'\1return await self.\2.find_one('),
        (r'(\s+)return self\.([a-zA-Z_]+_collection)\.count_documents\(', r'\1return await self.\2.count_documents('),
        
        # Cursor operations - need to use to_list
        (r'(\s+)return list\(cursor\)', r'\1return await cursor.to_list(length=limit)'),
        (r'(\s+)sections = list\(cursor\)', r'\1sections = await cursor.to_list(length=None)'),
        (r'(\s+)fields = list\(cursor\)', r'\1fields = await cursor.to_list(length=None)'),
        (r'(\s+)submissions = list\(cursor\)', r'\1submissions = await cursor.to_list(length=limit)'),
        
        # Aggregate operations
        (r'(\s+)result = list\(self\.([a-zA-Z_]+_collection)\.aggregate\(', r'\1cursor = self.\2.aggregate(\n\1result = await cursor.to_list(length=None)'),
    ]
    
    # Apply patterns
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content)
    
    with open(file_path, 'w') as file:
        file.write(content)
    
    print("✓ Fixed async patterns in Products.py")

if __name__ == "__main__":
    fix_products_async()
