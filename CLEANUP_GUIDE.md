# 🧹 RupiyaMe Code Cleanup और Server Optimization Guide

## 📊 Current Status Analysis

### स्पेस का इस्तेमाल:
- **Backend**: 4.4GB (जिसमें 1.6GB user media files हैं)
- **Frontend**: 2.0GB (node_modules)
- **Logs**: 317MB (बहुत बड़ा! ⚠️)
- **Total Project**: ~7GB

### समस्याएं जो मिलीं:
1. ✅ **62 unused Python scripts** (test_*, debug_*, fix_*, check_*)
2. ✅ **10 unused JavaScript scripts** (test*.js, debug*.js, permission*.js)
3. ⚠️ **बड़ी log files**:
   - rupiyame-backend-0.log: 118MB
   - rupiyame-backend-out-0.log: 71MB
   - rupiyame-backend-error-0.log: 47MB
   - rupiyame-frontend-2.log: 34MB
4. ⚠️ **Double processes running**: Development AND Production दोनों चल रहे हैं
   - rupiyame-backend (173MB)
   - rupiyame-backend-dev (250MB)
   - rupiyame-frontend (67MB)
   - rupiyame-frontend-dev (60MB)

## 🚀 Cleanup Process (Step by Step)

### Step 1: पहले Performance Check करें

```bash
cd /www/wwwroot/RupiyaMe
./optimize_server_performance.sh
```

यह script:
- ✅ PM2 processes को analyze करेगी
- ✅ Log rotation setup करेगी (automatic)
- ✅ Memory usage दिखाएगी
- ✅ Optimization suggestions देगी

### Step 2: Code Cleanup करें

```bash
./cleanup_codebase.sh
```

यह script **safely** करेगी:
- ✅ सभी unused test/debug/fix scripts को `OLD_UNUSED_FILES_[timestamp]` folder में move करेगी
- ✅ बड़ी log files को rotate करेगी (last 1000 lines रखेगी)
- ✅ Old documentation files को archive करेगी
- ✅ Backup configs को organize करेगी
- ✅ Complete summary report generate करेगी

**Important**: Files delete नहीं होंगी, सिर्फ archive folder में move होंगी!

### Step 3: Verify करें

```bash
# Check कि सब ठीक है
pm2 list
pm2 logs --lines 50

# अपनी website test करें
# Backend: http://localhost:8050
# Frontend: http://localhost:4521
```

### Step 4: अगर सब ठीक है, तो Archive Delete करें

```bash
# Archive folder का नाम देखें
ls -d OLD_UNUSED_FILES_*

# Delete करें (optional - बाद में भी कर सकते हैं)
rm -rf OLD_UNUSED_FILES_20260217_*
```

## ⚡ Server Performance Optimization

### 1. Stop Development Processes (अगर Production में हैं)

```bash
# Development processes को बंद करें
pm2 stop rupiyame-backend-dev rupiyame-frontend-dev

# Save PM2 configuration
pm2 save

# Memory savings: ~310MB
```

### 2. Frontend को Production Mode में Build करें

```bash
cd /www/wwwroot/RupiyaMe/rupiyamaker-UI/crm

# Production build बनाएं
npm run build

# Build folder serve करें (nginx/apache से)
# या PM2 config update करें static serving के लिए
```

### 3. PM2 Log Rotation Enable करें (Already done by script)

```bash
# Check log rotation settings
pm2 conf pm2-logrotate
```

### 4. Periodic Cleanup Cron Job Setup करें

```bash
# Crontab edit करें
crontab -e

# Add this line (हर रविवार 2 AM को logs clean करेगा):
0 2 * * 0 /www/wwwroot/RupiyaMe/optimize_server_performance.sh >> /www/wwwroot/RupiyaMe/logs/cleanup-cron.log 2>&1
```

## 📈 Expected Benefits

### System-wide improvements:
- ✅ **~200-300MB logs reduce** होंगी
- ✅ **Cleaner project structure** (62+ unwanted files archive में)
- ✅ **310MB memory save** (if stop dev processes)
- ✅ **Better code navigation** (कम confusion)
- ✅ **Automatic log rotation** (future में logs बड़ी नहीं होंगी)

### Performance improvements:
- 🚀 **Faster git operations** (कम files)
- 🚀 **Faster VS Code** (कम files to index)
- 🚀 **Better server performance** (single environment)
- 🚀 **Easier backup** (कम unnecessary files)

## 🔍 Monitoring

### Regular checks करते रहें:

```bash
# PM2 processes
pm2 monit

# Disk usage
du -sh /www/wwwroot/RupiyaMe/{backend,rupiyamaker-UI,logs}

# Database size
# MongoDB में connect करके
db.stats()

# Memory usage
free -h
```

## ⚠️ Important Notes

1. **Media files (1.6GB)** में हाथ नहीं लगाया - ये production data हैं
2. **node_modules** और **venv** normal size में हैं - कोई issue नहीं
3. **Backup files automatically archived** हैं - restore हो सकती हैं
4. **Git repository (.git)** optimize नहीं किया - normal size है (24MB)

## 🆘 Rollback (अगर कुछ गलत हो)

अगर cleanup के बाद कोई file चाहिए:

```bash
# Archive देखें
ls -R OLD_UNUSED_FILES_20260217_*/

# File restore करें
cp OLD_UNUSED_FILES_20260217_*/[category]/[filename] /www/wwwroot/RupiyaMe/

# Example:
cp OLD_UNUSED_FILES_20260217_*/test_scripts/test_login_api.py /www/wwwroot/RupiyaMe/
```

## 📋 Cleanup Checklist

- [ ] `optimize_server_performance.sh` run करें
- [ ] Output review करें
- [ ] `cleanup_codebase.sh` run करें
- [ ] Website test करें
- [ ] PM2 processes check करें
- [ ] Development processes stop करें (if needed)
- [ ] Archive folder verify करें
- [ ] 1-2 दिन बाद archive delete करें (optional)
- [ ] Cron job setup करें (optional)
- [ ] Git commit करें (optional)

## 🎯 Final Command Sequence

```bash
cd /www/wwwroot/RupiyaMe

# Step 1: Performance check
./optimize_server_performance.sh

# Step 2: Cleanup
./cleanup_codebase.sh

# Step 3: Stop dev processes (if you want)
pm2 stop rupiyame-backend-dev rupiyame-frontend-dev
pm2 save

# Step 4: Verify
pm2 list
pm2 logs --lines 20

# Step 5: Test website
# আপনার website खोलें और test करें

# Step 6: Future cleanup (after 1-2 days)
rm -rf OLD_UNUSED_FILES_*
```

---

## 💡 Pro Tips

1. **Regular cleanup**: महीने में एक बार logs check करें
2. **Monitor memory**: `pm2 monit` से regularly check करें
3. **Database backup**: महत्वपूर्ण data का regular backup लें
4. **Git cleanup**: बड़ी files git में commit न करें
5. **Media optimization**: पुरानी unused media files periodically archive करें

---

**Created**: February 17, 2026  
**Last Updated**: February 17, 2026  
**Status**: Ready to Execute ✅
