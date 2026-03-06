#!/bin/bash
# RupiyaMe Codebase Cleanup Script
# This script safely moves unused files and cleans up logs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="/www/wwwroot/RupiyaMe"
cd "$BASE_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RupiyaMe Codebase Cleanup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create archive directories with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_DIR="$BASE_DIR/OLD_UNUSED_FILES_$TIMESTAMP"
mkdir -p "$ARCHIVE_DIR/test_scripts"
mkdir -p "$ARCHIVE_DIR/debug_scripts"
mkdir -p "$ARCHIVE_DIR/fix_scripts"
mkdir -p "$ARCHIVE_DIR/check_scripts"
mkdir -p "$ARCHIVE_DIR/permission_scripts"
mkdir -p "$ARCHIVE_DIR/backup_scripts"
mkdir -p "$ARCHIVE_DIR/old_logs"

echo -e "${YELLOW}Created archive directory: $ARCHIVE_DIR${NC}"
echo ""

# Initialize counters
MOVED_FILES=0
LOG_SIZE_BEFORE=0
LOG_SIZE_AFTER=0
SPACE_FREED=0

# Get initial space usage
INITIAL_SPACE=$(du -sb "$BASE_DIR" | cut -f1)

echo -e "${GREEN}Step 1: Moving unused test scripts...${NC}"
# Move test scripts
shopt -s nullglob
for file in test_*.py test*.js test-*.js test_*.sh test-*.sh; do
    if [ -f "$file" ] && [ "$file" != "test_attachment.txt" ]; then
        echo "  Moving: $file"
        mv "$file" "$ARCHIVE_DIR/test_scripts/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
shopt -u nullglob
echo -e "${GREEN}✓ Test scripts moved${NC}"
echo ""

echo -e "${GREEN}Step 2: Moving debug scripts...${NC}"
# Move debug scripts
shopt -s nullglob
for file in debug_*.py debug*.js; do
    if [ -f "$file" ]; then
        echo "  Moving: $file"
        mv "$file" "$ARCHIVE_DIR/debug_scripts/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
shopt -u nullglob
echo -e "${GREEN}✓ Debug scripts moved${NC}"
echo ""

echo -e "${GREEN}Step 3: Moving fix scripts...${NC}"
# Move fix scripts
shopt -s nullglob
for file in fix_*.py fix_*.sh fix*.js; do
    if [ -f "$file" ]; then
        echo "  Moving: $file"
        mv "$file" "$ARCHIVE_DIR/fix_scripts/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
shopt -u nullglob
echo -e "${GREEN}✓ Fix scripts moved${NC}"
echo ""

echo -e "${GREEN}Step 4: Moving check scripts...${NC}"
# Move check scripts
shopt -s nullglob
for file in check_*.py check-*.sh; do
    if [ -f "$file" ]; then
        echo "  Moving: $file"
        mv "$file" "$ARCHIVE_DIR/check_scripts/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
shopt -u nullglob
echo -e "${GREEN}✓ Check scripts moved${NC}"
echo ""

echo -e "${GREEN}Step 5: Moving permission test scripts...${NC}"
# Move permission scripts
shopt -s nullglob
for file in permission*.js verify-*.js interactive-*.js enhanced-*.js frontend_permission_debugger.js; do
    if [ -f "$file" ]; then
        echo "  Moving: $file"
        mv "$file" "$ARCHIVE_DIR/permission_scripts/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
shopt -u nullglob
echo -e "${GREEN}✓ Permission scripts moved${NC}"
echo ""

echo -e "${GREEN}Step 6: Moving old backup/utility scripts...${NC}"
# Move other utility scripts that are not needed
shopt -s nullglob
for file in brace_*.js cleanup_debug.js clear_cookies.js autofix-service.js \
            obligationDataHelper.js rolesettings-critical-fixes.js \
            activate_all_employees.py disable_otp_all_users.py \
            list_team_leaders.py remove_prints.py convert_routes_to_async.py \
            set_validation.py setup_team_manager.py tasks.py try.py \
            update_*.py create_complete_status.py quick_test_api.py; do
    if [ -f "$file" ]; then
        echo "  Moving: $file"
        mv "$file" "$ARCHIVE_DIR/backup_scripts/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
shopt -u nullglob
echo -e "${GREEN}✓ Utility scripts moved${NC}"
echo ""

echo -e "${GREEN}Step 7: Cleaning up log files...${NC}"
# Get log size before
LOG_SIZE_BEFORE=$(du -sb logs/ 2>/dev/null | cut -f1 || echo 0)

# Rotate large log files (keep last 1000 lines)
for logfile in logs/*.log logs/**/*.log; do
    if [ -f "$logfile" ]; then
        LOG_SIZE=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0)
        # If log file is larger than 10MB (10485760 bytes)
        if [ "$LOG_SIZE" -gt 10485760 ]; then
            echo "  Rotating large log: $logfile ($(numfmt --to=iec $LOG_SIZE 2>/dev/null || echo $LOG_SIZE))"
            # Archive old content
            cp "$logfile" "$ARCHIVE_DIR/old_logs/$(basename $logfile).backup"
            # Keep only last 1000 lines
            tail -n 1000 "$logfile" > "$logfile.tmp" && mv "$logfile.tmp" "$logfile"
        fi
    fi
done

# Same for backend logs
if [ -d "backend/logs" ]; then
    for logfile in backend/logs/*.log; do
        if [ -f "$logfile" ]; then
            LOG_SIZE=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0)
            if [ "$LOG_SIZE" -gt 10485760 ]; then
                echo "  Rotating large log: $logfile ($(numfmt --to=iec $LOG_SIZE 2>/dev/null || echo $LOG_SIZE))"
                cp "$logfile" "$ARCHIVE_DIR/old_logs/$(basename $logfile).backup"
                tail -n 1000 "$logfile" > "$logfile.tmp" && mv "$logfile.tmp" "$logfile"
            fi
        fi
    done
fi

# Get log size after
LOG_SIZE_AFTER=$(du -sb logs/ 2>/dev/null | cut -f1 || echo 0)
echo -e "${GREEN}✓ Log files cleaned${NC}"
echo ""

echo -e "${GREEN}Step 8: Removing empty log files...${NC}"
# Remove empty log files
find logs/ backend/logs/ -name "*.log" -size 0 -delete 2>/dev/null || true
echo -e "${GREEN}✓ Empty logs removed${NC}"
echo ""

echo -e "${GREEN}Step 9: Moving old text documentation files...${NC}"
# Move old documentation files
shopt -s nullglob
for file in COMPLETE_FIX_SUMMARY.txt FINAL_FIX_DEPLOYED.txt \
            AUTO_LOGOUT_QUICK_REFERENCE.txt OBLIGATION_DATA_FIX_VISUAL_GUIDE.txt \
            PROCESS_DATA_SEPARATION_FIX.txt SERVICES_RESTARTED.txt; do
    if [ -f "$file" ]; then
        echo "  Moving: $file"
        mv "$file" "$ARCHIVE_DIR/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
shopt -u nullglob
echo -e "${GREEN}✓ Old docs moved${NC}"
echo ""

echo -e "${GREEN}Step 10: Moving backup config files...${NC}"
# Move backup SSL and old service files
shopt -s nullglob
for file in ssl.*.backup* *.service.old rupiyame*.service; do
    if [ -f "$file" ]; then
        echo "  Moving: $file"
        mv "$file" "$ARCHIVE_DIR/backup_scripts/" 2>/dev/null && ((MOVED_FILES++)) || true
    fi
done
shopt -u nullglob
echo -e "${GREEN}✓ Backup configs moved${NC}"
echo ""

# Calculate space freed
FINAL_SPACE=$(du -sb "$BASE_DIR" | cut -f1)
SPACE_FREED=$((INITIAL_SPACE - FINAL_SPACE))

# Generate summary report
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}         CLEANUP SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ Cleanup completed successfully!${NC}"
echo ""
echo "Files moved to archive: ${YELLOW}$MOVED_FILES${NC}"
echo "Archive location: ${YELLOW}$ARCHIVE_DIR${NC}"
echo ""
echo "Log size before: ${YELLOW}$(numfmt --to=iec $LOG_SIZE_BEFORE 2>/dev/null || echo "$LOG_SIZE_BEFORE bytes")${NC}"
echo "Log size after:  ${YELLOW}$(numfmt --to=iec $LOG_SIZE_AFTER 2>/dev/null || echo "$LOG_SIZE_AFTER bytes")${NC}"
echo "Log space freed: ${GREEN}$(numfmt --to=iec $((LOG_SIZE_BEFORE - LOG_SIZE_AFTER)) 2>/dev/null || echo "$((LOG_SIZE_BEFORE - LOG_SIZE_AFTER)) bytes")${NC}"
echo ""
if [ $SPACE_FREED -gt 0 ]; then
    echo "Total space freed: ${GREEN}$(numfmt --to=iec $SPACE_FREED 2>/dev/null || echo "$SPACE_FREED bytes")${NC}"
else
    echo "Total space freed: ${YELLOW}~0 MB (files moved to archive)${NC}"
fi
echo ""
echo -e "${YELLOW}Note: Files are moved to archive, not deleted.${NC}"
echo -e "${YELLOW}You can safely delete the archive folder after verification:${NC}"
echo -e "${YELLOW}rm -rf $ARCHIVE_DIR${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"

# Create a cleanup log
cat > "$ARCHIVE_DIR/CLEANUP_LOG.txt" << EOF
RupiyaMe Codebase Cleanup
Date: $(date)
Files Moved: $MOVED_FILES
Log Space Freed: $((LOG_SIZE_BEFORE - LOG_SIZE_AFTER)) bytes

Original Location: $BASE_DIR
Archive Location: $ARCHIVE_DIR

This archive contains old test, debug, fix, and utility scripts that were not being used.
All files have been preserved and can be restored if needed.

To restore a file:
cp $ARCHIVE_DIR/[category]/[filename] $BASE_DIR/

To permanently delete this archive after verification:
rm -rf $ARCHIVE_DIR
EOF

echo -e "${GREEN}Cleanup log saved to: ${ARCHIVE_DIR}/CLEANUP_LOG.txt${NC}"
echo ""
