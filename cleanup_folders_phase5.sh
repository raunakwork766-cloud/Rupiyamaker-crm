#!/bin/bash

# Phase 5: Cleanup testing, backup, and unused files from folders
# Date: 2026-02-18
# This script archives test files, backup versions, and unused utilities

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_DIR="rupiyamaker-UI/crm/src/FOLDER_CLEANUP_PHASE5_${TIMESTAMP}"
LOG_FILE="${ARCHIVE_DIR}/CLEANUP_LOG.txt"

echo "==================================="
echo "Phase 5: Folder Deep Cleanup"
echo "Started: $(date)"
echo "==================================="

# Create archive directory structure
mkdir -p "${ARCHIVE_DIR}/utils_test_files"
mkdir -p "${ARCHIVE_DIR}/pages_backup_files"
mkdir -p "${ARCHIVE_DIR}/unused_files"

# Initialize log
echo "Phase 5 Cleanup Log - $(date)" > "$LOG_FILE"
echo "======================================" >> "$LOG_FILE"

# Counter for files
TOTAL_FILES=0

echo -e "\n📁 Cleaning utils/ folder..."
echo -e "\n=== UTILS FOLDER ===" >> "$LOG_FILE"

# Test and debug files from utils/
TEST_UTILS_FILES=(
    "rupiyamaker-UI/crm/src/utils/apiTest.js"
    "rupiyamaker-UI/crm/src/utils/permissions.js.new"
    "rupiyamaker-UI/crm/src/utils/profilePhotoTester.js"
    "rupiyamaker-UI/crm/src/utils/testNotifications.js"
)

for file in "${TEST_UTILS_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ Moving: $file"
        mv "$file" "${ARCHIVE_DIR}/utils_test_files/"
        echo "MOVED: $file" >> "$LOG_FILE"
        ((TOTAL_FILES++))
    fi
done

echo -e "\n📁 Cleaning pages/ folder..."
echo -e "\n=== PAGES FOLDER ===" >> "$LOG_FILE"

# Backup and test versions from pages/
BACKUP_PAGE_FILES=(
    "rupiyamaker-UI/crm/src/pages/NotificationManagementPageFixed.jsx"
    "rupiyamaker-UI/crm/src/pages/NotificationManagementPageTest.jsx"
    "rupiyamaker-UI/crm/src/pages/NotificationManagementPageWorking.jsx"
    "rupiyamaker-UI/crm/src/pages/sample_html_popup.html"
)

for file in "${BACKUP_PAGE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ Moving: $file"
        mv "$file" "${ARCHIVE_DIR}/pages_backup_files/"
        echo "MOVED: $file" >> "$LOG_FILE"
        ((TOTAL_FILES++))
    fi
done

# Get archive size
ARCHIVE_SIZE=$(du -sh "${ARCHIVE_DIR}" | cut -f1)

echo -e "\n=== SUMMARY ===" >> "$LOG_FILE"
echo "Total files moved: $TOTAL_FILES" >> "$LOG_FILE"
echo "Archive location: ${ARCHIVE_DIR}" >> "$LOG_FILE"
echo "Archive size: ${ARCHIVE_SIZE}" >> "$LOG_FILE"
echo "Completed: $(date)" >> "$LOG_FILE"

echo -e "\n==================================="
echo "✅ Phase 5 Cleanup Complete!"
echo "==================================="
echo "📊 Summary:"
echo "  • Total files moved: $TOTAL_FILES"
echo "  • Archive: ${ARCHIVE_DIR}"
echo "  • Archive size: ${ARCHIVE_SIZE}"
echo "  • Log file: ${LOG_FILE}"
echo ""
echo "Files safely archived. Verify everything works, then you can delete the archive folder if needed."
echo "==================================="
