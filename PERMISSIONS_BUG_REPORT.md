# 🔍 Permission Bugs Report — RupiyaMe CRM
**Date:** 14 April 2026  
**Status:** 3 bugs found & fixed ✅

---

## 📋 Summary (Short)

| # | Bug | Role/File | Severity | Status |
|---|-----|-----------|----------|--------|
| 1 | **TEAM WINNERS TEAM LEADER** — sari leads dikh rahi thi (Super Admin jaise) | Database (Role permissions) | 🔴 Critical | ✅ Fixed |
| 2 | **Login module** — `leads` permissions `login` mein bleed ho rahi thi | `leadLoginRelated.py` | 🟡 Medium | ✅ Fixed |
| 3 | **Status Update button** — PLOD section mein kaam nahi kar raha tha | `LeadCRM.jsx` | 🟡 Medium | ✅ Fixed |

---

## 🐛 Bug 1 — TEAM WINNERS TEAM LEADER: Sari Leads Dikh Rahi Thi

### Problem Kya Tha?
TEAM WINNERS TEAM LEADER role ke user ko **saari leads dikh rahi thi** — bilkul Super Admin ki tarah. Unhe sirf apni team ki ya apni leads dikhni chahiye thi, lekin woh sab ki sab leads dekh sakte the.

### Kyun Hua?
Database mein **TEAM WINNERS TEAM LEADER** role ki `leads` permissions mein **galti se `all` action** add ho gaya tha.

**Database mein purani setting thi:**
```
leads: ['show', 'add', 'reassignment_popup', 'own', 'assign', 'status_update', 'download_obligation', 'ALL']
                                                                                                          ^^^
                                                                                                    YEH GALTI THI
```

**System ki rule:**
> Agar kisi role ki leads permissions mein `all` action hai → wo user **saari leads** dekh sakta hai (kisi ka bhi)

**Sahi setting honi chahiye thi:**
```
leads: ['show', 'add', 'reassignment_popup', 'own', 'assign', 'status_update', 'download_obligation']
                                                      ^^^
                                                 Sirf apni leads
```

### Compare karo — Galat vs Sahi:

| Role | leads actions | Kya dikh raha tha? |
|------|--------------|-------------------|
| TEAM WINNERS TEAM LEADER (purana) | `['own', ..., 'all']` ❌ | Saari leads (Super Admin wali) |
| TEAM ACHIEVERS TEAM LEADER | `['own', ...]` ✅ | Sirf apni + assigned leads |
| TEAM WINNERS MANAGER | `['own', 'junior', ...]` ✅ | Apni + junior team ki leads |

### Fix Kya Kiya?
Database se `all` action ko TEAM WINNERS TEAM LEADER ki leads permissions se **remove kar diya**.

```
BEFORE: leads: ['show', 'add', 'reassignment_popup', 'own', 'assign', 'status_update', 'download_obligation', 'all']
AFTER:  leads: ['show', 'add', 'reassignment_popup', 'own', 'assign', 'status_update', 'download_obligation']
```

### Ab Kya Dikhai Dega?
TEAM WINNERS TEAM LEADER ab sirf yeh leads dekh sakta hai:
- 🟢 Unki khud ki banai leads (`created_by = user_id`)
- 🟢 Jinhe unke naam assign ki hain (`assigned_to = user_id`)
- 🟢 Jisme woh report_to hain (`assign_report_to = user_id`)

❌ Doosri team ke leads NAHI dikhenge
❌ Team Achievers ke leads NAHI dikhenge

---

## 🐛 Bug 2 — Login Module Mein `leads` Permissions Ghus Rahi Thi

### Problem Kya Tha?
Login section (Login Department Leads) mein permission check karte waqt, system **`leads` page ki permissions bhi check kar raha tha** — jo bilkul galat tha.

### Technically Kyun Hua?
`get_hierarchical_permissions()` function mein ek galat logic thi:

```python
# GALAT CODE (purana):
for perm in permissions:
    if perm.get("page") in [module, "leads"]:  # "leads" NAHI check karna chahiye tha!
        if "all" in actions:
            has_all = True
```

**Matlab:** 
- Agar kisi user ki `leads` permissions mein `all` tha
- Toh system login module ke liye bhi `permission_level = "all"` return karta tha
- Yani leads ki permissions login section pe bhi lagu ho rahi thin

### Fix Kya Kiya?
`leadLoginRelated.py` mein function ko correct kiya:

```python
# SAHI CODE (naya):
for perm in permissions:
    if perm.get("page") == module:  # Sirf "login" check karo
        if "all" in actions:
            has_all = True
```

Ab har module ki permissions **sirf apne module** pe apply hongi.

---

## 🐛 Bug 3 — PLOD Section Mein Status Update Button Kaam Nahi Karta Tha

### Problem Kya Tha?
PLOD leads section mein (PL & ODD Leads — `leads.pl_odd_leads` page), Team Leaders ko **status update karne ki permission thi** lekin **Status Change button nahi dikh raha tha** ya disable tha.

### Kyun Hua?
Frontend `LeadCRM.jsx` mein `canUpdateStatus()` function galat action naam check kar raha tha:

```javascript
// GALAT (purana):
if (actions.includes('status_change')) return true;  // ← 'status_change' check karta tha
```

Lekin database mein action ka naam `status_update` tha:
```
leads.pl_odd_leads: ['show', 'own', 'assign', 'status_update']
                                                ^^^^^^^^^^^^
                                           Database mein 'status_UPDATE' hai
```

**Name mismatch:**
- Database mein: `status_update` ✅
- Frontend check: `status_change` ❌ → Match nahi → Permission false → Button hidden

### Fix Kya Kiya?
`LeadCRM.jsx` mein `canUpdateStatus()` function ko dono naam check karne ke liye update kiya:

```javascript
// SAHI (naya):
if (actions.includes('status_change') || actions.includes('status_update')) return true;
```

Ab `status_update` bhi work karega.

---

## 📊 Sab Roles Ki Current Permissions (Review)

### TEAM WINNERS TEAM LEADER (Fixed ✅)
```
leads:           ['show', 'add', 'reassignment_popup', 'own', 'assign', 'status_update', 'download_obligation']
leads.pl_odd:    ['show', 'own', 'assign', 'status_update']
login:           ['show', 'own']
employees:       ['show', 'edit', 'junior']
tasks:           ['show', 'create', 'own', 'junior']
```
**Access level:** Sirf apni leads + assigned leads ✅

### TEAM ACHIEVERS TEAM LEADER ✅
```
leads:           ['show', 'add', 'reassignment_popup', 'own', 'assign', 'status_update', 'download_obligation']
leads.pl_odd:    ['own', 'show', 'assign', 'status_update']
login:           ['show', 'own']
```
**Access level:** Sirf apni leads + assigned leads ✅

### TEAM WINNERS MANAGER ✅
```
leads:           ['show', 'add', 'reassignment_popup', 'own', 'junior', 'assign', 'status_update', 'download_obligation']
leads.pl_odd:    ['show', 'own', 'junior', 'assign', 'status_update']
login:           ['show', 'own', 'channel', 'edit', 'junior']
```
**Access level:** Apni + junior team ki leads ✅

### TEAM ACHIEVERS MANAGER ✅
```
leads:           ['show', 'add', 'reassignment_popup', 'own', 'download_obligation', 'junior', 'status_update']
leads.pl_odd:    ['show', 'own', 'junior', 'status_update']
login:           ['show', 'own', 'junior', 'channel', 'edit']
```
**Access level:** Apni + junior team ki leads ✅

### TEAM WINNERS CONSULTANT ✅
```
leads:           ['show', 'add', 'reassignment_popup', 'own', 'assign', 'status_update']
leads.pl_odd:    ['own', 'show', 'assign', 'status_update']
login:           ['show', 'own']
```
**Access level:** Sirf apni leads ✅

### TEAM ACHIEVERS CONSULTANT ✅
```
leads:           ['show', 'add', 'reassignment_popup', 'own', 'status_update', 'assign']
leads.pl_odd:    ['show', 'own', 'status_update', 'assign']
login:           ['show', 'own']
```
**Access level:** Sirf apni leads ✅

### Super Admin ✅
```
*: * (sab kuch)
```
**Access level:** Sab kuch ✅

---

## 🎯 Permission Levels Explained (Simple)

| Permission Action | Kya Matlab Hai? |
|------------------|----------------|
| `own` | Sirf woh leads jo maine banai hain ya mujhe assign hain |
| `junior` | Meri + mere neeche ki team ki leads (Manager ke liye) |
| `all` | Saari leads (poori company ki) |
| `*` | Super Admin — sab kuch |
| `show` | Section/Page dikh sakta hai |
| `add` | Naya lead bana sakta hai |
| `assign` | Lead assign kar sakta hai |
| `status_update` | Status change kar sakta hai |
| `download_obligation` | Obligation download kar sakta hai |
| `edit` | Login form edit kar sakta hai |
| `channel` | Channel dekh sakta hai |
| `delete` | Delete kar sakta hai |

---

## ⚠️ Important Notes — Future Ke Liye

1. **`all` action kabhi bhi accidentally add na ho** — Isse poori company ki leads visible ho jaati hain. Sirf Super Admin ya Manager level roles ko `all` milni chahiye.

2. **`leads` aur `login` ke permissions alag hain** — Leads mein `all` dene se Login section bhi affect hota tha (Bug 2). Ab fix ho gaya hai.

3. **Permission action names consistent rakho:**
   - Database: `status_update` ← Yahi sahi hai
   - Frontend mein ab dono check hote hain (`status_update` + `status_change`)

4. **Jab bhi role banao ya edit karo** — Settings → Roles mein jaake double-check karo ki `all` permission galat role ko na mili ho.

---

## 🔧 Files Changed

1. **Database** → TEAM WINNERS TEAM LEADER role ki `leads` permissions updated
2. **`/backend/app/routes/leadLoginRelated.py`** → `get_hierarchical_permissions()` fixed
3. **`/rupiyamaker-UI/crm/src/components/LeadCRM.jsx`** → `canUpdateStatus()` fixed

---
*Report generated: 14 April 2026*
