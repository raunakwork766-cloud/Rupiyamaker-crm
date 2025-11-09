## TEST PLAN FOR OBLIGATION DATA PERSISTENCE

### Problem Statement
User reports that obligation data disappears when updating pincode/city in the About section, despite multiple backend fixes to preserve dynamic_fields.

### Current Protection Mechanisms
1. **Frontend (LeadDetails.jsx)**: Defensive merge in updateLead()
2. **Backend Routes (leads.py line 1785-1807)**: Merge logic for dynamic_fields
3. **Backend Database (Leads.py line 481-512)**: Preservation of dynamic_fields and important_fields
4. **Frontend (sections/AboutSection.jsx)**: Now uses parent onSave OR direct API with minimal payload

### Testing Steps

#### Step 1: Verify Frontend Sends Correct Data
1. Open Browser Developer Tools → Network tab
2. Navigate to a lead with obligation data saved
3. Update pincode or city in About section
4. Check Network tab for PUT request to `/api/leads/{id}`
5. **Expected**: Request payload should be `{postal_code: "..."}`  OR  `{city: "..."}` ONLY
6. **Expected**: Should NOT include empty dynamic_fields or partial dynamic_fields

#### Step 2: Verify Backend Receives and Preserves
1. Check backend logs at `/www/wwwroot/RupiyaMe/backend/backend.log`
2. Look for lines with "DYNAMIC_FIELDS RECEIVED IN UPDATE"
3. Look for "Preserved obligation_data from database"
4. **Expected**: Backend should log preservation messages

#### Step 3: Verify Database State
Run this MongoDB query BEFORE and AFTER updating pincode:
```javascript
use RupiyaMe;  // or your company name
db.leads.findOne(
  {_id: ObjectId("YOUR_LEAD_ID_HERE")},
  {dynamic_fields: 1}
);
```

**Expected**: `dynamic_fields.obligation_data` should remain unchanged after pincode/city update

#### Step 4: Verify Frontend Display
1. After updating pincode/city, switch to Obligations tab
2. Check console logs for "ObligationsSection: Loaded obligation data"
3. **Expected**: Should show loaded data, not null/undefined

### Possible Issues

#### Issue A: Frontend Component Using Stale Data
- **Symptom**: Backend saves correctly, but UI shows old data
- **Cause**: React component not refreshing after update
- **Fix**: Force re-fetch of lead data after About section save

#### Issue B: Wrong AboutSection Component
- **Symptom**: Changes to lead-details/AboutSection.jsx don't affect behavior
- **Cause**: Application actually uses sections/AboutSection.jsx
- **Fix**: Modify sections/AboutSection.jsx (✅ DONE)

#### Issue C: Parent onSave Not Defined
- **Symptom**: AboutSection logs "No onSave function provided"  
- **Cause**: Component rendered without onSave prop
- **Fix**: Ensure all usages pass onSave prop OR rely on fallback direct API

#### Issue D: Database Update Timing
- **Symptom**: Obligation data briefly saved then disappears
- **Cause**: Multiple rapid updates overwriting each other
- **Fix**: Add debouncing or update queuing

### Console Log Checklist
When testing, you should see these logs in browser console:

```
✅ GOOD LOGS:
- "📤 AboutSection: Update payload for pinCode: {postal_code: '123456'}"
- "📡 AboutSection: Calling parent onSave" OR "📡 AboutSection: Using direct API call"
- "✅ AboutSection: Saved via parent callback" OR "✅ AboutSection: Successfully saved..."
- "ObligationsSection: Loaded obligation data from dynamic_fields" (with data shown)

❌ BAD LOGS:
- "⚠️ AboutSection: No onSave function provided - changes will not be saved!"
- "📤 AboutSection: Update payload for pinCode: {dynamic_fields: {...}}" (nested)
- "ObligationsSection: No obligation data found in dynamic_fields"
- Any 422 or 500 HTTP errors
```

### Next Steps Based on Results

**If Network tab shows partial dynamic_fields being sent**:
- Frontend issue - need to fix payload construction

**If backend logs show empty {} updates**:
- Empty update guard working, but something's triggering empty updates

**If MongoDB shows obligation_data missing after update**:
- Backend preservation logic failing - need to debug merge

**If MongoDB shows obligation_data present but UI shows "none"**:
- Frontend display/refresh issue - need to trigger re-fetch

### Quick Fix Commands

**Restart backend**:
```bash
cd /www/wwwroot/RupiyaMe/backend
pkill -f "python.*main.py"
source venv/bin/activate
nohup python -m uvicorn main:app --host 0.0.0.0 --port 8049 > backend.log 2>&1 &
```

**Check backend status**:
```bash
netstat -tuln | grep 8049
tail -f /www/wwwroot/RupiyaMe/backend/backend.log
```

**Rebuild frontend** (if changes not reflected):
```bash
cd /www/wwwroot/RupiyaMe/rupiyamaker-UI/crm
npm run build
# Restart frontend server if needed
```
