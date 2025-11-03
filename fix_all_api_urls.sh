#!/bin/bash

# Script to add API_BASE_URL constant and replace all direct API URLs in React components

CRM_DIR="/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components"

# List of files to fix
FILES=(
  "EnhancedRequestReassignmentButton.jsx"
  "SettingsPage.jsx"
  "LeadDetails.jsx"
  "TicketPage.jsx"
  "Remark.jsx"
  "Navbar.jsx"
  "CreateTask.jsx"
  "LeavesPage.jsx"
  "ChartPage.jsx"
)

# Function to add API_BASE_URL if not present and replace URLs
fix_file() {
  local file="$1"
  local filepath="$CRM_DIR/$file"
  
  if [ ! -f "$filepath" ]; then
    echo "File not found: $filepath"
    return
  fi
  
  echo "Processing: $file"
  
  # Check if API_BASE_URL is already defined
  if ! grep -q "const API_BASE_URL" "$filepath"; then
    # Find the last import line
    last_import=$(grep -n "^import" "$filepath" | tail -1 | cut -d: -f1)
    
    if [ -n "$last_import" ]; then
      # Insert API_BASE_URL after last import
      sed -i "${last_import}a\\\n// API base URL - Use proxy in development\nconst API_BASE_URL = import.meta.env.DEV ? '/api' : 'https://rupiyamaker.com:8049';" "$filepath"
    fi
  fi
  
  # Replace all direct API URLs with template literal
  sed -i "s|'https://rupiyamaker.com:8049|\`\${API_BASE_URL}|g" "$filepath"
  sed -i "s|\"https://rupiyamaker.com:8049|\`\${API_BASE_URL}|g" "$filepath"
  sed -i 's|https://rupiyamaker.com:8049|${API_BASE_URL}|g' "$filepath"
}

# Fix each file
for file in "${FILES[@]}"; do
  fix_file "$file"
done

# Fix subdirectories
fix_file "attendance/AttendanceSettingsTab.jsx"
fix_file "attendance/AttendanceManagement.jsx"
fix_file "attendance/AttendanceCheckInOut.jsx"
fix_file "settings/DepartmentSettings.jsx"
fix_file "sections/FileSentToLoginSection.jsx"
fix_file "sections/CopyLeadSection.jsx"
fix_file "sections/Remarks.jsx"

# Fix services directory
SERVICES_DIR="/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/services"
sed -i 's|"https://rupiyamaker.com:8049|`${API_BASE_URL}|g' "$SERVICES_DIR/directStatusUpdate.js" 2>/dev/null
sed -i "s|'https://rupiyamaker.com:8049|\`\${API_BASE_URL}|g" "$SERVICES_DIR/api.js" 2>/dev/null

echo "All files processed!"
