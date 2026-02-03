# Obligation Section Fixes - Problem Analysis & Solution

## Problems Identified

### Problem 1: Incorrect "Check Eligibility" Activity History Creation

**Current Behavior:**
- When updating ANY field in the Obligation tab, activity history always shows "Check Eligibility"
- This happens even when changes are made only in:
  - Customer Details (Personal section)
  - Customer Obligation (Obligation table)

**Root Cause:**
The `ObligationsSection` sends BOTH `obligation_data` AND `eligibility_details` together in every save:

```javascript
const obligationData = {
  dynamic_fields: {
    obligation_data: { ... },  // Customer Details + Obligation Table
    eligibility_details: { ... }  // Check Eligibility
  }
};
```

When the backend detects changes in `eligibility_details`, it creates activity history for "Check Eligibility" even if the user didn't touch that section.

### Problem 2: Data Disappearing in Customer Obligation

**Current Behavior:**
- After saving Customer Obligation data, it sometimes disappears
- Happens when:
  - User logs in again
  - User switches tabs quickly
  - For some leads (not consistently)

**Root Cause:**
1. **Initial State Issue:** The section initializes with empty obligations array:
   ```javascript
   const [obligations, setObligations] = useState([
     { product: "", bankName: "", ... }  // Empty row
   ]);
   ```
   This doesn't load existing data properly.

2. **Race Condition:** `LeadDetails.jsx` does defensive merge:
   ```javascript
   sanitizedPayload.dynamic_fields = {
     ...leadData.dynamic_fields,  // Current backend data
     ...sanitizedPayload.dynamic_fields  // Component's update
   };
   ```
   If component sends empty/undefined data, it overwrites the backend's existing data.

3. **No Change Detection:** Every save sends ALL data from ALL sections, even if only one field changed. This increases risk of data loss.

## Solution

### Part 1: Section-Specific Save Tracking

Track which sections were actually modified and only send those sections:

```javascript
// Track which sections were modified
const [modifiedSections, setModifiedSections] = useState({
  customerDetails: false,
  customerObligation: false,
  checkEligibility: false
});

// When a field changes, mark the section as modified
const handleSalaryChange = (e) => {
  setModifiedSections(prev => ({ ...prev, customerDetails: true }));
  // ... rest of handler
};

const handleObligationChange = (idx, field, value) => {
  setModifiedSections(prev => ({ ...prev, customerObligation: true }));
  // ... rest of handler
};

const handleCeFoirPercentChange = (e) => {
  setModifiedSections(prev => ({ ...prev, checkEligibility: true }));
  // ... rest of handler
};
```

### Part 2: Save Only Modified Sections

```javascript
const handleSaveObligation = async () => {
  // Build payload with ONLY modified sections
  const obligationData = {
    dynamic_fields: {}
  };

  // Only include sections that were actually modified
  if (modifiedSections.customerDetails) {
    obligationData.dynamic_fields.obligation_data = {
      salary: salaryRaw,
      partner_salary: partnerSalaryRaw,
      yearly_bonus: yearlyBonusRaw,
      bonus_division: bonusDivision,
      company_name: companyName
    };
  }

  if (modifiedSections.customerObligation) {
    obligationData.dynamic_fields.obligation_data = {
      ...obligationData.dynamic_fields.obligation_data,
      obligations: obligations.map(obl => ({...})),
      total_bt_pos: totalBtPosCalc,
      total_obligation: totalObligations
    };
  }

  if (modifiedSections.checkEligibility) {
    obligationData.dynamic_fields.eligibility_details = {
      company_category: ceCompanyCategory,
      foir_percent: parseFloat(ceFoirPercent),
      // ... rest of eligibility fields
    };
  }

  // Reset modified sections after save
  setModifiedSections({
    customerDetails: false,
    customerObligation: false,
    checkEligibility: false
  });
};
```

### Part 3: Fix Initial Data Loading

Load existing obligation data properly from `leadData`:

```javascript
useEffect(() => {
  if (!leadData) return;

  const obligationData = leadData.dynamic_fields?.obligation_data;
  
  if (obligationData?.obligations && Array.isArray(obligationData.obligations)) {
    // Load existing obligations, don't initialize with empty array
    const loadedObligations = obligationData.obligations.map(obl => ({
      product: obl.product || "",
      bankName: obl.bankName || "",
      // ... rest of fields
    }));
    setObligations(loadedObligations);
  }
}, [leadData?._id]);
```

### Part 4: Backend Protection (Optional Enhancement)

In `backend/app/database/Leads.py`, add logic to detect and preserve unchanged sections:

```python
async def update_lead(self, lead_id: str, update_data: Dict[str, Any], user_id: str, user_name: str = "", updated_by_name: str = ""):
    current_lead = await self.get_lead_by_id(lead_id)
    
    # Special handling for obligation_data and eligibility_details
    if "dynamic_fields" in update_data:
        dynamic_fields_update = update_data["dynamic_fields"]
        current_dynamic_fields = current_lead.get("dynamic_fields", {})
        
        # Only update sections that are actually present in update_data
        if "obligation_data" in dynamic_fields_update:
            # Merge with existing obligation_data to preserve other fields
            current_obligation_data = current_dynamic_fields.get("obligation_data", {})
            update_data["dynamic_fields"]["obligation_data"] = {
                **current_obligation_data,
                **dynamic_fields_update["obligation_data"]
            }
        
        if "eligibility_details" in dynamic_fields_update:
            # Merge with existing eligibility_details to preserve other fields
            current_eligibility_details = current_dynamic_fields.get("eligibility_details", {})
            update_data["dynamic_fields"]["eligibility_details"] = {
                **current_eligibility_details,
                **dynamic_fields_update["eligibility_details"]
            }
```

## Expected Behavior After Fix

### ✅ Problem 1 Fixed:
- Edit "Salary" in Customer Details → Activity history shows "Salary" (not "Check Eligibility")
- Edit "Product" in Obligation Table → Activity history shows "Product" (not "Check Eligibility")
- Edit "FOIR %" in Check Eligibility → Activity history shows "FOIR %" (correct)

### ✅ Problem 2 Fixed:
- Customer Obligation data loads correctly on initial render
- Data persists after page refresh
- Data persists after login/logout
- Data persists after tab switching
- No more data loss due to race conditions

## Files to Modify

1. `rupiyamaker-UI/crm/src/components/lead-details/ObligationsSection.jsx`
   - Add section change tracking
   - Save only modified sections
   - Fix initial data loading

2. `backend/app/database/Leads.py` (Optional)
   - Add defensive merge for obligation_data and eligibility_details

## Testing Checklist

- [ ] Edit Customer Details → verify correct activity history
- [ ] Edit Obligation Table → verify correct activity history
- [ ] Edit Check Eligibility → verify correct activity history
- [ ] Refresh page → verify data persists
- [ ] Switch tabs quickly → verify data persists
- [ ] Login/logout → verify data persists
- [ ] Test with multiple leads → verify consistency