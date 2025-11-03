# LeadCRM Variable Initialization Order Fix

## Issues Resolved

### 1. **ReferenceError: Cannot access 'filterOptions' before initialization**

**Problem:** The `memoizedGetActiveFilterCount` was using `getActiveFilterCount()` function which depends on `filterOptions`, but both were defined after the memoized function was declared.

**Solution:**
- Moved `filterOptions` state initialization from line 714 to line 325 (before memoized functions)
- Moved `getActiveFilterCount` function definition from line 2149 to line 345 (before memoized functions)
- Removed duplicate declarations to prevent redeclare errors

### 2. **ReferenceError: Cannot access 'allRowsChecked' before initialization**

**Problem:** The `handleSelectAllChange` callback was using `allRowsChecked` which was defined much later in the component at line 3268.

**Solution:**
- Moved `allRowsChecked` calculation from line 3268 to line 377 (before callbacks that depend on it)
- Removed duplicate declaration

## Changes Made

### Before:
```jsx
// Line 325: memoizedGetActiveFilterCount tries to use getActiveFilterCount()
const memoizedGetActiveFilterCount = useMemo(() => {
    return getActiveFilterCount(); // ❌ Error: getActiveFilterCount not defined yet
}, [filterOptions]); // ❌ Error: filterOptions not defined yet

// Line 397: handleSelectAllChange tries to use allRowsChecked
const handleSelectAllChange = useCallback(() => {
    if (allRowsChecked) { // ❌ Error: allRowsChecked not defined yet
        setCheckedRows([]);
    } else {
        setCheckedRows(filteredLeads.map((_, idx) => idx));
    }
}, [allRowsChecked, filteredLeads]);

// Line 714: filterOptions defined much later
const [filterOptions, setFilterOptions] = useState({...});

// Line 2149: getActiveFilterCount function defined much later
const getActiveFilterCount = () => {...};

// Line 3268: allRowsChecked defined much later
const allRowsChecked = checkedRows.length === filteredLeads.length && filteredLeads.length > 0;
```

### After:
```jsx
// Line 325: filterOptions state initialized early
const [filterOptions, setFilterOptions] = useState({...});

// Line 345: getActiveFilterCount function defined early
const getActiveFilterCount = () => {...};

// Line 377: allRowsChecked calculated early
const allRowsChecked = checkedRows.length === filteredLeads.length && filteredLeads.length > 0;

// Line 381: memoizedGetActiveFilterCount now works
const memoizedGetActiveFilterCount = useMemo(() => {
    return getActiveFilterCount(); // ✅ getActiveFilterCount is now defined
}, [filterOptions]); // ✅ filterOptions is now defined

// Line 404: handleSelectAllChange now works
const handleSelectAllChange = useCallback(() => {
    if (allRowsChecked) { // ✅ allRowsChecked is now defined
        setCheckedRows([]);
    } else {
        setCheckedRows(filteredLeads.map((_, idx) => idx));
    }
}, [allRowsChecked, filteredLeads]);
```

## Root Cause

The issue was caused by **variable hoisting** and **initialization order** in React functional components. In JavaScript, `const` and `let` declarations are not hoisted like `var` declarations, so they cannot be accessed before their declaration line.

In React functional components, all variable declarations and function definitions are executed in order from top to bottom on each render. When a variable or function is used before it's declared, it results in a `ReferenceError`.

## Result

- ✅ No more initialization order errors
- ✅ Component renders successfully
- ✅ All memoized functions work correctly
- ✅ All callbacks have access to their dependencies
- ✅ No duplicate variable declarations

The LeadCRM component should now load without any initialization errors.
