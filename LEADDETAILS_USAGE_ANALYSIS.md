# LeadDetails.jsx Usage Analysis

## 1️⃣ LoginCRM Component mein
**File:** `src/components/LoginCRM.jsx`
**Route/URL:** `/login-crm` ya `/login`

### Kaise use hota hai:
- LoginCRM page par table mein kisi bhi lead par **click** karte ho
- Tab **modal/overlay** open hota hai
- Isme `<LeadDetails>` component load hota hai (lazy loaded)
- Full screen detail view dikhta hai

### Code location:
```jsx
{showLeadDetails && selectedLead && (
    <LeadDetails
        lead={selectedLead}
        user={user}
        onBack={() => setShowLeadDetails(false)}
        onLeadUpdate={(updatedLead) => {...}}
    />
)}
```

---

## 2️⃣ LazyLeadSections.jsx mein
**File:** `src/components/LazyLeadSections.jsx`

### Kaise use hota hai:
- Ye file LeadDetails ko **lazy load** karne ke liye hai
- Export karta hai taaki dusri files use kar sake
- Performance optimization ke liye

### Code:
```jsx
const LeadDetails = createLazyComponent(() => import('./LeadDetails'), 'LeadDetails');
export { LeadDetails };
```

---

## 3️⃣ LeadCRM Component mein
**File:** `src/components/LeadCRM.jsx`
**Route/URL:** `/leads`

### ⚠️ IMPORTANT: 
**LeadCRM actually LeadDetails.jsx component USE NAHI karta!**

Instead:
- LeadCRM apna **khud ka detail view** build karta hai
- Directly `sections/` folder ke components use karta hai:
  - AboutSection
  - HowToProcessSection
  - LoginFormSection
  - ImportantQuestionsSection
  - ObligationSection
  - Attachments
  - TaskComponent
  - LeadActivity
  etc.

- Jab lead par click karte ho, `selectedLead` state set hota hai
- Phir full page detail view show hota hai (separate component nahi)

---

## Summary Table:

| Component | Uses LeadDetails.jsx? | Route/URL | When Opens |
|-----------|----------------------|-----------|------------|
| **LoginCRM** | ✅ YES | `/login-crm`, `/login` | Lead row click → Modal |
| **LeadCRM** | ❌ NO | `/leads` | Lead row click → Built-in detail view |
| **LazyLeadSections** | ✅ YES (for export) | N/A | Utility file for lazy loading |

---

## LeadDetails.jsx Internal Structure:

Ye component internally **`lead-details/` folder** ke components use karta hai:

1. ✅ AboutSection (`lead-details/AboutSection.jsx`)
2. ✅ AssignmentInfoSection (`lead-details/AssignmentInfoSection.jsx`)
3. ✅ AttachmentsSection (`lead-details/AttachmentsSection.jsx`)
4. ✅ HowToProcessSection (`lead-details/HowToProcessSection.jsx`)
5. ✅ ImportantQuestionsSection (`lead-details/ImportantQuestionsSection.jsx`)
6. ✅ LoginFormSection (`lead-details/LoginFormSection.jsx`)
7. ✅ ObligationsSection (`lead-details/ObligationsSection.jsx`)
8. ✅ OperationsSection (`lead-details/OperationsSection.jsx`)
9. ✅ StatusSection (`lead-details/StatusSection.jsx`)
10. ✅ TasksSection (`lead-details/TasksSection.jsx`)

Plus:
- Activities (`sections/Activities.jsx`)
- Remarks (`sections/Remarks.jsx`)
- RequestReassignmentButton (`sections/RequestReassignmentButton.jsx`)

---

## Conclusion:

### LeadDetails.jsx sirf **LOGIN DEPARTMENT** mein use hota hai!
- Login CRM page (`/login-crm`) par
- Lead click → LeadDetails modal opens
- Uses `lead-details/` folder components

### Lead Department (`/leads`) alag hai:
- LeadCRM apna khud ka view use karta hai
- Uses `sections/` folder components directly
- No separate LeadDetails component
