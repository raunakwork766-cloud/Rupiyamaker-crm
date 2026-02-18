#!/bin/bash

# Phase 7: Component Subfolders Cleanup
# Date: 2026-02-18
# Description: Remove unused files from component subfolders and old routing files

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_DIR="/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/PHASE7_CLEANUP_ARCHIVE_${TIMESTAMP}"

echo "=================================================="
echo "Phase 7: Component Subfolders Cleanup"
echo "=================================================="
echo "Creating archive directory: $ARCHIVE_DIR"
mkdir -p "$ARCHIVE_DIR"

# Files to archive
FILES_TO_ARCHIVE=(
    "/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/reports/ComprehensiveReport.jsx"
    "/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/reports/LeadsReport.jsx"
    "/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/employee-details/EmployeeAttachmentsNew.jsx"
    "/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/LazyComponents.js"
    "/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/routes/AppRoutes.jsx"
)

echo ""
echo "Files to be archived:"
for file in "${FILES_TO_ARCHIVE[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $(basename $file)"
    else
        echo "  ✗ $(basename $file) - NOT FOUND"
    fi
done

echo ""
read -p "Proceed with archiving? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "Archiving files..."
archived_count=0
total_size=0

for file in "${FILES_TO_ARCHIVE[@]}"; do
    if [ -f "$file" ]; then
        # Get file size
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        total_size=$((total_size + size))
        
        # Create subdirectory structure in archive
        relative_path="${file#/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/}"
        archive_subdir="$ARCHIVE_DIR/$(dirname $relative_path)"
        mkdir -p "$archive_subdir"
        
        # Move file
        mv "$file" "$archive_subdir/"
        echo "  ✓ Archived: $(basename $file)"
        archived_count=$((archived_count + 1))
    fi
done

echo ""
echo "=================================================="
echo "Phase 7 Cleanup Summary"
echo "=================================================="
echo "Files archived: $archived_count"
echo "Total size: $(echo "scale=2; $total_size/1024/1024" | bc) MB"
echo "Archive location: $ARCHIVE_DIR"
echo ""
echo "Details:"
echo "  - reports/ComprehensiveReport.jsx (old routing file)"
echo "  - reports/LeadsReport.jsx (unused, referenced in old LazyComponents)"
echo "  - employee-details/EmployeeAttachmentsNew.jsx (duplicate of sections/)"
echo "  - LazyComponents.js (not imported anywhere)"
echo "  - routes/AppRoutes.jsx (replaced by OptimizedAppRoutes.jsx)"
echo ""
echo "✅ Phase 7 cleanup completed successfully!"
echo "=================================================="
