# Fix for Duplicate Activity History Entries

## Problem
When editing any field in the lead details view, two activity history entries are being created:
1. One entry when the field gets focus/starts editing (intermediate value)
2. Another entry when the final value is set

## Root Cause
There are **two competing save mechanisms**:

### 1. LoginCRM.jsx Auto-Save (Debounced)
```javascript
const handleSelectedLeadFieldChange = (field, value, skipSuccessMessage = false, saveDelay = 2000) => {
    // Updates local state immediately
    setSelectedLead(prev => ({ ...prev, [field]: value }));
    
    // Marks as pending
    setPendingSaves(prev => ({ ...prev, [field]: value }));
    
    // Sets a timeout to save after delay (debounced)
    const newTimeout = setTimeout(() => {
        performAutoSave(field, value, skipSuccessMessage);
    }, saveDelay);
    
    setSaveTimeouts(prev => ({ ...prev, [field]: newTimeout }));
};
```

### 2. Section Components Save Immediately on Blur
```javascript
// LoginFormSection.jsx
const handleBlur = async (field, value) => {
    // Saves IMMEDIATELY on blur without checking if there's a pending save
    const response = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify(apiData)
    });
    // This creates an activity history entry
};
```

### 3. Components Use onBlur Handler
```javascript
<input
    value={fields.fieldName}
    onChange={e => handleChange("fieldName", e.target.value)}
    onBlur={e => handleBlur("fieldName", e.target.value)}  // <-- This saves
/>
```

But the parent component also passes the onChange to `handleSelectedLeadFieldChange`:
```javascript
<LoginFormSection
    data={lead.dynamic_fields?.applicant_form || {}}
    onSave={updated => {
        handleSelectedLeadFieldChange("applicant_form", updated, true, 0);
    }}
/>
```

When user types:
1. `onChange` updates local state → triggers parent's `handleSelectedLeadFieldChange` → sets up debounced save
2. User clicks away → `onBlur` fires → saves immediately → creates activity entry
3. 2 seconds later → debounced timer fires → saves again → creates another activity entry

## Solution
The fix has TWO parts:

### Part 1: Track Field Focus State (Prevent Saves While Editing)
When a field is in focus, we should NOT save intermediate values. Only save when field loses focus with the final value.

### Part 2: Remove Conflicting onBlur Saves
The section components should NOT save on `onBlur` - they should only update their local state and let the parent component handle saving with proper debouncing.

## Implementation Plan

### Step 1: Add Field Focus Tracking to LoginCRM.jsx
- Add `focusedField` state to track which field is currently being edited
- When field gets focus, mark it as focused
- When field loses focus, mark it as not focused and trigger save
- Prevent debounced saves while field is focused

### Step 2: Remove Direct Saves from Section Components
- Remove the `onBlur` handler that makes direct API calls
- Keep `onBlur` only to update local state (if needed)
- Let the parent component's `handleSelectedLeadFieldChange` handle all saves

### Step 3: Update All Section Components
- LoginFormSection.jsx
- AboutSection.jsx
- HowToProcessSection.jsx
- OperationsSection.jsx
- ObligationsSection.jsx (already handles this correctly)

### Step 4: Backend Enhancement (Optional)
Add duplicate prevention in backend - don't create activity history if:
- Same field was just updated (within 2 seconds)
- Old value matches new value
- Update is from same user

## Expected Behavior After Fix
1. User focuses on field → `focusedField` set
2. User types value → local state updates
3. User moves to another field → first field loses focus
4. ONE save triggered with final value → ONE activity history entry
5. No intermediate saves or duplicate entries