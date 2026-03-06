# 🚀 Development Workflow Guide - RupiyaMe

## ✅ Setup Complete - Ab Aap Dev Branch Par Ho!

**Current Branch:** `dev` (Development)  
**Production Branch:** `main`

---

## 📋 Branch Structure

```
main (Production) ← Yaha kabhi direct kaam mat karna
  └── dev (Development) ← Yaha aap safely kaam kar sakte ho
```

---

## 🔧 Daily Development Workflow

### 1️⃣ **Kaam Shuru Karne Se Pehle** (Hamesha Dev Branch Check Karo)

```bash
cd /www/wwwroot/RupiyaMe
git branch    # Current branch check karne ke liye (* dev hona chahiye)
```

Agar `main` branch par ho to:
```bash
git checkout dev    # Dev branch par aa jao
```

### 2️⃣ **Code Changes Karo**

- Apni files edit karo
- Features add karo
- Bugs fix karo
- **Production (main) affected nahi hoga!** ✅

### 3️⃣ **Changes Save Karo** (Commit)

```bash
# 1. Changes dekho
git status

# 2. Files add karo
git add .    # Sab files add karne ke liye
# ya
git add backend/app/routes/users.py    # Specific file add karne ke liye

# 3. Commit karo with message
git commit -m "Feature added: user authentication"
```

### 4️⃣ **Code Test Karo** 

Dev branch par apna code test karo:
```bash
# Server restart karo
pm2 restart all

# Ya specific service
pm2 restart rupiyame-backend
```

---

## 🔀 Production Mein Code Merge Karna (Jab Testing Complete Ho)

### Step 1: Pura Code Check Kar Lo
```bash
# Dev branch par ho, sab test kar lo
git status    # Ensure all changes are committed
```

### Step 2: Main Branch Par Jao
```bash
git checkout main
```

### Step 3: Dev Branch Ko Main Mein Merge Karo
```bash
git merge dev
```

### Step 4: Production Deploy Karo
```bash
# Agar service restart karni hai
pm2 restart all

# Ya deployment script chalao
./deploy.sh
```

---

## 📍 Current Branch Check Karna

```bash
git branch    # * wali branch current hai
```

**Output:**
```
* dev         ← Yaha * hai matlab aap is branch par ho
  main
```

---

## 🔄 Branches Switch Karna

```bash
# Dev branch par jana
git checkout dev

# Main (production) branch par jana (sirf dekhne ke liye)
git checkout main

# Wapas dev par aa jana
git checkout dev
```

---

## ⚠️ Important Rules

1. ✅ **Hamesha `dev` branch par kaam karo**
2. ❌ **Kabhi `main` branch par directly changes mat karo**
3. ✅ **Sare changes pehle `dev` par test karo**
4. ✅ **Testing complete hone ke baad hi `main` mein merge karo**
5. ✅ **Regular commits karo taaki changes track ho**

---

## 🛠️ Quick Commands Reference

| Action | Command |
|--------|---------|
| Current branch check | `git branch` |
| Dev branch par jana | `git checkout dev` |
| Changes dekho | `git status` |
| Files add karo | `git add .` |
| Commit karo | `git commit -m "message"` |
| Main par merge | `git checkout main && git merge dev` |

---

## 🆘 Common Issues

### ❓ "Main kaunse branch par hu?"
```bash
git branch
# * wali branch current hai
```

### ❓ "Galti se main par aa gaya?"
```bash
git checkout dev    # Wapas dev par aa jao
```

### ❓ "Changes commit nahi ho rahe?"
```bash
git add .
git commit -m "Changes saved"
```

---

## ✅ Current Status

**Aap Ab Safe Development Environment Mein Ho!**

- ✅ Dev branch created and active
- ✅ Production (main) safe hai
- ✅ Aap freely dev branch par kaam kar sakte ho
- ✅ Testing ke baad hi production update hoga

---

**Happy Coding! 🚀**

*Koi doubt ho to ye file reference kar lena!*
