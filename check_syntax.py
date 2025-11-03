#!/usr/bin/env python3

import os
import subprocess
import re

def check_and_fix_syntax():
    """Check and fix syntax errors in route files"""
    
    routes_dir = "/home/ubuntu/RupiyaMe/backend/app/routes"
    route_files = [f for f in os.listdir(routes_dir) if f.endswith('.py') and not f.startswith('__')]
    
    print(f"Checking syntax for {len(route_files)} route files...")
    
    errors_found = []
    
    for filename in route_files:
        file_path = os.path.join(routes_dir, filename)
        
        # Check syntax
        try:
            result = subprocess.run(
                ['python3', '-m', 'py_compile', file_path],
                capture_output=True,
                text=True,
                cwd='/home/ubuntu/RupiyaMe/backend'
            )
            
            if result.returncode == 0:
                print(f"✓ {filename} - syntax OK")
            else:
                print(f"❌ {filename} - syntax error:")
                print(f"   {result.stderr.strip()}")
                errors_found.append((filename, result.stderr))
                
                # Try to fix common import issues
                fix_import_issues(file_path, filename)
                
        except Exception as e:
            print(f"⚠️  {filename} - could not check: {e}")
    
    if errors_found:
        print(f"\nFound {len(errors_found)} files with syntax errors")
        
        # Try to fix and recheck
        print("\nRechecking after fixes...")
        for filename, _ in errors_found:
            file_path = os.path.join(routes_dir, filename)
            try:
                result = subprocess.run(
                    ['python3', '-m', 'py_compile', file_path],
                    capture_output=True,
                    text=True,
                    cwd='/home/ubuntu/RupiyaMe/backend'
                )
                
                if result.returncode == 0:
                    print(f"✓ {filename} - FIXED")
                else:
                    print(f"❌ {filename} - still has errors")
                    
            except Exception as e:
                print(f"⚠️  {filename} - could not recheck: {e}")
    else:
        print("\n🎉 All route files have correct syntax!")

def fix_import_issues(file_path, filename):
    """Fix common import issues in route files"""
    
    try:
        with open(file_path, 'r') as file:
            content = file.read()
        
        original_content = content
        
        # Fix broken import statements where the import got inserted in the middle
        # Pattern: from something import (\n    from app.database import get_database_instances\n    other_things)
        pattern = r'from ([^)]+)\(\s*\nfrom app\.database import get_database_instances\s*\n([^)]*)\)'
        replacement = r'from app.database import get_database_instances\nfrom \1(\n\2)'
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
        
        # Fix cases where import was inserted inside function definitions
        # Remove misplaced imports from middle of code
        lines = content.split('\n')
        fixed_lines = []
        import_added = False
        
        for i, line in enumerate(lines):
            # If we find the import in the wrong place, skip it
            if ('from app.database import get_database_instances' in line and 
                not line.strip().startswith('from app.database import') and
                i > 20):  # Not in the imports section
                continue
            
            # Add import at the top if not already present
            if (not import_added and 
                line.startswith('from app.') and 
                'from app.database import get_database_instances' not in content[:content.find(line)]):
                fixed_lines.append('from app.database import get_database_instances')
                import_added = True
            
            fixed_lines.append(line)
        
        content = '\n'.join(fixed_lines)
        
        # Write back if changed
        if content != original_content:
            with open(file_path, 'w') as file:
                file.write(content)
            print(f"   Fixed import issues in {filename}")
            
    except Exception as e:
        print(f"   Could not fix {filename}: {e}")

if __name__ == "__main__":
    check_and_fix_syntax()
