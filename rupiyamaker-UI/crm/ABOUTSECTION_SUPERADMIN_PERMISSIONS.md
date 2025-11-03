# AboutSection Super Admin Permission Implementation

## Overview
Modified the AboutSection.jsx component to restrict editing of mobile number and alternate number fields to Super Admin users only, based on the specific permission structure provided.

## Changes Made

### 1. Enhanced Permission Checking Function

**Updated `checkUserPermissions` function to:**
- Check for Super Admin role name in userData
- Validate wildcard permissions (`page: "*", actions: "*"`)
- Support multiple permission data sources (localStorage and userData)
- Set proper state for Super Admin status

```javascript
const checkUserPermissions = () => {
  const userRole = localStorage.getItem('userRole');
  const userDepartment = localStorage.getItem('userDepartment');
  const userPermissions = getUserPermissions();
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  
  // Check if user is superadmin with specific permissions
  let isSuperAdminUser = false;
  
  // Check for Super Admin role with wildcard permissions
  if (userData.role_name === 'Super Admin' || userRole === 'Super Admin') {
    isSuperAdminUser = true;
  }
  
  // Check for wildcard permissions (page: "*", actions: "*")
  if (userPermissions && Array.isArray(userPermissions)) {
    const hasSuperAdminPermissions = userPermissions.some(perm => 
      perm.page === "*" && perm.actions === "*"
    );
    if (hasSuperAdminPermissions) {
      isSuperAdminUser = true;
    }
  }
  
  // Check role-based permissions in userData
  if (userData.permissions && Array.isArray(userData.permissions)) {
    const hasSuperAdminPermissions = userData.permissions.some(perm => 
      perm.page === "*" && perm.actions === "*"
    );
    if (hasSuperAdminPermissions) {
      isSuperAdminUser = true;
    }
  }
  
  setIsUserSuperAdmin(isSuperAdminUser);
  
  // Only Super Admin can edit mobile number and alternate number
  if (isSuperAdminUser) {
    setCanEditAlternateNumber(true);
    return;
  }
  
  // For non-super admin users, alternate number can only be edited if it's empty
  const alternateNumber = fields?.alternateNumber || '';
  const isAlternateNumberEmpty = !alternateNumber || 
                                 alternateNumber.trim() === '' || 
                                 alternateNumber.toLowerCase() === 'none' ||
                                 alternateNumber.toLowerCase() === 'null';
  
  setCanEditAlternateNumber(isAlternateNumberEmpty);
};
```

### 2. Mobile Number Field - Super Admin Only

**Changed mobile number field to:**
- Use `isUserSuperAdmin` state instead of general `canEdit`
- Show "Super Admin only" placeholder for non-admin users
- Add descriptive tooltip explaining the restriction

```javascript
<input
  className={`text-[#0db45c] border rounded px-3 py-2 font-bold w-full text-base ${
    !isUserSuperAdmin ? 'bg-gray-100 cursor-not-allowed border-black' : 
    validationErrors.mobileNumber ? 'border-red-500 bg-red-50' : 'border-black'
  }`}
  value={fields.mobileNumber}
  onChange={e => isUserSuperAdmin && handleChange("mobileNumber", e.target.value)}
  onBlur={e => isUserSuperAdmin && handleBlur("mobileNumber", e.target.value)}
  readOnly={!isUserSuperAdmin}
  placeholder={!isUserSuperAdmin ? "Super Admin only" : "Enter 10-digit mobile number"}
  maxLength="10"
  pattern="[0-9]{10}"
  title={!isUserSuperAdmin ? "Only Super Admin can edit mobile number" : "Enter mobile number"}
/>
```

### 3. Alternate Number Field - Enhanced Logic

**Updated alternate number field to:**
- Use the enhanced `canEditAlternateNumber` logic
- Show appropriate placeholder based on Super Admin status
- Allow editing if user is Super Admin OR if field is empty (for backward compatibility)

```javascript
<input
  className={`text-[#0db45c] border rounded px-3 py-2 font-bold w-full text-base ${
    !canEditAlternateNumber ? 'bg-gray-100 cursor-not-allowed border-black' : 
    validationErrors.alternateNumber ? 'border-red-500 bg-red-50' : 'border-black'
  }`}
  value={fields.alternateNumber}
  onChange={e => canEditAlternateNumber && handleChange("alternateNumber", e.target.value)}
  onBlur={e => canEditAlternateNumber && handleBlur("alternateNumber", e.target.value)}
  readOnly={!canEditAlternateNumber}
  placeholder={!canEditAlternateNumber ? 
    (isUserSuperAdmin ? "Enter 10-digit alternate number" : "Super Admin only") : 
    "Enter 10-digit alternate number"
  }
  maxLength="10"
  pattern="[0-9]{10}"
  title={!canEditAlternateNumber ? 
    (isUserSuperAdmin ? "Enter alternate number" : "Only Super Admin can edit alternate number") : 
    "Enter alternate number"
  }
/>
```

## Permission Detection Logic

The system now checks for Super Admin permissions in the following order:

1. **Role Name Check:** `userData.role_name === 'Super Admin'` or `userRole === 'Super Admin'`
2. **Permission Structure Check:** Validates permissions array for `{page: "*", actions: "*"}`
3. **Multiple Sources:** Checks both `getUserPermissions()` and `userData.permissions`

## Super Admin Permission Structure (Reference)

Based on the provided example:
```json
{
  "_id": {"$oid": "685292be8d7cdc3a71c4829b"},
  "name": "Super Admin",
  "permissions": [
    {
      "page": "*",
      "actions": "*"
    }
  ]
}
```

## User Experience

### For Super Admin Users:
- ✅ Can edit both mobile number and alternate number
- ✅ Fields appear normal with standard styling
- ✅ Get standard placeholder text and tooltips

### For Non-Super Admin Users:
- ❌ Mobile number field is read-only with "Super Admin only" placeholder
- ❌ Alternate number field is read-only unless empty (backward compatibility)
- ❌ Fields appear grayed out with restricted styling
- ❌ Tooltips explain the permission restriction

## Implementation Benefits

1. **Enhanced Security:** Only Super Admin can modify critical contact information
2. **Clear User Feedback:** Visual and textual indicators explain restrictions
3. **Backward Compatibility:** Alternate number can still be added if field is empty
4. **Flexible Permission Detection:** Supports multiple permission data formats
5. **Consistent UX:** Maintains existing styling patterns and behaviors

## Status: ✅ COMPLETE

The AboutSection now properly restricts mobile number and alternate number editing to Super Admin users only, with clear visual feedback and enhanced permission detection.
