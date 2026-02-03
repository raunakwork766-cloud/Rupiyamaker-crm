# Production-Safe Workflow Implementation Guide

## Overview
This guide will help you implement a production-safe development workflow for RupiyaMe that ensures live users are never affected by development changes.

## Prerequisites

- Root or sudo access to the server
- PM2 installed and configured
- Git repository set up
- Current production running in `/www/wwwroot/RupiyaMe`

## Implementation Steps

### Step 1: Make All Scripts Executable

```bash
cd /www/wwwroot/RupiyaMe
chmod +x *.sh
```

### Step 2: Run the Setup Script

The setup script will:
- Create production and staging directories
- Set up proper permissions
- Configure Git branches
- Create necessary configuration files
- Back up current production

```bash
sudo ./setup-production-safe-workflow.sh
```

**⚠️ IMPORTANT: This will:**
1. Stop all current services
2. Create a backup of current production
3. Set up production (read-only) and staging (writable) directories
4. Configure proper permissions

### Step 3: Start Staging Services

```bash
cd /var/www/rupiyame-staging
pm2 start ecosystem.config.js
```

### Step 4: Start Production Services

```bash
cd /var/www/rupiyame-production
pm2 start ecosystem.config.js
```

### Step 5: Configure VS Code Remote SSH

Open VS Code on your local machine and configure Remote SSH:

1. Install VS Code Remote SSH extension
2. Configure SSH config to connect to server
3. Open ONLY the staging directory:
   ```
   code /var/www/rupiyame-staging
   ```

The setup script has already created `.vscode/settings.json` in staging with proper configuration.

### Step 6: Verify the Setup

Check that both environments are running:

```bash
# Check all PM2 services
pm2 status

# Should show:
# - rupiyame-backend (production)
# - rupiyame-frontend (production)
# - rupiyame-backend-staging (staging)
# - rupiyame-frontend-staging (staging)
```

Test both environments:

- **Production**: https://crm.rupiyamakercrm.online
- **Staging**: http://crm.rupiyamakercrm.online:5904

## Daily Development Workflow

### 1. Start Your Day

```bash
# Connect to staging via VS Code
code /var/www/rupiyame-staging

# Ensure staging services are running
cd /var/www/rupiyame-staging
pm2 restart ecosystem.config.js
```

### 2. Make Changes

- Edit files freely in VS Code
- Save files (NO impact on production)
- Test changes on staging: http://crm.rupiyamakercrm.online:5904

### 3. Commit Changes

```bash
cd /var/www/rupiyame-staging
git add .
git commit -m "Your descriptive message"
git push origin staging
```

### 4. Deploy to Production

**ONLY after testing in staging:**

```bash
cd /var/www/rupiyame-staging
sudo ./deploy-to-production.sh
```

This script will:
- Verify git status is clean
- Verify staging services are running
- Create backup of current production
- Require explicit confirmation
- Deploy changes
- Verify services are healthy
- Auto-rollback if deployment fails

## Available Scripts

### Setup
- `setup-production-safe-workflow.sh` - Initial setup of production-staging separation

### Deployment
- `deploy-staging.sh` - Deploy to staging (safe, no impact)
- `deploy-to-production.sh` - Deploy to production (with safety checks)

### Backup & Rollback
- `rollback.sh` - Rollback production to previous backup
- `manage-backups.sh` - Manage backups (list, create, delete, clean)

### Backup Management Examples

```bash
# List all backups
sudo ./manage-backups.sh list

# Create production backup
sudo ./manage-backups.sh create-production

# Create staging backup
sudo ./manage-backups.sh create-staging

# Delete specific backup
sudo ./manage-backups.sh delete production_backup_20260103_143000

# Keep only last 3 production backups
sudo ./manage-backups.sh clean-production 3

# Clean both production and staging backups (keep last 5)
sudo ./manage-backups.sh clean-all 5
```

## Rollback Procedure

If a production deployment causes issues:

```bash
# List available backups
sudo ./rollback.sh

# Rollback to specific backup
sudo ./rollback.sh production_backup_20260103_143000
```

The rollback script will:
- List all available backups
- Require explicit confirmation
- Create emergency backup of current production
- Restore from selected backup
- Verify services are healthy
- Auto-restore if rollback fails

## Permissions

### Production (Read-Only)
```bash
# View permissions
ls -la /var/www/rupiyame-production

# Files are owned by root:root
# Permissions: 644 (read-only for everyone except root)
```

**You cannot edit production files directly - this is by design!**

### Staging (Writable)
```bash
# View permissions
ls -la /var/www/rupiyame-staging

# Files are owned by your user
# Permissions: 755 (writable by your user)
```

**You can edit staging files freely**

## Git Workflow

### Branch Structure
- `main` - Production branch (never commit directly)
- `staging` - Development branch (all development here)

### Rules
1. NEVER commit directly to main
2. ALL development happens in staging branch
3. Test thoroughly in staging before deploying
4. Deploy only with explicit confirmation

### Example Git Workflow

```bash
# Switch to staging (do this once)
cd /var/www/rupiyame-staging
git checkout staging

# Make changes...

# Commit to staging
git add .
git commit -m "Fix user login bug"
git push origin staging

# After testing in staging...

# Deploy to production
sudo ./deploy-to-production.sh
```

## Monitoring

### Check Service Status

```bash
# All services
pm2 status

# Production logs
pm2 logs production

# Staging logs
pm2 logs staging

# Real-time logs
pm2 logs --lines 100
```

### Check Error Logs

```bash
# Production errors
tail -f /var/www/rupiyame-production/backend/logs/backend-error.log
tail -f /var/www/rupiyame-production/rupiyamaker-UI/crm/logs/frontend-error.log

# Staging errors
tail -f /var/www/rupiyame-staging/backend/logs/backend-error.log
tail -f /var/www/rupiyame-staging/rupiyamaker-UI/crm/logs/frontend-error.log
```

## URLs

### Production (Live Users)
- Frontend: https://crm.rupiyamakercrm.online
- Backend API: https://crm.rupiyamakercrm.online:8049

### Staging (Development Only)
- Frontend: http://crm.rupiyamakercrm.online:5904
- Backend API: http://crm.rupiyamakercrm.online:8050

## Safety Checks

### Before Deployment to Production

1. ✅ Test all changes in staging
2. ✅ Verify no errors in staging logs
3. ✅ Ensure git status is clean
4. ✅ Create backup (automatic with deploy script)
5. ✅ Get explicit confirmation

### After Deployment

1. ✅ Verify services are running
2. ✅ Check production logs for errors
3. ✅ Test critical user workflows
4. ✅ Monitor for 10-15 minutes

## Troubleshooting

### Staging Services Won't Start

```bash
# Check logs
cd /var/www/rupiyame-staging
pm2 logs rupiyame-backend-staging --lines 100
pm2 logs rupiyame-frontend-staging --lines 100

# Restart services
pm2 restart ecosystem.config.js
```

### Production Deployment Fails

```bash
# Check deployment logs
cd /var/www/rupiyame-staging
pm2 logs production --lines 100

# Rollback to previous version
sudo ./rollback.sh production_backup_<timestamp>
```

### Permission Errors

```bash
# Fix staging permissions (if needed)
sudo chown -R $USER:$USER /var/www/rupiyame-staging
chmod -R 755 /var/www/rupiyame-staging

# Production permissions should remain root:root
# DO NOT change production permissions
```

### Can't Edit Production Files

**This is expected behavior!** Production is read-only by design.

1. Make changes in staging instead
2. Test changes in staging
3. Deploy to production via `deploy-to-production.sh`

## Best Practices

### Development
1. Always work in staging
2. Test thoroughly before deployment
3. Commit changes regularly
4. Use descriptive commit messages
5. Review changes before deploying

### Deployment
1. Deploy during low-traffic hours if possible
2. Monitor logs after deployment
3. Be ready to rollback if needed
4. Keep backup of current version
5. Document any manual steps needed

### Backup Management
1. Create backups before major changes
2. Clean old backups regularly (keep last 5-10)
3. Never delete emergency backups
4. Verify backup integrity periodically
5. Store backups in `/var/www/rupiyame-backups`

## Security

### Production Safety
- Production directory is read-only (root:root)
- Cannot edit files directly
- Deployment requires sudo access
- Multiple confirmation steps
- Automatic rollback on failure
- Always creates backup before deployment

### Access Control
- Setup scripts require sudo
- Deployment scripts require sudo
- Rollback scripts require sudo
- Regular development does not need sudo (in staging)

## Emergency Procedures

### Production Down

1. Check service status: `pm2 status`
2. Check logs: `pm2 logs production --lines 100`
3. If services failed, try restart: `pm2 restart production`
4. If restart fails, rollback: `sudo ./rollback.sh <backup>`
5. Contact team if needed

### Deployment Failure

The deployment script automatically:
1. Creates backup before deployment
2. Stops services
3. Deploys code
4. Starts services
5. Verifies health
6. Auto-rolls back if services fail to start

If auto-rollback fails:
```bash
sudo ./rollback.sh <backup_name>
```

### Data Loss Prevention

1. Always create backup before deployment (automatic)
2. Never delete emergency backups
3. Keep multiple backup versions
4. Test backup restoration periodically
5. Document backup locations

## Summary

The production-safe workflow ensures:

✅ **Live users never affected by development**
- Production and staging are completely separate
- File saves in staging don't impact production
- Production is read-only

✅ **Safe development environment**
- Edit files freely in staging
- Test changes in staging
- No risk to production

✅ **Controlled deployment**
- Manual deployment only
- Multiple safety checks
- Explicit confirmation required
- Automatic rollback on failure

✅ **Professional workflow**
- Git branch strategy
- Proper permissions
- Backup and rollback procedures
- Clear documentation

✅ **Industry standard**
- Production-staging separation
- No direct production editing
- Deployment scripts with safety checks
- Comprehensive monitoring

## Quick Reference

| Task | Command |
|------|---------|
| Setup workflow | `sudo ./setup-production-safe-workflow.sh` |
| Start staging | `cd /var/www/rupiyame-staging && pm2 start ecosystem.config.js` |
| Start production | `cd /var/www/rupiyame-production && pm2 start ecosystem.config.js` |
| Deploy to production | `cd /var/www/rupiyame-staging && sudo ./deploy-to-production.sh` |
| Rollback | `sudo ./rollback.sh <backup_name>` |
| List backups | `sudo ./manage-backups.sh list` |
| View logs | `pm2 logs production` |
| Check status | `pm2 status` |

---

**Remember: This workflow protects your live users. Follow it strictly.**

For detailed documentation, see `PRODUCTION_SAFE_WORKFLOW.md`