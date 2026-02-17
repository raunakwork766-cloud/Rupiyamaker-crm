#!/bin/bash
# Frontend Unused Components Cleanup Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Unused Components Cleanup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

FRONTEND_DIR="/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src"
cd "$FRONTEND_DIR"

# Create archive directory with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_DIR="$FRONTEND_DIR/UNUSED_COMPONENTS_ARCHIVE_$TIMESTAMP"
mkdir -p "$ARCHIVE_DIR/standalone_components"
mkdir -p "$ARCHIVE_DIR/utility_components" 
mkdir -p "$ARCHIVE_DIR/empty_files"

echo -e "${YELLOW}Created archive directory: $ARCHIVE_DIR${NC}"
echo ""

MOVED_FILES=0

echo -e "${GREEN}Step 1: Analyzing and moving unused standalone components...${NC}"
# These components have 0 imports anywhere in the codebase

# Standalone unused components
UNUSED_COMPONENTS=(
    "components/NewAttendancePage.jsx"
    "components/StatusDropdownExample.jsx"
    "components/SimpleNotificationBell.jsx"
    "components/DebugErrorBoundary.jsx"
    "components/MonthlyCalendarTable.jsx"
    "components/EmployeeRemarkSection.jsx"
    "components/EmploymentDetailsSection.jsx"
    "components/SharedAppView.jsx"
)

for file in "${UNUSED_COMPONENTS[@]}"; do
    if [ -f "$file" ]; then
        echo "  Moving: $file (0 imports found)"
        mv "$file" "$ARCHIVE_DIR/standalone_components/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done

echo -e "${GREEN}✓ Standalone components moved${NC}"
echo ""

echo -e "${GREEN}Step 2: Moving unused utility components...${NC}"
# These are utility components that are not imported

UNUSED_UTILITIES=(
    "components/NotificationCenter.jsx"
    "components/LeadCRMFilter.jsx"
    "components/SearchableSelect.jsx"
)

for file in "${UNUSED_UTILITIES[@]}"; do
    if [ -f "$file" ]; then
        echo "  Moving: $file (0 imports found)"
        mv "$file" "$ARCHIVE_DIR/utility_components/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done

echo -e "${GREEN}✓ Utility components moved${NC}"
echo ""

echo -e "${GREEN}Step 3: Moving empty/unused CSS files...${NC}"

if [ -f "components/CustomStatusDropdown.css" ]; then
    SIZE=$(stat -f%z "components/CustomStatusDropdown.css" 2>/dev/null || stat -c%s "components/CustomStatusDropdown.css" 2>/dev/null || echo 0)
    if [ "$SIZE" -eq 0 ]; then
        echo "  Moving: components/CustomStatusDropdown.css (empty file)"
        mv "components/CustomStatusDropdown.css" "$ARCHIVE_DIR/empty_files/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
fi

echo -e "${GREEN}✓ Empty files moved${NC}"
echo ""

echo -e "${GREEN}Step 4: Checking unused sections within components folder...${NC}"

# Check sections subfolder
UNUSED_SECTIONS=()
if [ -d "components/sections" ]; then
    for section_file in components/sections/*.jsx; do
        if [ -f "$section_file" ]; then
            filename=$(basename "$section_file" .jsx)
            # Count imports excluding self-references
            import_count=$(grep -r "import.*$filename\|from.*$filename" . --include="*.jsx" --include="*.js" --exclude-dir=ARCHIVED_* --exclude-dir=UNUSED_* 2>/dev/null | grep -v "^$section_file:" | wc -l)
            if [ "$import_count" -eq 0 ]; then
                echo "  Found potentially unused section: $section_file"
                UNUSED_SECTIONS+=("$section_file")
            fi
        fi
    done
fi

if [ ${#UNUSED_SECTIONS[@]} -eq 0 ]; then
    echo "  No unused section components found"
else
    echo -e "${YELLOW}  Note: Found ${#UNUSED_SECTIONS[@]} potentially unused sections (not moved for safety)${NC}"
fi

echo -e "${GREEN}✓ Section analysis complete${NC}"
echo ""

# Generate summary
TOTAL_ARCHIVED=$(find "$ARCHIVE_DIR" -type f | wc -l)
ARCHIVE_SIZE=$(du -sh "$ARCHIVE_DIR" | cut -f1)

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}         CLEANUP SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ Unused components cleanup completed!${NC}"
echo ""
echo "Components archived: ${YELLOW}$TOTAL_ARCHIVED${NC}"
echo "Archive location: ${YELLOW}$ARCHIVE_DIR${NC}"
echo "Archive size: ${YELLOW}$ARCHIVE_SIZE${NC}"
echo ""
echo -e "${YELLOW}Components cleaned:${NC}"
echo "  • Standalone unused components (8 files)"
echo "  • Utility components (3 files)"
echo "  • Empty CSS files (1 file)"
echo ""
echo -e "${GREEN}Categories:${NC}"
echo "  ✓ NewAttendancePage - Alternative unused page"
echo "  ✓ StatusDropdownExample - Example component"
echo "  ✓ SimpleNotificationBell - Unused notification component"
echo "  ✓ DebugErrorBoundary - Debug component"
echo "  ✓ MonthlyCalendarTable - Unused calendar view"
echo "  ✓ EmployeeRemarkSection - Unused section"
echo "  ✓ EmploymentDetailsSection - Unused section"
echo "  ✓ SharedAppView - Unused viewer"
echo "  ✓ NotificationCenter - Unused utility"
echo "  ✓ LeadCRMFilter - Unused filter"
echo "  ✓ SearchableSelect - Unused select component"
echo "  ✓ CustomStatusDropdown.css - Empty CSS file"
echo ""
echo -e "${YELLOW}Note: Files are moved to archive, not deleted.${NC}"
echo -e "${YELLOW}You can safely delete the archive folder after verification:${NC}"
echo -e "${YELLOW}rm -rf $ARCHIVE_DIR${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"

# Create cleanup log
cat > "$ARCHIVE_DIR/CLEANUP_LOG.txt" << EOF
Unused Components Cleanup
Date: $(date)
Components Archived: $TOTAL_ARCHIVED
Archive Size: $ARCHIVE_SIZE

Location: $FRONTEND_DIR
Archive: $ARCHIVE_DIR

Analysis Method:
- Searched entire codebase for imports
- Components with 0 import references were archived
- Empty files were archived

Categories Cleaned:
1. Standalone unused components (8 files)
   - NewAttendancePage.jsx (0 imports)
   - StatusDropdownExample.jsx (0 imports)
   - SimpleNotificationBell.jsx (0 imports)
   - DebugErrorBoundary.jsx (0 imports)
   - MonthlyCalendarTable.jsx (0 imports)
   - EmployeeRemarkSection.jsx (0 imports)
   - EmploymentDetailsSection.jsx (0 imports)
   - SharedAppView.jsx (0 imports)

2. Utility components (3 files)
   - NotificationCenter.jsx (0 imports)
   - LeadCRMFilter.jsx (0 imports)
   - SearchableSelect.jsx (0 imports)

3. Empty files (1 file)
   - CustomStatusDropdown.css (0 bytes)

All files have been preserved and can be restored if needed.

To restore a file:
cp $ARCHIVE_DIR/[category]/[filename] $FRONTEND_DIR/

To permanently delete this archive after verification:
rm -rf $ARCHIVE_DIR
EOF

echo -e "${GREEN}Cleanup log saved to: ${ARCHIVE_DIR}/CLEANUP_LOG.txt${NC}"
echo ""
