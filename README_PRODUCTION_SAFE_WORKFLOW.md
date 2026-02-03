# Production-Safe Workflow for RupiyaMe

## 🎯 Overview

This production-safe workflow ensures that **live users are never affected by development changes**. It provides a complete separation between production and staging environments with robust safety mechanisms.

## ⚡ What This Solves

**Before**: Saving files directly updated the live website - dangerous for users!

**After**: 
- ✅ Edit files freely in staging (no impact on production)
- ✅ Test changes thoroughly before deployment
- ✅ Deploy to production only with explicit confirmation
- ✅ Automatic rollback if deployment fails
- ✅ Always backed up before deployment

## 📁 Directory Structure

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

## 🚀 Quick Setup

```bash
# 1. Make scripts executable
cd /www/wwwroot/RupiyaMe
chmod +x *.sh

# 2. Run setup script
sudo ./setup-production-safe-workflow.sh

# 3. Start staging
cd /var/www/rupiyame-staging
pm2 start ecosystem.config.js

# 4. Start production
cd /var/www/rupiyame-production
pm2 start ecosystem.config.js

# 5. Open VS Code for development
code /var/www/rupiyame-staging
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **QUICK_REFERENCE.md** | Quick commands and reference (start here) |
| **IMPLEMENTATION_GUIDE.md** | Complete setup and daily workflow guide |
| **PRODUCTION_SAFE_WORKFLOW.md** | Detailed workflow documentation |

## 🔧 Scripts

| Script | Purpose |
|--------|---------|
| `setup-production-safe-workflow.sh` | Initial setup of production-staging separation |
| `deploy-to-production.sh` | Deploy to production (with safety checks) |
| `deploy-staging.sh` | Deploy to staging (safe) |
| `rollback.sh` | Rollback production to previous backup |
| `manage-backups.sh` | Manage backups (list, create, delete, clean) |

## 🌐 URLs

### Production (Live Users)
- Frontend: https://crm.rupiyamakercrm.online
- Backend: https://crm.rupiyamakercrm.online:8049

### Staging (Development Only)
- Frontend: http://crm.rupiyamakercrm.online:5904
- Backend: http://crm.rupiyamakercrm.online:8050

## 📝 Daily Workflow

```bash
# 1. Make changes in staging (via VS Code)
code /var/www/rupiyame-staging

# 2. Test changes
# http://crm.rupiyamakercrm.online:5904

# 3. Commit changes
git add .
git commit -m "Your message"
git push origin staging

# 4. Deploy to production (ONLY after testing)
cd /var/www/rupiyame-staging
sudo ./deploy-to-production.sh
```

## ⚠️ Critical Rules

1. **NEVER** edit production files directly
2. **NEVER** commit directly to main branch
3. **ALWAYS** test in staging first
4. **ALWAYS** deploy with `deploy-to-production.sh`
5. **ALWAYS** create backups (automatic with deploy)

## 🔒 Safety Features

### Production Protection
- ✅ Read-only permissions (root:root)
- ✅ Cannot edit files directly
- ✅ Deployment requires sudo
- ✅ Multiple confirmation steps
- ✅ Automatic rollback on failure
- ✅ Always backed up before deployment

### Deployment Safety
- ✅ Verifies git status is clean
- ✅ Verifies staging services running
- ✅ Creates backup automatically
- ✅ Requires explicit confirmation
- ✅ Checks service health after deployment
- ✅ Auto-rolls back if services fail

### Backup Protection
- ✅ Emergency backups never deleted
- ✅ Multiple backup versions retained
- ✅ Easy rollback procedure
- ✅ Backup management tools

## 🔄 Rollback Procedure

```bash
# List available backups
sudo ./rollback.sh

# Rollback to specific backup
sudo ./rollback.sh production_backup_20260103_143000
```

## 💾 Backup Management

```bash
# List all backups
sudo ./manage-backups.sh list

# Create backup
sudo ./manage-backups.sh create-production

# Clean old backups (keep last 5)
sudo ./manage-backups.sh clean-all 5
```

## 🌿 Git Branch Strategy

- **main**: Production branch (never commit directly)
- **staging**: Development branch (all development here)

```bash
# Switch to staging (do once)
cd /var/www/rupiyame-staging
git checkout staging

# All development in staging branch
# Deploy to production after testing
```

## 📊 Monitoring

```bash
# Check all services
pm2 status

# View logs
pm2 logs production
pm2 logs staging

# Real-time monitoring
pm2 logs --lines 100
```

## 🚨 Emergency Procedures

### Production Down
```bash
# Check status
pm2 status

# Check logs
pm2 logs production --lines 100

# Try restart
pm2 restart production

# If restart fails, rollback
sudo ./rollback.sh <backup_name>
```

### Deployment Failed
```bash
# The deploy script automatically:
# 1. Creates backup
# 2. Stops services
# 3. Deploys code
# 4. Starts services
# 5. Verifies health
# 6. Auto-rolls back if services fail

# If auto-rollback fails:
sudo ./rollback.sh <backup_name>
```

## ✅ Benefits

### For Live Users
- ✅ Zero downtime during development
- ✅ No unexpected changes
- ✅ Stable production environment
- ✅ Quick rollback if issues occur

### For Developers
- ✅ Safe development environment
- ✅ Edit and save freely
- ✅ Test without risk
- ✅ Clear deployment process
- ✅ Easy rollback

### For Business
- ✅ Professional workflow
- ✅ Industry-standard practices
- ✅ Reduced risk
- ✅ Better reliability
- ✅ Peace of mind

## 🎓 Key Concepts

| Concept | Description |
|---------|-------------|
| **Production** | Live environment for real users (read-only) |
| **Staging** | Development environment (writable) |
| **Deploy** | Move changes from staging to production |
| **Rollback** | Restore production to previous backup |
| **Backup** | Snapshot of production before deployment |

## 💡 Best Practices

1. **Test thoroughly** in staging before deployment
2. **Deploy during low-traffic** hours when possible
3. **Monitor logs** after deployment
4. **Keep multiple backups** (at least 5)
5. **Document manual steps** needed for deployment
6. **Save often** in staging - no impact on production
7. **Use descriptive commit messages**
8. **Review changes** before deploying

## 📞 When to Contact Team

- Production down and can't restart
- Rollback fails
- Multiple deployment attempts fail
- Data integrity issues
- Security concerns

## 🔍 Troubleshooting

### Can't edit production files?
**Expected!** Production is read-only by design. Edit in staging, then deploy.

### Staging services won't start?
```bash
pm2 logs staging --lines 100
pm2 restart ecosystem.config.js
```

### Deployment failed?
```bash
sudo ./rollback.sh <backup_name>
```

### Permission errors?
```bash
# Fix staging permissions (if needed)
sudo chown -R $USER:$USER /var/www/rupiyame-staging
chmod -R 755 /var/www/rupiyame-staging

# Production permissions should remain root:root
# DO NOT change production permissions
```

## 📋 Before Production Deployment Checklist

- [ ] Test all changes in staging
- [ ] Verify no errors in staging logs
- [ ] Ensure git status is clean
- [ ] Check staging services running
- [ ] Plan deployment time
- [ ] Have rollback plan ready

## ✅ After Production Deployment Checklist

- [ ] Verify services running
- [ ] Check production logs
- [ ] Test critical user workflows
- [ ] Monitor for 10-15 minutes
- [ ] Document any issues

## 🎉 Summary

This production-safe workflow provides:

✅ **Complete separation** of production and staging
✅ **Read-only production** prevents accidental edits
✅ **Safe development** environment
✅ **Controlled deployment** with multiple safety checks
✅ **Automatic backups** before deployment
✅ **Easy rollback** if issues occur
✅ **Professional workflow** following industry standards
✅ **Comprehensive documentation** for all scenarios

**Live users are protected. Development is safe. Deployment is controlled.**

---

## 📖 Getting Started

1. Read **QUICK_REFERENCE.md** for immediate help
2. Follow **IMPLEMENTATION_GUIDE.md** for detailed setup
3. Refer to **PRODUCTION_SAFE_WORKFLOW.md** for workflow details

**Remember: This workflow protects your live users. Follow it strictly.**