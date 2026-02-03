#!/bin/bash

# Staging Deployment Script
# This script deploys changes to staging (safe, no impact on production)

set -e

echo "========================================="
echo "🚀 STAGING DEPLOYMENT SCRIPT"
echo "========================================="

# Configuration
STAGING_DIR="/var/www/rupiyame-staging"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script should be run as root or with sudo."
    echo "   Example: sudo ./deploy-staging.sh"
    exit 1
fi

# Check if we're in staging directory
if [ "$(pwd)" != "$STAGING_DIR" ]; then
    echo "❌ This script must be run from the staging directory."
    echo "   Current: $(pwd)"
    echo "   Expected: $STAGING_DIR"
    exit 1
fi

echo ""
echo "📋 Deployment Information:"
echo "   Environment: Staging"
echo "   Directory:    $STAGING_DIR"
echo "   Time:         $(date)"
echo ""

# Optional: Create backup before staging deployment
read -p "💾 Create backup before staging deployment? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    BACKUP_DIR="/var/www/rupiyame-backups"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_NAME="staging_backup_$TIMESTAMP"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    mkdir -p "$BACKUP_PATH"
    rsync -av --exclude='node_modules' --exclude='__pycache__' --exclude='*.pyc' --exclude='.git' --exclude='logs' \
        "$STAGING_DIR/" "$BACKUP_PATH/"
    
    echo "✅ Staging backup created: $BACKUP_PATH"
fi

# Restart staging services
echo ""
echo "🔄 Restarting staging services..."
pm2 restart rupiyame-backend-staging rupiyame-frontend-staging
echo "✅ Staging services restarted"

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service health
echo ""
echo "🏥 Checking service health..."
for i in {1..10}; do
    if pm2 list | grep -q "rupiyame-backend-staging.*online"; then
        echo "✅ Backend service is online"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Backend service failed to start"
        echo ""
        echo "📋 Backend logs:"
        pm2 logs rupiyame-backend-staging --lines 50 --nostream
        exit 1
    fi
    echo "   Attempt $i/10 - waiting..."
    sleep 5
done

for i in {1..10}; do
    if pm2 list | grep -q "rupiyame-frontend-staging.*online"; then
        echo "✅ Frontend service is online"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Frontend service failed to start"
        echo ""
        echo "📋 Frontend logs:"
        pm2 logs rupiyame-frontend-staging --lines 50 --nostream
        exit 1
    fi
    echo "   Attempt $i/10 - waiting..."
    sleep 5
done

# Final summary
echo ""
echo "========================================="
echo "✅ Staging Deployment Completed!"
echo "========================================="
echo ""
echo "📊 Service Status:"
pm2 list
echo ""
echo "🌐 Staging URLs:"
echo "   Frontend: http://crm.rupiyamakercrm.online:5904"
echo "   Backend:  http://crm.rupiyamakercrm.online:8050"
echo ""
echo "🔍 Monitor logs:"
echo "   pm2 logs staging --lines 100"
echo ""
echo "📝 Test your changes in staging before deploying to production"
echo ""
echo "🎉 Staging deployment complete!"
echo "========================================="