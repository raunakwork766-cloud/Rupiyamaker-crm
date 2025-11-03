#!/bin/bash

# Advanced Codebase Backup Script
# This script provides multiple backup options for the codebase

# Configuration
PROJECT_NAME="Rupiyamakers"
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_header() {
    echo -e "${BLUE}[BACKUP]${NC} $1"
}

# Usage function
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE     Backup type: full, code-only, config-only"
    echo "  -o, --output DIR    Output directory (default: backups)"
    echo "  -n, --name NAME     Custom backup name"
    echo "  -c, --compress      Compression type: gzip, bzip2, xz (default: gzip)"
    echo "  -v, --verify        Verify backup after creation"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                          # Default full codebase backup"
    echo "  $0 -t code-only             # Only source code files"
    echo "  $0 -t config-only           # Only configuration files"
    echo "  $0 -o /tmp/backups          # Custom output directory"
    echo "  $0 -n my_backup             # Custom backup name"
    echo "  $0 -c bzip2 -v              # Use bzip2 compression and verify"
}

# Default values
BACKUP_TYPE="full"
OUTPUT_DIR="backups"
CUSTOM_NAME=""
COMPRESSION="gzip"
VERIFY=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -n|--name)
            CUSTOM_NAME="$2"
            shift 2
            ;;
        -c|--compress)
            COMPRESSION="$2"
            shift 2
            ;;
        -v|--verify)
            VERIFY=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate backup type
if [[ ! "$BACKUP_TYPE" =~ ^(full|code-only|config-only)$ ]]; then
    print_error "Invalid backup type: $BACKUP_TYPE"
    print_error "Valid types: full, code-only, config-only"
    exit 1
fi

# Validate compression type
if [[ ! "$COMPRESSION" =~ ^(gzip|bzip2|xz)$ ]]; then
    print_error "Invalid compression type: $COMPRESSION"
    print_error "Valid types: gzip, bzip2, xz"
    exit 1
fi

# Set compression options
case $COMPRESSION in
    gzip)
        COMPRESS_OPT="-z"
        FILE_EXT=".tar.gz"
        ;;
    bzip2)
        COMPRESS_OPT="-j"
        FILE_EXT=".tar.bz2"
        ;;
    xz)
        COMPRESS_OPT="-J"
        FILE_EXT=".tar.xz"
        ;;
esac

# Set backup filename
if [ -n "$CUSTOM_NAME" ]; then
    BACKUP_FILENAME="${CUSTOM_NAME}_${TIMESTAMP}${FILE_EXT}"
else
    BACKUP_FILENAME="${PROJECT_NAME}_${BACKUP_TYPE}_backup_${TIMESTAMP}${FILE_EXT}"
fi

# Get the script directory (project root)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

print_header "Starting $BACKUP_TYPE backup for $PROJECT_NAME"
print_status "Project directory: $SCRIPT_DIR"
print_status "Backup type: $BACKUP_TYPE"
print_status "Compression: $COMPRESSION"
print_status "Output: $OUTPUT_DIR/$BACKUP_FILENAME"

# Create backup directory if it doesn't exist
if [ ! -d "$OUTPUT_DIR" ]; then
    mkdir -p "$OUTPUT_DIR"
    print_status "Created backup directory: $OUTPUT_DIR"
fi

# Define exclusion patterns based on backup type
declare -a COMMON_EXCLUDES=(
    '.git'
    'node_modules'
    'venv'
    'new_venv'
    '__pycache__'
    '*.pyc'
    '*.pyo'
    '.pytest_cache'
    '*.log'
    '*.pid'
    'data/'
    'media/'
    'uploads/'
    'tmp/'
    'temp/'
    '.DS_Store'
    'Thumbs.db'
    '*.swp'
    '*.swo'
    '*~'
    '.idea/'
    'coverage/'
    '.coverage'
    'htmlcov/'
    'dist/'
    'build/'
    '*.egg-info/'
    '.tox/'
    '.mypy_cache/'
    '.pytest_cache/'
    'backups/'
)

declare -a CODE_ONLY_EXCLUDES=(
    '*.md'
    '*.txt'
    '*.json'
    '*.xlsx'
    '*.xls'
    '*.doc'
    '*.docx'
    '*.pdf'
    '.env*'
    'ssl.crt'
    'ssl.key'
    '*.pem'
    '*.key'
    '*.crt'
    '*.sqlite'
    '*.sqlite3'
    '*.db'
    '*.tar.gz'
    '*.zip'
    '*.rar'
)

declare -a CONFIG_ONLY_INCLUDES=(
    '*.json'
    '*.yml'
    '*.yaml'
    '*.toml'
    '*.ini'
    '*.conf'
    '*.config'
    '.env*'
    'requirements.txt'
    'package.json'
    'package-lock.json'
    'Dockerfile'
    'docker-compose.yml'
    '*.sh'
    '*.ps1'
)

# Build tar command based on backup type
TAR_EXCLUDES=""
for exclude in "${COMMON_EXCLUDES[@]}"; do
    TAR_EXCLUDES+="--exclude='$exclude' "
done

case $BACKUP_TYPE in
    full)
        # Full backup excludes only common unnecessary files
        for exclude in "${CODE_ONLY_EXCLUDES[@]:5}"; do  # Skip some excludes for full backup
            if [[ "$exclude" != "*.json" && "$exclude" != "*.md" && "$exclude" != "*.txt" ]]; then
                TAR_EXCLUDES+="--exclude='$exclude' "
            fi
        done
        ;;
    code-only)
        # Code-only backup excludes documentation and config files
        for exclude in "${CODE_ONLY_EXCLUDES[@]}"; do
            TAR_EXCLUDES+="--exclude='$exclude' "
        done
        ;;
    config-only)
        # Config-only backup - we'll use includes instead
        TAR_EXCLUDES=""
        ;;
esac

print_status "Creating backup archive..."

if [ "$BACKUP_TYPE" = "config-only" ]; then
    # For config-only, create a temporary directory with only config files
    TEMP_DIR=$(mktemp -d)
    print_status "Creating temporary directory for config files: $TEMP_DIR"
    
    # Copy config files to temp directory
    for pattern in "${CONFIG_ONLY_INCLUDES[@]}"; do
        find . -name "$pattern" -not -path "./backups/*" -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./venv/*" -not -path "./new_venv/*" -not -path "./__pycache__/*" -not -path "./data/*" -not -path "./media/*" | while read file; do
            if [ -f "$file" ]; then
                target_dir="$TEMP_DIR/$(dirname "$file")"
                mkdir -p "$target_dir"
                cp "$file" "$target_dir/"
            fi
        done
    done
    
    # Create archive from temp directory
    tar $COMPRESS_OPT -cf "$OUTPUT_DIR/$BACKUP_FILENAME" -C "$TEMP_DIR" .
    
    # Clean up temp directory
    rm -rf "$TEMP_DIR"
else
    # Standard backup with exclusions
    eval "tar $COMPRESS_OPT -cf '$OUTPUT_DIR/$BACKUP_FILENAME' $TAR_EXCLUDES ."
fi

# Check if backup was successful
if [ $? -eq 0 ]; then
    # Get backup file size
    BACKUP_SIZE=$(du -h "$OUTPUT_DIR/$BACKUP_FILENAME" | cut -f1)
    
    print_status "Backup completed successfully!"
    print_status "Backup file: $OUTPUT_DIR/$BACKUP_FILENAME"
    print_status "Backup size: $BACKUP_SIZE"
    
    # Verify backup if requested
    if [ "$VERIFY" = true ]; then
        print_status "Verifying backup integrity..."
        if tar -tf "$OUTPUT_DIR/$BACKUP_FILENAME" > /dev/null 2>&1; then
            print_status "Backup verification successful!"
        else
            print_error "Backup verification failed!"
            exit 1
        fi
    fi
    
    # List contents of the backup (preview)
    echo ""
    print_status "Backup contents preview (first 20 files):"
    tar -tf "$OUTPUT_DIR/$BACKUP_FILENAME" | head -20
    
    # Count total files in backup
    FILE_COUNT=$(tar -tf "$OUTPUT_DIR/$BACKUP_FILENAME" | wc -l)
    print_status "Total files backed up: $FILE_COUNT"
    
else
    print_error "Backup failed!"
    exit 1
fi

# Optional: Clean up old backups (keep only last 5 of the same type)
OLD_BACKUPS=$(ls -t "$OUTPUT_DIR"/${PROJECT_NAME}_${BACKUP_TYPE}_backup_*${FILE_EXT} 2>/dev/null | tail -n +6)
if [ ! -z "$OLD_BACKUPS" ]; then
    print_warning "Cleaning up old $BACKUP_TYPE backups (keeping latest 5)..."
    echo "$OLD_BACKUPS" | xargs rm -f
    print_status "Old backups cleaned up"
fi

echo ""
print_header "Backup process completed at $(date)"
print_status "Backup location: $SCRIPT_DIR/$OUTPUT_DIR/$BACKUP_FILENAME"
print_status "Use 'tar -tf $OUTPUT_DIR/$BACKUP_FILENAME' to list contents"
print_status "Use 'tar -xf $OUTPUT_DIR/$BACKUP_FILENAME' to extract"
