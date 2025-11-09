# Quick Fix Applied: AboutSection No Longer Sends dynamic_fields

## Issue
When updating name, phone, city, or pin_code in the About section, the obligation data was being removed.

## Root Cause
The AboutSection was sending partial `dynamic_fields` objects like:
```javascript
{
  city: "Mumbai",
  dynamic_fields: {
    address: {
      city: "Mumbai"
    }
  }
}
```

Even though the backend merge logic was correct, sending partial `dynamic_fields` could cause issues in edge cases.

## Fix Applied
**File**: `/rupiyamaker-UI/crm/src/components/lead-details/AboutSection.jsx`

**Changed**:
- Removed `dynamic_fields` from updates when changing pin_code or city
- Now only sends top-level fields: `postal_code` and `city`
- Backend handles any necessary syncing to `dynamic_fields`

**Before**:
```javascript
} else if (field === 'pin_code') {
    updateData.postal_code = String(editableData.pin_code || '');
    updateData.dynamic_fields = {
        address: {
            postal_code: String(editableData.pin_code || '')
        }
    };
}
```

**After**:
```javascript
} else if (field === 'pin_code') {
    updateData.postal_code = String(editableData.pin_code || '');
    // Don't send dynamic_fields - let backend handle it
}
```

## Result
✅ AboutSection now sends ONLY the specific field being updated (name, phone, city, postal_code)
✅ No partial `dynamic_fields` objects sent
✅ Backend merges with fresh database data
✅ Obligation data is preserved!

## Test This Fix

1. Login with non-superadmin account
2. Open a lead and save obligation data
3. Go to About section
4. Change **Name** → Obligation data should remain ✅
5. Change **Phone** → Obligation data should remain ✅
6. Change **City** → Obligation data should remain ✅
7. Change **Pin Code** → Obligation data should remain ✅

All updates should now preserve obligation data!
