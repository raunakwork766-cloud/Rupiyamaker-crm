#!/usr/bin/env python3

import os
import re

def update_route_dependencies():
    """Update all route files to use async database dependencies"""
    
    routes_dir = "/home/ubuntu/RupiyaMe/backend/app/routes"
    
    # Mapping of old database imports to new async database dependencies
    database_mappings = {
        'UsersDB': 'users_db',
        'LeadsDB': 'leads_db', 
        'TasksDB': 'tasks_db',
        'RolesDB': 'roles_db',
        'DepartmentsDB': 'departments_db',
        'AttendanceDB': 'attendance_db',
        'SettingsDB': 'settings_db',
        'TicketsDB': 'tickets_db',
        'NotificationsDB': 'notifications_db',
        'LeavesDB': 'leaves_db',
        'WarningDB': 'warnings_db',
        'LoanTypesDB': 'loan_types_db',
        'EmployeeAttachmentsDB': 'employee_attachments_db',
        'EmployeeRemarksDB': 'employee_remarks_db',
        'EmployeeActivityDB': 'employee_activity_db',
        'ProductsDB': 'products_db',
        'HolidaysDB': 'holidays_db',
        'ImportantQuestionsDB': 'important_questions_db'
    }
    
    # Get all Python files in routes directory
    route_files = [f for f in os.listdir(routes_dir) if f.endswith('.py') and not f.startswith('__')]
    
    print(f"Found {len(route_files)} route files to update")
    
    for filename in route_files:
        file_path = os.path.join(routes_dir, filename)
        print(f"Processing {filename}...")
        
        with open(file_path, 'r') as file:
            content = file.read()
        
        original_content = content
        
        # Check if file uses any database classes
        uses_database = False
        for db_class in database_mappings.keys():
            if db_class in content:
                uses_database = True
                break
        
        if not uses_database:
            print(f"  Skipping {filename} - no database usage found")
            continue
        
        # Add database dependency import at the top
        if 'from app.database import get_database_instances' not in content:
            # Find the last import line
            import_pattern = r'(from app\.[^\n]*\n)'
            matches = list(re.finditer(import_pattern, content))
            if matches:
                last_import_pos = matches[-1].end()
                new_import = 'from app.database import get_database_instances\n'
                content = content[:last_import_pos] + new_import + content[last_import_pos:]
        
        # Replace old dependency functions with new async dependency
        for db_class, db_instance in database_mappings.items():
            # Replace dependency functions like def get_users_db(): return UsersDB()
            old_function_pattern = rf'def get_{db_instance.replace("_db", "")}_db\(\):\s*\n\s*return {db_class}\(\)'
            new_function = f'async def get_{db_instance.replace("_db", "")}_db():\n    db_instances = get_database_instances()\n    return db_instances["{db_instance.replace("_db", "")}"]'
            content = re.sub(old_function_pattern, new_function, content)
            
            # Also handle variations
            old_function_pattern2 = rf'def get_{db_instance.replace("_db", "")}_db\(\):\s*return {db_class}\(\)'
            content = re.sub(old_function_pattern2, new_function, content)
        
        # Update route function signatures to be async if they use database dependencies
        # Look for route decorators followed by function definitions
        route_pattern = r'(@router\.(get|post|put|delete|patch)\([^)]*\)\s*(?:\n[^def]*)*\n)(def\s+\w+\s*\([^)]*\):)'
        
        def make_route_async(match):
            decorator_part = match.group(1)
            function_signature = match.group(4)
            
            # Check if this function uses database dependencies
            if any(f'{db_instance.replace("_db", "")}_db:' in function_signature for db_instance in database_mappings.values()):
                if not function_signature.startswith('async def'):
                    function_signature = function_signature.replace('def ', 'async def ', 1)
            
            return decorator_part + function_signature
        
        content = re.sub(route_pattern, make_route_async, content, flags=re.MULTILINE)
        
        # Write updated content if changes were made
        if content != original_content:
            with open(file_path, 'w') as file:
                file.write(content)
            print(f"  ✓ Updated {filename}")
        else:
            print(f"  No changes needed for {filename}")

if __name__ == "__main__":
    update_route_dependencies()
    print("✓ Route dependencies update completed")
