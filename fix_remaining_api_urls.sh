#!/bin/bash

# Fix all remaining direct API URLs in the codebase

CRM_SRC="/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src"

echo "🔧 Fixing all remaining direct API URLs..."

# Function to add API_BASE_URL if not present and replace direct URLs
fix_file() {
  local file="$1"
  
  if [ ! -f "$file" ]; then
    echo "❌ File not found: $file"
    return
  fi
  
  echo "📝 Processing: $(basename $file)"
  
  # Check if API_BASE_URL is already defined
  if ! grep -q "const API_BASE_URL" "$file" && ! grep -q "API_BASE_URL.*import" "$file"; then
    # Find the last import line
    last_import=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
    
    if [ -n "$last_import" ]; then
      # Insert API_BASE_URL after last import
      sed -i "${last_import}a\\\n// API base URL - Use proxy in development\nconst API_BASE_URL = import.meta.env.DEV ? '/api' : 'https://rupiyamaker.com:8049';" "$file"
    else
      # No imports, add at the top after any comments
      sed -i "1a\\\n// API base URL - Use proxy in development\nconst API_BASE_URL = import.meta.env.DEV ? '/api' : 'https://rupiyamaker.com:8049';\n" "$file"
    fi
  fi
  
  # Replace all direct fetch calls with API_BASE_URL
  sed -i 's|fetch(`https://rupiyamaker\.com:8049|fetch(`${API_BASE_URL}|g' "$file"
  sed -i "s|fetch('https://rupiyamaker\.com:8049|fetch(\`\${API_BASE_URL}|g" "$file"
  sed -i 's|fetch("https://rupiyamaker\.com:8049|fetch(`${API_BASE_URL}|g' "$file"
}

# Fix all component files with direct API calls
echo ""
echo "🎯 Fixing component files..."
fix_file "$CRM_SRC/components/PublicLoginForm.jsx"
fix_file "$CRM_SRC/components/LeadCRM.jsx"
fix_file "$CRM_SRC/components/LoginCRM.jsx"

# Fix section components
echo ""
echo "🎯 Fixing section components..."
fix_file "$CRM_SRC/components/sections/AboutSection.jsx"
fix_file "$CRM_SRC/components/sections/OperationsSection.jsx"
fix_file "$CRM_SRC/components/sections/LoginFormSection.jsx"
fix_file "$CRM_SRC/components/sections/EnhancedRequestReassignmentButton.jsx"
fix_file "$CRM_SRC/components/sections/TaskSectionInLead.jsx"

# Fix services
echo ""
echo "🎯 Fixing remaining service calls in api.js..."
sed -i 's|fetch(`https://rupiyamaker\.com:8049|fetch(`${API_BASE_URL}|g' "$CRM_SRC/services/api.js"

echo ""
echo "✅ All files processed!"
echo ""
echo "📊 Summary:"
grep -r "fetch(\`https://rupiyamaker\.com:8049" "$CRM_SRC" 2>/dev/null | wc -l | xargs echo "Remaining direct URLs:"
