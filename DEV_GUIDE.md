# Development & Production Environment Guide

## 🎯 Setup Complete!

Aapke paas ab **2 separate environments** hain:

---

## 📦 1. PRODUCTION (Main Branch)

**Status:** ✅ Running
**Branch:** `main`
**Access:** https://rupiyamaker.com

**Ports:**
- Backend: 8049
- Frontend: 4521

**Services:**
- `rupiyame-backend` (PM2 ID: 10)
- `rupiyame-frontend` (PM2 ID: 12)

**Commands:**
```bash
# Production ko main branch par switch karo
./switch-production.sh

# Production restart karo
pm2 restart rupiyame-backend rupiyame-frontend

# Production logs dekho
pm2 logs rupiyame-backend rupiyame-frontend
```

---

## 🔧 2. DEVELOPMENT (Dev Branch)

**Status:** ✅ Running & Fully Isolated
**Branch:** `dev`
**Access:** http://156.67.111.95:4522

**Ports:**
- Backend: 8051 (HTTPS)
- Frontend: 4522

**Database:** crm_database_dev (separate from production)

**Services:**
- `rupiyame-backend-dev` (PM2 ID: 2)
- `rupiyame-frontend-dev` (PM2 ID: 3)

**Commands:**
```bash
# Dev environment start karo (dev branch par automatically switch hoga)
./start-dev.sh

# Dev environment stop karo
./stop-dev.sh

# Dev logs dekho
pm2 logs rupiyame-backend-dev rupiyame-frontend-dev
```

---

## 🚀 Usage Workflow

### Development Mein Kaam Karna:

1. **Dev Environment Start Karo:**
   ```bash
   cd /www/wwwroot/RupiyaMe
   ./start-dev.sh
   ```

2. **Dev Branch Par Changes Karo:**
   ```bash
   # Files edit karo
   # Changes test karo: http://SERVER_IP:4522
   ```

3. **Changes Commit Karo:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push raunak dev
   ```

4. **Production Mein Deploy Karne Ke Liye:**
   ```bash
   # Dev se main merge karo
   git checkout main
   git merge dev
   git push raunak main
   
   # Production restart karo
   pm2 restart rupiyame-backend rupiyame-frontend
   ```

5. **Dev Environment Cleanup:**
   ```bash
   ./stop-dev.sh
   ```

---

## 📊 Check Status

```bash
# Sab services dekho
pm2 status

# Production services (main branch)
pm2 list | grep -v dev

# Dev services (dev branch)
pm2 list | grep dev
```

---

## ⚠️ Important Notes

1. **Production** hamesha `main` branch par chalega (https://rupiyamaker.com)
2. **Development** hamesha `dev` branch par chalega (http://IP:4522)
3. Dono **completely separate** hain - ek dusre ko affect nahi karenge
4. Production par directly changes **KABHI MAT KARO** - hamesha dev se test karke merge karo

### 🗄️ Database Configuration

**✅ FULLY ISOLATED:** Dev environment uses **separate backend** and **separate database**.

**Configuration:**
- Production Backend: Port 8049 (HTTPS) → crm_database
- Dev Backend: Port 8051 (HTTPS) → crm_database_dev
- Dev Frontend: Port 4522 → Points to Dev Backend (8051)

**What this means:**
- ✅ All frontend changes are completely safe
- ✅ All backend changes only affect dev database
- ✅ All database operations isolated to crm_database_dev
- ✅ Production is completely untouched by dev testing

**Database Management:**
```bash
# Copy production data to dev database
./copy_db_to_dev.sh

# Or use mongodump/mongorestore for full copy:
mongodump --host=156.67.111.95 --port=27017 --username=raunak --password='Raunak@123' --authenticationDatabase=admin --db=crm_database --out=/tmp/mongo_backup
mongorestore --host=156.67.111.95 --port=27017 --username=raunak --password='Raunak@123' --authenticationDatabase=admin --db=crm_database_dev --drop /tmp/mongo_backup/crm_database/
rm -rf /tmp/mongo_backup
```

**Note:** Dev backend uses HTTPS with self-signed certificate. Frontend proxy has `secure: false` to accept it.
2. Fix dev backend startup issues
3. Point vite.config.js to use localhost:8051

---

## 🔥 Quick Commands

```bash
# Production ko main par lock karo
./switch-production.sh

# Dev environment start karo
./start-dev.sh

# Dev environment stop karo
./stop-dev.sh

# Sab services status
pm2 status

# Logs dekho
pm2 logs
```

---

## 💡 Example Workflow

```bash
# Step 1: Dev start karo
./start-dev.sh

# Step 2: Browser mein test karo
# http://YOUR_SERVER_IP:4522

# Step 3: Changes commit karo
git add .
git commit -m "Added new feature"
git push raunak dev

# Step 4: Production mein deploy karo (after testing)
git checkout main
git merge dev
git push raunak main
pm2 restart rupiyame-backend rupiyame-frontend

# Step 5: Dev stop karo (optional)
./stop-dev.sh
```

---

## 🛡️ Safety

✅ Production `main` branch par locked hai
✅ Dev changes production ko affect nahi karenge
✅ Test karne ke baad hi production mein deploy hoga
✅ Rollback possible hai (git revert)

---

**Happy Coding! 🚀**
