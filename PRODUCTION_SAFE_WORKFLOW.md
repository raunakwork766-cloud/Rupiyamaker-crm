# Production-Safe Development Workflow for RupiyaMe

## Overview
This document outlines the complete production-safe development workflow that ensures live users are never affected by development changes.

## Directory Structure

```
/var/www/
├── rupiyame-production/     # LIVE - Read-only, for real users
│   ├── backend/
│   ├── rupiyamaker-UI/
│   └── ecosystem.config.js
│
├── rupiyame-staging/        # DEVELOPMENT - Safe for editing and testing
│   ├── backend/
│   ├── rupiyamaker-UI/
│   └── ecosystem.config.js
│
└── rupiyame-backups/        # Automated backups
```

## Git Branch Strategy

- **main**: Production branch - merged ONLY after testing in staging
- **staging**: Development branch - all development happens here
- **feature/***: Feature branches (optional) - for major features

### Workflow Rules
1. NEVER commit directly to main
2. ALL development happens in staging branch
3. Testing happens in staging environment
4. Only deploy to production after successful staging testing
5. Production deployment is MANUAL only

## VS Code Remote SSH Configuration

### Required Settings
Open `.vscode/settings.json` in your project root and ensure:

```json
{
  "remote.SSH.remoteServerListenOnSocket": false,
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000,
  "files.watcherExclude": {
    "**/rupiyame-production/**": true
  }
}
```

### VS Code Workspace Setup
1. Open ONLY the staging directory: `code /var/www/rupiyame-staging`
2. NEVER open production directory in VS Code
3. Use VS Code's workspace feature to keep environments separate

## Permission Setup

### Production Directory Permissions (Read-Only)
```bash
# Production is read-only for developers
sudo chown -R root:root /var/www/rupiyame-production
sudo chmod -R 755 /var/www/rupiyame-production
# Make specific files read-only
sudo find /var/www/rupiyame-production -type f -exec chmod 644 {} \;
```

### Staging Directory Permissions (Writable)
```bash
# Staging is writable for developers
sudo chown -R $USER:$USER /var/www/rupiyame-staging
sudo chmod -R 755 /var/www/rupiyame-staging
```

## Development Workflow

### 1. Initial Setup (One-Time)
```bash
# Switch to staging branch
cd /var/www/rupiyame-staging
git checkout -b staging

# Configure git to track staging
git push -u origin staging
```

### 2. Daily Development
```bash
# 1. Start staging services
cd /var/www/rupiyame-staging
pm2 start ecosystem.config.js --env staging

# 2. Open VS Code on staging
code /var/www/rupiyame-staging

# 3. Make changes freely
# Edit files, save, test - NO impact on production

# 4. Commit changes to staging branch
git add .
git commit -m "Your commit message"
git push origin staging
```

### 3. Testing in Staging
- Access staging app: http://your-server:5902 (or configured staging port)
- Test thoroughly with staging data
- Verify all functionality works correctly

### 4. Deploy to Production (MANUAL ONLY)
```bash
# Run deployment script with confirmation
cd /var/www/rupiyame-staging
./deploy-to-production.sh
```

## Deployment Scripts

### Staging Deployment (Safe)
```bash
cd /var/www/rupiyame-staging
./deploy-staging.sh
```

### Production Deployment (Manual with Confirmation)
```bash
cd /var/www/rupiyame-staging
./deploy-to-production.sh
```

**⚠️ CRITICAL: Production deployment requires explicit confirmation**

## Service Management

### Staging Services
```bash
# Start staging
pm2 start ecosystem.config.js --env staging

# Stop staging
pm2 stop ecosystem.config.js --env staging

# Restart staging
pm2 restart ecosystem.config.js --env staging

# View staging logs
pm2 logs staging
```

### Production Services
```bash
# View production logs
pm2 logs production

# Production should never be restarted during development
# Only restart during maintenance windows with proper notification
```

## URLs

### Production (Live)
- Frontend: https://crm.rupiyamakercrm.online
- Backend API: https://crm.rupiyamakercrm.online:8049

### Staging (Development)
- Frontend: http://crm.rupiyamakercrm.online:5904
- Backend API: http://crm.rupiyamakercrm.online:8050

## Safety Checks

### Before Deployment
1. ✅ All tests pass in staging
2. ✅ No errors in staging logs
3. ✅ Manual testing completed
4. ✅ Git status is clean
5. ✅ Backup created successfully

### Deployment Verification
1. ✅ Production services started successfully
2. ✅ Health checks pass
3. ✅ Sample user workflows work
4. ✅ No errors in production logs

## Rollback Procedure

If deployment causes issues:

```bash
# Quick rollback to previous version
cd /var/www/rupiyame-production
git log --oneline -5  # Find previous commit hash
git reset --hard <previous-commit-hash>
pm2 restart all
```

## Non-Negotiable Rules

1. **NEVER** edit production files directly
2. **NEVER** commit directly to main branch
3. **NEVER** run deploy-to-production.sh without testing
4. **NEVER** open production directory in VS Code
5. **NEVER** restart production services during business hours
6. **ALWAYS** test in staging first
7. **ALWAYS** create backups before deployment
8. **ALWAYS** use proper git branch workflow

## Monitoring

### Production Health
```bash
# Check production services
pm2 status

# Check production logs
pm2 logs production --lines 100

# Check error logs
tail -f /var/www/rupiyame-production/backend/logs/backend-error.log
```

### Staging Health
```bash
# Check staging services
pm2 status

# Check staging logs
pm2 logs staging --lines 100
```

## Backup Strategy

### Automated Backups
- Daily database backups
- Weekly code snapshots
- Stored in `/var/www/rupiyame-backups/`

### Manual Backup Before Deployment
```bash
./create-backup.sh
```

## Emergency Contacts

If production is down:
1. Check logs: `pm2 logs production`
2. Verify services: `pm2 status`
3. If needed, rollback: `./rollback.sh`
4. Contact team immediately

## Quick Reference

| Task | Command |
|------|---------|
| Start Staging | `cd /var/www/rupiyame-staging && pm2 start ecosystem.config.js --env staging` |
| Stop Staging | `cd /var/www/rupiyame-staging && pm2 stop ecosystem.config.js --env staging` |
| Deploy to Production | `cd /var/www/rupiyame-staging && ./deploy-to-production.sh` |
| View Production Logs | `pm2 logs production` |
| Create Backup | `./create-backup.sh` |
| Rollback | `./rollback.sh` |

---

**Remember: This workflow protects your live users. Follow it strictly.**