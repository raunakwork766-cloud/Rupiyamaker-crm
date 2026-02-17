# 🎯 Development & Production - Side by Side Setup

## ✅ Setup Complete!

Aapke paas ab **2 alag environments** hain:

### 🟢 **Production Environment** (Always Safe!)
- **Branch:** `main`
- **Ports:** 
  - Backend: `8049`
  - Frontend: `4521`
- **Status:** Currently Running ✅
- **URL:** `http://your-ip:4521`

### 🟡 **Development Environment** (Testing/New Features)
- **Branch:** `dev`  
- **Ports:**
  - Backend: `8050`
  - Frontend: `4522`
- **URL:** `http://your-ip:4522`

---

## 🚀 Quick Start Commands

### Step 1: Make Script Executable (One Time)
```bash
cd /www/wwwroot/RupiyaMe
chmod +x dev-manager.sh
```

### Step 2: Use Simple Commands

#### ✅ Check Status
```bash
./dev-manager.sh status
```
**Shows:** Current branch, running services, URLs

#### 🟡 Start Development Environment
```bash
./dev-manager.sh dev
```
**This will:**
- Switch to `dev` branch
- Start dev backend on port `8050`
- Start dev frontend on port `4522`
- Production keeps running on `8049/4521` ✅

#### 🟢 Restart Production
```bash
./dev-manager.sh prod
```

#### 📜 View Logs
```bash
# Development logs
./dev-manager.sh logs dev

# Production logs
./dev-manager.sh logs prod

# All logs
./dev-manager.sh logs
```

#### 🛑 Stop Development (Keep Production Running)
```bash
./dev-manager.sh stop-dev
```

#### 🚀 Deploy Dev to Production
```bash
./dev-manager.sh deploy
```
**This will:**
- Show you what changes will be deployed
- Ask for confirmation
- Merge `dev` into `main`
- Restart production with new code

---

## 🔧 Manual Commands (If Needed)

### Start Dev Environment Manually:
```bash
# 1. Switch to dev branch
git checkout dev

# 2. Start dev services
pm2 start ecosystem.dev.config.js

# 3. Check status
pm2 status
```

### Stop Dev Environment:
```bash
pm2 delete rupiyame-backend-dev rupiyame-frontend-dev
```

### Check Which Branch You're On:
```bash
git branch
# * means current branch
```

---

## 📍 Current Setup

| Environment | Branch | Backend Port | Frontend Port | Status |
|-------------|--------|--------------|---------------|--------|
| **Production** | `main` | 8049 | 4521 | ✅ Running |
| **Development** | `dev` | 8050 | 4522 | ⏸️ Ready to start |

---

## 🎯 Typical Workflow

```bash
# 1️⃣ Start development environment
./dev-manager.sh dev

# 2️⃣ Make code changes in VS Code (you'll be on dev branch)
# Edit files, test features...

# 3️⃣ Commit your changes
git add .
git commit -m "Added new feature"

# 4️⃣ Test on dev URL
# Open: http://your-ip:4522

# 5️⃣ If everything works, deploy to production
./dev-manager.sh deploy

# 6️⃣ Stop dev environment (optional)
./dev-manager.sh stop-dev
```

---

## 🆘 Troubleshooting

### Problem: "Port already in use"
```bash
# Check what's running
pm2 status

# Stop specific service
pm2 stop rupiyame-backend-dev
```

### Problem: "Which environment am I on?"
```bash
./dev-manager.sh status
```

### Problem: "Dev not starting"
```bash
# Check logs
pm2 logs rupiyame-backend-dev

# Or use script
./dev-manager.sh logs dev
```

### Problem: "Want to switch to production code"
```bash
git checkout main
```

### Problem: "Want to go back to dev"
```bash
git checkout dev
```

---

## 🎨 Access Your Environments

### 🟢 Production (Live/Stable)
```
http://your-server-ip:4521
```

### 🟡 Development (Testing)
```
http://your-server-ip:4522
```

**Dono ek saath chal sakte hain! No conflict!** ✅

---

## ✅ Benefits of This Setup

1. ✅ **Production safe rahega** - Dev branch par kuch bhi karo, production affected nahi hoga
2. ✅ **Side-by-side testing** - Dono environments ko compare kar sakte ho
3. ✅ **Easy deployment** - Ek command se dev to prod deploy
4. ✅ **Separate logs** - Dev aur prod ki logs alag
5. ✅ **No downtime** - Production running rehta hai jab aap dev test kar rahe ho

---

**Koi doubt? Use `./dev-manager.sh help` command!** 🚀
