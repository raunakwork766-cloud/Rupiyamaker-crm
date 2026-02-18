#!/bin/bash

# Phase 6: Backend cleanup - remove old debug, test, and migration scripts
# Date: 2026-02-18
# This script archives old scripts that are no longer needed

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_DIR="backend/OLD_SCRIPTS_ARCHIVE_${TIMESTAMP}"
LOG_FILE="${ARCHIVE_DIR}/CLEANUP_LOG.txt"

echo "==================================="
echo "Phase 6: Backend Scripts Cleanup"
echo "Started: $(date)"
echo "==================================="

# Create archive directory structure
mkdir -p "${ARCHIVE_DIR}/debug_scripts"
mkdir -p "${ARCHIVE_DIR}/migration_scripts"
mkdir -p "${ARCHIVE_DIR}/test_scripts"
mkdir -p "${ARCHIVE_DIR}/fix_scripts"

# Initialize log
echo "Phase 6 Backend Cleanup Log - $(date)" > "$LOG_FILE"
echo "======================================" >> "$LOG_FILE"

# Counter for files
TOTAL_FILES=0

echo -e "\n📁 Moving debug scripts..."
echo -e "\n=== DEBUG SCRIPTS ===" >> "$LOG_FILE"

# Debug scripts
DEBUG_SCRIPTS=(
    "backend/debug_applicant_form.py"
    "backend/remove_prints.py"
)

for file in "${DEBUG_SCRIPTS[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ Moving: $file"
        mv "$file" "${ARCHIVE_DIR}/debug_scripts/"
        echo "MOVED: $file" >> "$LOG_FILE"
        ((TOTAL_FILES++))
    fi
done

echo -e "\n📁 Moving migration scripts..."
echo -e "\n=== MIGRATION SCRIPTS ===" >> "$LOG_FILE"

# Migration scripts
MIGRATION_SCRIPTS=(
    "backend/migrate_lead_schema.py"
    "backend/remove_address_fields_from_db.py"
    "backend/fix_leaves_dependencies.py"
    "backend/fix_team_winners_role.py"
)

for file in "${MIGRATION_SCRIPTS[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ Moving: $file"
        mv "$file" "${ARCHIVE_DIR}/migration_scripts/"
        echo "MOVED: $file" >> "$LOG_FILE"
        ((TOTAL_FILES++))
    fi
done

echo -e "\n📁 Moving test scripts..."
echo -e "\n=== TEST SCRIPTS ===" >> "$LOG_FILE"

# Test/performance scripts
TEST_SCRIPTS=(
    "backend/test_api_performance.py"
    "backend/test_loan_types_performance.py"
    "backend/test_optimized_performance.py"
    "backend/test_settings_performance.py"
)

for file in "${TEST_SCRIPTS[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ Moving: $file"
        mv "$file" "${ARCHIVE_DIR}/test_scripts/"
        echo "MOVED: $file" >> "$LOG_FILE"
        ((TOTAL_FILES++))
    fi
done

echo -e "\n📁 Moving fix scripts..."
echo -e "\n=== FIX SCRIPTS ===" >> "$LOG_FILE"

# Fix scripts (empty or old)
FIX_SCRIPTS=(
    "backend/fix_async_comprehensions.py"
    "backend/fix_async_syntax.py"
)

for file in "${FIX_SCRIPTS[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ Moving: $file"
        mv "$file" "${ARCHIVE_DIR}/fix_scripts/"
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
echo "✅ Phase 6 Cleanup Complete!"
echo "==================================="
echo "📊 Summary:"
echo "  • Total files moved: $TOTAL_FILES"
echo "  • Archive: ${ARCHIVE_DIR}"
echo "  • Archive size: ${ARCHIVE_SIZE}"
echo "  • Log file: ${LOG_FILE}"
echo ""
echo "Backend scripts safely archived. These were old debug, test, and migration scripts."
echo "==================================="
