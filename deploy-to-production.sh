#!/bin/bash

# Production Deployment Script
# This script deploys changes from staging to production
# CRITICAL: Requires explicit confirmation and safety checks

set -e

echo "========================================="
echo "🚨 PRODUCTION DEPLOYMENT SCRIPT"
echo "========================================="

# Configuration
STAGING_DIR="/var/www/rupiyame-staging"
PRODUCTION_DIR="/var/www/rupiyame-production"
BACKUP_DIR="/var/www/rupiyame-backups"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script should be run as root or with sudo."
    echo "   Example: sudo ./deploy-to-production.sh"
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
echo "⚠️  WARNING: You are about to deploy to PRODUCTION!"
echo ""
echo "📋 Deployment Information:"
echo "   Source:       $STAGING_DIR"
echo "   Destination:  $PRODUCTION_DIR"
echo "   Time:         $(date)"
echo ""

# Safety check 1: Verify git status
echo "🔍 Checking git status..."
if ! git diff-index --quiet HEAD --; then
    echo "❌ ERROR: You have uncommitted changes in staging!"
    echo ""
    git status --short
    echo ""
    echo "Please commit your changes first:"
    echo "  git add ."
    echo "  git commit -m 'Your changes'"
    echo "  git push origin staging"
    exit 1
fi
echo "✅ Git status is clean"

# Safety check 2: Verify staging services are running
echo ""
echo "🔍 Checking staging services..."
if ! pm2 list | grep -q "rupiyame-backend-staging\|rupiyame-frontend-staging"; then
    echo "❌ ERROR: Staging services are not running!"
    echo "   Please start staging services first:"
    echo "   pm2 start ecosystem.config.js"
    exit 1
fi
echo "✅ Staging services are running"

# Safety check 3: Verify we're on staging branch
echo ""
echo "🔍 Checking current branch..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "staging" ]; then
    echo "❌ ERROR: You are not on the staging branch!"
    echo "   Current branch: $CURRENT_BRANCH"
    echo "   Please switch to staging:"
    echo "   git checkout staging"
    exit 1
fi
echo "✅ On staging branch"

# Safety check 4: Create backup
echo ""
echo "💾 Creating backup of current production..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="production_backup_$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

mkdir -p "$BACKUP_PATH"
rsync -av --exclude='node_modules' --exclude='__pycache__' --exclude='*.pyc' --exclude='.git' --exclude='logs' \
    "$PRODUCTION_DIR/" "$BACKUP_PATH/"

echo "✅ Backup created: $BACKUP_PATH"

# Safety check 5: Confirm deployment
echo ""
echo "========================================="
echo "⚠️  FINAL CONFIRMATION REQUIRED"
echo "========================================="
echo ""
echo "You are about to deploy to PRODUCTION."
echo ""
echo "Changes to be deployed:"
git log --oneline main..staging
echo ""
echo "Backup location: $BACKUP_PATH"
echo ""
read -p "Are you absolutely sure you want to proceed? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo ""
    echo "❌ Deployment cancelled by user."
    echo "   Backup remains at: $BACKUP_PATH"
    exit 1
fi

echo ""
echo "========================================="
echo "🚀 Starting Deployment to Production"
echo "========================================="

# Stop production services
echo ""
echo "🛑 Stopping production services..."
pm2 stop rupiyame-backend rupiyame-frontend 2>/dev/null || true
sleep 3
echo "✅ Production services stopped"

# Deploy code changes
echo ""
echo "📋 Deploying code to production..."
rsync -av --delete \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='.vscode' \
    --exclude='README.md' \
    "$STAGING_DIR/" "$PRODUCTION_DIR/"

echo "✅ Code deployed"

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

# Update production to main branch
echo ""
echo "🌿 Updating production to main branch..."
cd "$PRODUCTION_DIR"
git checkout main
git merge staging -m "Deploy from staging: $(date)"
echo "✅ Production updated to main branch"

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
for i in {1..10}; do
    if pm2 list | grep -q "rupiyame-backend.*online"; then
        echo "✅ Backend service is online"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Backend service failed to start"
        echo ""
        echo "📋 Backend logs:"
        pm2 logs rupiyame-backend --lines 50 --nostream
        echo ""
        echo "🔄 Initiating rollback..."
        ./rollback.sh "$BACKUP_PATH"
        exit 1
    fi
    echo "   Attempt $i/10 - waiting..."
    sleep 5
done

for i in {1..10}; do
    if pm2 list | grep -q "rupiyame-frontend.*online"; then
        echo "✅ Frontend service is online"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Frontend service failed to start"
        echo ""
        echo "📋 Frontend logs:"
        pm2 logs rupiyame-frontend --lines 50 --nostream
        echo ""
        echo "🔄 Initiating rollback..."
        ./rollback.sh "$BACKUP_PATH"
        exit 1
    fi
    echo "   Attempt $i/10 - waiting..."
    sleep 5
done

# Final verification
echo ""
echo "========================================="
echo "✅ Deployment Completed Successfully!"
echo "========================================="
echo ""
echo "📊 Service Status:"
pm2 list
echo ""
echo "🌐 Production URLs:"
echo "   Frontend: https://crm.rupiyamakercrm.online"
echo "   Backend:  https://crm.rupiyamakercrm.online:8049"
echo ""
echo "💾 Backup Location: $BACKUP_PATH"
echo "   If needed, rollback with: ./rollback.sh $BACKUP_PATH"
echo ""
echo "📋 Recent Changes:"
git log --oneline -5
echo ""
echo "🔍 Monitor logs:"
echo "   pm2 logs production --lines 100"
echo ""
echo "🎉 Production deployment complete!"
echo "========================================="