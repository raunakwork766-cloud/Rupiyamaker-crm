#!/bin/bash

# Codebase Backup Script
# This script creates a backup of the codebase excluding unnecessary files and directories

# Configuration
PROJECT_NAME="Rupiyamakers"
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="${PROJECT_NAME}_codebase_backup_${TIMESTAMP}.tar.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get the script directory (project root)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

print_status "Starting codebase backup for $PROJECT_NAME"
print_status "Project directory: $SCRIPT_DIR"

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    print_status "Created backup directory: $BACKUP_DIR"
fi

# Create the backup with exclusions
print_status "Creating backup archive: $BACKUP_FILENAME"

tar -czf "$BACKUP_DIR/$BACKUP_FILENAME" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='venv' \
    --exclude='new_venv' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='*.pyo' \
    --exclude='.pytest_cache' \
    --exclude='*.log' \
    --exclude='*.pid' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.production' \
    --exclude='.env.development' \
    --exclude='data/' \
    --exclude='media/' \
    --exclude='uploads/' \
    --exclude='tmp/' \
    --exclude='temp/' \
    --exclude='.DS_Store' \
    --exclude='Thumbs.db' \
    --exclude='*.swp' \
    --exclude='*.swo' \
    --exclude='*~' \
    --exclude='.vscode/settings.json' \
    --exclude='.idea/' \
    --exclude='*.sqlite' \
    --exclude='*.sqlite3' \
    --exclude='*.db' \
    --exclude='ssl.crt' \
    --exclude='ssl.key' \
    --exclude='*.pem' \
    --exclude='*.key' \
    --exclude='*.crt' \
    --exclude='coverage/' \
    --exclude='.coverage' \
    --exclude='htmlcov/' \
    --exclude='dist/' \
    --exclude='build/' \
    --exclude='*.egg-info/' \
    --exclude='.tox/' \
    --exclude='.mypy_cache/' \
    --exclude='.pytest_cache/' \
    --exclude='*.xlsx' \
    --exclude='*.xls' \
    --exclude='*.doc' \
    --exclude='*.docx' \
    --exclude='*.pdf' \
    --exclude='*.json' \
    --exclude='*.tar.gz' \
    --exclude='*.zip' \
    --exclude='*.rar' \
    --exclude='backups/' \
    .

# Check if backup was successful
if [ $? -eq 0 ]; then
    # Get backup file size
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILENAME" | cut -f1)
    
    print_status "Backup completed successfully!"
    print_status "Backup file: $BACKUP_DIR/$BACKUP_FILENAME"
    print_status "Backup size: $BACKUP_SIZE"
    
    # List contents of the backup (optional verification)
    echo ""
    print_status "Backup contents preview:"
    tar -tzf "$BACKUP_DIR/$BACKUP_FILENAME" | head -20
    
    # Count total files in backup
    FILE_COUNT=$(tar -tzf "$BACKUP_DIR/$BACKUP_FILENAME" | wc -l)
    print_status "Total files backed up: $FILE_COUNT"
    
else
    print_error "Backup failed!"
    exit 1
fi

# Optional: Clean up old backups (keep only last 5)
OLD_BACKUPS=$(ls -t "$BACKUP_DIR"/${PROJECT_NAME}_codebase_backup_*.tar.gz 2>/dev/null | tail -n +6)
if [ ! -z "$OLD_BACKUPS" ]; then
    print_warning "Cleaning up old backups (keeping latest 5)..."
    echo "$OLD_BACKUPS" | xargs rm -f
    print_status "Old backups cleaned up"
fi

echo ""
print_status "Backup process completed at $(date)"
print_status "Backup location: $SCRIPT_DIR/$BACKUP_DIR/$BACKUP_FILENAME"
