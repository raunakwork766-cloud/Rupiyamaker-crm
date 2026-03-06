#!/bin/bash
# Frontend Code Cleanup Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Frontend Code Cleanup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

FRONTEND_DIR="/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src"
cd "$FRONTEND_DIR"

# Create archive directory with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_DIR="$FRONTEND_DIR/ARCHIVED_UNUSED_FILES_$TIMESTAMP"
mkdir -p "$ARCHIVE_DIR/backup_files"
mkdir -p "$ARCHIVE_DIR/test_files"
mkdir -p "$ARCHIVE_DIR/duplicate_versions"
mkdir -p "$ARCHIVE_DIR/old_backup_folders"

echo -e "${YELLOW}Created archive directory: $ARCHIVE_DIR${NC}"
echo ""

MOVED_FILES=0

echo -e "${GREEN}Step 1: Moving backup files (.backup, .bak)...${NC}"
shopt -s nullglob
find . -type f \( -name "*.backup" -o -name "*.bak" \) | while read file; do
    if [ -f "$file" ]; then
        echo "  Moving: $file"
        mkdir -p "$ARCHIVE_DIR/backup_files/$(dirname "$file")"
        mv "$file" "$ARCHIVE_DIR/backup_files/$file" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
shopt -u nullglob
echo -e "${GREEN}✓ Backup files moved${NC}"
echo ""

echo -e "${GREEN}Step 2: Moving test files...${NC}"
shopt -s nullglob
for file in components/LeadCRM_test.jsx components/LeadCRM_test2.jsx \
            components/PermissionTest.jsx components/testPDF.js \
            components/obligationDataHelper.js components/warning.html; do
    if [ -f "$file" ]; then
        echo "  Moving: $file"
        mv "$file" "$ARCHIVE_DIR/test_files/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
shopt -u nullglob
echo -e "${GREEN}✓ Test files moved${NC}"
echo ""

echo -e "${GREEN}Step 3: Moving duplicate/old versions...${NC}"
shopt -s nullglob
for file in App_old.jsx App_new.jsx \
            components/LeadCRM_new.jsx components/LeadCRM_temp.jsx components/LeadCRM_backup.jsx \
            components/CreateLead_new.jsx \
            components/EditInterview_New.jsx components/EditInterview_Original.jsx; do
    if [ -f "$file" ]; then
        echo "  Moving: $file"
        mv "$file" "$ARCHIVE_DIR/duplicate_versions/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
shopt -u nullglob
echo -e "${GREEN}✓ Duplicate versions moved${NC}"
echo ""

echo -e "${GREEN}Step 4: Moving entire backup folders...${NC}"
if [ -d "BackupFiles" ]; then
    echo "  Moving: BackupFiles/ ($(du -sh BackupFiles | cut -f1))"
    mv BackupFiles "$ARCHIVE_DIR/old_backup_folders/" 2>/dev/null && ((MOVED_FILES+=10)) || true
fi
if [ -d "components/backup" ]; then
    echo "  Moving: components/backup/ ($(du -sh components/backup | cut -f1))"
    mv components/backup "$ARCHIVE_DIR/old_backup_folders/" 2>/dev/null && ((MOVED_FILES+=10)) || true
fi
echo -e "${GREEN}✓ Backup folders moved${NC}"
echo ""

echo -e "${GREEN}Step 5: Counting cleaned files...${NC}"
TOTAL_ARCHIVED=$(find "$ARCHIVE_DIR" -type f | wc -l)
ARCHIVE_SIZE=$(du -sh "$ARCHIVE_DIR" | cut -f1)
echo -e "${GREEN}✓ Counting complete${NC}"
echo ""

# Generate summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}         CLEANUP SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ Frontend cleanup completed successfully!${NC}"
echo ""
echo "Total files archived: ${YELLOW}$TOTAL_ARCHIVED${NC}"
echo "Archive location: ${YELLOW}$ARCHIVE_DIR${NC}"
echo "Archive size: ${YELLOW}$ARCHIVE_SIZE${NC}"
echo ""
echo -e "${YELLOW}Files cleaned:${NC}"
echo "  • Backup files (.backup, .bak)"
echo "  • Test files (test*.jsx, testPDF.js)"
echo "  • Duplicate versions (_new, _old, _temp, _test)"
echo "  • Old backup folders (BackupFiles/, components/backup/)"
echo ""
echo -e "${YELLOW}Note: Files are moved to archive, not deleted.${NC}"
echo -e "${YELLOW}You can safely delete the archive folder after verification:${NC}"
echo -e "${YELLOW}rm -rf $ARCHIVE_DIR${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"

# Create cleanup log
cat > "$ARCHIVE_DIR/CLEANUP_LOG.txt" << EOF
Frontend Code Cleanup
Date: $(date)
Files Archived: $TOTAL_ARCHIVED
Archive Size: $ARCHIVE_SIZE

Location: $FRONTEND_DIR
Archive: $ARCHIVE_DIR

Categories Cleaned:
1. Backup files (.backup, .bak extensions)
2. Test files (LeadCRM_test.jsx, testPDF.js, etc.)
3. Duplicate versions (App_old.jsx, LeadCRM_new.jsx, etc.)
4. Old backup folders (BackupFiles/, components/backup/)

All files have been preserved and can be restored if needed.

To restore a file:
cp $ARCHIVE_DIR/[category]/[filename] $FRONTEND_DIR/

To permanently delete this archive after verification:
rm -rf $ARCHIVE_DIR
EOF

echo -e "${GREEN}Cleanup log saved to: ${ARCHIVE_DIR}/CLEANUP_LOG.txt${NC}"
echo ""
