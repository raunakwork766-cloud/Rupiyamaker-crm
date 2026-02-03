#!/bin/bash

# Production-Safe Workflow Setup Script
# This script sets up the complete production-staging separation

set -e

echo "========================================="
echo "🚀 Production-Safe Workflow Setup"
echo "========================================="

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script should be run as root or with sudo."
    echo "   Example: sudo ./setup-production-safe-workflow.sh"
    exit 1
fi

# Configuration
CURRENT_DIR="/www/wwwroot/RupiyaMe"
PRODUCTION_DIR="/var/www/rupiyame-production"
STAGING_DIR="/var/www/rupiyame-staging"
BACKUP_DIR="/var/www/rupiyame-backups"

echo ""
echo "📋 Configuration:"
echo "   Current Directory: $CURRENT_DIR"
echo "   Production Target: $PRODUCTION_DIR"
echo "   Staging Target: $STAGING_DIR"
echo "   Backup Directory: $BACKUP_DIR"
echo ""

# Create backup directory
echo "📁 Creating backup directory..."
mkdir -p "$BACKUP_DIR"
chmod 755 "$BACKUP_DIR"
echo "✅ Backup directory created: $BACKUP_DIR"

# Stop all current services
echo ""
echo "🛑 Stopping current services..."
pm2 stop all 2>/dev/null || echo "No PM2 services running"
echo "✅ Services stopped"

# Create backup of current production
echo ""
echo "💾 Creating backup of current production..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="rupiyame_backup_$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

mkdir -p "$BACKUP_PATH"
rsync -av --exclude='node_modules' --exclude='__pycache__' --exclude='*.pyc' --exclude='.git' \
    "$CURRENT_DIR/" "$BACKUP_PATH/" --delete

echo "✅ Backup created: $BACKUP_PATH"

# Create production directory structure
echo ""
echo "📁 Creating production directory structure..."
mkdir -p "$PRODUCTION_DIR"

# Copy current production code to production directory
echo "📋 Copying code to production directory..."
rsync -av --exclude='node_modules' --exclude='__pycache__' --exclude='*.pyc' --exclude='.git' --exclude='logs' \
    "$CURRENT_DIR/" "$PRODUCTION_DIR/"

echo "✅ Production directory created: $PRODUCTION_DIR"

# Create staging directory structure
echo ""
echo "📁 Creating staging directory structure..."
mkdir -p "$STAGING_DIR"

# Copy code to staging directory
echo "📋 Copying code to staging directory..."
rsync -av --exclude='node_modules' --exclude='__pycache__' --exclude='*.pyc' --exclude='.git' --exclude='logs' \
    "$CURRENT_DIR/" "$STAGING_DIR/"

echo "✅ Staging directory created: $STAGING_DIR"

# Set up permissions for production (read-only for developers)
echo ""
echo "🔒 Setting production permissions (read-only)..."
chown -R root:root "$PRODUCTION_DIR"
chmod -R 755 "$PRODUCTION_DIR"
find "$PRODUCTION_DIR" -type f -exec chmod 644 {} \;
echo "✅ Production permissions set"

# Set up permissions for staging (writable for developers)
echo ""
echo "📝 Setting staging permissions (writable)..."
# Get current user
if [ -n "$SUDO_USER" ]; then
    USER="$SUDO_USER"
else
    USER="$USER"
fi
chown -R "$USER:$USER" "$STAGING_DIR"
chmod -R 755 "$STAGING_DIR"
echo "✅ Staging permissions set"

# Create necessary log directories
echo ""
echo "📝 Creating log directories..."
mkdir -p "$PRODUCTION_DIR/backend/logs"
mkdir -p "$PRODUCTION_DIR/rupiyamaker-UI/crm/logs"
mkdir -p "$STAGING_DIR/backend/logs"
mkdir -p "$STAGING_DIR/rupiyamaker-UI/crm/logs"
chmod -R 755 "$PRODUCTION_DIR/backend/logs"
chmod -R 755 "$PRODUCTION_DIR/rupiyamaker-UI/crm/logs"
chmod -R 755 "$STAGING_DIR/backend/logs"
chmod -R 755 "$STAGING_DIR/rupiyamaker-UI/crm/logs"
echo "✅ Log directories created"

# Create production ecosystem config
echo ""
echo "⚙️ Creating production ecosystem config..."
cat > "$PRODUCTION_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [
    {
      name: 'rupiyame-backend',
      cwd: '/var/www/rupiyame-production/backend',
      script: 'venv/bin/python',
      args: '-m app',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        ENVIRONMENT: 'production',
        PYTHONUNBUFFERED: '1'
      },
      error_file: '/var/www/rupiyame-production/backend/logs/backend-error.log',
      out_file: '/var/www/rupiyame-production/backend/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    {
      name: 'rupiyame-frontend',
      cwd: '/var/www/rupiyame-production/rupiyamaker-UI/crm',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 4521',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: '4521'
      },
      error_file: '/var/www/rupiyame-production/rupiyamaker-UI/crm/logs/frontend-error.log',
      out_file: '/var/www/rupiyame-production/rupiyamaker-UI/crm/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
EOF
echo "✅ Production ecosystem config created"

# Create staging ecosystem config
echo ""
echo "⚙️ Creating staging ecosystem config..."
cat > "$STAGING_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [
    {
      name: 'rupiyame-backend-staging',
      cwd: '/var/www/rupiyame-staging/backend',
      script: 'venv/bin/python',
      args: '-m app',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        ENVIRONMENT: 'staging',
        PYTHONUNBUFFERED: '1'
      },
      error_file: '/var/www/rupiyame-staging/backend/logs/backend-error.log',
      out_file: '/var/www/rupiyame-staging/backend/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    {
      name: 'rupiyame-frontend-staging',
      cwd: '/var/www/rupiyame-staging/rupiyamaker-UI/crm',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 5904',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: '5904'
      },
      error_file: '/var/www/rupiyame-staging/rupiyamaker-UI/crm/logs/frontend-error.log',
      out_file: '/var/www/rupiyame-staging/rupiyamaker-UI/crm/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
EOF
echo "✅ Staging ecosystem config created"

# Set up Git branches
echo ""
echo "🌿 Setting up Git branches..."
cd "$STAGING_DIR"

# Create staging branch if it doesn't exist
if ! git show-ref --verify --quiet refs/heads/staging; then
    git checkout -b staging
    echo "✅ Staging branch created"
else
    git checkout staging
    echo "✅ Switched to staging branch"
fi

# Push staging branch to remote
read -p "📤 Push staging branch to remote? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push -u origin staging
    echo "✅ Staging branch pushed to remote"
fi

# Switch back to main in production
cd "$PRODUCTION_DIR"
if ! git show-ref --verify --quiet refs/heads/main; then
    git branch main
fi
git checkout main
echo "✅ Production on main branch"

# Create VS Code workspace
echo ""
echo "💻 Creating VS Code workspace configuration..."
mkdir -p "$STAGING_DIR/.vscode"
cat > "$STAGING_DIR/.vscode/settings.json" << 'EOF'
{
  "remote.SSH.remoteServerListenOnSocket": false,
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000,
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/venv/**": true,
    "**/__pycache__/**": true,
    "**/.git/**": true,
    "**/rupiyame-production/**": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/venv": true,
    "**/__pycache__": true,
    "**/.git": true
  },
  "files.exclude": {
    "**/__pycache__": true,
    "**/*.pyc": true
  }
}
EOF
echo "✅ VS Code workspace configuration created"

# Create README in staging
echo ""
echo "📝 Creating staging README..."
cat > "$STAGING_DIR/README.md" << 'EOF'
# RupiyaMe Staging Environment

⚠️ **THIS IS THE STAGING ENVIRONMENT**

## Purpose
This environment is for development and testing only. Changes here do NOT affect production.

## Workflow
1. Make changes freely in this directory
2. Test changes on staging: http://crm.rupiyamakercrm.online:5904
3. Commit changes to staging branch
4. Deploy to production only after testing

## Commands
```bash
# Start staging services
pm2 start ecosystem.config.js

# Stop staging services
pm2 stop ecosystem.config.js

# View logs
pm2 logs staging

# Deploy to production
./deploy-to-production.sh
```

## Important Rules
- ✅ Edit files freely
- ✅ Save and test in staging
- ✅ Commit to staging branch
- ❌ NEVER edit production files directly
- ❌ NEVER commit directly to main branch

## URLs
- Staging Frontend: http://crm.rupiyamakercrm.online:5904
- Production Frontend: https://crm.rupiyamakercrm.online

For more details, see PRODUCTION_SAFE_WORKFLOW.md
EOF
echo "✅ Staging README created"

# Create README in production
echo ""
echo "📝 Creating production README..."
cat > "$PRODUCTION_DIR/README.md" << 'EOF'
# RupiyaMe Production Environment

🚨 **THIS IS THE LIVE PRODUCTION ENVIRONMENT**

## Warning
⚠️ **DO NOT EDIT FILES IN THIS DIRECTORY DIRECTLY**

This directory is read-only and serves live users. Any changes must be deployed through the staging environment.

## Purpose
This environment is for live users only. All development happens in the staging environment.

## Deployment
Deploy changes from staging:
```bash
cd /var/www/rupiyame-staging
./deploy-to-production.sh
```

## Monitoring
```bash
# Check services
pm2 status

# View logs
pm2 logs production

# View error logs
tail -f /var/www/rupiyame-production/backend/logs/backend-error.log
```

## URLs
- Production Frontend: https://crm.rupiyamakercrm.online
- Production Backend: https://crm.rupiyamakercrm.online:8049

## Important Rules
- ❌ NEVER edit files directly
- ❌ NEVER commit directly to this directory
- ✅ ONLY deploy from staging
- ✅ Monitor logs regularly

For more details, see PRODUCTION_SAFE_WORKFLOW.md
EOF
echo "✅ Production README created"

# Final summary
echo ""
echo "========================================="
echo "✅ Setup Completed Successfully!"
echo "========================================="
echo ""
echo "📁 Directories Created:"
echo "   Production:  $PRODUCTION_DIR"
echo "   Staging:     $STAGING_DIR"
echo "   Backups:     $BACKUP_DIR"
echo ""
echo "🔒 Permissions:"
echo "   Production:  Read-only (root:root)"
echo "   Staging:     Writable ($USER:$USER)"
echo ""
echo "🌿 Git Branches:"
echo "   Production:  main"
echo "   Staging:     staging"
echo ""
echo "🔧 Next Steps:"
echo ""
echo "1. Start staging services:"
echo "   cd $STAGING_DIR"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "2. Start production services:"
echo "   cd $PRODUCTION_DIR"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "3. Open VS Code for development:"
echo "   code $STAGING_DIR"
echo ""
echo "4. Read the full workflow documentation:"
echo "   cat $STAGING_DIR/PRODUCTION_SAFE_WORKFLOW.md"
echo ""
echo "⚠️  IMPORTANT:"
echo "   - Production is now read-only"
echo "   - Only edit files in staging"
echo "   - Deploy to production manually"
echo "   - Test thoroughly before deployment"
echo ""
echo "🎉 Your production-safe workflow is ready!"
echo "========================================="