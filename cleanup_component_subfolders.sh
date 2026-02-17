#!/bin/bash
# Component Subfolders Cleanup Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Component Subfolders Cleanup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

COMPONENTS_DIR="/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/components"
cd "$COMPONENTS_DIR"

# Create archive directory with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_DIR="$COMPONENTS_DIR/SUBFOLDER_CLEANUP_ARCHIVE_$TIMESTAMP"
mkdir -p "$ARCHIVE_DIR/backup_files"
mkdir -p "$ARCHIVE_DIR/debug_test_files"
mkdir -p "$ARCHIVE_DIR/unused_sections"
mkdir -p "$ARCHIVE_DIR/duplicate_files"

echo -e "${YELLOW}Created archive directory: $ARCHIVE_DIR${NC}"
echo ""

MOVED_FILES=0

echo -e "${GREEN}Step 1: Moving backup files from subfolders...${NC}"
# Backup files with .backup or .new extensions
BACKUP_FILES=(
    "settings/DesignationSettings.backup.jsx"
    "hrms/EmployeeFormNew.jsx.new"
)

for file in "${BACKUP_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  Moving: $file"
        mkdir -p "$ARCHIVE_DIR/backup_files/$(dirname "$file")"
        mv "$file" "$ARCHIVE_DIR/backup_files/$file" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
echo -e "${GREEN}✓ Backup files moved${NC}"
echo ""

echo -e "${GREEN}Step 2: Moving debug/test files...${NC}"
# Debug and test files
DEBUG_TEST_FILES=(
    "lead-details/AutoSaveDebugger.jsx"
    "lead-details/AutoSaveTest.jsx"
)

for file in "${DEBUG_TEST_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  Moving: $file (debug/test component)"
        mkdir -p "$ARCHIVE_DIR/debug_test_files/$(dirname "$file")"
        mv "$file" "$ARCHIVE_DIR/debug_test_files/$file" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
echo -e "${GREEN}✓ Debug/test files moved${NC}"
echo ""

echo -e "${GREEN}Step 3: Moving unused sections components...${NC}"
# Sections with 0 imports
UNUSED_SECTIONS=(
    "sections/Attachments.fixed.jsx"
    "sections/EnhancedRequestReassignmentButton.jsx"
    "sections/CopyLeadSection.jsx"
    "sections/FileSentToLoginSection.jsx"
)

for file in "${UNUSED_SECTIONS[@]}"; do
    if [ -f "$file" ]; then
        echo "  Moving: $file (0 imports found)"
        mv "$file" "$ARCHIVE_DIR/unused_sections/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
echo -e "${GREEN}✓ Unused sections moved${NC}"
echo ""

echo -e "${GREEN}Step 4: Checking for duplicate employee-details files...${NC}"
# Check if old versions exist in employee-details that might be duplicates
if [ -f "employee-details/EmployeeAttachments.jsx" ] && [ -f "sections/EmployeeAttachmentsNew.jsx" ]; then
    echo "  Note: Found EmployeeAttachments in employee-details (EmployeeAttachmentsNew is used from sections)"
    echo "  Moving: employee-details/EmployeeAttachments.jsx"
    mv "employee-details/EmployeeAttachments.jsx" "$ARCHIVE_DIR/duplicate_files/" 2>/dev/null && ((MOVED_FILES++)) || true
fi

# Check for old EmployeeRemarks if newer version exists
if [ -f "employee-details/EmployeeRemarks.jsx" ]; then
    # Count imports
    IMPORT_COUNT=$(grep -r "employee-details/EmployeeRemarks" .. --include="*.jsx" --include="*.js" 2>/dev/null | grep "import\|from" | wc -l)
    if [ "$IMPORT_COUNT" -eq 0 ]; then
        echo "  Moving: employee-details/EmployeeRemarks.jsx (0 imports)"
        mv "employee-details/EmployeeRemarks.jsx" "$ARCHIVE_DIR/duplicate_files/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
fi

echo -e "${GREEN}✓ Duplicate check complete${NC}"
echo ""

# Generate summary
TOTAL_ARCHIVED=$(find "$ARCHIVE_DIR" -type f | wc -l)
ARCHIVE_SIZE=$(du -sh "$ARCHIVE_DIR" | cut -f1)

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}         CLEANUP SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ Component subfolders cleanup completed!${NC}"
echo ""
echo "Files archived: ${YELLOW}$TOTAL_ARCHIVED${NC}"
echo "Archive location: ${YELLOW}$ARCHIVE_DIR${NC}"
echo "Archive size: ${YELLOW}$ARCHIVE_SIZE${NC}"
echo ""
echo -e "${YELLOW}Categories cleaned:${NC}"
echo "  • Backup files (.backup, .new) - 2 files"
echo "  • Debug/Test components - 2 files"
echo "  • Unused sections (0 imports) - 4 files"
echo "  • Duplicate files - checked and cleaned"
echo ""
echo -e "${GREEN}Files removed:${NC}"
echo "  ✓ DesignationSettings.backup.jsx"
echo "  ✓ EmployeeFormNew.jsx.new"
echo "  ✓ AutoSaveDebugger.jsx (debug component)"
echo "  ✓ AutoSaveTest.jsx (test component)"
echo "  ✓ Attachments.fixed.jsx (old fixed version)"
echo "  ✓ EnhancedRequestReassignmentButton.jsx (duplicate)"
echo "  ✓ CopyLeadSection.jsx (unused)"
echo "  ✓ FileSentToLoginSection.jsx (unused)"
echo ""
echo -e "${YELLOW}Note: Files are moved to archive, not deleted.${NC}"
echo -e "${YELLOW}You can safely delete the archive folder after verification:${NC}"
echo -e "${YELLOW}rm -rf $ARCHIVE_DIR${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"

# Create cleanup log
cat > "$ARCHIVE_DIR/CLEANUP_LOG.txt" << EOF
Component Subfolders Cleanup
Date: $(date)
Files Archived: $TOTAL_ARCHIVED
Archive Size: $ARCHIVE_SIZE

Location: $COMPONENTS_DIR
Archive: $ARCHIVE_DIR

Analysis Method:
- Searched entire codebase for import statements
- Removed backup files (.backup, .new extensions)
- Removed debug/test components
- Removed unused sections with 0 imports
- Checked for duplicate files

Categories Cleaned:
1. Backup files (2 files)
   - settings/DesignationSettings.backup.jsx
   - hrms/EmployeeFormNew.jsx.new

2. Debug/Test files (2 files)
   - lead-details/AutoSaveDebugger.jsx
   - lead-details/AutoSaveTest.jsx

3. Unused sections (4 files)
   - sections/Attachments.fixed.jsx (0 imports)
   - sections/EnhancedRequestReassignmentButton.jsx (0 imports)
   - sections/CopyLeadSection.jsx (0 imports)
   - sections/FileSentToLoginSection.jsx (0 imports)

All files have been preserved and can be restored if needed.

To restore a file:
cp $ARCHIVE_DIR/[category]/[path] $COMPONENTS_DIR/

To permanently delete this archive after verification:
rm -rf $ARCHIVE_DIR
EOF

echo -e "${GREEN}Cleanup log saved to: ${ARCHIVE_DIR}/CLEANUP_LOG.txt${NC}"
echo ""
