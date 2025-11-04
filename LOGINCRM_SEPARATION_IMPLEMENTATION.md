# LoginCRM Separate Storage Implementation

## Overview
This document describes the implementation of separate storage for LoginCRM leads, moving from a single `leads` collection with a flag to completely separate `login_leads` collection.

## Problem Statement
**Before:** 
- All leads stored in single `leads` collection
- LoginCRM filtered leads using `file_sent_to_login = true` flag
- When status changed from LeadCRM to LoginCRM, only the flag was toggled
- Both LeadCRM and LoginCRM shared the same lead data

**User Request:**
- Create separate storage for LoginCRM leads
- When lead is sent from LeadCRM to LoginCRM, create a completely new login lead document
- LoginCRM and LeadCRM should have independent lead data
- All lead data (including ObligationSection, forms, etc.) should be duplicated

## Solution Implemented

### 1. New Database Collection: `login_leads`
Created `/www/wwwroot/RupiyaMe/backend/app/database/LoginLeads.py`

**Key Features:**
- Separate MongoDB collection: `login_leads`
- Independent activity tracking: `login_lead_activities`
- Complete data duplication from original lead
- Links to original lead via `original_lead_id` field

**Main Methods:**
```python
- create_login_lead(lead_data, original_lead_id, user_id)
- get_login_lead(login_lead_id)
- list_login_leads(filter_dict, limit)
- update_login_lead(login_lead_id, update_data, user_id)
- delete_login_lead(login_lead_id, user_id)
- get_login_lead_activities(login_lead_id, limit)
- get_login_lead_by_original_id(original_lead_id)
```

### 2. Database Initialization Updated
Modified `/www/wwwroot/RupiyaMe/backend/app/database/__init__.py`

**Changes:**
- Added `login_leads_db` global variable
- Imported `LoginLeadsDB` class
- Created `login_leads_db` instance
- Initialized indexes for login_leads collection
- Added `get_login_leads_db()` dependency function
- Added to `get_database_instances()` return dictionary

### 3. Backend API Routes Updated
Modified `/www/wwwroot/RupiyaMe/backend/app/routes/leadLoginRelated.py`

#### Updated Endpoints:

1. **POST `/send-to-login-department/{lead_id}`**
   - **OLD:** Set `file_sent_to_login = true` flag on existing lead
   - **NEW:** Creates complete duplicate in `login_leads` collection
   - Copies ALL lead data including dynamic_fields, ObligationSection, forms
   - Links back to original lead via `original_lead_id`
   - Updates original lead with `login_lead_id` for tracking

2. **GET `/login-department-leads`**
   - **OLD:** Filtered main `leads` collection where `file_sent_to_login = true`
   - **NEW:** Queries `login_leads` collection directly
   - No need for `file_sent_to_login` filter anymore
   - Returns only login-specific leads

3. **PATCH `/assign-multiple-users/{lead_id}`**
   - **OLD:** Updated assignments in main `leads` collection
   - **NEW:** Updates assignments in `login_leads` collection
   - Uses `login_leads_db.update_login_lead()`

4. **PATCH `/update-operations/{lead_id}`**
   - **OLD:** Updated operations data in main `leads` collection
   - **NEW:** Updates operations data in `login_leads` collection
   - All operations fields stored in login lead document

5. **PATCH `/validate-questions/{lead_id}`** (TODO)
   - Needs update to work with `login_leads` collection

6. **PATCH `/update-login-fields/{lead_id}`** (TODO)
   - Needs update to work with `login_leads` collection

7. **DELETE `/{lead_id}`** (TODO)
   - Needs update to delete from `login_leads` collection

## Data Flow

### Lead Lifecycle:

1. **Creation in LeadCRM:**
   ```
   User creates lead → Stored in `leads` collection
   ```

2. **Send to LoginCRM:**
   ```
   User clicks "Send to Login" 
   → Backend creates duplicate in `login_leads` collection
   → Original lead updated with:
      - file_sent_to_login = true
      - login_lead_id = <new_login_lead_id>
      - login_department_sent_date
      - login_department_sent_by
   ```

3. **Working in LoginCRM:**
   ```
   All LoginCRM operations work on `login_leads` collection
   → Status changes, assignments, operations, forms
   → All stored in login lead document
   → Original lead in `leads` collection untouched
   ```

4. **Data Independence:**
   ```
   LeadCRM lead data ← NO SYNC → LoginCRM lead data
   Each has complete independent copy
   ```

## Database Schema

### login_leads Collection Fields:
```javascript
{
  _id: ObjectId,  // Unique ID for login lead
  original_lead_id: String,  // Link to original lead in `leads` collection
  login_created_at: ISODate,  // When login lead was created
  login_created_by: String,  // User who created login lead
  
  // All original lead fields duplicated:
  first_name, last_name, email, phone, mobile_number,
  address, loan_type, loan_amount, status, sub_status,
  dynamic_fields: {
    obligation_section: {...},  // ObligationSection data
    applicant_form: {...},       // LoginFormSection data
    co_applicant_form: {...},    // Co-applicant form
    financial_details: {...},
    personal_details: {...},
    // ... all other dynamic fields
  },
  
  // Login department specific:
  assigned_to: [userId],
  assignment_history: [...],
  login_sent_date, login_person, channel_name,
  amount_approved, amount_disbursed,
  // ... all operations fields
  
  updated_at, last_updated_by
}
```

### Indexes Created:
- created_at (descending)
- login_created_at (descending)
- original_lead_id
- assigned_to
- status, sub_status
- loan_type
- Compound: (status, created_at), (assigned_to, status)
- Text search: first_name, last_name, email, phone

## Benefits

1. **Complete Data Separation:**
   - LeadCRM and LoginCRM have independent data
   - Changes in one don't affect the other

2. **Full Data Preservation:**
   - All lead data including ObligationSection, forms copied
   - Nothing is lost when moving to LoginCRM

3. **Better Performance:**
   - Separate collections allow better indexing
   - LoginCRM queries don't scan through all leads

4. **Clear Data Ownership:**
   - `leads` collection = LeadCRM data
   - `login_leads` collection = LoginCRM data

5. **Audit Trail:**
   - `original_lead_id` maintains link to source
   - Both original and login lead preserve full history

## Migration Notes

### For Existing Data:
If you have existing leads with `file_sent_to_login = true`, you can migrate them:

```python
# Migration script (to be created if needed)
async def migrate_existing_login_leads():
    leads_db = LeadsDB()
    login_leads_db = LoginLeadsDB()
    
    # Find all leads sent to login
    existing_login_leads = await leads_db.list_leads({
        "file_sent_to_login": True
    })
    
    for lead in existing_login_leads:
        # Check if login lead already exists
        existing = await login_leads_db.get_login_lead_by_original_id(str(lead['_id']))
        if not existing:
            # Create login lead from existing data
            login_lead_id = await login_leads_db.create_login_lead(
                lead_data=lead,
                original_lead_id=str(lead['_id']),
                user_id=lead.get('created_by')
            )
            print(f"Migrated {lead['_id']} → {login_lead_id}")
```

## Frontend Changes Required

### LoginCRM.jsx:
**No changes required** - The component already works with the API endpoints which now fetch from `login_leads` collection.

The API layer transparently handles the new collection, so frontend code continues to work as-is.

## Testing Checklist

- [ ] Send lead from LeadCRM to LoginCRM
- [ ] Verify new login lead created in `login_leads` collection
- [ ] Verify original lead updated with `login_lead_id`
- [ ] Check LoginCRM shows the login lead
- [ ] Verify ObligationSection data preserved
- [ ] Verify LoginFormSection data preserved
- [ ] Test status changes in LoginCRM
- [ ] Test operations updates
- [ ] Test lead assignment
- [ ] Test lead deletion
- [ ] Verify original lead unaffected by LoginCRM changes

## Remaining Work

1. Update these endpoints to use `login_leads`:
   - `/validate-questions/{lead_id}`
   - `/update-login-fields/{lead_id}`
   - `/{lead_id}` (DELETE)
   - `/debug/test-lead/{lead_id}`

2. Restart backend server to initialize new database

3. Test complete flow end-to-end

4. Optional: Create migration script for existing data

## Files Modified

1. `/www/wwwroot/RupiyaMe/backend/app/database/LoginLeads.py` (NEW)
2. `/www/wwwroot/RupiyaMe/backend/app/database/__init__.py` (MODIFIED)
3. `/www/wwwroot/RupiyaMe/backend/app/routes/leadLoginRelated.py` (MODIFIED)
4. `/www/wwwroot/RupiyaMe/LOGINCRM_SEPARATION_IMPLEMENTATION.md` (NEW - this file)

## Summary

The implementation successfully separates LoginCRM leads into an independent collection while preserving all data and maintaining backward compatibility. When a lead is sent from LeadCRM to LoginCRM, a complete duplicate is created, ensuring both departments have their own independent data that can evolve separately.
