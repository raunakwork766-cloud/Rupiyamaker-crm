#!/bin/bash

# Rollback Script
# This script rolls back production to a previous backup

set -e

echo "========================================="
echo "🔄 PRODUCTION ROLLBACK SCRIPT"
echo "========================================="

# Configuration
PRODUCTION_DIR="/var/www/rupiyame-production"
BACKUP_DIR="/var/www/rupiyame-backups"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script should be run as root or with sudo."
    echo "   Example: sudo ./rollback.sh"
    exit 1
fi

# Check for backup argument
if [ -z "$1" ]; then
    echo ""
    echo "📋 Available Backups:"
    echo ""
    
    # List available backups
    if [ -d "$BACKUP_DIR" ]; then
        for backup in $(ls -t "$BACKUP_DIR" | grep "production_backup_"); do
            backup_path="$BACKUP_DIR/$backup"
            if [ -d "$backup_path" ]; then
                size=$(du -sh "$backup_path" | cut -f1)
                echo "  📦 $backup ($size)"
                echo "     Usage: ./rollback.sh $backup"
                echo ""
            fi
        done
    else
        echo "❌ No backups found in $BACKUP_DIR"
    fi
    
    echo ""
    echo "Usage: ./rollback.sh <backup_name>"
    echo "Example: ./rollback.sh production_backup_20260103_143000"
    exit 1
fi

BACKUP_NAME="$1"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

echo ""
echo "📋 Rollback Information:"
echo "   Backup:      $BACKUP_NAME"
echo "   Path:        $BACKUP_PATH"
echo "   Production:  $PRODUCTION_DIR"
echo "   Time:        $(date)"
echo ""

# Verify backup exists
if [ ! -d "$BACKUP_PATH" ]; then
    echo "❌ ERROR: Backup not found!"
    echo "   Path: $BACKUP_PATH"
    exit 1
fi

# Verify it's a valid backup
if [ ! -f "$BACKUP_PATH/ecosystem.config.js" ]; then
    echo "❌ ERROR: Invalid backup! Missing ecosystem.config.js"
    exit 1
fi

# Critical warning
echo "========================================="
echo "⚠️  CRITICAL WARNING"
echo "========================================="
echo ""
echo "You are about to ROLLBACK PRODUCTION to a previous state."
echo ""
echo "This will:"
echo "  ⛔ Stop all production services"
echo "  ⛔ Replace all production code with backup"
echo "  ⛔ Restart services with old code"
echo "  ⛔ Any changes since this backup will be LOST"
echo ""
echo "Current production will be backed up before rollback."
echo ""
read -p "Are you absolutely sure? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo ""
    echo "❌ Rollback cancelled by user."
    exit 1
fi

# Create emergency backup of current production
echo ""
echo "========================================="
echo "🔄 Starting Rollback Process"
echo "========================================="

echo ""
echo "💾 Creating emergency backup of current production..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EMERGENCY_BACKUP="$BACKUP_DIR/emergency_backup_before_rollback_$TIMESTAMP"
mkdir -p "$EMERGENCY_BACKUP"
rsync -av --exclude='node_modules' --exclude='__pycache__' --exclude='*.pyc' --exclude='.git' --exclude='logs' \
    "$PRODUCTION_DIR/" "$EMERGENCY_BACKUP/"
echo "✅ Emergency backup created: $EMERGENCY_BACKUP"

# Stop production services
echo ""
echo "🛑 Stopping production services..."
pm2 stop rupiyame-backend rupiyame-frontend 2>/dev/null || true
sleep 3
echo "✅ Production services stopped"

# Restore from backup
echo ""
echo "📋 Restoring from backup..."
rsync -av --delete \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.git' \
    --exclude='logs' \
    "$BACKUP_PATH/" "$PRODUCTION_DIR/"

echo "✅ Backup restored"

# Set production permissions
echo ""
echo "🔒 Setting production permissions..."
chown -R root:root "$PRODUCTION_DIR"
chmod -R 755 "$PRODUCTION_DIR"
find "$PRODUCTION_DIR" -type f -exec chmod 644 {} \;
echo "✅ Permissions set"

# Ensure log directories are writable
echo ""
echo "📝 Ensuring log directories are writable..."
mkdir -p "$PRODUCTION_DIR/backend/logs"
mkdir -p "$PRODUCTION_DIR/rupiyamaker-UI/crm/logs"
chmod -R 755 "$PRODUCTION_DIR/backend/logs"
chmod -R 755 "$PRODUCTION_DIR/rupiyamaker-UI/crm/logs"
echo "✅ Log directories ready"

# Restart production services
echo ""
echo "🚀 Starting production services..."
pm2 start "$PRODUCTION_DIR/ecosystem.config.js"
echo "✅ Production services started"

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "🏥 Checking service health..."
BACKEND_OK=false
FRONTEND_OK=false

for i in {1..10}; do
    if pm2 list | grep -q "rupiyame-backend.*online"; then
        echo "✅ Backend service is online"
        BACKEND_OK=true
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Backend service failed to start"
    fi
    echo "   Attempt $i/10 - waiting..."
    sleep 5
done

for i in {1..10}; do
    if pm2 list | grep -q "rupiyame-frontend.*online"; then
        echo "✅ Frontend service is online"
        FRONTEND_OK=true
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Frontend service failed to start"
    fi
    echo "   Attempt $i/10 - waiting..."
    sleep 5
done

# Check if services are healthy
if [ "$BACKEND_OK" = false ] || [ "$FRONTEND_OK" = false ]; then
    echo ""
    echo "❌ ROLLBACK FAILED - Services not starting properly!"
    echo ""
    echo "📋 Service logs:"
    pm2 logs --lines 50 --nostream
    echo ""
    echo "🔄 Attempting to restore current production..."
    
    pm2 stop all 2>/dev/null || true
    rsync -av --delete \
        --exclude='node_modules' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='.git' \
        --exclude='logs' \
        "$EMERGENCY_BACKUP/" "$PRODUCTION_DIR/"
    
    pm2 start "$PRODUCTION_DIR/ecosystem.config.js"
    sleep 10
    
    echo "❌ Rollback failed. Current production restored."
    echo "   Emergency backup: $EMERGENCY_BACKUP"
    echo "   Please investigate the issue manually."
    exit 1
fi

# Final verification
echo ""
echo "========================================="
echo "✅ Rollback Completed Successfully!"
echo "========================================="
echo ""
echo "📊 Service Status:"
pm2 list
echo ""
echo "🌐 Production URLs:"
echo "   Frontend: https://crm.rupiyamakercrm.online"
echo "   Backend:  https://crm.rupiyamakercrm.online:8049"
echo ""
echo "💾 Emergency Backup: $EMERGENCY_BACKUP"
echo "   (Current production before rollback)"
echo ""
echo "📋 Rollback Source: $BACKUP_PATH"
echo ""
echo "🔍 Monitor logs:"
echo "   pm2 logs production --lines 100"
echo ""
echo "⚠️  IMPORTANT:"
echo "   - Production is now running on the backup version"
echo "   - Emergency backup of current production: $EMERGENCY_BACKUP"
echo "   - Investigate why rollback was needed"
echo "   - Fix the issue in staging before redeploying"
echo ""
echo "🎉 Rollback complete!"
echo "========================================="