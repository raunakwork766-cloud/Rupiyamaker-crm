# PL & OD Login CRM — Full Bug Report & Fix Guide
**Date**: 15 April 2026  
**Module**: Login CRM → PL & OD Section  
**Prepared by**: Audit Analysis  
**Target**: Developer ke liye — Har problem clearly explain karke likha gaya hai

---

> **Important Note for Developer:**  
> Yeh sab issues main files mein hain:  
> - `rupiyamaker-UI/crm/src/components/LoginCRM.jsx` (main file — 7499 lines)  
> - `rupiyamaker-UI/crm/src/components/sections/ObligationSection.jsx` (8656 lines)  
> - `rupiyamaker-UI/crm/src/components/sections/HowToProcessSection.jsx`  
> - `rupiyamaker-UI/crm/src/components/sections/AboutSection.jsx`  
> - `rupiyamaker-UI/crm/src/components/sections/LoginFormSection.jsx`  
> - `rupiyamaker-UI/crm/src/components/sections/ImportantQuestionsSection.jsx`  
> - `rupiyamaker-UI/crm/src/components/sections/TaskSectionInLead.jsx`  
> - `rupiyamaker-UI/crm/src/components/Remark.jsx`  
> - `backend/app/routes/leadLoginRelated.py`  
> - `backend/app/database/LoginLeads.py`

---

## 🔴 CATEGORY A — CRITICAL BUGS (Pehle Fix Karo — User Ko Directly Dikhai Deta Hai)

---

### Problem 1 — Filters Table Pe Apply Nahi Hote

**Simple Explanation:**  
User jab filter popup open karta hai aur koi filter lagata hai (jaise "Team Name = XYZ" ya "Income Range = 50,000–1,00,000"), toh upar ke status cards (Active Login, Approved, Disbursed, etc.) ka count toh sahi change hota hai — lekin neeche ki table mein wahi purana data rehta hai, filter koi effect nahi karta. Matlab user sochta hai filter lag gaya lekin table mein sab kuch wahi dikhta rehta hai.

**Technical Reason:**  
`LoginCRM.jsx` mein do jagah filtering logic hai:
1. `memoizedStatusCounts` (line ~1284) — ismein sare filters apply hain
2. `filteredLeadsData` (line ~2589) — **ismein sirf 4 filters hain**: loanType, status, searchTerm, assignedTL

Yeh 10 filters `filteredLeadsData` mein **missing** hain:
- Team Name
- Created By
- Campaign Name
- Login Department (assigned person)
- Channel Name
- Income Range (From/To)
- Disbursement Date (From/To)
- File Sent to Login (checkbox)
- Multiple Status Select (`selectedStatuses` array)
- Duplicate Check

**Fix:**  
`filteredLeadsData` useMemo mein wahi poora filter logic copy karo jo `memoizedStatusCounts` mein likha hai. Dono jagah same filtering honi chahiye.

**Files:**  
`LoginCRM.jsx` — Line ~2589 ka `filteredLeadsData` useMemo block fix karo

---

### Problem 2 — Status Card Click Karne Se Table Filter Nahi Hota

**Simple Explanation:**  
Upar ke 5 colored cards hain — "Active Login", "Approved", "Disbursed", "Lost by Mistake", "Lost Login". Agar user "Active Login" card pe click kare, toh expect karta hai ki table mein sirf Active Login leads dikhein. Lekin aisa hota nahi — ek popup modal khulta hai, table same rehta hai.

**Technical Reason:**  
Card click handler sirf `setActiveCardModal(key)` karta hai jo ek breakdown popup kholta hai. `setSelectedStatus(key)` call nahi hота, toh table filter nahi hota.

**Fix:**  
Card `onClick` function mein `setSelectedStatus(key)` bhi add karo taaki table filter ho jaye. Ya ek option do — "Apply Filter" button card modal mein.

**Files:**  
`LoginCRM.jsx` — Line ~5188 ka status card click handler

---

### Problem 3 — Obligation Data 5 Jagah Save Hota Hai (Data Inconsistency)

**Simple Explanation:**  
Jab user Obligation tab mein kuch save karta hai (jaise salary, loan required, CIBIL score), yeh data database mein ek hi jagah nahi jaata — 5 alag jagah split ho jaata hai. Agar ek jagah update ho aur doosri jagah purani value rahe, toh kabhi kabhi galat data dikhega ya ek field save hoga doosra nahi.

**Technical Reason (Backend):**  
`leadLoginRelated.py` mein obligations data in 5 locations pe store hota hai:
```
lead.dynamic_fields.obligation_data       ← Main location
lead.dynamic_fields.obligations           ← Duplicate 1
lead.dynamic_fields.financial_details.*   ← Salary/CIBIL duplicate
lead.dynamic_fields.personal_details.*    ← Company name duplicate
lead.salary / lead.cibil_score           ← Top-level duplicate
```

**Fix:**  
Ek single canonical location decide karo (recommended: `dynamic_fields.obligation_data`). Purana data wahan migrate karo. GET endpoint mein sirf wahan se padhna, POST endpoint mein sirf wahan likhna. Backend mein data normalization function banana padega.

**Files:**  
`backend/app/routes/leadLoginRelated.py` — Line ~950–975  
`backend/app/database/LoginLeads.py` — Line ~40, 480

---

### Problem 4 — Obligation Delete + Auto-Save Race Condition

**Simple Explanation:**  
User jab obligation table mein ek row delete karta hai, toh code automatically save karta hai. Lekin background mein auto-save timer bhi chal raha hota hai. Dono ek saath save karne ki koshish karte hain — kabhi kabhi deleted row wapas aa jaata hai ya data overwrite ho jaata hai.

**Technical Reason:**  
`ObligationSection.jsx` mein `handleDeleteObligation` function `handleSaveObligations()` call karta hai. Lekin saath mein `autoSaveTimeoutRef` bhi fire hone wala hota hai. Dono competing saves create karte hain.

**Fix:**  
`handleDeleteObligation` mein pehle `clearTimeout(autoSaveTimeoutRef.current)` call karo, phir manual save karo. Auto-save timer ko delete ke time clear karna zaroori hai.

**Files:**  
`ObligationSection.jsx` — Line ~4343–4550

---

## 🟠 CATEGORY B — HIGH SEVERITY BUGS (Important — Functionality Affect Karta Hai)

---

### Problem 5 — Backend API Ko Filters Pass Nahi Hote (Pagination Break)

**Simple Explanation:**  
Jab leads load hoti hain, frontend sirf 3 cheezein backend ko bolta hai: user_id, status, loan_type. Baaki sare filters (team, income, date, etc.) sirf frontend pe apply hote hain. Iska problem yeh hai ki jab "Load More" karo ya pagination ho, backend ko pata hi nahi ki filtered data chahiye — woh sab leads bhej deta hai aur pagination galat ho jaata hai.

**Technical Reason:**  
`fetchLoginDepartmentLeads` function (LoginCRM.jsx ~line 2084) sirf yeh params bhejta hai:
```
?user_id=...&status_filter=...&loan_type=...&no_activity_date=...
```
Baaki parameters (teamName, createdBy, campaignName, channelName, incomeRange, disbursementDate) API call mein include hi nahi hain.

**Fix:**  
Ya toh:
1. Sare filter params API call mein add karo aur backend mein server-side filtering implement karo, **ya**
2. Sab 1000 leads ek baar mein load karo aur sirf frontend filtering use karo (current approach) — lekin iske liye pagination theek karo

**Files:**  
`LoginCRM.jsx` — `fetchLoginDepartmentLeads` function (~line 2084)  
`backend/app/routes/leadLoginRelated.py` — `GET /login-department-leads` (~line 2150)

---

### Problem 6 — Search Counter vs Table Mismatch (300ms Delay Issue)

**Simple Explanation:**  
Upar jab search karo, status cards pe count update hota hai, aur table mein bhi filter hota hai. Lekin dono mein alag timing hai — table thodi der se update hota hai. Typing ke dauraan dono alag results dikhate hain, confusing lagta hai.

**Technical Reason:**  
- `filteredLeadsData` uses `debouncedSearchTerm` (300ms delay — correct)
- `memoizedStatusCounts` uses `searchTerm` (no delay — raw value)

Dono ko ek hi variable use karna chahiye.

**Fix:**  
`memoizedStatusCounts` mein bhi `debouncedSearchTerm` use karo, `searchTerm` nahi.

**Files:**  
`LoginCRM.jsx` — Line ~1295 (`memoizedStatusCounts` ka search logic)

---

### Problem 7 — Backend Mein Request Validation Nahi (Security Risk)

**Simple Explanation:**  
Jab lead update hoti hai, server koi bhi field accept kar leta hai bina check kiye. Iska matlab koi bhi user API se directly `is_super_admin: true` ya `role_id: XYZ` jaise privileged fields inject kar sakta hai.

**Technical Reason:**  
`PUT /login-leads/{id}` endpoint raw `Dict[str, Any]` accept karta hai without Pydantic schema validation. Koi protected fields list bhi nahi hai.

**Fix:**  
Ek Pydantic `LoginLeadUpdateRequest` model banao with only allowed fields. Protected fields (`created_at`, `original_lead_id`, `login_created_by`, `role_id`, etc.) ko explicitly block karo.

**Files:**  
`backend/app/routes/leadLoginRelated.py` — Line ~739  
`backend/app/database/LoginLeads.py` — Line ~143

---

### Problem 8 — `useEffect` Dependencies Incomplete (Stale Data Bug)

**Simple Explanation:**  
Obligation section mein jab data load ya sync hota hai, React ki dependency list incomplete hai. Iska matlab hai ki kabhi kabhi purani values se calculate hota hai, ya deleted rows wapas aa jaati hain page refresh jaisi feel ke bina.

**Technical Reason:**  
`ObligationSection.jsx` line ~2330 ka `useEffect`:
```js
}, [JSON.stringify(leadData?.dynamic_fields?.obligations), hasUnsavedChanges]);
// MISSING: obligations, hasDeletedRow
```
`obligations` aur `hasDeletedRow` dependency array mein nahi hain.

**Fix:**  
```js
}, [JSON.stringify(leadData?.dynamic_fields?.obligations), hasUnsavedChanges, hasDeletedRow]);
```

**Files:**  
`ObligationSection.jsx` — Line ~2330

---

### Problem 9 — CIBIL Score Value Validation Missing

**Simple Explanation:**  
CIBIL score input field mein sirf numbers hi allow hain, lekin range check nahi hai. User 1 bhi enter kar sakta hai ya 9999 bhi. CIBIL score hamesha 300 se 900 ke beech hona chahiye.

**Technical Reason:**  
`ObligationSection.jsx` mein CIBIL input handler sirf `/[^0-9]/g` strip karta hai, koi min/max validation nahi hai. Na display mein error message aata hai.

**Fix:**  
```js
if (raw < 300 || raw > 900) {
  setErrors(prev => ({...prev, cibilScore: "CIBIL score 300–900 ke beech hona chahiye"}));
}
```

**Files:**  
`ObligationSection.jsx` — CIBIL Score input handler (~line 6870)

---

### Problem 10 — Task Section: Login Lead Detection Weak

**Simple Explanation:**  
Task banane ya fetch karne ke waqt, code yeh check karta hai ki yeh "login lead" hai ya regular lead. Lekin check bahut basic hai — agar `original_lead_id` field nahi hogi (jo kuch older leads mein nahi hoti), toh galat endpoint use ho jaayega aur tasks load nahi honge.

**Technical Reason:**  
`TaskSectionInLead.jsx` line ~210:
```js
const isLoginLead = !!lead?.original_lead_id; // Only checks this
```
Lekin login leads ke paas `login_created_at` bhi hota hai. Dono check karne chahiye.

**Fix:**  
```js
const isLoginLead = !!lead?.original_lead_id || !!lead?.login_created_at || 
                    localStorage.getItem('userDepartment') === 'login';
```

**Files:**  
`TaskSectionInLead.jsx` — Line ~210

---

### Problem 11 — Remark Save Karne Pe Field Name Mismatch

**Simple Explanation:**  
Jab remark save hota hai, frontend `created_by` field bhejta hai lekin backend `creator_name` expect karta hai. Iska result yeh hota hai ki remark save toh hota hai lekin kabhi kabhi creator ka naam sahi nahi dikhta.

**Technical Reason:**  
`Remark.jsx` line ~108–112:
```js
// Bhejta hai:
{ note: noteText, created_by: userId }
// Backend expect karta hai:
{ note: noteText, creator_name: userName }
```

**Fix:**  
Either frontend mein dono fields bhejo:
```js
{ note: noteText, created_by: userId, creator_name: userName }
```
Ya backend mein dono accept karo.

**Files:**  
`Remark.jsx` — Line ~108–112  
`backend/app/routes/leadLoginRelated.py` — Notes endpoint

---

### Problem 12 — Co-Applicant Mobile Number Pre-fill Nahi Hota

**Simple Explanation:**  
Jab applicant form open hota hai, main applicant ka phone number auto-fill ho jaata hai. Lekin co-applicant form mein mobile field blank hi rehta hai even if data already saved hai.

**Technical Reason:**  
`LoginFormSection.jsx` line ~930–960 mein co-applicant ke liye `mobileNumber` prop pass hota hai lekin component ke andar us prop se field initialize nahi hoti. Default value empty string hai aur existing value se override nahi hoti.

**Fix:**  
Co-applicant form ka initial state properly `leadData.dynamic_fields.co_applicant_form.mobile_number` se set karo.

**Files:**  
`LoginFormSection.jsx` — Line ~930–960

---

## 🟡 CATEGORY C — MEDIUM ISSUES (UX Problems & Minor Bugs)

---

### Problem 13 — "Login Age Filter" Dead Code (Kaam Hi Nahi Karta)

**Simple Explanation:**  
Filter popup mein "Login Age Range" (Days) ka ek section dikhta hai jahan From aur To enter kar sako. User values dalega, kuch nahi hoga — filter apply hi nahi hoga. Yeh UI waste hai.

**Technical Reason:**  
Filter UI toh render hota hai lekin:
- Values `filterOptions` state mein store nahi hoti
- Filtering logic exist hi nahi karta
- Clear button ka `onClick` nahi hai

**Fix:**  
Ya toh yeh UI hata do, ya properly implement karo:
```js
filterOptions: { loginAgeFrom: '', loginAgeTo: '' }
```
Aur `filteredLeadsData` mein `lead.login_date` se days calculate karke filter lagao.

**Files:**  
`LoginCRM.jsx` — Line ~6803–6821

---

### Problem 14 — Disbursement Date Filter Accessible Nahi Hai

**Simple Explanation:**  
Disbursement date se filter karne ka logic code mein likha hua hai, lekin filter popup mein koi button ya section nahi hai jisse user wahan pahunch sake. Feature exist karta hai lekin user use kar hi nahi sakta.

**Technical Reason:**  
`memoizedStatusCounts` mein disbursement date filtering logic hai (~line 1391) lekin filter modal rendering `selectedFilterCategory === 'disbursementDate'` condition pe hai. Filter modal mein left sidebar mein koi button hi nahi hai is category ka.

**Fix:**  
Filter popup ke left sidebar mein "Disbursement Date" category button add karo, ya `leadDate` section ke andar hi disbursement date inputs shift karo.

**Files:**  
`LoginCRM.jsx` — Line ~6175 (filter category buttons), ~7328 (UI section)

---

### Problem 15 — Campaign Name Filter: Array vs Single Value Mismatch

**Simple Explanation:**  
Campaign filter expect karta hai multiple campaigns select ho sakein (array), lekin UI mein radio buttons hain jahan sirf ek select ho sakta hai. Dono mismatch hain, ek theek karna padega.

**Technical Reason:**  
```js
// State declaration (line ~1170):
campaignName: []  // Array — multiple selection

// UI (line ~6950):
<Radio.Group> // Single selection only
```

**Fix:**  
Ya toh UI ko `Checkbox.Group` pe change karo (multiple select allow karo), ya state ko single string kar do — dono consistent hone chahiye.

**Files:**  
`LoginCRM.jsx` — Line ~1170 (state), ~6950 (UI)

---

### Problem 16 — Duplicate Date Fields Cause Confusion

**Simple Explanation:**  
Code mein date filter ke liye do sets of variables hain:
- `dateFrom` / `dateTo` — yeh actual filtering mein use hota hai
- `leadDateFrom` / `leadDateTo` — yeh declare hai lekin kahi use nahi hota

Ek developer confuse ho sakta hai kaun sa use karna hai.

**Technical Reason:**  
`filterOptions` state mein (line ~1149–1159):
```js
dateFrom: '',         // ← Used in filtering
dateTo: '',           // ← Used in filtering
leadDateFrom: '',     // ← NEVER USED anywhere
leadDateTo: '',       // ← NEVER USED anywhere
```

**Fix:**  
`leadDateFrom` aur `leadDateTo` ko hata do, sirf `dateFrom`/`dateTo` rakho. Ya agar plan hai alag date types ke liye alag filters, toh properly implement karo.

**Files:**  
`LoginCRM.jsx` — Line ~1149–1159

---

### Problem 17 — Clear All Filters Button Theek Se Kaam Nahi Karta

**Simple Explanation:**  
Filter popup mein "Clear All" button hai. Click karne pe filters clear ho jaate hain lekin:
1. Popup band nahi hota (manual X click karna padta hai)
2. Main search bar nahi clear hoti
3. Koi feedback nahi milta (success message wagera)

**Fix:**  
Clear all button ke onClick mein:
```js
setFilterOptions(defaultFilterOptions); // existing
setSearchTerm('');           // Yeh missing hai
setShowFilterPopup(false);   // Yeh bhi missing hai
message.success('Filters cleared!'); // Feedback
```

**Files:**  
`LoginCRM.jsx` — Line ~7389

---

### Problem 18 — Obligation: Company Category Save Mein Inconsistency

**Simple Explanation:**  
Company category field kabhi string ke roop mein save hoti hai, kabhi array, kabhi `{label, value}` object. Jab wapas load karte hain toh different format aata hai different times. Data inconsistent rehta hai.

**Technical Reason:**  
`ObligationSection.jsx` line ~1670 pe extract hoti hai as array. Lekin save ke waqt complex IIFE use hoti hai (~line 3000–3025) jo har element ko check karke format convert karta hai. Backend bhi different format store karta hai.

**Fix:**  
Ek standard format decide karo: recommend hai `string[]` (array of strings, e.g., `["Salaried", "Private Limited"]`). Load aur save dono jagah same format enforce karo.

**Files:**  
`ObligationSection.jsx` — Line ~1670 (load), ~3000 (save)

---

### Problem 19 — Obligation Total Calculation Stale Ho Sakta Hai

**Simple Explanation:**  
Total obligation amount ek alag `useEffect` se calculate hota hai. Lekin jब obligation save hota hai (save function mein), total obligation ki value bhi use ho sakti hai jo abhi update nahi hui ho (old value). Iske wajah se save mein galat total ja sakta hai.

**Technical Reason:**  
`IntentionalExclusion` comment bhi hai code mein (~line 3687):
```js
// "totalBtPos, totalObligation intentionally excluded from unsaved changes"
```
Lekin save function isliye stale `totalObligation` use kar sakta hai.

**Fix:**  
Save ke time `totalObligation` ko state se nahi, balki `obligations` array se fresh calculate karo:
```js
const calculatedTotal = obligations.reduce((sum, o) => sum + parseINR(o.emi), 0);
```

**Files:**  
`ObligationSection.jsx` — `prepareObligationDataForSave` function (~line 2931)

---

### Problem 20 — Operations Fields: Amount Mein Text Save Ho Sakta Hai

**Simple Explanation:**  
Disbursed Amount, Approved Amount jaise fields mein user "abc" likhe toh bhi save ho jaayega. Backend koi check nahi karta ki value number hai ya nahi.

**Technical Reason:**  
`backend/app/routes/leadLoginRelated.py` — `PATCH /update-operations/{id}` (~line 2468) mein fields accept hote hain without type validation. Pydantic model use nahi hai.

**Fix:**  
```python
class OperationsUpdate(BaseModel):
    amount_approved: Optional[float] = None
    amount_disbursed: Optional[float] = None
    disbursement_date: Optional[str] = None  # + ISO format validation
```

**Files:**  
`backend/app/routes/leadLoginRelated.py` — ~Line 2442–2490

---

### Problem 21 — Status Aur Sub-Status Atomic Update Nahi Hote

**Simple Explanation:**  
Jab status change hoti hai, sub-status separately update hoti hai. Agar pehla save ho jaaye aur doosra fail ho, toh lead ka status inconsistent ho jaata hai — jaise `status = "Approved"` lekin `sub_status = null` ya kuch purana jo match nahi karta.

**Technical Reason:**  
`PUT /login-leads/{id}` endpoint ek field at a time update karta hai. Status aur sub_status ke liye alag separate calls ho sakti hain without transaction.

**Fix:**  
Status change ke time dono ko ek hi payload mein saath bhejo:
```js
{ status: newStatus, sub_status: newSubStatus }
```
Backend mein bhi ek transaction ensure karo — agar ek fail ho toh doosra bhi rollback ho.

**Files:**  
`LoginCRM.jsx` — Status update calls  
`backend/app/routes/leadLoginRelated.py` — ~Line 739–800

---

### Problem 22 — Backend: N+1 Query Problem (Performance Issue)

**Simple Explanation:**  
Jab "No Activity Date" filter lagaya jaata hai, backend pehle 1000 leads fetch karta hai, phir **har lead ke liye alag alag** database call karta hai — yani 1000 leads = 1000+ queries. Yeh server ko slow kar deta hai aur page hang ho sakta hai.

**Technical Reason:**  
`backend/app/routes/leadLoginRelated.py` line ~2276–2323 mein `no_activity_date` filter ke liye loop mein `get_lead_activities()` call hota hai for each lead individually.

**Fix:**  
MongoDB aggregation pipeline use karo ya ek single query mein sab leads ki last activity fetch karo, then in-memory filter karo:
```python
# Bad (current):
for lead in all_leads:
    activities = await get_lead_activities(lead['_id'])  # 1000 queries!

# Good:
pipeline = [{"$lookup": {"from": "login_lead_activities", ...}}]
```

**Files:**  
`backend/app/routes/leadLoginRelated.py` — Line ~2276–2323

---

### Problem 23 — Document Upload Mein File Type Validation Nahi

**Simple Explanation:**  
Document upload karte waqt koi bhi file type upload ki ja sakti hai — .exe, .sh, .php wagera. Agar web server media folder se serve kare toh yeh dangerous hai.

**Technical Reason:**  
`backend/app/routes/leadLoginRelated.py` line ~1293 pe file type check nahi hai. Frontend bhi restrict nahi karta properly.

**Fix:**  
Backend mein allowed types whitelist karo:
```python
ALLOWED_TYPES = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'}
file_ext = Path(file.filename).suffix.lower()
if file_ext not in ALLOWED_TYPES:
    raise HTTPException(400, "File type not allowed")
```

**Files:**  
`backend/app/routes/leadLoginRelated.py` — Document upload endpoint (~line 1269)

---

### Problem 24 — Document Password Plaintext Store Hota Hai

**Simple Explanation:**  
Agar koi PDF password protected upload karta hai, toh woh password MongoDB mein seedha (plaintext) store ho jaata hai. Koi bhi database access wala yeh password padh sakta hai — yeh security risk hai.

**Technical Reason:**  
`backend/app/routes/leadLoginRelated.py` line ~1328:
```python
"password": _stored_password  # Plaintext MongoDB mein!
```

**Fix:**  
Password ko store mat karo. Ya agar zaroori hai, toh encrypt karke store karo (AES-256). Yeh PDF password decrypt ke liye zaroorat se zyada sensitive data hai.

**Files:**  
`backend/app/routes/leadLoginRelated.py` — Line ~1304–1330

---

### Problem 25 — Record-Level Permission Check Missing (Security Gap)

**Simple Explanation:**  
Backend sirf yeh check karta hai ki user ke paas "login" module ka permission hai ya nahi. Lekin yeh nahi check karta ki jo specific lead open ki hai woh "apni" hai, "junior ki" hai ya "sab ki". Koi bhi user sirf apne leads dekh sakte hone ke bawajood doosron ke leads access kar sakta hai agar usse page permission hai.

**Technical Reason:**  
Har endpoint (line ~725, 810, 1096, etc.) sirf page-level check karta hai:
```python
await check_permission(user_id, ["leads", "login"], "show", ...)
```
Record-level `own/junior/all` hierarchy enforce nahi hoti.

**Fix:**  
Lead fetch karte waqt permission level check karo:
- `own` → sirf apni leads
- `junior` → apni + subordinates ki leads
- `all` → sab leads

**Files:**  
`backend/app/routes/leadLoginRelated.py` — All GET/PUT/DELETE endpoints

---

## 📋 CATEGORY D — CODE QUALITY ISSUES (Technical Debt)

---

### Problem 26 — 100+ Console.log Statements Production Code Mein

**Simple Explanation:**  
`ObligationSection.jsx` mein 100 se zyada `console.log` statements hain. Production mein yeh slow kar deta hai, browser console spam ho jaata hai, aur sensitive data log ho sakta hai.

**Fix:**  
Sab debug console.log remove karo ya conditional karo:
```js
if (process.env.NODE_ENV === 'development') {
  console.log(...);
}
```

**Files:**  
`ObligationSection.jsx` — Throughout

---

### Problem 27 — Magic Numbers Use Hue Hain (No Constants)

**Simple Explanation:**  
Code mein random numbers scattered hain jaise `0.04`, `48`, `60`, `300`, `500` — koi explain nahi karta yeh kya hain. Doosra developer confuse ho jaata hai.

**Examples:**
```js
const emiAmount = outstandingAmount * 0.04; // 4% — but why? Credit card EMI formula
// ObligationSection.jsx
const delay = 300; // Milliseconds — debounce delay
```

**Fix:**  
Sab magic numbers ko named constants banao at the top of the file:
```js
const CREDIT_CARD_EMI_RATE = 0.04;  // 4% of outstanding
const AUTO_SAVE_DEBOUNCE_MS = 300;
const MIN_CIBIL_SCORE = 300;
const MAX_CIBIL_SCORE = 900;
```

**Files:**  
`ObligationSection.jsx` — Throughout

---

### Problem 28 — useMemo Dependency Arrays Incomplete

**Simple Explanation:**  
React mein `useMemo` aur `useEffect` ke aakhir mein dependency array likhte hain — yeh React ko batata hai kab recalculate karna hai. Kuch jagah yeh array incomplete hai, matlab stale ya outdated data dikha sakta hai.

**Technical Reason:**  
`filteredLeadsData` dependencies (line ~2754):
```js
}, [leads, selectedLoanType, selectedStatus, debouncedSearchTerm, filterOptions, filterRevision, employees]);
// MISSING: allEmployees, teams, allStatuses
```

**Fix:**  
Jo bhi variables use hote hain useMemo/useEffect ke andar, sab dependency array mein hone chahiye. React's `eslint-plugin-react-hooks` use karo automatic detection ke liye.

**Files:**  
`LoginCRM.jsx` — Lines ~2754, ~1513

---

### Problem 29 — ObjectId Conversion Incomplete (Nested Fields)

**Simple Explanation:**  
Backend jab MongoDB ka data bhejta hai, IDs convert hoti hain strings mein. Yeh top-level fields ke liye hota hai. Lekin `dynamic_fields` ke andar nested IDs sometimes ObjectId format mein reh jaati hain, jo frontend parse nahi kar pata.

**Technical Reason:**  
`convert_object_id()` helper sirf top-level fields pe chalti hai. Nested arrays of documents (jaise obligation rows, activities) ke andar IDs miss ho jaati hain.

**Fix:**  
Recursive ObjectId conversion function use karo:
```python
def deep_convert_object_ids(obj):
    if isinstance(obj, dict):
        return {k: deep_convert_object_ids(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [deep_convert_object_ids(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    return obj
```

**Files:**  
`backend/app/database/LoginLeads.py` — `get_login_lead` aur related functions

---

## 🔧 QUICK REFERENCE — Fix Priority Table

| # | Problem | Severity | File | Estimated Effort |
|---|---------|----------|------|-----------------|
| 1 | Filters table pe apply nahi hote | 🔴 Critical | LoginCRM.jsx ~2589 | 2–3 hours |
| 2 | Status card click pe table filter nahi | 🔴 Critical | LoginCRM.jsx ~5188 | 30 min |
| 3 | Obligation data 5 jagah store | 🔴 Critical | leadLoginRelated.py ~950 | 4–6 hours |
| 4 | Delete + auto-save race condition | 🔴 Critical | ObligationSection.jsx ~4343 | 1 hour |
| 5 | Backend ko filters pass nahi hote | 🟠 High | LoginCRM.jsx ~2084 | 2 hours |
| 6 | Search counter vs table mismatch | 🟠 High | LoginCRM.jsx ~1295 | 15 min |
| 7 | Backend request validation missing | 🟠 High | leadLoginRelated.py ~739 | 2 hours |
| 8 | useEffect dependencies incomplete | 🟠 High | ObligationSection.jsx ~2330 | 30 min |
| 9 | CIBIL score no range validation | 🟠 High | ObligationSection.jsx ~6870 | 30 min |
| 10 | Task section login lead detection | 🟠 High | TaskSectionInLead.jsx ~210 | 30 min |
| 11 | Remark field name mismatch | 🟠 High | Remark.jsx ~108 | 15 min |
| 12 | Co-applicant mobile not prefilled | 🟠 High | LoginFormSection.jsx ~930 | 1 hour |
| 13 | Login Age filter dead code | 🟡 Medium | LoginCRM.jsx ~6803 | 1 hour |
| 14 | Disbursement date filter inaccessible | 🟡 Medium | LoginCRM.jsx ~6175 | 30 min |
| 15 | Campaign name type mismatch | 🟡 Medium | LoginCRM.jsx ~1170 | 30 min |
| 16 | Duplicate date field variables | 🟡 Medium | LoginCRM.jsx ~1149 | 15 min |
| 17 | Clear filters button incomplete | 🟡 Medium | LoginCRM.jsx ~7389 | 15 min |
| 18 | Company category inconsistent format | 🟡 Medium | ObligationSection.jsx ~1670 | 1 hour |
| 19 | Obligation total stale in save | 🟡 Medium | ObligationSection.jsx ~2931 | 30 min |
| 20 | Operations amount no type validation | 🟡 Medium | leadLoginRelated.py ~2442 | 1 hour |
| 21 | Status + sub_status not atomic | 🟡 Medium | leadLoginRelated.py ~739 | 1 hour |
| 22 | N+1 query for no_activity filter | 🟡 Medium | leadLoginRelated.py ~2276 | 2 hours |
| 23 | File upload no type check | 🟡 Medium | leadLoginRelated.py ~1269 | 30 min |
| 24 | PDF password stored plaintext | 🟡 Medium | leadLoginRelated.py ~1328 | 1 hour |
| 25 | Record-level permissions missing | 🟡 Medium | leadLoginRelated.py ~725 | 3–4 hours |
| 26 | 100+ console.log in production | 🟢 Low | ObligationSection.jsx | 1 hour |
| 27 | Magic numbers no constants | 🟢 Low | ObligationSection.jsx | 1 hour |
| 28 | useMemo deps incomplete | 🟢 Low | LoginCRM.jsx ~2754 | 30 min |
| 29 | ObjectId nested conversion | 🟢 Low | LoginLeads.py | 1 hour |

---

## ✅ Test Checklist — Fix Ke Baad Verify Karna

Developer ko fix ke baad yeh sab check karna hai:

- [ ] Filter popup mein Team Name filter lagane ke baad table mein sirf woh leads dikhein
- [ ] Filter popup mein Income Range lagane ke baad table sahi se filter ho
- [ ] Status card "Active Login" click karne pe table filter ho
- [ ] Obligation tab mein row delete karne ke baad data wapas nahi aaye
- [ ] Obligation save karne ke baad page refresh pe wahi data dikhe
- [ ] Remark add karne pe creator ka naam sahi dikhe
- [ ] Task banane pe login lead ka task sahi endpoint pe jaye
- [ ] Co-applicant form mein mobile number pre-fill ho
- [ ] CIBIL score mein 300 se kam ya 900 se zyada enter karne pe error aaye
- [ ] Document upload mein .exe file reject ho
- [ ] "Clear All Filters" click karne pe popup band ho aur search bar bhi clear ho
- [ ] "Load More" button click pe sahi filtered leads aayein

---

*Report End — Total 29 Issues Found*  
*Critical: 4 | High: 8 | Medium: 13 | Low: 4*
