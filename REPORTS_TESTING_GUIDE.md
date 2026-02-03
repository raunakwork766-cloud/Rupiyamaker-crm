# Reports Module - Testing & Troubleshooting Guide

## ✅ Pre-Flight Checklist

Before testing, ensure:

1. **Dependencies Installed**
   ```bash
   cd rupiyamaker-UI/crm
   npm install xlsx dayjs
   ```
   
2. **Files in Place**
   - ✅ `rupiyamaker-UI/crm/src/components/reports/ComprehensiveReportDark.jsx`
   - ✅ `rupiyamaker-UI/crm/src/routes/OptimizedAppRoutes.jsx` (updated)
   - ✅ `rupiyamaker-UI/crm/src/services/leadsService.js` (updated with getLeadById)
   - ✅ `rupiyamaker-UI/crm/src/services/hrmsService.js` (exists)

3. **User Logged In**
   - You must be authenticated to view Reports

## 🧪 Testing Steps

### Step 1: Navigate to Reports
1. Login to the CRM
2. Click **"Reports"** from the sidebar menu
3. **Expected Result**: Dark-themed Reports page loads

**If not working:**
- Check browser console for errors (F12 → Console tab)
- Verify route is configured: Check `/reports` path in URL
- Check if you have permissions for "leads.show" or "reports.show"

### Step 2: Verify Dark Theme
1. Look at the page background
2. **Expected Result**: Black/dark gray background (#0f0f14)

**If not working:**
- Check if CSS styles are loading
- Look for CSS override errors in console
- Verify component is mounting correctly

### Step 3: Test Section Dropdown
1. Click the dropdown button (top right, shows "PLOD Leads")
2. Select "Login Leads"
3. **Expected Result**: Only leads with `file_sent_to_login: true` are shown

**If not working:**
- Check network tab (F12 → Network tab)
- Look for API call to `/api/leads?file_sent_to_login=true`
- Verify backend supports this query parameter
- Check for 404 or 500 errors

### Step 4: Test Filters
1. Set a date range
2. Select a status (e.g., "Active")
3. Type in search box
4. **Expected Result**: Data filters in real-time

**If not working:**
- Check browser console for JavaScript errors
- Verify filter state is updating
- Check if data array is being filtered correctly

### Step 5: Test Lead Details Modal
1. Click on any lead row
2. **Expected Result**: Modal opens with 6 tabs (About, Obligations, Remarks, Tasks, Attachments, Activity)

**If not working:**
- Check if `handleRowClick` is being called
- Look for modal visibility issues
- Check if lead data is being fetched correctly
- Verify `leadsService.getLeadById()` returns data

### Step 6: Test Excel Export
1. Click the download icon on a lead row
2. **Expected Result**: Excel file downloads with 6 sheets

**If not working:**
- Check if `xlsx` library is loaded
- Look for export errors in console
- Verify browser allows file downloads
- Check if data is being properly formatted for export

## 🐛 Common Issues & Solutions

### Issue 1: Page shows blank white screen
**Symptoms**: Nothing loads, white background
**Solutions**:
1. Check browser console for errors
2. Verify component is imported correctly in routes
3. Check if dependencies are installed: `npm list xlsx dayjs`
4. Clear browser cache and reload

### Issue 2: Dark theme not applying
**Symptoms**: White background instead of black
**Solutions**:
1. Check if CSS styles are being overridden by global styles
2. Verify inline styles in component are applying
3. Check for conflicting CSS classes
4. Look for theme provider conflicts

### Issue 3: Data not loading
**Symptoms**: Empty table, no data shown
**Solutions**:
1. Check network tab for failed API calls
2. Verify backend is running and accessible
3. Check user authentication token in localStorage
4. Verify user has required permissions

### Issue 4: Login leads showing all leads
**Symptoms**: Login dropdown shows regular leads too
**Solutions**:
1. Check API call includes `file_sent_to_login=true` parameter
2. Verify backend supports this filter
3. Check response data structure
4. Look at network tab to see actual query sent

### Issue 5: User names showing as "Unknown"
**Symptoms**: Assigned To column shows "Unknown"
**Solutions**:
1. Check if `hrmsService.getAllEmployees()` is being called
2. Verify API returns employee data
3. Check user ID matching logic in `getUserNameById()`
4. Look at network tab for employees API call

### Issue 6: Excel export fails
**Symptoms**: No file downloads, or file is empty
**Solutions**:
1. Verify `xlsx` library is installed: `npm list xlsx`
2. Check if data is being properly flattened
3. Look for export errors in console
4. Verify browser allows automatic downloads

### Issue 7: Modal not opening
**Symptoms**: Clicking row does nothing
**Solutions**:
1. Check if `handleRowClick` is being called (add console.log)
2. Verify `detailModalVisible` state is being set
3. Check if modal is rendered but hidden
4. Look for z-index conflicts

## 🔍 Debugging Commands

### Check Component is Mounted
Open browser console and type:
```javascript
// Check if component exists
document.querySelector('.ant-card')
```

### Check Data Loading
Add to component temporarily:
```javascript
useEffect(() => {
  console.log('📊 Data loaded:', filteredData);
  console.log('👥 Users loaded:', users);
}, [filteredData, users]);
```

### Check API Calls
1. Open Network tab (F12 → Network)
2. Filter by "XHR/fetch"
3. Look for calls to `/api/leads`, `/api/users`, etc.
4. Check response status and data

### Check State Changes
Add to component:
```javascript
useEffect(() => {
  console.log('🔄 Selected section changed:', selectedSection);
  console.log('📊 Filtered data count:', filteredData.length);
}, [selectedSection, filteredData]);
```

## 📊 Performance Monitoring

### Check Load Time
```javascript
// Add to component
useEffect(() => {
  const startTime = performance.now();
  fetchData().then(() => {
    const endTime = performance.now();
    console.log(`⏱️ Data fetch took ${endTime - startTime}ms`);
  });
}, [selectedSection]);
```

### Check Memory Usage
1. Open Chrome DevTools → Performance tab
2. Click "Record"
3. Navigate through Reports
4. Stop recording and check memory

## 🌐 Browser Compatibility Testing

### Test in Different Browsers
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

### Check Mobile View
1. Open DevTools (F12)
2. Click device toolbar (Ctrl+Shift+M)
3. Select iPhone or Android device
4. Test all functionality

## 🔧 Backend Verification

### Check Backend is Running
```bash
# Test leads endpoint
curl http://your-backend/api/leads

# Test employees endpoint  
curl http://your-backend/api/users

# Check if file_sent_to_login filter works
curl http://your-backend/api/leads?file_sent_to_login=true
```

### Check API Response Format
```json
// Expected response structure for leads:
{
  "data": [...],
  "success": true
}

// Expected response structure for employees:
[...]
```

## 📝 Expected Behavior Summary

| Feature | Expected Behavior |
|----------|------------------|
| Initial Load | Black background, PLOD Leads selected, data loading spinner |
| Section Dropdown | Shows 7 options, changes data on selection |
| Date Filter | Filters data by created_date range |
| Status Filter | Filters by status value |
| Search | Filters by text across all fields |
| Statistics | Updates in real-time based on filtered data |
| Row Click | Opens modal with 6 tabs |
| Export Single | Downloads Excel with 6 sheets |
| Export Bulk | Downloads Excel for selected rows |
| Export All | Downloads Excel for all filtered data |

## 🚨 When to Escalate

If you experience:

1. **Complete page failure** - Component won't load at all
2. **Data loss** - Exported files are empty or corrupted
3. **Security issues** - Unauthorized access to sensitive data
4. **Performance issues** - Page takes >10 seconds to load
5. **Browser crashes** - Component causes browser to crash

## 📞 Getting Help

### Check These First
1. **Browser Console** (F12 → Console) - Look for red errors
2. **Network Tab** (F12 → Network) - Check failed API calls
3. **Application Tab** (F12 → Application) - Check localStorage

### Common Error Messages

**Error: "Failed to load component"**
- Cause: Component file not found or has syntax error
- Fix: Check file path and syntax

**Error: "Component not found"**
- Cause: Import path is incorrect in routes
- Fix: Verify import path in OptimizedAppRoutes.jsx

**Error: "User not authenticated"**
- Cause: No user ID in localStorage
- Fix: Login again

**Error: "Module not found: xlsx"**
- Cause: xlsx package not installed
- Fix: Run `npm install xlsx`

**Error: "404 Not Found"**
- Cause: API endpoint doesn't exist
- Fix: Check backend endpoint is available

**Error: "500 Internal Server Error"**
- Cause: Backend error
- Fix: Check backend logs

## ✅ Success Criteria

The Reports module is working correctly when:

- [ ] Dark theme applies to entire page
- [ ] All 7 sections load data correctly
- [ ] Login leads filter shows only login leads
- [ ] PLOD leads shows only regular leads
- [ ] Filters (date, status, search) work instantly
- [ ] Statistics update in real-time
- [ ] Clicking row opens modal
- [ ] All 6 modal tabs load data
- [ ] Single row export downloads complete Excel
- [ ] Bulk export works for selected rows
- [ ] Export all works for filtered data
- [ ] No console errors
- [ ] No network errors
- [ ] Page loads in <3 seconds

## 🎯 Next Steps

Once verified working:

1. **Customize** - Adjust colors, add/remove sections
2. **Optimize** - Add server-side pagination for large datasets
3. **Enhance** - Add charts, analytics, custom reports
4. **Secure** - Add role-based access control
5. **Test** - Perform load testing with large datasets

---

**Last Updated**: February 2, 2026
**Version**: 1.0.0