# 🔴 CRITICAL: You Entered the Wrong Token!

## ❌ The Problem

You entered: **"authenticated"**

This is **NOT** a valid JWT token!

---

## ✅ What a Valid JWT Token Looks Like

A real JWT token is a **very long string** (200-500+ characters) that looks like this:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDY4MjU2OTYsInVzZXJfaWQiOiI2NTZmMzVmNzJlYzAwZTBhM2RkNzJkOWEiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIn0.7yZk8KxQJhXvL5Y2mP5qH7nR8sT1vW9Y0cX3dF7gB4
```

**Key features:**
- ✅ Starts with `eyJhbGci`
- ✅ Very long (200-500+ characters)
- ✅ Has 3 parts separated by dots
- ✅ Contains random-looking characters
- ❌ **NOT** just the word "authenticated"

---

## 🎯 How to Get Your REAL Token

### Method 1: Use the get_token.html Tool (EASIEST!)

1. **Open your CRM system** in a browser tab and **log in**
2. **Open file:** `get_token.html` (double-click it)
3. Click the green button: **"🔄 Get My Token"**
4. Copy the **long string** that appears (starts with `eyJ...`)

### Method 2: Browser Console (QUICK!)

1. **Open your CRM** and log in
2. Press **F12** to open Developer Tools
3. Click **Console** tab
4. Type this and press Enter:
   ```javascript
   localStorage.getItem('token')
   ```
5. Copy the **long string** that appears (starts with `eyJ...`)

### Method 3: Browser Application Tab

1. **Open your CRM** and log in
2. Press **F12** to open Developer Tools
3. Click **Application** tab
4. Look at **Local Storage** → Click your website URL
5. Find key named **`token`**
6. Copy the **Value** (long string starting with `eyJ...`)

---

## 🔍 Check If Your Token Is Valid

**Valid token example:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDY4MjU2OTYsInVzZXJfaWQiOiI2NTZmMzVmNzJlYzAwZTBhM2RkNzJkOWEiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIn0.7yZk8KxQJhXvL5Y2mP5qH7nR8sT1vW9Y0cX3dF7gB4
```

**Invalid token examples:**
```
❌ "authenticated"
❌ "mytoken"
❌ "123456"
❌ "admin"
```

---

## 📋 Complete Steps to Download Excel

### Step 1: Get Your Token
- Open `get_token.html` in browser (while logged into CRM)
- Click "Get My Token"
- Copy the long string (starts with `eyJ...`)

### Step 2: Run Download Script
```bash
python3 download_leads_excel.py
```

### Step 3: Paste the Token
- Paste the **long JWT string** (NOT "authenticated")
- Press Enter

### Step 4: Wait
- Wait for the download to complete
- Your Excel file will be saved as `leads_export_YYYYMMDD_HHMMSS.xlsx`

---

## 💡 Quick Test

Before running the download script, test your token:

**Good token** (starts with `eyJ` and is very long):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDY4MjU2OTY...
```

**Bad token** (short or simple words):
```
authenticated
mytoken
admin
123456
```

---

## ❓ Still Confused?

**The simplest way:**

1. Open your CRM website and log in
2. Open `get_token.html` in the SAME browser
3. Click "Get My Token" button
4. Copy the long string shown
5. Run `python3 download_leads_excel.py`
6. Paste that long string when asked

**That long string IS your token!** 🎉

---

## 🔐 Remember

- ❌ **DON'T** type "authenticated" 
- ❌ **DON'T** type any simple words
- ✅ **DO** copy the long JWT string from your browser
- ✅ **DO** make sure it starts with `eyJ...`

**The token is like a password - it must be the exact long string, not just any word!**