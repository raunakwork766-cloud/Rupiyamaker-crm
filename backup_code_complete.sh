#!/bin/bash

# Complete Code Backup Script - Excluding Heavy Directories
# Target: Max 150MB compressed archive

set -e  # Exit on any error

# Configuration
BACKUP_NAME="RupiyaMe_Code_Backup_$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/tmp/$BACKUP_NAME"
SOURCE_DIR="/home/ubuntu/RupiyaMe"
FINAL_ARCHIVE="$HOME/${BACKUP_NAME}.tar.gz"

echo "🚀 Starting Complete Code Backup..."
echo "📁 Source: $SOURCE_DIR"
echo "📦 Target: $FINAL_ARCHIVE"
echo "🎯 Target Size: <150MB"
echo "=" * 60

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "📋 Creating selective copy..."

# Copy backend code (excluding heavy files)
echo "  📂 Copying backend..."
rsync -av --progress \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='*.pyo' \
    --exclude='venv' \
    --exclude='env' \
    --exclude='.env' \
    --exclude='*.log' \
    --exclude='*.pid' \
    --exclude='temp' \
    --exclude='tmp' \
    --exclude='uploads' \
    --exclude='downloads' \
    --exclude='*.db-journal' \
    --exclude='*.sqlite-wal' \
    --exclude='*.sqlite-shm' \
    --exclude='test*' \
    --exclude='*test*' \
    --exclude='*.test.*' \
    --exclude='tests/' \
    --exclude='test/' \
    --exclude='*.md' \
    --exclude='*.MD' \
    "$SOURCE_DIR/backend/" "$BACKUP_DIR/backend/"

# Copy frontend code (excluding node_modules and build artifacts)
echo "  📂 Copying frontend..."
rsync -av --progress \
    --exclude='node_modules' \
    --exclude='build' \
    --exclude='dist' \
    --exclude='.next' \
    --exclude='out' \
    --exclude='coverage' \
    --exclude='*.log' \
    --exclude='.cache' \
    --exclude='.parcel-cache' \
    --exclude='.vscode' \
    --exclude='.idea' \
    --exclude='*.tmp' \
    --exclude='*.temp' \
    --exclude='test*' \
    --exclude='*test*' \
    --exclude='*.test.*' \
    --exclude='tests/' \
    --exclude='test/' \
    --exclude='__tests__/' \
    --exclude='*.spec.*' \
    --exclude='*.md' \
    --exclude='*.MD' \
    --exclude='README*' \
    "$SOURCE_DIR/rupiyamaker-UI/" "$BACKUP_DIR/rupiyamaker-UI/"

# Copy data files (excluding large databases)
echo "  📂 Copying data..."
if [ -d "$SOURCE_DIR/data" ]; then
    rsync -av --progress \
        --exclude='*.db-wal' \
        --exclude='*.db-shm' \
        --exclude='*.log' \
        --exclude='backup_*' \
        --exclude='temp_*' \
        "$SOURCE_DIR/data/" "$BACKUP_DIR/data/"
fi

# Copy docker files
echo "  📂 Copying Docker configuration..."
if [ -d "$SOURCE_DIR/docker" ]; then
    cp -r "$SOURCE_DIR/docker" "$BACKUP_DIR/"
fi

# Copy root level configuration files
echo "  📂 Copying configuration files..."
cd "$SOURCE_DIR"
for file in *.yml *.yaml *.json *.txt *.sh *.conf *.key *.crt *.env.example requirements.txt package.json; do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/"
    fi
done

# Copy important scripts (excluding test files and markdown)
echo "  📂 Copying scripts..."
for file in *.py *.sh; do
    if [ -f "$file" ] && [[ ! "$file" =~ test ]] && [[ ! "$file" =~ Test ]]; then
        cp "$file" "$BACKUP_DIR/"
    fi
done

# Create backup metadata
echo "  📝 Creating backup metadata..."
cat > "$BACKUP_DIR/BACKUP_INFO.md" << EOF
# RupiyaMe Code Backup

**Created:** $(date)
**Source:** $SOURCE_DIR
**Backup Type:** Selective Code Backup (Excluding Heavy Dependencies)

## Excluded Directories/Files:
- node_modules (Frontend dependencies)
- __pycache__ (Python bytecode)
- venv/env (Python virtual environments)
- .git (Git repository data)
- *.log (Log files)
- *.md (Markdown documentation files)
- test* (All test files and directories)
- *test* (Files containing 'test' in name)
- *.test.* (Test files)
- tests/ (Test directories)
- *.spec.* (Spec files)
- build/dist/out (Build artifacts)
- uploads/downloads (User uploads)
- temp/tmp (Temporary files)
- Large database files (*.db-wal, *.db-shm)

## Included:
- ✅ Complete source code (Frontend + Backend)
- ✅ Configuration files (*.yml, *.json, *.conf)
- ✅ Scripts and automation (*.py, *.sh - excluding tests)
- ✅ Database schema and sample data
- ✅ Docker configuration
- ✅ SSL certificates
- ❌ Documentation files (*.md) - excluded to save space
- ❌ Test files - excluded to save space

## To Restore:
1. Extract archive: \`tar -xzf ${BACKUP_NAME}.tar.gz\`
2. Backend: \`cd backend && pip install -r requirements.txt\`
3. Frontend: \`cd rupiyamaker-UI/crm && npm install\`
4. Configure environment variables
5. Start services

## Structure:
\`\`\`
${BACKUP_NAME}/
├── backend/           # FastAPI backend
├── rupiyamaker-UI/    # React frontend
├── data/              # Database files
├── docker/            # Docker configuration
├── *.yml              # Configuration files
├── *.md               # Documentation
└── BACKUP_INFO.md     # This file
\`\`\`
EOF

# Calculate size before compression
echo "📊 Calculating backup size..."
UNCOMPRESSED_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "  📏 Uncompressed size: $UNCOMPRESSED_SIZE"

# Create compressed archive with maximum compression
echo "🗜️  Creating compressed archive..."
cd "/tmp"
tar -czf "$FINAL_ARCHIVE" \
    --verbose \
    --checkpoint=1000 \
    --checkpoint-action=echo='.' \
    "$BACKUP_NAME"

# Calculate final size
COMPRESSED_SIZE=$(du -sh "$FINAL_ARCHIVE" | cut -f1)
COMPRESSED_BYTES=$(stat -f%z "$FINAL_ARCHIVE" 2>/dev/null || stat -c%s "$FINAL_ARCHIVE")
COMPRESSED_MB=$((COMPRESSED_BYTES / 1024 / 1024))

echo ""
echo "✅ Backup completed successfully!"
echo "=" * 60
echo "📦 Archive: $FINAL_ARCHIVE"
echo "📏 Uncompressed: $UNCOMPRESSED_SIZE"
echo "📏 Compressed: $COMPRESSED_SIZE (${COMPRESSED_MB}MB)"

# Check if target size met
if [ $COMPRESSED_MB -le 150 ]; then
    echo "🎯 ✅ Target achieved: ${COMPRESSED_MB}MB ≤ 150MB"
else
    echo "⚠️  Target exceeded: ${COMPRESSED_MB}MB > 150MB"
    echo "💡 Consider removing more files or using additional exclusions"
fi

echo ""
echo "📁 Backup contents:"
tar -tzf "$FINAL_ARCHIVE" | head -20
if [ $(tar -tzf "$FINAL_ARCHIVE" | wc -l) -gt 20 ]; then
    echo "   ... and $(( $(tar -tzf "$FINAL_ARCHIVE" | wc -l) - 20 )) more files"
fi

# Cleanup temporary directory
rm -rf "$BACKUP_DIR"

echo ""
echo "🔧 To extract and restore:"
echo "   tar -xzf $FINAL_ARCHIVE"
echo "   cd ${BACKUP_NAME}/backend && pip install -r requirements.txt"
echo "   cd ${BACKUP_NAME}/rupiyamaker-UI/crm && npm install"
echo ""
echo "✨ Backup completed!"
