#!/usr/bin/env python3
"""
Route Conversion Script for Async Motor Database Pattern

This script automatically converts FastAPI route files to use the new async Motor 
database pattern with dependency injection.

Usage: python convert_routes_to_async.py
"""

import os
import re
import sys
from pathlib import Path

def convert_route_file(file_path):
    """Convert a single route file to use async database pattern"""
    print(f"Converting {file_path}...")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        conversions_made = 0
        
        # 1. Add imports for database dependencies
        if 'from app.utils.database_dependencies import' not in content:
            # Find the last import line
            import_pattern = r'(from app\.[^\n]*\n)'
            matches = list(re.finditer(import_pattern, content))
            if matches:
                last_import = matches[-1]
                insert_pos = last_import.end()
                dependency_import = "from app.utils.database_dependencies import (\n    get_users_db, get_leads_db, get_tasks_db, get_roles_db, get_departments_db,\n    get_attendance_db, get_settings_db, get_tickets_db, get_notifications_db,\n    get_leaves_db, get_warnings_db\n)\n"
                content = content[:insert_pos] + dependency_import + content[insert_pos:]
                conversions_made += 1
        
        # 2. Convert database method calls to await
        # Pattern: database_instance.method_name( -> await database_instance.method_name(
        db_method_pattern = r'(\w+_db)\.(\w+)\s*\('
        matches = list(re.finditer(db_method_pattern, content))
        
        # Work backwards to avoid position shifts
        for match in reversed(matches):
            # Check if already has await
            before_match = content[:match.start()].strip()
            if not before_match.endswith('await'):
                # Add await
                content = content[:match.start()] + 'await ' + content[match.start():]
                conversions_made += 1
        
        # 3. Convert synchronous database instantiations
        # Pattern: database_class = DatabaseClass() -> database_class = None
        db_instantiation_pattern = r'(\w+_db)\s*=\s*\w+DB\(\)'
        content = re.sub(db_instantiation_pattern, r'\1 = None  # Use dependency injection', content)
        
        # 4. Add Request import if not present
        if 'from fastapi import' in content and 'Request' not in content:
            content = re.sub(r'from fastapi import ([^)]*)', r'from fastapi import \1, Request', content)
            conversions_made += 1
        
        # Only write if changes were made
        if content != original_content:
            # Create backup
            backup_path = str(file_path) + '.backup'
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(original_content)
            
            # Write converted content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"✓ Converted {file_path} ({conversions_made} changes)")
            return True
        else:
            print(f"- No changes needed for {file_path}")
            return False
            
    except Exception as e:
        print(f"✗ Error converting {file_path}: {e}")
        return False

def main():
    """Main conversion function"""
    routes_dir = Path('/home/ubuntu/RupiyaMe/backend/app/routes')
    
    if not routes_dir.exists():
        print("Routes directory not found!")
        return
    
    # Get all Python files in routes directory
    route_files = list(routes_dir.glob('*.py'))
    print(f"Found {len(route_files)} route files to convert")
    
    converted_count = 0
    for route_file in route_files:
        if route_file.name != '__init__.py':  # Skip __init__.py
            if convert_route_file(route_file):
                converted_count += 1
    
    print(f"\n🎉 Conversion completed! {converted_count}/{len(route_files)-1} files converted")
    print("Note: This is a basic conversion. You may need to manually:")
    print("1. Add database dependencies to route function parameters")
    print("2. Fix any remaining sync database calls") 
    print("3. Test each route to ensure proper async behavior")

if __name__ == "__main__":
    main()
