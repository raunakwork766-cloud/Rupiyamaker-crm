# Obligation Row Deletion Fix - Complete Solution

## Problem
Deleted obligation rows were reappearing after switching tabs due to 422 validation errors when saving.

## Root Causes Identified

### 1. **Frontend Sending Formatted Strings to Backend**
- UI displays formatted numbers like `"4,64,334"` for better readability
- When saving, these formatted strings were sent to the backend
- Backend Pydantic models expected raw numbers (int/float), causing 422 errors

### 2. **Dual Save Paths with Different Data Formats**
- **Path 1**: `POST /api/leads/{id}/obligations` - Direct save (was fixed earlier)
- **Path 2**: `PUT /api/leads/{id}` - Called via `handleChangeFunc` (was broken)

### 3. **Backend Deep Merge Issue**
- Backend was merging obligation arrays instead of replacing them
- When deleting a row, old data was merged back

## Solutions Applied

### Fix 1: Frontend - Parse Before Calling handleChangeFunc
**File**: `/rupiyamaker-UI/crm/src/components/sections/ObligationSection.jsx`
**Lines**: ~6157-6185

Added parsing logic to convert formatted strings to numbers before passing data to `handleChangeFunc`:

```javascript
// Parse obligations array to remove formatting before passing to handleChangeFunc
const parsedObligations = (obligationData.obligations || []).map(obl => {
  const parseValue = (val) => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
    return isNaN(parsed) ? null : parsed;
  };

  return {
    ...obl,
    tenure: parseValue(obl.tenure),
    roi: parseValue(obl.roi),
    total_loan: parseValue(obl.total_loan),
    emi: parseValue(obl.emi),
    transfer_to_proposed_bank: parseValue(obl.transfer_to_proposed_bank),
    existing_emi: parseValue(obl.existing_emi),
    foirEmi: parseValue(obl.foirEmi)
  };
});
```

### Fix 2: Backend - Pydantic Validator for ObligationSchema
**File**: `/backend/app/schemas/lead_schemas.py`
**Lines**: ~100-137

Added Pydantic validator to automatically parse formatted strings at validation time:

```python
class ObligationSchema(BaseModel):
    product: Optional[str] = None
    bank_name: Optional[str] = None
    bankName: Optional[str] = None
    totalLoan: Optional[float] = None
    tenure: Optional[int] = None
    roi: Optional[float] = None
    total_loan: Optional[float] = None
    outstanding: Optional[float] = None
    emi: Optional[float] = None
    action: Optional[str] = None
    
    # Additional fields
    transfer_to_proposed_bank: Optional[float] = None
    existing_emi: Optional[float] = None
    foirEmi: Optional[float] = None
    
    @validator('tenure', 'roi', 'total_loan', 'totalLoan', 'outstanding', 'emi', 
               'transfer_to_proposed_bank', 'existing_emi', 'foirEmi', pre=True)
    def parse_formatted_numbers(cls, v):
        """Parse formatted strings like '4,64,334' to numbers"""
        if v is None or v == '':
            return None
        if isinstance(v, (int, float)):
            return v
        if isinstance(v, str):
            # Remove commas and parse
            cleaned = v.replace(',', '').strip()
            if cleaned == '':
                return None
            try:
                parsed = float(cleaned)
                return parsed
            except ValueError:
                return None
        return v
```

### Fix 3: Backend - Replace Instead of Merge
**File**: `/backend/app/routes/leads.py`
**Lines**: ~4383-4404

Added special case to replace obligations array instead of merging:

```python
# Special case: obligations should be replaced, not merged
if key == "obligations":
    dynamic_fields[key] = value
    continue
```

## Services Status

✅ **Backend**: Running on port 8049 with Pydantic validator fix
✅ **Frontend**: Running on port 4521 with parsing fix
✅ **Apache**: Proxying requests correctly

## Testing Instructions

1. **Open Lead Application Section**
   - Navigate to any lead
   - Go to the "Application" tab → "Obligation" section

2. **Add Obligation Rows**
   - Add 2-3 obligation rows with formatted numbers
   - Save the data

3. **Delete a Row**
   - Click the delete button (🗑️) on any obligation row
   - The row should disappear immediately

4. **Switch Tabs**
   - Go to another tab (e.g., "Basic Info")
   - Come back to "Application" → "Obligation"
   - **VERIFY**: Deleted row should NOT reappear

5. **Check Browser Console**
   - Should see successful PUT/POST requests (200 OK)
   - Should NOT see 422 errors

## What Should Work Now

✅ Row deletion persists after tab switching
✅ No 422 validation errors
✅ Both save paths (POST and PUT) handle formatted numbers
✅ Backend properly replaces obligation arrays
✅ Data syncs correctly between tabs

## Date Fixed
November 16, 2025

## Services Restarted
- Backend: 20:35 IST
- Frontend: 20:21 IST
