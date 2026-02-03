# Production-Safe Workflow Setup Checklist

## ✅ Checklist Overview

Use this checklist to verify that the production-safe workflow has been fully implemented and configured correctly.

## 📁 Files Created

### Documentation
- [ ] `PRODUCTION_SAFE_WORKFLOW.md` - Complete workflow documentation
- [ ] `IMPLEMENTATION_GUIDE.md` - Step-by-step implementation guide
- [ ] `QUICK_REFERENCE.md` - Quick reference card
- [ ] `README_PRODUCTION_SAFE_WORKFLOW.md` - Main README
- [ ] `WORKFLOW_SETUP_CHECKLIST.md` - This checklist

### Scripts (All Executable)
- [ ] `setup-production-safe-workflow.sh` - Setup script
- [ ] `deploy-to-production.sh` - Production deployment script
- [ ] `deploy-staging.sh` - Staging deployment script
- [ ] `rollback.sh` - Rollback script
- [ ] `manage-backups.sh` - Backup management script

## 🔧 Pre-Setup Checks

- [ ] Have root or sudo access to server
- [ ] PM2 is installed and configured
- [ ] Git repository is set up
- [ ] Current production is running in `/www/wwwroot/RupiyaMe`
- [ ] Have read all documentation files
- [ ] Understand the workflow rules
- [ ] Have backup plan ready

## 🚀 Setup Steps

### Step 1: Make Scripts Executable
```bash
cd /www/wwwroot/RupiyaMe
chmod +x *.sh
```
- [ ] Scripts are now executable
- [ ] Verified with `ls -la *.sh`

### Step 2: Run Setup Script
```bash
sudo ./setup-production-safe-workflow.sh
```
- [ ] Setup script ran successfully
- [ ] Backup of current production created
- [ ] Production directory created: `/var/www/rupiyame-production`
- [ ] Staging directory created: `/var/www/rupiyame-staging`
- [ ] Backup directory created: `/var/www/rupiyame-backups`
- [ ] Permissions set correctly
- [ ] Git branches configured
- [ ] VS Code settings created

### Step 3: Verify Directory Structure
```bash
ls -la /var/www/
```
- [ ] `rupiyame-production` directory exists
- [ ] `rupiyame-staging` directory exists
- [ ] `rupiyame-backups` directory exists

### Step 4: Verify Permissions
```bash
ls -la /var/www/rupiyame-production
ls -la /var/www/rupiyame-staging
```
- [ ] Production is owned by `root:root`
- [ ] Production files are `644` (read-only)
- [ ] Staging is owned by your user
- [ ] Staging files are `755` (writable)

### Step 5: Start Staging Services
```bash
cd /var/www/rupiyame-staging
pm2 start ecosystem.config.js
pm2 status
```
- [ ] `rupiyame-backend-staging` is running
- [ ] `rupiyame-frontend-staging` is running
- [ ] Services show "online" status

### Step 6: Start Production Services
```bash
cd /var/www/rupiyame-production
pm2 start ecosystem.config.js
pm2 status
```
- [ ] `rupiyame-backend` is running
- [ ] `rupiyame-frontend` is running
- [ ] Services show "online" status

### Step 7: Configure VS Code
- [ ] VS Code Remote SSH extension installed
- [ ] SSH connection configured
- [ ] Open ONLY staging directory: `code /var/www/rupiyame-staging`
- [ ] `.vscode/settings.json` exists in staging
- [ ] VS Code opens staging directory correctly

### Step 8: Verify All Services
```bash
pm2 status
```
- [ ] All 4 services are running:
  - [ ] `rupiyame-backend` (production)
  - [ ] `rupiyame-frontend` (production)
  - [ ] `rupiyame-backend-staging` (staging)
  - [ ] `rupiyame-frontend-staging` (staging)

### Step 9: Test URLs
#### Production
- [ ] Production frontend loads: https://crm.rupiyamakercrm.online
- [ ] Production backend responds: https://crm.rupiyamakercrm.online:8049

#### Staging
- [ ] Staging frontend loads: http://crm.rupiyamakercrm.online:5904
- [ ] Staging backend responds: http://crm.rupiyamakercrm.online:8050

### Step 10: Test Git Workflow
```bash
cd /var/www/rupiyame-staging
git branch
```
- [ ] Currently on `staging` branch
- [ ] Can switch to staging branch
- [ ] Can commit changes to staging
- [ ] Can push to origin/staging

### Step 11: Test Backup System
```bash
sudo ./manage-backups.sh list
```
- [ ] Backup directory exists
- [ ] At least one backup exists
- [ ] Can list backups
- [ ] Can create new backup: `sudo ./manage-backups.sh create-production`

### Step 12: Verify Safety Mechanisms
#### Production Protection
- [ ] Cannot edit production files directly (permission denied)
- [ ] Production directory is read-only
- [ ] Deployment requires sudo access
- [ ] Cannot write to production directory

#### Deployment Safety
- [ ] `deploy-to-production.sh` requires sudo
- [ ] Script checks git status before deployment
- [ ] Script requires explicit confirmation
- [ ] Script creates backup automatically

## 📋 Post-Setup Verification

### Daily Workflow Test
- [ ] Can edit files in staging
- [ ] Changes reflect in staging URL (port 5904)
- [ ] Changes DO NOT reflect in production URL
- [ ] Can commit changes to staging branch
- [ ] Can push to origin/staging

### Deployment Test
```bash
cd /var/www/rupiyame-staging
sudo ./deploy-to-production.sh
```
- [ ] Script asks for confirmation
- [ ] Creates backup before deployment
- [ ] Deploys changes to production
- [ ] Production updates successfully
- [ ] Services restart correctly

### Rollback Test
```bash
sudo ./rollback.sh
```
- [ ] Lists available backups
- [ ] Requires confirmation
- [ ] Successfully rolls back to backup
- [ ] Services restart correctly

## 🎯 Final Verification

### Documentation
- [ ] All documentation files are readable
- [ ] Team has read the documentation
- [ ] Team understands the workflow
- [ ] Team knows emergency procedures

### Scripts
- [ ] All scripts are executable
- [ ] All scripts run without errors
- [ ] Help messages display correctly
- [ ] Scripts have proper error handling

### Permissions
- [ ] Production is read-only for developers
- [ ] Staging is writable for developers
- [ ] Backup directory is accessible
- [ ] Log directories are writable

### Monitoring
- [ ] Can view PM2 status
- [ ] Can view production logs
- [ ] Can view staging logs
- [ ] Can check service health

## 🚨 Emergency Preparedness

### Rollback Procedure
- [ ] Team knows how to rollback
- [ ] Team knows which backup to use
- [ ] Team understands rollback risks
- [ ] Rollback has been tested

### Contact Information
- [ ] Emergency contacts documented
- [ ] Team knows when to escalate
- [ ] Team has escalation procedures

### Backup Strategy
- [ ] Regular backup schedule planned
- [ ] Backup retention policy set
- [ ] Offsite backup consideration
- [ ] Backup restoration tested

## ✅ Sign-Off

### Setup Completed By
- [ ] Date: ___________
- [ ] Name: ___________
- [ ] Role: ___________

### Verified By
- [ ] Date: ___________
- [ ] Name: ___________
- [ ] Role: ___________

### Team Training Completed
- [ ] Date: ___________
- [ ] Team members trained: ___________
- [ ] Questions resolved: ___________

## 📝 Notes

```
Add any notes, issues encountered, or special considerations here:
```

## 🎉 Setup Complete!

If all items are checked, your production-safe workflow is fully implemented and ready to use.

### Next Steps

1. **Read Documentation**
   - Start with `QUICK_REFERENCE.md`
   - Review `IMPLEMENTATION_GUIDE.md`
   - Keep `PRODUCTION_SAFE_WORKFLOW.md` handy

2. **Train Your Team**
   - Ensure everyone understands the workflow
   - Practice the deployment process
   - Review emergency procedures

3. **Begin Development**
   - Open VS Code to staging directory
   - Make changes freely
   - Test in staging
   - Deploy to production when ready

4. **Monitor and Improve**
   - Monitor logs regularly
   - Review deployment process
   - Update documentation as needed
   - Continuously improve workflow

---

**Remember: This workflow protects your live users. Follow it strictly.**