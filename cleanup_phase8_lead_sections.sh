#!/bin/bash

# Phase 8: Lead-details and Sections folders cleanup
# Date: 2026-02-18
# Description: Remove unused files from lead-details and sections folders
# Keep only actively used files

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_DIR="/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/PHASE8_LEAD_SECTIONS_ARCHIVE_${TIMESTAMP}"

echo "=================================================="
echo "Phase 8: Lead-details & Sections Cleanup"
echo "=================================================="
echo "Creating archive directory: $ARCHIVE_DIR"
mkdir -p "$ARCHIVE_DIR/lead-details"

# Unused files from lead-details folder
FILES_TO_ARCHIVE=(
    "/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/lead-details/ActivitiesSection.jsx"
    "/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components/lead-details/RemarksSection.jsx"
)

echo ""
echo "Analysis Summary:"
echo "----------------"
echo "lead-details folder (12 files):"
echo "  ✓ 10 files actively used by LeadDetails.jsx"
echo "  ✗ 2 files unused (only in archived backups)"
echo ""
echo "sections folder (16 files):"
echo "  ✓ All 16 files actively used"
echo "  ✗ 0 files to remove"
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
        
        # Move file to archive maintaining structure
        mv "$file" "$ARCHIVE_DIR/lead-details/"
        echo "  ✓ Archived: $(basename $file)"
        archived_count=$((archived_count + 1))
    fi
done

echo ""
echo "=================================================="
echo "Phase 8 Cleanup Summary"
echo "=================================================="
echo "Files archived: $archived_count"
echo "Total size: $(echo "scale=2; $total_size/1024" | bc) KB"
echo "Archive location: $ARCHIVE_DIR"
echo ""
echo "Details:"
echo "  lead-details/ActivitiesSection.jsx - Not imported (only in old backups)"
echo "  lead-details/RemarksSection.jsx - Not imported (only in old backups)"
echo ""
echo "Kept files:"
echo "  ✓ lead-details: 10 actively used files"
echo "  ✓ sections: All 16 files actively used"
echo ""
echo "✅ Phase 8 cleanup completed successfully!"
echo "=================================================="
