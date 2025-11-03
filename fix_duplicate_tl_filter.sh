#!/bin/bash

# Script to fix the duplicate assignedTL filter in LeadCRM.jsx

FILE="/home/ubuntu/RupiyaMe/rupiyamaker-UI/crm/src/components/LeadCRM.jsx"
BACKUP_FILE="/home/ubuntu/RupiyaMe/rupiyamaker-UI/crm/src/components/LeadCRM.jsx.backup"

# Create backup
cp "$FILE" "$BACKUP_FILE"

# Remove the duplicate filter at line 2510 (and the 6 lines after it)
sed -i '2510,2515d' "$FILE"

echo "✅ Removed duplicate assignedTL filter from lines 2510-2515"
echo "📁 Backup created at: $BACKUP_FILE"

# Show the lines around where we made the change
echo "Lines around the change:"
sed -n '2505,2520p' "$FILE"