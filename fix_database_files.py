#!/usr/bin/env python3

import re
import os

def fix_database_files():
    """Fix all remaining database files to use async Motor"""
    
    database_dir = "/home/ubuntu/RupiyaMe/backend/app/database"
    
    files_to_fix = [
        "EmployeeActivity.py",
        "Holidays.py", 
        "ImportantQuestions.py"
    ]
    
    for filename in files_to_fix:
        file_path = os.path.join(database_dir, filename)
        if not os.path.exists(file_path):
            print(f"Skipping {filename} - file not found")
            continue
            
        print(f"Fixing {filename}...")
        
        with open(file_path, 'r') as file:
            content = file.read()
        
        # Fix import and class patterns
        import_patterns = [
            (r'from pymongo import.*\n', ''),  # Remove pymongo imports
            (r'from motor\.motor_asyncio import.*\n', ''),  # Remove duplicate motor imports
            (r'class ([A-Za-z]+):',
             r'from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase\n'
             r'from app.config import Config\n'
             r'import pymongo\n\n'
             r'class \1:'),
        ]
        
        # Fix class initialization
        init_patterns = [
            (r'def __init__\(self\):\s*\n\s*self\.([a-zA-Z_]+) = db\["([^"]+)"\]',
             r'def __init__(self, db=None):\n'
             r'        if db is None:\n'
             r'            client = AsyncIOMotorClient(Config.MONGO_URI)\n'
             r'            self.db = client[Config.COMPANY_NAME]\n'
             r'        else:\n'
             r'            self.db = db\n'
             r'        self.\1 = self.db["\2"]'),
        ]
        
        # Fix database operations
        operation_patterns = [
            # Basic operations
            (r'(\s+)result = self\.([a-zA-Z_]+)\.insert_one\(', r'\1result = await self.\2.insert_one('),
            (r'(\s+)result = self\.([a-zA-Z_]+)\.update_one\(', r'\1result = await self.\2.update_one('),
            (r'(\s+)result = self\.([a-zA-Z_]+)\.delete_one\(', r'\1result = await self.\2.delete_one('),
            (r'(\s+)result = self\.([a-zA-Z_]+)\.find_one\(', r'\1result = await self.\2.find_one('),
            (r'(\s+)return self\.([a-zA-Z_]+)\.find_one\(', r'\1return await self.\2.find_one('),
            (r'(\s+)return self\.([a-zA-Z_]+)\.count_documents\(', r'\1return await self.\2.count_documents('),
            
            # Cursor operations
            (r'(\s+)([a-zA-Z_]+) = list\(self\.([a-zA-Z_]+)\.find\(',
             r'\1cursor = self.\3.find('),
            (r'(\s+)\.sort\("([^"]+)", DESCENDING\)\.skip\(([^)]+)\)\.limit\(([^)]+)\)\)',
             r'.sort("\2", pymongo.DESCENDING).skip(\3).limit(\4)\n\1\2 = await cursor.to_list(length=\4)'),
            (r'(\s+)\.sort\("([^"]+)", ASCENDING\)\.skip\(([^)]+)\)\.limit\(([^)]+)\)\)',
             r'.sort("\2", pymongo.ASCENDING).skip(\3).limit(\4)\n\1\2 = await cursor.to_list(length=\4)'),
            
            # Fix ASCENDING/DESCENDING references
            (r'DESCENDING', r'pymongo.DESCENDING'),
            (r'ASCENDING', r'pymongo.ASCENDING'),
        ]
        
        # Apply patterns
        for pattern, replacement in import_patterns + init_patterns + operation_patterns:
            content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
        
        # Add init_indexes method if not present
        if 'async def init_indexes' not in content:
            class_match = re.search(r'class ([A-Za-z]+):', content)
            if class_match:
                class_name = class_match.group(1)
                collection_match = re.search(r'self\.([a-zA-Z_]+) = self\.db\["([^"]+)"\]', content)
                if collection_match:
                    collection_var = collection_match.group(1)
                    
                    init_method = f'''
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Add indexes as needed
            await self.{collection_var}.create_index("created_at")
            print("✓ {class_name} database indexes created successfully")
        except Exception as e:
            print(f"{class_name} index creation warning (may already exist): {{e}}")
'''
                    # Insert after the __init__ method
                    init_end = re.search(r'(def __init__.*?\n(?:\s{4,}.*\n)*)', content, re.MULTILINE)
                    if init_end:
                        insert_pos = init_end.end()
                        content = content[:insert_pos] + init_method + content[insert_pos:]
        
        with open(file_path, 'w') as file:
            file.write(content)
        
        print(f"✓ Fixed {filename}")

if __name__ == "__main__":
    fix_database_files()
    print("✓ All database files conversion completed")
