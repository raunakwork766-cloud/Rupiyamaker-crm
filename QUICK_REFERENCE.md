# Production-Safe Workflow - Quick Reference

## 🚀 Quick Start

```bash
# 1. Setup (one-time)
cd /www/wwwroot/RupiyaMe
sudo ./setup-production-safe-workflow.sh

# 2. Start staging
cd /var/www/rupiyame-staging
pm2 start ecosystem.config.js

# 3. Start production
cd /var/www/rupiyame-production
pm2 start ecosystem.config.js

# 4. Open VS Code for development
code /var/www/rupiyame-staging
```

## 📝 Daily Development

```bash
# Make changes in staging (via VS Code)

# Test changes
# http://crm.rupiyamakercrm.online:5904

# Commit changes
git add .
git commit -m "Your message"
git push origin staging
```

## 🚢 Deploy to Production

```bash
cd /var/www/rupiyame-staging
sudo ./deploy-to-production.sh
```

**⚠️ Requires explicit confirmation - type 'yes' to proceed**

## 🔄 Rollback

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

# Create production backup
sudo ./manage-backups.sh create-production

# Create staging backup
sudo ./manage-backups.sh create-staging

# Clean old backups (keep last 5)
sudo ./manage-backups.sh clean-all 5
```

## 📊 Service Management

```bash
# Check all services
pm2 status

# View logs
pm2 logs production
pm2 logs staging

# Restart services
pm2 restart all
```

## 🌐 URLs

### Production (Live)
- Frontend: https://crm.rupiyamakercrm.online
- Backend: https://crm.rupiyamakercrm.online:8049

### Staging (Development)
- Frontend: http://crm.rupiyamakercrm.online:5904
- Backend: http://crm.rupiyamakercrm.online:8050

## 🔒 Permissions

### Production (Read-Only)
- Location: `/var/www/rupiyame-production`
- Owner: `root:root`
- Files: `644` (read-only)
- **Cannot edit directly**

### Staging (Writable)
- Location: `/var/www/rupiyame-staging`
- Owner: `your-user:your-user`
- Files: `755` (writable)
- **Edit freely**

## 🌿 Git Branches

```bash
# Switch to staging (do once)
git checkout staging

# All development happens in staging branch
# NEVER commit directly to main

# Deploy to production after testing
sudo ./deploy-to-production.sh
```

## ⚠️ CRITICAL RULES

1. **NEVER** edit production files directly
2. **NEVER** commit directly to main branch
3. **ALWAYS** test in staging first
4. **ALWAYS** deploy with `deploy-to-production.sh`
5. **ALWAYS** create backups (automatic with deploy)

## 🚨 Emergency Commands

```bash
# Production down
pm2 restart production
pm2 logs production --lines 100

# Deployment failed
sudo ./rollback.sh <backup_name>

# Check errors
tail -f /var/www/rupiyame-production/backend/logs/backend-error.log
```

## 📋 Before Production Deployment

- [ ] Test all changes in staging
- [ ] Verify no errors in staging logs
- [ ] Ensure git status is clean
- [ ] Check staging services running
- [ ] Plan deployment time

## ✅ After Production Deployment

- [ ] Verify services running
- [ ] Check production logs
- [ ] Test critical workflows
- [ ] Monitor for 10-15 minutes

## 🔍 Troubleshooting

### Can't edit production files?
**Expected!** Edit in staging, then deploy.

### Staging services won't start?
```bash
pm2 logs staging --lines 100
pm2 restart ecosystem.config.js
```

### Deployment failed?
```bash
sudo ./rollback.sh <backup_name>
```

## 📚 Documentation

- **Full Guide**: `IMPLEMENTATION_GUIDE.md`
- **Workflow Details**: `PRODUCTION_SAFE_WORKFLOW.md`
- **Quick Reference**: `QUICK_REFERENCE.md` (this file)

## 🎯 Key Concepts

| Concept | Description |
|---------|-------------|
| **Production** | Live environment for real users (read-only) |
| **Staging** | Development environment (writable) |
| **Deploy** | Move changes from staging to production |
| **Rollback** | Restore production to previous backup |
| **Backup** | Snapshot of production before deployment |

## 💡 Pro Tips

1. **Save often** in staging - no impact on production
2. **Test thoroughly** before deployment
3. **Deploy during low-traffic** hours when possible
4. **Keep multiple backups** (at least 5)
5. **Monitor logs** after deployment
6. **Document manual steps** needed for deployment

## 📞 When to Contact Team

- Production down and can't restart
- Rollback fails
- Multiple deployment attempts fail
- Data integrity issues
- Security concerns

---

**Remember: This workflow protects your live users. Follow it strictly.**