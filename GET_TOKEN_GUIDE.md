# 🔑 How to Get Your Authentication Token

Here are 3 easy methods to get your authentication token for downloading the Excel file.

---

## Method 1: Using Browser Developer Tools (EASIEST)

### Step-by-Step Instructions:

#### 1. Open Your CRM System
- Go to your CRM website (e.g., `https://yourdomain.com` or `localhost:5173`)
- **Make sure you are logged in**

#### 2. Open Developer Tools
- **Windows/Linux:** Press `F12` or `Ctrl + Shift + I`
- **Mac:** Press `Cmd + Option + I`
- Or right-click anywhere on the page and select **"Inspect"** or **"Inspect Element"**

#### 3. Go to Application Tab
- In the Developer Tools panel, click on the **"Application"** tab (or "Storage" in some browsers)
- It's usually the last tab on the top menu

#### 4. Find Local Storage
- In the left sidebar, look for **"Local Storage"**
- Click the arrow to expand it
- Click on your website URL (e.g., `http://localhost:5173` or `https://yourdomain.com`)

#### 5. Find the Token
You'll see a list of keys. Look for any of these:

**Option A: Direct "token" key**
- Look for a key named exactly: `token`
- Click on it
- Copy the **Value** (it's a long string starting with `eyJ...`)

**Option B: Inside "userData"**
- Look for a key named: `userData`
- Click on it
- The value will show JSON data like: `{"token":"eyJ...","user_id":...}`
- Copy the entire value
- Or just copy the `token` field value from inside the JSON

#### 6. Copy the Token
- Select the entire token string
- It usually looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDY4...` (very long)
- **Copy the entire string** (Ctrl+C or Cmd+C)

**That's your token!** 🎉

---

## Method 2: Using Browser Console (QUICK)

### Step-by-Step Instructions:

#### 1. Open Your CRM System
- Go to your CRM website and **log in**

#### 2. Open Developer Tools
- Press `F12` to open Developer Tools

#### 3. Go to Console Tab
- Click on the **"Console"** tab at the top of Developer Tools

#### 4. Run This Command
Copy and paste this command into the console and press Enter:

```javascript
localStorage.getItem('token')
```

#### 5. If That Doesn't Work
Try this command instead:

```javascript
JSON.parse(localStorage.getItem('userData')).token
```

#### 6. Copy the Result
- The console will show your token
- **Copy the entire string** (Ctrl+C or Cmd+C)

---

## Method 3: Create a Simple Token Extractor Page

Create a new HTML file `get_token.html` and open it in your browser:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Get CRM Token</title>
    <style>
        body { font-family: Arial; padding: 20px; max-width: 600px; margin: 50px auto; }
        button { padding: 15px 30px; font-size: 16px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }
        .result { margin-top: 20px; padding: 15px; background: #f0f0f0; word-break: break-all; display: none; }
        .instructions { background: #e3f2fd; padding: 15px; border-left: 4px solid #2196F3; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>🔑 Get Your CRM Token</h1>
    
    <div class="instructions">
        <strong>⚠️ Important:</strong> You must be logged into your CRM system first (in another tab or window).
    </div>
    
    <button onclick="getToken()">🔄 Get My Token</button>
    
    <div id="result" class="result"></div>
    
    <script>
        function getToken() {
            let token = localStorage.getItem('token');
            
            if (!token) {
                const userData = localStorage.getItem('userData');
                if (userData) {
                    const parsed = JSON.parse(userData);
                    token = parsed.token || parsed.access_token;
                }
            }
            
            const resultDiv = document.getElementById('result');
            
            if (token) {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = `
                    <h3>✅ Your Token:</h3>
                    <textarea style="width: 100%; height: 100px; margin-top: 10px;">${token}</textarea>
                    <p><strong>Copy the token above and use it in the Python script.</strong></p>
                `;
            } else {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = `
                    <h3 style="color: red;">❌ No Token Found</h3>
                    <p>Please make sure you are logged into the CRM system first.</p>
                `;
            }
        }
    </script>
</body>
</html>
```

**To use:**
1. Log in to your CRM system
2. Open `get_token.html` in your browser
3. Click "🔄 Get My Token"
4. Copy the token shown

---

## What the Token Looks Like

Your token will be a **long string** that looks like this:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDY4MjU2OTYsInVzZXJfaWQiOiI2NTZmMzVmNzJlYzAwZTBhM2RkNzJkOWEiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIn0.7yZk8KxQJhXvL5Y2mP5qH7nR8sT1vW9Y0cX3dF7gB4
```

**Key characteristics:**
- Starts with `eyJhbGci`
- Very long (usually 200-500+ characters)
- Contains three parts separated by dots
- No spaces

---

## Troubleshooting

### ❌ "Cannot find token"
- **Solution:** Make sure you are **logged in** to the CRM system first
- **Solution:** Refresh the page and try again
- **Solution:** Try Method 2 (Console command)

### ❌ "Token is null or undefined"
- **Solution:** Check if you're on the correct website URL in the Application tab
- **Solution:** Try logging out and logging back in

### ❌ "UserData doesn't have token field"
- **Solution:** Look for other keys like `access_token`, `authToken`, or `jwt`
- **Solution:** Check the entire localStorage for any long string starting with `eyJ`

### ❌ "Token expired"
- **Solution:** Log out and log back in to get a fresh token
- **Solution:** Tokens usually expire after some time (hours or days)

---

## After You Have Your Token

### Option A: Use the Python Script
```bash
python3 download_leads_excel.py
```
Then paste your token when asked.

### Option B: Use curl Command
```bash
curl -X GET "https://localhost:8049/leads/excel-export/export-leads" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -k \
  -o leads_export.xlsx
```
Replace `YOUR_TOKEN_HERE` with your actual token.

---

## Need More Help?

If you're still having trouble finding your token:

1. **Check browser type:**
   - Chrome/Edge: Use Method 1 (Application tab)
   - Firefox: Use Method 1 (Storage tab)
   - Safari: Use Method 2 (Console tab)

2. **Check localStorage directly:**
   ```javascript
   // Run this in console to see ALL localStorage keys
   console.log(localStorage);
   ```

3. **Contact support** if you continue to have issues

---

**Remember:** Your token is sensitive. Don't share it with anyone you don't trust! 🔒