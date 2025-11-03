#!/usr/bin/env python3
import re

files = [
    './components/ChartPage.jsx',
    './components/LeadDetails.jsx',
    './components/LeavesPage.jsx',
    './components/Remark.jsx',
    './components/attendance/AttendanceCheckInOut.jsx',
    './components/attendance/AttendanceManagement.jsx',
    './components/attendance/AttendanceSettingsTab.jsx',
    './components/sections/CopyLeadSection.jsx',
    './components/sections/FileSentToLoginSection.jsx',
    './components/sections/Remarks.jsx',
    './components/settings/DepartmentSettings.jsx',
]

base_dir = '/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src'

for file in files:
    filepath = f"{base_dir}/{file}"
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace any form of conditional API_BASE_URL
        patterns = [
            r"const API_BASE_URL = import\.meta\.env\.DEV \? '/api' : '[^']*';",
            r'const API_BASE_URL = import\.meta\.env\.DEV \? "/api" : "[^"]*";',
            r"const API_BASE_URL = import\.meta\.env\.DEV \? '/api' : `[^`]*`;",
        ]
        
        modified = False
        for pattern in patterns:
            if re.search(pattern, content):
                content = re.sub(pattern, "const API_BASE_URL = '/api'; // Always use API proxy", content)
                modified = True
        
        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Fixed: {file}")
        else:
            print(f"⚠️  No match: {file}")
    except Exception as e:
        print(f"❌ Error: {file} - {e}")

print("\n✅ Done!")
