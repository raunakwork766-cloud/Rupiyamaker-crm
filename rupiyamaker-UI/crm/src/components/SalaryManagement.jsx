/**
 * SalaryManagement.jsx
 * Exact React port of the HTML salary spreadsheet.
 * Light theme · Super Admin only · Standalone page (/hr-salary)
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { isSuperAdmin, getUserPermissions } from '../utils/permissions';
import { formatIndianCurrency } from './common/CurrencyInput';

// ─── constants ────────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const API = '/api';

// ─── helpers ──────────────────────────────────────────────────────────────────
const num  = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const fmt  = n => n == null ? '' : Number(n).toLocaleString('en-IN');
const inr  = n => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const mkid = () => Math.random().toString(36).slice(2, 9);
const now  = new Date();
const DEFAULT_SALARY_START_MONTH = { year: now.getFullYear(), month: 4 }; // May (0-based)
const isValidStartMonth = (v) => (
  !!v && Number.isInteger(v.year) && Number.isInteger(v.month) && v.month >= 0 && v.month <= 11
);
const periodSerial = (y, m) => (y * 12) + m;
const isBeforeSalaryStart = (y, m, start) => (
  isValidStartMonth(start) ? periodSerial(y, m) < periodSerial(start.year, start.month) : false
);
const isRecordOnOrAfterStart = (recYear, recMonth, start) => (
  !isBeforeSalaryStart(recYear, recMonth, start)
);
const isEarnedLeaveType = (leaveType) => {
  const t = String(leaveType || '').toLowerCase();
  return t.includes('earned') || t === 'el' || t.includes('earned_leave');
};
const formatAttendanceDays = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
};
const getISTDateParts = () => {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(new Date());
  const get = type => Number(parts.find(p => p.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day') };
};
const getEffectiveAttendanceWindow = (year, month, daysInMonth, joiningRaw, inactiveRaw) => {
  const today = getISTDateParts();
  let startDay = 1;
  let endDay = daysInMonth;

  if (year > today.year || (year === today.year && month > today.month)) {
    endDay = 0;
  } else if (year === today.year && month === today.month) {
    endDay = Math.min(daysInMonth, today.day);
  }

  if (joiningRaw) {
    const jStr = String(joiningRaw).substring(0, 10);
    const jYear  = parseInt(jStr.substring(0, 4), 10);
    const jMonth = parseInt(jStr.substring(5, 7), 10);
    const jDay   = parseInt(jStr.substring(8, 10), 10);
    if (jYear === year && jMonth === month && jDay > 1) startDay = Math.max(startDay, jDay);
  }

  if (inactiveRaw) {
    const iStr = String(inactiveRaw).substring(0, 10);
    const iYear  = parseInt(iStr.substring(0, 4), 10);
    const iMonth = parseInt(iStr.substring(5, 7), 10);
    const iDay   = parseInt(iStr.substring(8, 10), 10);
    if (iYear === year && iMonth === month && iDay >= 1) endDay = Math.min(endDay, iDay);
  }

  return { startDay, endDay, effectiveDays: Math.max(0, endDay - startDay + 1) };
};
const displayText = (value, fallback = '') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    return displayText(
      value.name ?? value.role_name ?? value.department_name ?? value.designation_name ??
      value.title ?? value.label ?? value.value ?? value.message ?? value.description,
      fallback
    );
  }
  return fallback;
};
const refId = value => {
  if (value && typeof value === 'object') return value._id || value.id || value.value || '';
  return value || '';
};
const teamName = (emp, deptMap = {}, fallback = '—') =>
  displayText(deptMap[refId(emp?.department_id)] || emp?.department_name || emp?.department, fallback);

const getUid = () =>
  localStorage.getItem('userId') ||
  localStorage.getItem('user_id') ||
  (() => { try { const ud = JSON.parse(localStorage.getItem('userData') || '{}'); return ud.user_id || ud._id || null; } catch { return null; } })();

const loadJ = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const saveJ = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const LS = {
  HISTORY:   'sal_history',   // { empId: [{month,year,target,achieved,indi,team,finalSalary,paidOn}] }
  PROCESSED: 'sal_processed', // ["empId_month_year", ...]
  ALLOCS:    'sal_allocs',    // [{id,fromId,toId,amount,month,year}]
  DEDUCTS:   'sal_deducts',   // [{id,empId,type,desc,amount,month,year}]
  ADV:       'sal_advance',   // { empId: advanceBalance }
  CF:        'sal_cf',        // { "empId_month_year": shortfall }
  INACTIVE:  'sal_inactive',  // { empId: {date, reason} }
  SAL_START: 'sal_start_month', // { year, month } — salary system start month
};

const periodK = (id, m, y) => `${id}_${m}_${y}`;

// ─── API ──────────────────────────────────────────────────────────────────────
const apiFetch = async path => {
  const token = localStorage.getItem('token') || '';
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
};

const fetchActive   = () => apiFetch(`/users?user_id=${getUid()}&is_active=true`);
const fetchInactive = () => apiFetch(`/users?user_id=${getUid()}&is_active=false`);
const fetchDepts    = async () => { const r = await apiFetch(`/departments/?user_id=${getUid()}`); return Array.isArray(r) ? r : (r.items || []); };
const fetchRoles    = async () => { const r = await apiFetch(`/roles/?user_id=${getUid()}`); return Array.isArray(r) ? r : (r.items || []); };

const fetchWarnings = async (empId, year, month) => {
  const pad = n => String(n).padStart(2, '0');
  const start = `${year}-${pad(month+1)}-01`;
  const last  = new Date(year, month+1, 0).getDate();
  const end   = `${year}-${pad(month+1)}-${pad(last)}`;
  try {
    const r = await apiFetch(`/warnings/?user_id=${getUid()}&employee_id=${empId}&start_date=${start}&end_date=${end}&limit=200`);
    const list = Array.isArray(r) ? r : (r.items || r.warnings || []);
    return list.filter(w => !w.is_waived);
  } catch { return []; }
};

// ─── HRMS Finance API fetcher (single summary call) ───────────────────────────
// One endpoint returns reimbursements + deductions (for month) + all advances.
// Falls back to empty on error so salary calc still works without HRMS data.
const fetchHrmsFinanceSummary = async (year, month) => {
  try {
    const r = await apiFetch(`/hrms/finance-summary?user_id=${getUid()}&year=${year}&month=${month}`);
    const result = {
      reimbs:   Array.isArray(r.reimbursements) ? r.reimbursements : [],
      advances: Array.isArray(r.advances)        ? r.advances        : [],
      deducts:  Array.isArray(r.deductions)      ? r.deductions      : [],
      holds:    Array.isArray(r.salary_holds)    ? r.salary_holds    : [],
    };
    console.log('[SalaryMgmt] Finance summary:', { year, month, deducts: result.deducts.length, reimbs: result.reimbs.length });
    return result;
  } catch {
    return { reimbs: [], advances: [], deducts: [], holds: [] };
  }
};

// Fetch attendance present days for all employees for given month.
// Mirrors AttendancePage fetch + enrich + calculateMonthlyStats exactly.
const fetchAttendancePresentDays = async (year, month) => {
  try {
    let token = localStorage.getItem('token') || '';
    if (!token) {
      try { const ud = JSON.parse(localStorage.getItem('userData') || '{}'); token = ud.token || ''; } catch {}
    }
    const uid = getUid();
    const period = `${year}-${String(month).padStart(2, '0')}`; // month is 1-based
    const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // ── 0. Fetch attendance settings (default_paid_leave_monthly) ─────────
    let defaultPlMonthly = 1.0;
    try {
      const sRes = await fetch(`${API}/settings/attendance-settings?user_id=${uid}`, { headers: hdrs });
      if (sRes.ok) {
        const sData = await sRes.json();
        const s = sData?.data || sData || {};
        if (s.default_paid_leave_monthly != null) defaultPlMonthly = parseFloat(s.default_paid_leave_monthly);
      }
    } catch (e) { /* use default 1.0 */ }

    // ── 1. Fetch attendance calendar ──────────────────────────────────────
    const res = await fetch(`${API}/attendance/calendar?user_id=${uid}&year=${year}&month=${month}&_t=${Date.now()}`, { headers: hdrs });
    if (!res.ok) { console.warn('[SalaryMgmt] Attendance API error:', res.status); return {}; }
    const r = await res.json();
    const employees = Array.isArray(r) ? r : (r.employees || r.data || []);
    console.log('[SalaryMgmt] Attendance employees count:', employees.length);

    const totalDaysInMonth = new Date(year, month, 0).getDate(); // month 1-based

    // ── 2. Fetch leave balances — same as AttendancePage ─────────────────
    // Key: employee_id (RM###), same as AttendancePage balanceMap
    const balanceMap = {};
    try {
      const leaveResults = await Promise.allSettled(
        employees.map(e => {
          const apiId = String(e.user_mongo_id || e.employee_id || '');
          if (!apiId) return Promise.resolve(null);
          return fetch(`${API}/settings/leave-balance/${apiId}?user_id=${uid}&period=${period}`, { headers: hdrs })
            .then(r2 => r2.ok ? r2.json().then(d => ({
              empId: String(e.employee_id || ''),
              mongoId: String(e.user_mongo_id || ''),
              data: d
            })) : null);
        })
      );
      leaveResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          const { empId, mongoId, data } = result.value;
          const balData = data?.data || data;
          // Only store non-empty objects — empty {} = no DB record = null (same as AttendancePage)
          if (empId && balData && typeof balData === 'object' && Object.keys(balData).length > 0) {
            balanceMap[empId] = balData;
            if (mongoId) balanceMap[mongoId] = balData;
          }
        }
      });
    } catch (e) { console.warn('[SalaryMgmt] Leave balance fetch error:', e); }

    // ── 3. Convert numeric day.status → string (same as AttendancePage convertToCalendarFormat)
    //       Then run calculateMonthlyStats logic exactly ────────────────────
    const map = {};
    employees.forEach(e => {
      const mongoId    = String(e.user_mongo_id || '');
      const employeeId = String(e.employee_id || '');
      if (!mongoId && !employeeId) return;

      // ── Step A: convert numeric status → string, exactly as AttendancePage does ──
      const dayMap = {}; // { day1: 'P', day2: 'AB', ... }
      const leaveTypeMap = {};
      const leaveUnitsMap = {};
      (e.days || []).forEach(day => {
        const key = `day${day.day}`;
        leaveTypeMap[key] = day.leave_type || null;
        leaveUnitsMap[key] = Number(day.leave_units || 0);
        if (day.status !== null && day.status !== undefined) {
          const s = parseFloat(day.status);
          if      (s === 1.5)              dayMap[key] = 'H';
          else if (s === 2.0 || s === 2)   dayMap[key] = 'WK';
          else if (s === 1.0 || s === 1)   dayMap[key] = day.is_weekend ? 'SP' : 'P';
          else if (s === 0.5)              dayMap[key] = 'HD';
          else if (s === 0 || s === 0.0)   dayMap[key] = day.is_weekend ? 'S0' : 'LV';
          else if (s === -1 || s === -1.0) dayMap[key] = 'A';
          else if (s === -2 || s === -2.0) dayMap[key] = 'AB';
          else if (day.status === 'L')     dayMap[key] = 'L';
          else                             dayMap[key] = '';
        } else if (day.is_holiday) {
          dayMap[key] = 'H';
        } else if (day.is_weekend) {
          dayMap[key] = 'W';
        } else {
          dayMap[key] = '';
        }
      });

      // ── Step B: effective window → current month counts only up to today ──
      const { startDay, endDay, effectiveDays } = getEffectiveAttendanceWindow(
        year,
        month,
        totalDaysInMonth,
        e.joining_date || e.date_of_joining || null,
        e.inactive_from_date || null
      );

      // ── Step C: present score using STRING statuses (same business rules as AttendancePage) ──
      const getDayVal = (status) => {
        switch (status) {
          case 'P':  return 1;
          case 'L':  return 1;   // Late = full present
          case 'SP': return 1;   // Sunday Paid
          case 'WK': return 1;   // Checked-in
          case 'HD': return 0.5; // Half day
          case 'H':  return null; // Holiday — excluded
          case 'W':  return null; // Weekend — excluded
          default:   return null; // not marked — excluded
        }
      };

      let presentScore = 0;
      let actualPresent = 0;
      let abscondingDays = 0;
      let absentDays = 0;
      let sundayZeroDays = 0;
      let plLeaveDaysTaken = 0;
      let elLeaveDaysTaken = 0;
      for (let d = 1; d <= totalDaysInMonth; d++) {
        if (d < startDay || d > endDay) continue;
        const key = `day${d}`;
        const status = dayMap[key] || '';
        const leaveUnits = leaveUnitsMap[key] || 0;
        if (status === 'H') {
          // holiday — excluded from presentScore
        } else if (status === 'LV') {
          if (isEarnedLeaveType(leaveTypeMap[key])) elLeaveDaysTaken += leaveUnits || 1;
          else plLeaveDaysTaken += leaveUnits || 1;
        } else if (status === 'AB') {
          abscondingDays++;
        } else if (status === 'A') {
          absentDays++;
        } else if (status === 'S0') {
          sundayZeroDays++;
        } else {
          const val = getDayVal(status);
          if (val !== null) {
            presentScore += val;
            if (val > 0) actualPresent += val;
            if (status === 'HD' && leaveUnits > 0) {
              if (isEarnedLeaveType(leaveTypeMap[key])) elLeaveDaysTaken += leaveUnits;
              else plLeaveDaysTaken += leaveUnits;
            }
          }
        }
      }

      // ── Step D: PL — exact mirror of enrichedData + calculateMonthlyStats ──
      // enrichedData sets:
      //   paidLeavesTotal     = bal!=null ? (bal.paid_leaves_total ?? defaultPl) : defaultPl
      //   paidLeavesRemaining = bal!=null ? (bal.paid_leaves_remaining ?? 0) : null
      // calculateMonthlyStats:
      //   plAllotted  = record.paidLeavesTotal ?? record.plMonthly ?? 1
      //   plRemaining = record.paidLeavesRemaining ?? null  → 0 stays 0 (non-null)
      //   plDays = plRemaining != null ? plRemaining : plAllotted
      const bal = balanceMap[employeeId] ?? balanceMap[mongoId] ?? null;
      const paidLeavesTotal     = bal != null
        ? parseFloat(bal.paid_leaves_total ?? defaultPlMonthly)
        : defaultPlMonthly;
      const paidLeavesRemaining = bal != null
        ? (bal.paid_leaves_remaining != null ? parseFloat(bal.paid_leaves_remaining) : 0)
        : null;
      // plRemaining = paidLeavesRemaining ?? null  → 0 is non-null, so plDays = 0
      const plDays = paidLeavesRemaining !== null ? paidLeavesRemaining : paidLeavesTotal;

      const earnedLeavesTotal = bal != null
        ? parseFloat(bal.earned_leaves_total ?? 0)
        : 0;
      const earnedLeavesRemaining = bal != null
        ? (bal.earned_leaves_remaining != null ? parseFloat(bal.earned_leaves_remaining) : 0)
        : 0;
      const elDays = earnedLeavesRemaining !== null ? earnedLeavesRemaining : earnedLeavesTotal;

      const plScore = Math.min(plLeaveDaysTaken, plDays);
      const elScore = Math.min(elLeaveDaysTaken, elDays);
      // Final = earned days (present + eligible leave) capped to eligible days,
      // then one extra day penalty for every absconding day. The absconding day
      // itself already contributes 0 in presentScore, so subtract only the extra penalty.
      const earnedBeforeAbscondingPenalty = Math.min(
        effectiveDays,
        Math.max(0, presentScore) + plScore + elScore
      );
      const finalScore = Math.max(0, earnedBeforeAbscondingPenalty - abscondingDays);

      const entry = {
        presentScore,
        actualPresent,
        finalScore,
        totalDays: totalDaysInMonth,
        effectiveDays,
        plAdded: plScore,
        elAdded: elScore,
        abscondingDays,
        absentDays,
      };
      // Store by BOTH keys so lookup always works
      if (mongoId)    map[mongoId]    = entry;
      if (employeeId) map[employeeId] = entry;
    });

    console.log('[SalaryMgmt] Present days map (entries):', Object.keys(map).length);
    return map;
  } catch (err) {
    console.error('[SalaryMgmt] fetchAttendancePresentDays error:', err);
    return {};
  }
};

// Role hierarchy
const buildRSM = roles => {
  const sub = {};
  roles.forEach(r => { sub[String(r._id||r.id)] = new Set(); });
  roles.forEach(r => {
    const rid = String(r._id||r.id);
    (r.reporting_ids || (r.reporting_id ? [r.reporting_id] : [])).forEach(pid => {
      const ps = String(pid);
      if (!sub[ps]) sub[ps] = new Set();
      sub[ps].add(rid);
    });
  });
  const getAll = (id, vis=new Set()) => {
    if (vis.has(id)) return new Set();
    vis.add(id);
    const d = sub[id] || new Set();
    const all = new Set(d);
    d.forEach(c => getAll(c, new Set(vis)).forEach(x => all.add(x)));
    return all;
  };
  const r2 = {};
  roles.forEach(r => { const id = String(r._id||r.id); r2[id] = getAll(id); });
  return r2;
};

// ─── Calc row ─────────────────────────────────────────────────────────────────
// overallBusiness = indi + teamReceived
// finalBusiness   = overallBusiness
// shortfall       = totalTarget - finalBusiness  (if > 0)
// excessBusiness  = finalBusiness - totalTarget  (if > 0)
// incentive       = (excessBusiness / 100000) * iRate
// attendanceDeduction = (totalDays - presentDays) * perDaySalary
// finalSalary     = monthlySalary + incentive - attendanceDeduction
// accountTransfer = finalSalary - totalDeductions + totalReimbursements
const calcRow = (emp, allocs, deducts, advanceBalance, carryForward, warnDeducts, presentDays, totalDaysInMonth, rawPresentScore, plAdded, effectiveDays, elAdded, salaryHold = null) => {
  const id = String(emp._id || emp.id);
  const indi       = num(emp.settled_target || 0);
  const givenAway  = allocs.filter(a => a.fromId === id).reduce((s,a) => s + num(a.amount), 0);
  const teamRcvd   = allocs.filter(a => a.toId   === id).reduce((s,a) => s + num(a.amount), 0);
  const availIndi  = indi - givenAway;

  const baseTarget = num(emp.monthly_target || 0);
  const cf         = num(carryForward || 0);
  const totalTarget= baseTarget + cf;

  const overallBiz = indi + teamRcvd;
  const finalBiz   = overallBiz;
  const shortfall  = totalTarget > finalBiz ? totalTarget - finalBiz : 0;
  const excessBiz  = finalBiz > totalTarget ? finalBiz - totalTarget : 0;

  // incentive per lakh from employee form field, fallback to 200
  const iRate       = num(emp.incentive) || 200;
  const incentive   = (excessBiz / 100000) * iRate;

  const monthlySalary = num(emp.salary || 0);

  // ── Attendance-based deduction ────────────────────────────────────────────
  // perDaySalary = monthlySalary / totalDaysInMonth  (full month denominator always)
  // effectiveDays = days employee was eligible (joining mid-month → less than totalDays)
  // presentDays = finalScore from attendance page = presentScore + plDays (PL already included)
  //   This matches the "Final" column on AttendancePage exactly.
  // plAdded is kept for display breakdown only (rawPresentScore + plAdded = presentDays)
  //
  // earnedScore = presentDays (finalScore already includes PL benefit — no need to add again)
  //   capped at effectiveDays so mid-month joiners don't over-earn
  // effectiveSalary = perDaySalary * effectiveDays (max entitled salary this month)
  // earnedSalary  = perDaySalary * earnedScore
  // attendanceDed = max(0, effectiveSalary - earnedSalary)
  const hasPresentData  = presentDays != null && totalDaysInMonth > 0;
  const effDays         = (effectiveDays != null && effectiveDays > 0) ? effectiveDays : totalDaysInMonth;
  const _plAdded        = plAdded || 0;
  const _elAdded        = elAdded || 0;
  const perDaySalary    = hasPresentData ? monthlySalary / totalDaysInMonth : 0;
  const effectiveSal    = hasPresentData ? Math.round(perDaySalary * effDays) : monthlySalary;
  // earnedScore: presentDays already includes PL — just cap at effectiveDays
  const earnedScore     = hasPresentData ? Math.min(presentDays, effDays) : effDays;
  const earnedSal       = hasPresentData ? Math.round(perDaySalary * earnedScore) : monthlySalary;
  const absentDays      = hasPresentData ? Math.max(0, effDays - earnedScore) : 0;
  const attendanceDed   = hasPresentData ? Math.max(0, effectiveSal - earnedSal) : 0;

  const finalSalary   = monthlySalary + incentive - attendanceDed;

  // deductions
  const empDeds       = deducts.filter(d => d.empId === id && !d.isReimbursement);
  const empReimb      = deducts.filter(d => d.empId === id && d.isReimbursement);
  const totalDeds     = empDeds.reduce((s,d) => s + num(d.amount), 0) +
                        warnDeducts.reduce((s,w) => s + num(w.penalty_amount), 0);
  const totalReimb    = empReimb.reduce((s,r) => s + num(r.amount), 0);
  const advRecovered  = empDeds.filter(d => d.type === 'Advance Recovery').reduce((s,d) => s + num(d.amount), 0);
  const remainingAdv  = Math.max(0, num(advanceBalance) - advRecovered);

  const grossAccountTransfer = finalSalary - totalDeds + totalReimb;
  const isSalaryHeld = !!salaryHold;
  const accountTransfer = isSalaryHeld ? 0 : grossAccountTransfer;

  return { id, indi, givenAway, teamRcvd, availIndi, baseTarget, cf, totalTarget,
           overallBiz, finalBiz, shortfall, excessBiz, incentive, iRate,
           monthlySalary, perDaySalary, absentDays, attendanceDed: attendanceDed, hasPresentData,
           plAdded: _plAdded, elAdded: _elAdded, rawPresentScore: rawPresentScore ?? null,
           totalDaysInMonth: totalDaysInMonth || 0,
           effectiveDays: effDays,
           finalScore: presentDays,  // finalScore = the attendance page "Final" value passed in
           finalSalary, totalDeds, totalReimb, advRecovered, remainingAdv,
           grossAccountTransfer, accountTransfer, isSalaryHeld, salaryHold,
           empDeds, empReimb, warnDeducts };
};

// ─── CSS injected once ────────────────────────────────────────────────────────
const CSS = `
.sm-body { font-family: Arial, sans-serif; margin: 0; background: #f9fafb; color: #1f2937; min-height: 100vh; }
.sm-tabs { display: inline-flex; background: #e5e7eb; padding: 6px; border-radius: 8px; margin: 16px; box-shadow: inset 0 2px 4px rgba(0,0,0,.05); }
.sm-tab { padding: 10px 28px; cursor: pointer; border: none; background: transparent; font-size: 15px; font-weight: bold; color: #4b5563; border-radius: 6px; transition: all .2s; }
.sm-tab:hover { color: #111827; }
.sm-tab.active { background: white; color: #2563eb; box-shadow: 0 2px 4px rgba(0,0,0,.1); }
.sm-toolbar { display: flex; gap: 15px; background: white; padding: 15px; border-radius: 8px 8px 0 0; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin: 0 16px 2px; align-items: flex-end; flex-wrap: wrap; }
.sm-fg { display: flex; flex-direction: column; gap: 4px; }
.sm-fg label { font-size: 12px; font-weight: bold; color: #4b5563; }
.sm-input { padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px; min-width: 180px; }
.sm-table-wrap { overflow-x: auto; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1); border-radius: 0 0 8px 8px; margin: 0 16px 24px; }
.sm-table { border-collapse: collapse; width: 100%; font-size: 13px; white-space: nowrap; }
.sm-table th, .sm-table td { border: 1px solid #e5e7eb; padding: 5px 8px; text-align: right; }
.sm-table th:nth-child(1),.sm-table td:nth-child(1),
.sm-table th:nth-child(2),.sm-table td:nth-child(2),
.sm-table th:nth-child(3),.sm-table td:nth-child(3),
.sm-table th:nth-child(15),.sm-table td:nth-child(15),
.sm-table th:nth-child(16),.sm-table td:nth-child(16),
.sm-table th:nth-child(17),.sm-table td:nth-child(17),
.sm-table th:nth-child(18),.sm-table td:nth-child(18),
.sm-table th:nth-child(19),.sm-table td:nth-child(19) { text-align: left; }
.sm-table th:nth-child(4),.sm-table td:nth-child(4) { text-align: center; }
.sm-table th { background: #f3f4f6; font-weight: bold; color: #374151; position: sticky; top: 0; z-index: 5; }
.sm-table th.hl-yellow { background: #fef08a; color: #854d0e; min-width: 160px; white-space: normal; }
.sm-table th.hl-green  { background: #86efac; color: #14532d; min-width: 130px; }
.sm-table tbody tr:hover { background: #f9fafb; }
.sm-table tbody tr.processed { background: #ecfdf5 !important; }
.sm-team-cell { cursor: pointer; color: #2563eb; font-weight: bold; background: #eff6ff !important; transition: background .2s; }
.sm-team-cell:hover { background: #dbeafe !important; }
.sm-ded-cell { cursor: pointer; background: #fef2f2 !important; transition: background .2s; }
.sm-ded-cell:hover { background: #fee2e2 !important; }
.sm-overlay { display: flex; position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 1000; justify-content: center; align-items: center; }
.sm-modal { background: white; padding: 24px; border-radius: 8px; width: 90%; max-width: 680px; box-shadow: 0 20px 25px -5px rgba(0,0,0,.1); max-height: 90vh; overflow-y: visible; }
.sm-modal h2 { margin-top: 0; font-size: 18px; margin-bottom: 8px; }
.sm-fg2 { margin-bottom: 16px; }
.sm-fg2 label { display: block; font-weight: bold; margin-bottom: 6px; font-size: 14px; }
.sm-fc { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; box-sizing: border-box; }
.sm-dd-wrap { position: relative; }
.sm-dd-list { display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #d1d5db; max-height: 150px; overflow-y: auto; z-index: 10; border-radius: 0 0 4px 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1); }
.sm-dd-item { padding: 8px; cursor: pointer; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
.sm-dd-item:hover { background: #f3f4f6; }
.sm-info-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
.sm-btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; }
.sm-btn-primary { background: #2563eb; color: white; }
.sm-btn-primary:hover { background: #1d4ed8; }
.sm-btn-secondary { background: #e5e7eb; color: #374151; }
.sm-btn-secondary:hover { background: #d1d5db; }
.sm-btn-outline { background: white; border: 1px solid #d1d5db; }
.sm-btn-outline.active { background: #eff6ff; border-color: #2563eb; color: #2563eb; }
.sm-btn-danger { background: white; border: 1px solid #ef4444; color: #ef4444; width: 100%; }
.sm-btn-danger:hover { background: #fef2f2; }
.sm-flex-right { display: flex; justify-content: flex-end; gap: 8px; }
.sm-list-table { width: 100%; font-size: 13px; text-align: left; border-collapse: collapse; }
.sm-list-table td { padding: 5px 4px; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
.sm-perf-cell { padding: 8px; border-radius: 4px; width: 180px; box-shadow: 0 1px 2px rgba(0,0,0,.05); border: 1px solid transparent; transition: transform .2s, box-shadow .2s; }
.sm-perf-cell:hover { transform: translateY(-1px); box-shadow: 0 2px 4px -1px rgba(0,0,0,.1); }
.sm-perf-success { background: linear-gradient(135deg,#ecfdf5,#f0fdf4); border-color: #a7f3d0; }
.sm-perf-danger  { background: linear-gradient(135deg,#fef2f2,#fff1f2); border-color: #fecaca; }
.sm-perf-nodata  { background: #f9fafb; border-color: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 48px; }
.sm-badge { padding: 2px 4px; border-radius: 3px; font-size: 8px; font-weight: bold; color: white; letter-spacing: .5px; }
.sm-badge-s { background: #10b981; }
.sm-badge-d { background: #ef4444; }
.sm-status-processed { background: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
.sm-status-pending   { background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
  cssInjected = true;
}

// ─── Allocation Modal ─────────────────────────────────────────────────────────
function AllocModal({ beneficiary, calcRows, allocs, onSave, onClose }) {
  const [search,  setSearch]  = useState('');
  const [showDD,  setShowDD]  = useState(false);
  const [selEmp,  setSelEmp]  = useState(null);  // selected row from dropdown
  const [aType,   setAType]   = useState('amount');
  const [aVal,    setAVal]    = useState('');
  const inputRef = useRef();

  const benId        = String(beneficiary._id||beneficiary.id);
  const allCandidates= calcRows.filter(r => r.id !== benId);
  const matches      = search.trim()
    ? allCandidates.filter(r =>
        `${r.emp.first_name||''} ${r.emp.last_name||''} ${r.emp.employee_id||''}`.toLowerCase()
          .includes(search.toLowerCase()))
    : allCandidates;
  const existing     = allocs.filter(a => a.toId === benId);

  const previewAmt = selEmp
    ? aType === 'percent' ? (selEmp.availIndi * num(aVal)) / 100 : num(aVal)
    : 0;
  const overLimit  = selEmp && previewAmt > selEmp.availIndi;
  const canAllocate= selEmp && aVal && num(aVal) > 0 && !overLimit;

  const doSave = () => {
    if (!canAllocate) return;
    onSave({ id: mkid(), fromId: selEmp.id, toId: benId, amount: Math.round(previewAmt) });
    setSelEmp(null); setAVal(''); setSearch(''); setShowDD(false);
  };

  const selectEmp = (r) => {
    setSelEmp(r);
    setSearch('');      // clear search so dropdown closes, controls appear
    setShowDD(false);
    setAVal('');
  };

  return (
    <div className="sm-overlay" onClick={onClose}>
      <div className="sm-modal" style={{maxWidth:680,overflowY:'auto',maxHeight:'88vh'}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <h2 style={{margin:'0 0 4px'}}>Allocate Team Achievement</h2>
            <p style={{margin:0,fontSize:13,color:'#6b7280'}}>
              For: <strong style={{color:'#1f2937'}}>{beneficiary.first_name} {beneficiary.last_name}</strong>
            </p>
          </div>
          <button onClick={onClose}
            style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#9ca3af',lineHeight:1}}>×</button>
        </div>

        {/* Existing contributions */}
        {existing.length > 0 && (
          <div style={{marginBottom:16,background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,padding:12}}>
            <div style={{fontSize:12,fontWeight:'bold',color:'#166534',marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>
              Current Contributions
            </div>
            {existing.map(a => {
              const src = calcRows.find(r => r.id === a.fromId);
              return (
                <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'6px 0',borderBottom:'1px solid #bbf7d0'}}>
                  <span style={{fontSize:13,color:'#1f2937'}}>
                    <strong>{src ? `${src.emp.first_name} ${src.emp.last_name}` : 'Unknown'}</strong>
                    {displayText(src?.emp?.designation) && <span style={{color:'#6b7280',fontSize:11,marginLeft:6}}>{displayText(src.emp.designation)}</span>}
                  </span>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{color:'#059669',fontWeight:'bold',fontSize:14}}>+₹{fmt(a.amount)}</span>
                    <button onClick={()=>onSave({__remove:a.id})}
                      style={{background:'#fef2f2',border:'1px solid #fca5a5',color:'#ef4444',
                        borderRadius:4,padding:'2px 8px',cursor:'pointer',fontSize:11,fontWeight:'bold'}}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            <div style={{marginTop:8,textAlign:'right',fontSize:13,fontWeight:'bold',color:'#059669'}}>
              Total: +₹{fmt(existing.reduce((s,a)=>s+num(a.amount),0))}
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{marginBottom: selEmp ? 0 : 8}}>
          <label style={{fontSize:12,fontWeight:'bold',color:'#374151',display:'block',marginBottom:6}}>
            Select Employee to Contribute
          </label>
          <div style={{position:'relative'}}>
            <input
              ref={inputRef}
              style={{width:'100%',padding:'10px 12px',border:'2px solid #e5e7eb',borderRadius:8,
                fontSize:14,outline:'none',boxSizing:'border-box',
                borderColor: showDD ? '#2563eb' : '#e5e7eb', transition:'border-color .15s'}}
              placeholder="🔍  Search or click to see all employees..."
              value={search}
              autoComplete="off"
              onChange={e=>{setSearch(e.target.value);setShowDD(true);if(selEmp)setSelEmp(null);}}
              onFocus={()=>setShowDD(true)}
              onBlur={()=>setTimeout(()=>setShowDD(false),200)}
            />
            {/* Dropdown list */}
            {showDD && !selEmp && (
              <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,
                background:'white',border:'1px solid #d1d5db',borderRadius:8,
                maxHeight:260,overflowY:'auto',zIndex:20,
                boxShadow:'0 8px 24px rgba(0,0,0,0.12)'}}>
                {/* column header */}
                <div style={{display:'grid',gridTemplateColumns:'2fr 1.4fr 1fr',
                  padding:'8px 14px',background:'#f9fafb',
                  borderBottom:'2px solid #e5e7eb',fontSize:11,fontWeight:'bold',
                  color:'#374151',position:'sticky',top:0,zIndex:1}}>
                  <span>NAME</span><span>DESIGNATION</span>
                  <span style={{textAlign:'right'}}>ACHIEVED</span>
                </div>
                {matches.length === 0
                  ? <div style={{padding:'14px',color:'#9ca3af',fontSize:13,textAlign:'center'}}>No employees found</div>
                  : matches.map(r=>(
                    <div key={r.id}
                      onMouseDown={e=>{e.preventDefault();selectEmp(r);}}
                      style={{display:'grid',gridTemplateColumns:'2fr 1.4fr 1fr',
                        padding:'10px 14px',cursor:'pointer',
                        borderBottom:'1px solid #f3f4f6',alignItems:'center',
                        transition:'background .1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#eff6ff'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}
                    >
                      <div>
                        <div style={{fontWeight:'600',color:'#111827',fontSize:13}}>
                          {r.emp.first_name} {r.emp.last_name}
                        </div>
                        {r.emp.employee_id && <div style={{color:'#9ca3af',fontSize:10}}>{r.emp.employee_id}</div>}
                      </div>
                      <div style={{color:'#6b7280',fontSize:12}}>{displayText(r.emp.designation, '—')}</div>
                      <div style={{textAlign:'right',color:'#059669',fontWeight:'bold',fontSize:13}}>
                        ₹{fmt(r.indi)}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>

        {/* ── Inline allocation card — appears right after employee is selected ── */}
        {selEmp && (
          <div style={{border:'2px solid #2563eb',borderRadius:10,overflow:'hidden',marginTop:8}}>
            {/* Selected employee header */}
            <div style={{background:'#eff6ff',padding:'10px 14px',
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:'bold',fontSize:14,color:'#1e40af'}}>
                  {selEmp.emp.first_name} {selEmp.emp.last_name}
                  {displayText(selEmp.emp.designation) && <span style={{fontSize:11,color:'#6b7280',marginLeft:8,fontWeight:'normal'}}>{displayText(selEmp.emp.designation)}</span>}
                </div>
                <div style={{fontSize:12,color:'#3b82f6',marginTop:2}}>
                  Achieved: <strong>₹{fmt(selEmp.indi)}</strong>
                  &nbsp;·&nbsp; Available: <strong style={{color:'#059669'}}>₹{fmt(selEmp.availIndi)}</strong>
                </div>
              </div>
              <button onClick={()=>{setSelEmp(null);setAVal('');}}
                style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>
            </div>

            {/* Amount/Percent controls inline */}
            <div style={{padding:'14px',background:'white'}}>
              {/* Toggle buttons */}
              <div style={{display:'flex',gap:0,marginBottom:12,border:'1px solid #e5e7eb',
                borderRadius:6,overflow:'hidden',width:'fit-content'}}>
                {[['amount','₹ Fixed Amount'],['percent','% Percentage']].map(([t,l])=>(
                  <button key={t} onClick={()=>{setAType(t);setAVal('');}}
                    style={{padding:'7px 18px',border:'none',cursor:'pointer',fontSize:12,fontWeight:'bold',
                      background: aType===t?'#2563eb':'white',
                      color: aType===t?'white':'#6b7280',
                      borderRight: t==='amount'?'1px solid #e5e7eb':'none',
                      transition:'all .15s'}}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Input + preview side by side */}
              <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                <div style={{flex:1}}>
                  <div style={{position:'relative'}}>
                    <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',
                      color:'#6b7280',fontSize:13,fontWeight:'bold',pointerEvents:'none'}}>
                      {aType==='amount'?'₹':'%'}
                    </span>
                    <input
                      type={aType==='amount' ? 'text' : 'number'}
                      inputMode="numeric"
                      min="0"
                      placeholder={aType==='amount'?'Enter amount':'Enter %'}
                      value={aType==='amount' ? (document.activeElement?.dataset?.allocField === 'aval' ? aVal : (aVal ? formatIndianCurrency(aVal) : '')) : aVal}
                      data-alloc-field="aval"
                      onChange={e=>setAVal(aType==='amount' ? e.target.value.replace(/,/g,'') : e.target.value)}
                      onFocus={e=>{ e.target.dataset.allocField='aval'; if(aType==='amount') e.target.value=aVal||''; }}
                      onBlur={e=>{ if(aType==='amount'){const n=parseFloat(e.target.value.replace(/,/g,''));if(!isNaN(n))setAVal(String(n));}}}
                      autoFocus
                      style={{width:'100%',padding:'10px 12px 10px 26px',
                        border:`2px solid ${overLimit?'#ef4444':aVal?'#2563eb':'#e5e7eb'}`,
                        borderRadius:6,fontSize:14,outline:'none',boxSizing:'border-box',
                        transition:'border-color .15s'}}
                    />
                  </div>
                  {/* Live preview */}
                  {aVal && (
                    <div style={{marginTop:6,fontSize:12,
                      color:overLimit?'#ef4444':'#059669',fontWeight:'bold'}}>
                      {overLimit
                        ? `⚠ Exceeds available (₹${fmt(selEmp.availIndi)})`
                        : `✓ Allocating ₹${fmt(Math.round(previewAmt))} to ${beneficiary.first_name}`
                      }
                    </div>
                  )}
                </div>
                <button onClick={doSave} disabled={!canAllocate}
                  style={{padding:'10px 20px',background:canAllocate?'#2563eb':'#e5e7eb',
                    color:canAllocate?'white':'#9ca3af',border:'none',borderRadius:6,
                    fontWeight:'bold',fontSize:13,cursor:canAllocate?'pointer':'not-allowed',
                    transition:'all .15s',whiteSpace:'nowrap',marginTop:0}}>
                  + Allocate
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{marginTop:20,textAlign:'right'}}>
          <button className="sm-btn sm-btn-secondary" onClick={onClose}>Close Window</button>
        </div>
      </div>
    </div>
  );
}

// ─── Deduction & Reimbursement Modal ─────────────────────────────────────────
function DedModal({ emp, calc, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState('deduction'); // 'deduction' | 'reimbursement'
  const [dtype,  setDtype]  = useState('Advance Recovery');
  const [ddesc,  setDdesc]  = useState('');
  const [damt,   setDamt]   = useState('');
  // Reimbursement fields
  const [rtype,  setRtype]  = useState('Travel');
  const [rdesc,  setRdesc]  = useState('');
  const [ramt,   setRamt]   = useState('');

  const dedTypes = ['Advance Recovery','Fine','Warning Penalty','Other'];
  const rmbTypes = ['Travel','Medical','Food','Internet','Equipment','Other'];

  const empReimb = (calc.empDeds || []).filter(d => d.isReimbursement);
  const empDeds  = (calc.empDeds || []).filter(d => !d.isReimbursement);

  const addDed = () => {
    const amount = parseFloat(damt);
    if (!amount || amount <= 0) { alert('Enter valid amount.'); return; }
    if (dtype === 'Advance Recovery' && amount > calc.remainingAdv) {
      alert(`Cannot recover more than pending advance (₹${fmt(calc.remainingAdv)}).`); return;
    }
    onSave({ __add: { id: mkid(), empId: calc.id, type: dtype, desc: ddesc, amount, isReimbursement: false } });
    setDdesc(''); setDamt('');
  };

  const addReimb = () => {
    const amount = parseFloat(ramt);
    if (!amount || amount <= 0) { alert('Enter valid amount.'); return; }
    onSave({ __add: { id: mkid(), empId: calc.id, type: rtype, desc: rdesc, amount, isReimbursement: true } });
    setRdesc(''); setRamt('');
  };

  return (
    <div className="sm-overlay" onClick={onClose}>
      <div className="sm-modal" style={{maxWidth:580,overflowY:'auto',maxHeight:'85vh'}} onClick={e => e.stopPropagation()}>
        <h2>Deduction & Reimbursement</h2>
        <p style={{fontSize:13,color:'#4b5563',marginBottom:16}}>
          Managing for <strong>{emp.first_name} {emp.last_name}</strong>
        </p>

        {/* Tab switcher */}
        <div style={{display:'flex',gap:0,marginBottom:16,border:'1px solid #e5e7eb',borderRadius:6,overflow:'hidden'}}>
          {[['deduction','✂️ Deductions'],['reimbursement','💰 Reimbursements']].map(([t,l])=>(
            <button key={t} onClick={()=>setActiveTab(t)}
              style={{flex:1,padding:'9px',border:'none',cursor:'pointer',fontWeight:'bold',fontSize:13,
                background: activeTab===t ? '#2563eb' : 'white',
                color: activeTab===t ? 'white' : '#6b7280',
                borderRight: t==='deduction' ? '1px solid #e5e7eb' : 'none'}}>
              {l}
            </button>
          ))}
        </div>

        {activeTab === 'deduction' ? (
          <>
            {/* Advance tracking */}
            {(calc.advanceBalance > 0 || calc.advRecovered > 0) && (
              <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',padding:12,borderRadius:6,marginBottom:16}}>
                <label style={{fontWeight:'bold',fontSize:14,color:'#1e3a8a',marginBottom:8,display:'block'}}>📦 Advance Salary Tracking</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,fontSize:13}}>
                  <div style={{background:'white',borderRadius:4,padding:'8px 10px',border:'1px solid #bfdbfe'}}>
                    <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>Previous Balance</div>
                    <div style={{fontWeight:'bold',color:'#1e40af'}}>₹{fmt(calc.advanceBalance)}</div>
                  </div>
                  <div style={{background:'white',borderRadius:4,padding:'8px 10px',border:'1px solid #bfdbfe'}}>
                    <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>Recovered</div>
                    <div style={{fontWeight:'bold',color:'#059669'}}>-₹{fmt(calc.advRecovered)}</div>
                  </div>
                  <div style={{background:'white',borderRadius:4,padding:'8px 10px',border:'1px solid #fca5a5'}}>
                    <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>Remaining</div>
                    <div style={{fontWeight:'bold',color:'#ef4444'}}>₹{fmt(calc.remainingAdv)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Current deductions list */}
            {(empDeds.length > 0 || calc.warnDeducts?.length > 0) && (
              <div style={{marginBottom:16}}>
                <label style={{fontWeight:'bold',fontSize:14}}>Current Deductions</label>
                <div className="sm-info-card" style={{marginTop:6,background:'#fef2f2',borderColor:'#fca5a5'}}>
                  <table className="sm-list-table">
                    <tbody>
                      {empDeds.map(d=>(
                        <tr key={d.id}>
                          <td>
                            <strong style={{color:'#b91c1c'}}>{displayText(d.type, 'Deduction')}</strong>
                            {displayText(d.desc) && <span style={{color:'#6b7280',fontSize:11}}>– {displayText(d.desc)}</span>}
                            {d.isAuto && <span style={{marginLeft:5,background:'#7c3aed',color:'white',borderRadius:3,padding:'1px 5px',fontSize:9,fontWeight:'bold',letterSpacing:.4}}>AUTO</span>}
                          </td>
                          <td style={{textAlign:'right',color:'#ef4444',fontWeight:'bold'}}>-₹{fmt(d.amount)}</td>
                          <td style={{width:60,textAlign:'right'}}>
                            {d.isAuto
                              ? <span style={{color:'#9ca3af',fontSize:11}}>synced</span>
                              : <button onClick={()=>onSave({__remove:d.id})}
                                  style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',textDecoration:'underline',fontSize:12}}>Remove</button>
                            }
                          </td>
                        </tr>
                      ))}
                      {calc.warnDeducts?.map((w,i)=>(
                        <tr key={i}>
                          <td><strong style={{color:'#b91c1c'}}>Warning Penalty</strong> <span style={{color:'#6b7280',fontSize:11}}>– {displayText(w.warning_type || w.warning_message, 'Warning')}</span></td>
                          <td style={{textAlign:'right',color:'#ef4444',fontWeight:'bold'}}>-₹{fmt(w.penalty_amount)}</td>
                          <td style={{width:60,textAlign:'right',color:'#9ca3af',fontSize:11}}>auto</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{borderTop:'1px solid #fca5a5',paddingTop:6,marginTop:4,textAlign:'right',fontWeight:'bold',color:'#ef4444'}}>
                    Total: -₹{fmt(calc.totalDeds)}
                  </div>
                </div>
              </div>
            )}

            {/* Add deduction */}
            <div style={{borderTop:'1px solid #e5e7eb',paddingTop:16}}>
              <label style={{fontWeight:'bold',fontSize:14,marginBottom:8,display:'block'}}>Add Deduction</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div className="sm-fg2">
                  <label>Type</label>
                  <select className="sm-fc" value={dtype} onChange={e=>setDtype(e.target.value)}>
                    {dedTypes.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="sm-fg2">
                  <label>Amount (₹)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="sm-fc"
                    placeholder="0"
                    min="0"
                    value={damt ? formatIndianCurrency(damt) : ''}
                    onFocus={e => { e.target.value = damt || ''; }}
                    onChange={e => setDamt(e.target.value.replace(/,/g, ''))}
                    onBlur={e => { const n = parseFloat(e.target.value.replace(/,/g,'')); if (!isNaN(n)) setDamt(String(n)); }}
                  />
                </div>
              </div>
              <div className="sm-fg2">
                <label>Description / Note</label>
                <input className="sm-fc" placeholder="e.g., 1st half of advance payment" value={ddesc} onChange={e=>setDdesc(e.target.value)}/>
              </div>
              <button className="sm-btn sm-btn-danger" onClick={addDed} style={{width:'100%'}}>+ Add Deduction</button>
            </div>
          </>
        ) : (
          <>
            {/* Reimbursements list */}
            {empReimb.length > 0 && (
              <div style={{marginBottom:16}}>
                <label style={{fontWeight:'bold',fontSize:14}}>Current Reimbursements</label>
                <div className="sm-info-card" style={{marginTop:6,background:'#f0fdf4',borderColor:'#86efac'}}>
                  <table className="sm-list-table">
                    <tbody>
                      {empReimb.map(r=>(
                        <tr key={r.id}>
                          <td>
                            <strong style={{color:'#166534'}}>{displayText(r.type, 'Reimbursement')}</strong>
                            {displayText(r.desc) && <span style={{color:'#6b7280',fontSize:11}}>– {displayText(r.desc)}</span>}
                            {r.isAuto && <span style={{marginLeft:5,background:'#059669',color:'white',borderRadius:3,padding:'1px 5px',fontSize:9,fontWeight:'bold',letterSpacing:.4}}>AUTO</span>}
                          </td>
                          <td style={{textAlign:'right',color:'#059669',fontWeight:'bold'}}>+₹{fmt(r.amount)}</td>
                          <td style={{width:60,textAlign:'right'}}>
                            {r.isAuto
                              ? <span style={{color:'#9ca3af',fontSize:11}}>synced</span>
                              : <button onClick={()=>onSave({__remove:r.id})}
                                  style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',textDecoration:'underline',fontSize:12}}>Remove</button>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{borderTop:'1px solid #86efac',paddingTop:6,marginTop:4,textAlign:'right',fontWeight:'bold',color:'#059669'}}>
                    Total: +₹{fmt(empReimb.reduce((s,r)=>s+num(r.amount),0))}
                  </div>
                </div>
              </div>
            )}

            {/* Add reimbursement */}
            <div style={{borderTop:'1px solid #e5e7eb',paddingTop:16}}>
              <label style={{fontWeight:'bold',fontSize:14,marginBottom:8,display:'block'}}>Add Reimbursement</label>
              <p style={{fontSize:12,color:'#6b7280',margin:'0 0 12px'}}>Reimbursements are added to the final salary</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div className="sm-fg2">
                  <label>Type</label>
                  <select className="sm-fc" value={rtype} onChange={e=>setRtype(e.target.value)}>
                    {rmbTypes.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="sm-fg2">
                  <label>Amount (₹)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="sm-fc"
                    placeholder="0"
                    min="0"
                    value={ramt ? formatIndianCurrency(ramt) : ''}
                    onFocus={e => { e.target.value = ramt || ''; }}
                    onChange={e => setRamt(e.target.value.replace(/,/g, ''))}
                    onBlur={e => { const n = parseFloat(e.target.value.replace(/,/g,'')); if (!isNaN(n)) setRamt(String(n)); }}
                  />
                </div>
              </div>
              <div className="sm-fg2">
                <label>Description / Note</label>
                <input className="sm-fc" placeholder="e.g., Travel to client site" value={rdesc} onChange={e=>setRdesc(e.target.value)}/>
              </div>
              <button onClick={addReimb}
                style={{width:'100%',background:'#059669',color:'white',border:'none',borderRadius:4,padding:'8px',fontWeight:'bold',fontSize:13,cursor:'pointer'}}>
                + Add Reimbursement
              </button>
            </div>
          </>
        )}

        <div className="sm-flex-right" style={{marginTop:24}}>
          <button className="sm-btn sm-btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── History Modal ────────────────────────────────────────────────────────────
function HistModal({ emp, inactiveInfo, startMonth, onClose }) {
  const hist = useMemo(() => {
    const store = loadJ(LS.HISTORY, {});
    const raw = (store[String(emp._id||emp.id)] || []).slice().reverse();
    return raw.filter(h => isRecordOnOrAfterStart(h.year, h.month, startMonth));
  }, [emp, startMonth]);

  return (
    <div className="sm-overlay" onClick={onClose}>
      <div className="sm-modal" style={{maxWidth:600}} onClick={e=>e.stopPropagation()}>
        <h2>Salary History</h2>
        <p style={{fontSize:13,color:'#4b5563',marginBottom:16}}>
          Historical records for <strong>{emp.first_name} {emp.last_name}</strong>
          {inactiveInfo && <><br/><span style={{color:'#ef4444',fontWeight:'bold',fontSize:12}}>(Inactive since: {inactiveInfo.date})</span></>}
        </p>
        <div style={{border:'1px solid #e5e7eb',borderRadius:6,overflow:'hidden'}}>
          <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
            <thead style={{background:'#f9fafb'}}>
              <tr>
                {['MONTH','TARGET','ACHIEVED','FINAL SALARY','PAID ON'].map(h=>(
                  <th key={h} style={{padding:'5px 8px',textAlign:'left',fontWeight:'bold',color:'#374151',borderBottom:'1px solid #e5e7eb',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hist.length === 0
                ? <tr><td colSpan={5} style={{textAlign:'center',padding:16,color:'#6b7280'}}>No past salary history available.</td></tr>
                : hist.map((h,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid #e5e7eb'}}>
                    <td style={{padding:'5px 8px',fontWeight:'bold',whiteSpace:'nowrap'}}>{MONTHS_SHORT[h.month]} {h.year}</td>
                    <td style={{padding:'5px 8px',whiteSpace:'nowrap'}}>{fmt(h.target)}</td>
                    <td style={{padding:'5px 8px',whiteSpace:'nowrap'}}>{fmt(h.achieved)}</td>
                    <td style={{padding:'5px 8px',fontWeight:'bold',color:'#2563eb',whiteSpace:'nowrap'}}>{fmt(h.finalSalary)}</td>
                    <td style={{padding:'5px 8px',color:'#6b7280',fontSize:11,whiteSpace:'nowrap'}}>{h.paidOn}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <div className="sm-flex-right" style={{marginTop:24}}>
          <button className="sm-btn sm-btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Salary Table Row ─────────────────────────────────────────────────────────
function SalRow({ emp, calc, processed, deptMap, isLockedMonth, onTeam, onDeduct, onToggle }) {
  if (isLockedMonth) {
    return (
      <tr>
        <td>
          <div style={{fontWeight:'bold'}}>{emp.first_name} {emp.last_name}</div>
          <div style={{fontSize:11,color:'#6b7280'}}>{emp.employee_id||''}</div>
        </td>
        <td>
          <div style={{fontWeight:'bold',color:'#374151'}}>{teamName(emp, deptMap)}</div>
          <div style={{fontSize:11,color:'#6b7280'}}>{displayText(emp.designation, '—')}</div>
        </td>
        <td colSpan={18} style={{color:'#d1d5db',textAlign:'center'}}>—</td>
      </tr>
    );
  }

  // finalScore IS the "Final" from attendance page — use it directly as present days
  const finalScore       = calc.hasPresentData ? calc.finalScore : null;
  const totalDaysInMonth = calc.totalDaysInMonth || 0;
  const isMidMonthJoiner = calc.hasPresentData && calc.effectiveDays < totalDaysInMonth;
  return (
    <tr className={processed ? 'processed' : ''}>
      <td>
        <div style={{fontWeight:'bold'}}>{emp.first_name} {emp.last_name}</div>
        <div style={{fontSize:11,color:'#6b7280'}}>{emp.employee_id||''}</div>
      </td>
      <td>
        <div style={{fontWeight:'bold',color:'#374151'}}>{teamName(emp, deptMap)}</div>
        <div style={{fontSize:11,color:'#6b7280'}}>{displayText(emp.designation, '—')}</div>
      </td>
      <td>{inr(calc.monthlySalary)}</td>
      {/* DAYS PRESENT — shows finalScore (attendance page "Final" column) with breakdown */}
      <td style={{textAlign:'center'}}>
        {calc.hasPresentData
          ? (
            <div>
              <span style={{fontWeight:'bold',fontSize:14,
                color: calc.absentDays === 0 ? '#059669' : '#f97316'}}>
                {finalScore != null && formatAttendanceDays(finalScore)}
              </span>
              <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>
                / {isMidMonthJoiner ? calc.effectiveDays : totalDaysInMonth} days
                {isMidMonthJoiner && <span style={{color:'#8b5cf6'}}> (joined mid)</span>}
              </div>
            </div>
          )
          : <span style={{color:'#d1d5db',fontSize:11}}>—</span>
        }
      </td>
      <td title="Base Monthly Target">{fmt(calc.baseTarget)}</td>
      <td style={{color:'#ef4444'}} title="Shortfall carried from previous month">{fmt(calc.cf)||''}</td>
      {/* INDI */}
      <td>{fmt(calc.indi)}</td>
      {/* TEAM — clickable */}
      <td className="sm-team-cell" onClick={onTeam}>{fmt(calc.teamRcvd)||'0'}</td>
      <td>{fmt(calc.overallBiz)}</td>
      <td>{fmt(calc.finalBiz)}</td>
      <td style={{fontWeight:'bold',color:calc.shortfall>0?'#ef4444':'inherit'}}>{fmt(calc.shortfall)}</td>
      <td>{fmt(Math.round(calc.incentive))||'0'}</td>
      <td>
        <div style={{fontWeight:'bold'}}>{fmt(Math.round(calc.finalSalary))}</div>
        {calc.isSalaryHeld && (
          <div style={{fontSize:10,color:'#fb923c',marginTop:1,fontWeight:'bold'}}>
            salary held
          </div>
        )}
        {calc.hasPresentData && calc.attendanceDed > 0 && (
          <div style={{fontSize:10,color:'#ef4444',marginTop:1}}>
            -{fmt(calc.attendanceDed)} att.
          </div>
        )}
      </td>
      {/* DEDUCTION & REIMBURSEMENT — clickable */}
      <td className="sm-ded-cell" onClick={onDeduct}>
        {calc.hasPresentData && calc.attendanceDed > 0 && (
          <div style={{fontWeight:'bold',fontSize:12,color:'#f97316'}}>
            -{fmt(calc.attendanceDed)} absent
          </div>
        )}
        <div style={{fontWeight:'bold',fontSize:13,color:'#ef4444'}}>{fmt(calc.totalDeds)||'0'}</div>
        {calc.totalReimb > 0 && <div style={{fontWeight:'bold',fontSize:12,color:'#059669'}}>+{fmt(calc.totalReimb)} reimb</div>}
        {calc.advanceBalance > 0 && (
          <div style={{fontSize:10,color:'#6b7280',marginTop:2,lineHeight:1.2}}>
            {calc.advRecovered > 0 && <><span style={{color:'#059669'}}>Rec: {fmt(calc.advRecovered)}</span><br/></>}
            <span style={{color:'#ef4444'}}>Due: {fmt(calc.remainingAdv)}</span>
          </div>
        )}
      </td>
      <td style={{fontWeight:'bold',color: calc.isSalaryHeld ? '#fb923c' : '#2563eb'}}>
        {calc.isSalaryHeld ? (
          <div>
            <div>HELD</div>
            <div style={{fontSize:10,color:'#6b7280',fontWeight:'normal'}}>
              gross {fmt(Math.round(calc.grossAccountTransfer || 0))}
            </div>
          </div>
        ) : fmt(Math.round(calc.accountTransfer))}
      </td>
      <td style={{fontFamily:'monospace',fontSize:11}}>{emp.salary_account_name||''}</td>
      <td style={{fontFamily:'monospace',fontSize:11}}>{emp.salary_account_number||''}</td>
      <td style={{fontSize:11}}>{emp.salary_bank_name||''}</td>
      <td style={{fontFamily:'monospace',fontSize:11}}>{emp.salary_ifsc_code||''}</td>
      <td style={{textAlign:'center'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
          {processed
            ? <>
                <span className="sm-status-processed">✓ Done</span>
                <button onClick={onToggle}
                  style={{background:'none',border:'1px solid #d1d5db',padding:'2px 8px',borderRadius:4,fontSize:11,cursor:'pointer',color:'#4b5563'}}>
                  Undo
                </button>
              </>
            : <button onClick={onToggle}
                style={{background:'#2563eb',border:'none',color:'white',padding:'5px 12px',borderRadius:4,fontSize:11,cursor:'pointer',fontWeight:'bold'}}>
                Mark Done
              </button>
          }
        </div>
      </td>
    </tr>
  );
}

// ─── Performance Tab ──────────────────────────────────────────────────────────
function PerfTab({ calcRows, history, startMonth }) {
  const [perfDate, setPerfDate] = useState(() => new Date(now.getFullYear(), now.getMonth()));

  const changeMonth = d => setPerfDate(prev => new Date(prev.getFullYear(), prev.getMonth() + d));

  const numCols = 4;
  const cols = Array.from({length: numCols}, (_,i) => new Date(perfDate.getFullYear(), perfDate.getMonth()+i));

  const endDate = cols[cols.length-1];
  const rangeLabel = `${MONTHS_SHORT[perfDate.getMonth()]} ${perfDate.getFullYear()} - ${MONTHS_SHORT[endDate.getMonth()]} ${endDate.getFullYear()}`;

  const curM = now.getMonth(), curY = now.getFullYear();

  return (
    <>
      <div className="sm-toolbar" style={{borderRadius:8,marginBottom:2,justifyContent:'space-between'}}>
        <h2 style={{margin:0,fontSize:16,color:'#1f2937'}}>Monthly Performance Dashboard</h2>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="sm-btn sm-btn-outline" style={{padding:'4px 8px'}} onClick={()=>changeMonth(-1)}>← Prev</button>
          <div style={{fontWeight:'bold',fontSize:14,minWidth:200,textAlign:'center'}}>{rangeLabel}</div>
          <button className="sm-btn sm-btn-outline" style={{padding:'4px 8px'}} onClick={()=>changeMonth(1)}>Next →</button>
        </div>
      </div>
      <div className="sm-table-wrap">
        <table className="sm-table">
          <thead>
            <tr>
              <th style={{width:150}}>NAME</th>
              <th style={{width:180}}>TEAM & DESIGNATION</th>
              {cols.map(c=><th key={c} style={{width:200,textAlign:'left'}}>{MONTHS_SHORT[c.getMonth()]} {c.getFullYear()}</th>)}
            </tr>
          </thead>
          <tbody>
            {calcRows.map(({emp, calc, id}) => {
              const empHist = (history[id] || []);
              return (
                <tr key={id}>
                  <td>{emp.first_name} {emp.last_name}</td>
                  <td>
                    <div style={{fontWeight:'bold',color:'#374151'}}>{teamName(emp, {}, '—')}</div>
                    <div style={{fontSize:11,color:'#6b7280'}}>{displayText(emp.designation, '—')}</div>
                  </td>
                  {cols.map(c => {
                    const isCur = c.getMonth()===curM && c.getFullYear()===curY;
                    const isBeforeStart = isBeforeSalaryStart(c.getFullYear(), c.getMonth(), startMonth);
                    if (isBeforeStart) {
                      return <td key={c}><div className="sm-perf-cell sm-perf-nodata"><span style={{fontSize:10,fontWeight:'bold',color:'#d1d5db',letterSpacing:1}}>NO DATA</span></div></td>;
                    }

                    const hRec = empHist.find(h => h.month===c.getMonth() && h.year===c.getFullYear());

                    let achieved, target, indi, team;
                    if (isCur) {
                      achieved = calc.overallBiz; target = calc.totalTarget;
                      indi = calc.indi; team = calc.teamRcvd;
                    } else if (hRec) {
                      achieved = hRec.achieved; target = hRec.target;
                      indi = hRec.indi||hRec.achieved; team = hRec.team||0;
                    } else {
                      return <td key={c}><div className="sm-perf-cell sm-perf-nodata"><span style={{fontSize:10,fontWeight:'bold',color:'#d1d5db',letterSpacing:1}}>NO DATA</span></div></td>;
                    }

                    const ok = achieved >= target;
                    return (
                      <td key={c}>
                        <div className={`sm-perf-cell ${ok?'sm-perf-success':'sm-perf-danger'}`}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6,borderBottom:'1px solid rgba(0,0,0,.06)',paddingBottom:6}}>
                            <div>
                              <div style={{fontSize:9,fontWeight:'bold',color:'#6b7280',textTransform:'uppercase',letterSpacing:.5,marginBottom:1}}>Target: {fmt(target)}</div>
                              <div style={{fontSize:12,fontWeight:900,color:'#111827'}}>Total: {fmt(achieved)}</div>
                            </div>
                            <span className={`sm-badge ${ok?'sm-badge-s':'sm-badge-d'}`}>{ok?'✓ ACHIEVED':'⚠ MISSED'}</span>
                          </div>
                          <div style={{fontSize:10,display:'flex',flexDirection:'column',gap:2,color:'#4b5563'}}>
                            <div style={{display:'flex',justifyContent:'space-between'}}><span>Indi:</span><strong>{fmt(indi)}</strong></div>
                            <div style={{display:'flex',justifyContent:'space-between'}}><span>Team:</span><strong>+{fmt(team)}</strong></div>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalaryManagement() {
  injectCSS();

  const perms = getUserPermissions();

  // Check role name from userData — allow superadmin OR any HR role
  const userData  = (() => { try { return JSON.parse(localStorage.getItem('userData') || '{}'); } catch { return {}; } })();
  const roleName  = displayText(userData.role || userData.role_name || userData.designation, '').toLowerCase();
  const isHrRole  = roleName.includes('hr');
  const canAccess = isSuperAdmin(perms) || userData.is_super_admin || isHrRole;
  const isAdmin   = canAccess;

  // Block access for non-HR, non-superadmin users
  if (!canAccess) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        minHeight:'100vh', background:'#f9fafb', fontFamily:'Arial, sans-serif' }}>
        <div style={{ background:'white', border:'1px solid #fca5a5', borderRadius:12,
          padding:'40px 48px', textAlign:'center', maxWidth:420, boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
          <h2 style={{ color:'#b91c1c', margin:'0 0 8px', fontSize:20 }}>Access Denied</h2>
          <p style={{ color:'#6b7280', fontSize:14, margin:'0 0 24px', lineHeight:1.6 }}>
            Salary management is accessible to HR and Super Admins only.
          </p>
          <button onClick={() => window.history.back()}
            style={{ background:'#2563eb', color:'white', border:'none',
              borderRadius:6, padding:'10px 24px', cursor:'pointer', fontWeight:'bold', fontSize:14 }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const [tab, setTab] = useState('pending');

  // current salary month
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());

  // ── Salary system start month ──────────────────────────────────────────────
  // Months before this are not shown. Configurable by admin (stored in localStorage + DB).
  const [startMonth, setStartMonth] = useState(() => {
    const saved = loadJ(LS.SAL_START, null);
    return isValidStartMonth(saved) ? saved : DEFAULT_SALARY_START_MONTH;
  });
  // { year, month } e.g. { year: 2026, month: 4 } = May 2026

  // Per-month salary/target override map: { empId: { salary, monthly_target, settled_target } }
  const [monthlyConfigMap, setMonthlyConfigMap] = useState({});

  // employees
  const [activeEmps,   setActiveEmps]   = useState([]);
  const [inactiveEmps, setInactiveEmps] = useState([]);
  const [deptMap,      setDeptMap]      = useState({});
  const [roleMap,      setRoleMap]      = useState({});
  const [warnings,     setWarnings]     = useState({}); // empId → []
  const [loading,      setLoading]      = useState(true);
  const [warnLoad,     setWarnLoad]     = useState(false);
  const [error,        setError]        = useState(null);

  // ── HRMS Finance (DB-backed): reimbursements, advances, deductions ──────────
  const [hrmsReimbs,   setHrmsReimbs]   = useState([]); // approved/paid this month
  const [hrmsAdvances, setHrmsAdvances] = useState([]); // all approved advances
  const [hrmsDeducts,  setHrmsDeducts]  = useState([]); // approved deductions this month
  const [hrmsHolds,    setHrmsHolds]    = useState([]); // held salaries this month
  const [hrmsLoad,     setHrmsLoad]     = useState(false);

  // ── Attendance present days ─────────────────────────────────────────────────
  const [presentDaysMap, setPresentDaysMap] = useState({}); // empId → presentDays (float)

  // persistent state (localStorage)
  const [allocs,     setAllocs]     = useState(() => loadJ(LS.ALLOCS,    []).filter(a=>a.month===now.getMonth()&&a.year===now.getFullYear()));
  const [deducts,    setDeducts]    = useState(() => loadJ(LS.DEDUCTS,   []).filter(d=>d.month===now.getMonth()&&d.year===now.getFullYear()));
  const [processed,  setProcessed]  = useState(() => loadJ(LS.PROCESSED, []));
  const [advMap,     setAdvMap]     = useState(() => loadJ(LS.ADV,       {})); // empId→number
  const [cfMap,      setCfMap]      = useState(() => loadJ(LS.CF,        {})); // periodK→shortfall
  const [inactMap,   setInactMap]   = useState(() => loadJ(LS.INACTIVE,  {})); // empId→{date}
  const [histMap,    setHistMap]    = useState(() => loadJ(LS.HISTORY,   {})); // empId→[...]

  // filters
  const [search,  setSearch]  = useState('');
  const [teamF,   setTeamF]   = useState('All');
  const [desigF,  setDesigF]  = useState('All');

  // modals
  const [allocModal,  setAllocModal]  = useState(null); // emp
  const [dedModal,    setDedModal]    = useState(null); // emp
  const [histModal,   setHistModal]   = useState(null); // emp

  // ── sync allocs/deducts to localStorage whenever month changes ──────────────
  const allAllocs  = useMemo(() => loadJ(LS.ALLOCS,  []), []);
  const allDeducts = useMemo(() => loadJ(LS.DEDUCTS, []), []);

  useEffect(() => {
    setAllocs(loadJ(LS.ALLOCS,  []).filter(a=>a.month===month&&a.year===year));
    setDeducts(loadJ(LS.DEDUCTS,[]).filter(d=>d.month===month&&d.year===year));
  }, [month, year]);

  // ── load employees ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true); setError(null);
    Promise.all([fetchActive(), fetchInactive(), fetchDepts(), fetchRoles()])
      .then(([act, inact, depts, roles]) => {
        const aList = Array.isArray(act)   ? act   : (act.items   || act.users   || []);
        const iList = Array.isArray(inact) ? inact : (inact.items || inact.users || []);
        setActiveEmps(aList);
        setInactiveEmps(iList);
        const dm={}, rm={};
        depts.forEach(d=>{dm[d._id||d.id]=d.name;});
        roles.forEach(r=>{rm[r._id||r.id]=r.name;});
        setDeptMap(dm); setRoleMap(rm);
      })
      .catch(e=>setError(e.message))
      .finally(()=>setLoading(false));
  }, [isAdmin]);

  // ── load warnings ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin || activeEmps.length === 0) return;
    setWarnLoad(true);
    Promise.all(activeEmps.map(e =>
      fetchWarnings(String(e._id||e.id), year, month).then(ws=>({id:String(e._id||e.id),ws}))
    )).then(res=>{
      const map={};
      res.forEach(({id,ws})=>{map[id]=ws;});
      setWarnings(map);
    }).finally(()=>setWarnLoad(false));
  }, [activeEmps, month, year, isAdmin]);

  // ── load HRMS finance data (single summary call) ─────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    setHrmsLoad(true);
    fetchHrmsFinanceSummary(year, month).then(({ reimbs, advances, deducts, holds }) => {
      setHrmsReimbs(reimbs);
      setHrmsAdvances(advances);
      setHrmsDeducts(deducts);
      setHrmsHolds(holds);
    }).finally(() => setHrmsLoad(false));
  }, [isAdmin, month, year]);

  // ── load attendance present days ────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    const uid = getUid();
    let token = localStorage.getItem('token') || '';
    if (!token) {
      try { const ud = JSON.parse(localStorage.getItem('userData') || '{}'); token = ud.token || ''; } catch {}
    }
    console.log('[SalaryMgmt] Fetching attendance for year:', year, 'month:', month + 1, 'uid:', uid, 'hasToken:', !!token);
    fetchAttendancePresentDays(year, month + 1).then(map => {
      console.log('[SalaryMgmt] setPresentDaysMap with', Object.keys(map).length, 'entries');
      setPresentDaysMap(map);
    });
  }, [isAdmin, month, year]);

  // ── load per-month salary/target config ────────────────────────────────────
  useEffect(() => {
    if (!isAdmin || activeEmps.length === 0) return;
    const ids = activeEmps.map(e => String(e._id || e.id)).filter(Boolean);
    if (ids.length === 0) return;
    const uid = getUid();
    apiFetch(`/employee-monthly-config/bulk?user_id=${uid}&year=${year}&month=${month}&employee_ids=${ids.join(',')}`)
      .then(res => { setMonthlyConfigMap(res.data || {}); })
      .catch(() => { /* fallback to live emp values */ });

    // Also fetch global start month (once)
    apiFetch(`/employee-monthly-config/start-month?user_id=${uid}`)
      .then(res => {
        if (isValidStartMonth(res.data)) {
          setStartMonth(res.data);
          saveJ(LS.SAL_START, res.data);
        }
      })
      .catch(() => {});
  }, [isAdmin, activeEmps, month, year]);

  useEffect(() => {
    // Keep a deterministic fallback so behavior is stable even before API responds.
    if (!isValidStartMonth(loadJ(LS.SAL_START, null))) {
      saveJ(LS.SAL_START, startMonth);
    }
  }, [startMonth]);

  // ── computed calc rows ──────────────────────────────────────────────────────
  // Build per-employee advance balance from DB (hrms_advance_salary)
  const dbAdvMap = useMemo(() => {
    const map = {};
    hrmsAdvances.forEach(adv => {
      const empId = adv.employee_id;
      if (!empId) return;
      const outstanding = num(adv.amount) - num(adv.paid_amount || 0);
      map[empId] = (map[empId] || 0) + outstanding;
    });
    return map;
  }, [hrmsAdvances]);

  const calcRows = useMemo(() => {
    return activeEmps.map(emp => {
      const id = String(emp._id||emp.id);
      const pk = periodKey => cfMap[periodKey] || 0;
      const prevM = month===0?11:month-1;
      const prevY = month===0?year-1:year;
      // ── Per-month salary/target override ────────────────────────────────────
      // Salary/monthly_target can inherit from employee/current config. settled_target is exact-month only.
      const monthCfg = monthlyConfigMap[id] || {};
      const cf = monthCfg.carry_forward_shortfall != null
        ? num(monthCfg.carry_forward_shortfall)
        : pk(`${id}_${prevM}_${prevY}`);
      const empWithMonthlyValues = {
        ...emp,
        salary:         monthCfg.salary         != null ? monthCfg.salary         : emp.salary,
        monthly_target: monthCfg.monthly_target  != null ? monthCfg.monthly_target  : emp.monthly_target,
        settled_target: monthCfg.settled_target  != null ? monthCfg.settled_target  : 0,
      };

      // Advance balance: DB-sourced takes priority, falls back to localStorage
      const adv = (dbAdvMap[id] != null ? dbAdvMap[id] : advMap[id]) || 0;
      const ws  = warnings[id] || [];

      // Merge localStorage deductions with hrms_deductions (DB-backed, approved, this month)
      const hrmsEmpDeds = hrmsDeducts
        .filter(d => String(d.employee_id) === id)
        .map(d => ({
          id: d._id, empId: id,
          type: displayText(d.deduction_type, 'Fine'),
          desc: `${displayText(d.description, '')} [auto]`,
          amount: num(d.amount),
          isReimbursement: false,
          isAuto: true,
        }));

      // Merge localStorage reimbursements with hrms_reimbursements (DB-backed, approved/paid, this month)
      const hrmsEmpReimbs = hrmsReimbs
        .filter(r => String(r.employee_id) === id)
        .map(r => ({
          id: r._id, empId: id,
          type: displayText(r.category, 'Other'),
          desc: `${displayText(r.description, '')} [auto]`,
          amount: num(r.amount),
          isReimbursement: true,
          isAuto: true,
        }));

      // Combined: localStorage entries + DB entries (dedup by id to avoid double-counting)
      const localDedIds = new Set(deducts.filter(d=>d.empId===id).map(d=>d.id));
      const mergedDeds = [
        ...deducts.filter(d => d.empId === id),
        ...hrmsEmpDeds.filter(d => !localDedIds.has(d.id)),
        ...hrmsEmpReimbs.filter(r => !localDedIds.has(r.id)),
      ];

      const empCode = String(emp.employee_id || '');
      const attData = presentDaysMap[id] || (empCode ? presentDaysMap[empCode] : null) || null;
      const salaryHold = hrmsHolds.find(h => String(h.employee_id) === id && h.status === 'held') || null;
      const c = calcRow(empWithMonthlyValues, allocs, mergedDeds, adv, cf, ws,
        attData ? attData.finalScore : null,
        new Date(year, month + 1, 0).getDate(),
        attData ? attData.presentScore : null,
        attData ? attData.plAdded : 0,
        attData ? attData.effectiveDays : null,
        attData ? attData.elAdded : 0,
        salaryHold
      );
      return { emp: empWithMonthlyValues, calc: { ...c, advanceBalance: adv }, id };
    });
  }, [activeEmps, allocs, deducts, advMap, cfMap, warnings, month, year,
      monthlyConfigMap,
      hrmsReimbs, hrmsAdvances, hrmsDeducts, hrmsHolds, dbAdvMap, presentDaysMap]);

  // ── filters ─────────────────────────────────────────────────────────────────
  const teams  = useMemo(()=>[...new Set(activeEmps.map(e=>teamName(e, deptMap, '')).filter(Boolean))].sort(),[activeEmps,deptMap]);
  const desigs = useMemo(()=>[...new Set(activeEmps.map(e=>displayText(e.designation)).filter(Boolean))].sort(),[activeEmps]);

  const filtered = useMemo(() => {
    return calcRows.filter(({emp}) => {
      const name = `${emp.first_name||''} ${emp.last_name||''}`.toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (teamF  !== 'All' && teamName(emp, deptMap, '') !== teamF)  return false;
      if (desigF !== 'All' && displayText(emp.designation) !== desigF) return false;
      return true;
    });
  }, [calcRows, search, teamF, desigF, deptMap]);

  const selectedBeforeStart = useMemo(
    () => isBeforeSalaryStart(year, month, startMonth),
    [year, month, startMonth]
  );

  const isPro  = id => processed.includes(periodK(id, month, year));
  const pending   = selectedBeforeStart ? filtered : filtered.filter(r => !isPro(r.id));
  const completed = selectedBeforeStart ? [] : filtered.filter(r =>  isPro(r.id));

  // ── actions ─────────────────────────────────────────────────────────────────
  const toggleProcessed = useCallback((id) => {
    if (selectedBeforeStart) return;
    const key = periodK(id, month, year);
    const emp = activeEmps.find(e=>String(e._id||e.id)===id)||{};
    const row = calcRows.find(r=>r.id===id);
    let newP;
    if (processed.includes(key)) {
      // Un-marking as done: also remove carry forward that was saved for this period
      newP = processed.filter(k=>k!==key);
      const existingCf = loadJ(LS.CF, {});
      const cfKey = periodK(id, month, year);
      if (existingCf[cfKey] !== undefined) {
        const updatedCf = { ...existingCf };
        delete updatedCf[cfKey];
        setCfMap(updatedCf);
        saveJ(LS.CF, updatedCf);
      }
    } else {
      // save history
      const hist = loadJ(LS.HISTORY, {});
      if (!hist[id]) hist[id] = [];
      hist[id] = hist[id].filter(h=>!(h.month===month&&h.year===year));
      const d=new Date();
      hist[id].push({ month, year,
        target:   row?.calc.totalTarget || 0,
        achieved: row?.calc.overallBiz  || 0,
        indi:     row?.calc.indi        || 0,
        team:     row?.calc.teamRcvd    || 0,
        shortfall: row?.calc.shortfall  || 0,
        finalSalary: Math.round(row?.calc.finalSalary||0),
        paidOn: `${String(d.getDate()).padStart(2,'0')}-${MONTHS_SHORT[d.getMonth()]}-${d.getFullYear()}`,
      });
      saveJ(LS.HISTORY, hist);
      setHistMap(hist);

      // ── Save shortfall as carry forward into NEXT month ──────────────
      // Format: { "empId_month_year": shortfallAmount }
      // e.g. marking May done with shortfall → saves as "empId_4_2026" so
      // June's calcRow picks it up as prevM=4 prevY=2026
      const shortfall = row?.calc.shortfall || 0;
      const existingCf = loadJ(LS.CF, {});
      const cfKey = periodK(id, month, year); // current month key
      const updatedCf = { ...existingCf };
      if (shortfall > 0) {
        updatedCf[cfKey] = shortfall;
      } else {
        // If no shortfall this month, clear any old carry forward for this period
        delete updatedCf[cfKey];
      }
      setCfMap(updatedCf);
      saveJ(LS.CF, updatedCf);

      newP = [...processed, key];
    }
    setProcessed(newP);
    saveJ(LS.PROCESSED, newP);
  }, [processed, month, year, activeEmps, calcRows, selectedBeforeStart]);

  const deactivateEmp = useCallback((id) => {
    const emp = activeEmps.find(e=>String(e._id||e.id)===id)||{};
    if (!confirm(`Are you sure you want to mark ${emp.first_name} ${emp.last_name} as Inactive?`)) return;
    const d=new Date();
    const date=`${d.getDate()}-${MONTHS_SHORT[d.getMonth()]}-${d.getFullYear()}`;
    const newInact = {...inactMap, [id]: {date}};
    setInactMap(newInact);
    saveJ(LS.INACTIVE, newInact);
    setActiveEmps(prev=>prev.filter(e=>String(e._id||e.id)!==id));
  }, [activeEmps, inactMap]);

  // allocs
  const handleAllocSave = useCallback((data) => {
    let newAllocs;
    if (data.__remove) {
      newAllocs = [...loadJ(LS.ALLOCS,[]).filter(a=>a.id!==data.__remove)];
    } else {
      const full = {...data, month, year};
      newAllocs = [...loadJ(LS.ALLOCS,[]).filter(a=>!(a.fromId===full.fromId&&a.toId===full.toId&&a.month===month&&a.year===year)), full];
    }
    saveJ(LS.ALLOCS, newAllocs);
    setAllocs(newAllocs.filter(a=>a.month===month&&a.year===year));
  }, [month, year]);

  // deductions
  const handleDedSave = useCallback((data) => {
    let newDeds;
    if (data.__remove) {
      newDeds = loadJ(LS.DEDUCTS,[]).filter(d=>d.id!==data.__remove);
    } else {
      newDeds = [...loadJ(LS.DEDUCTS,[]), {...data.__add, month, year}];
    }
    saveJ(LS.DEDUCTS, newDeds);
    setDeducts(newDeds.filter(d=>d.month===month&&d.year===year));
  }, [month, year]);

  // guard removed — route is open to all authenticated users

  const showSalaryView = tab === 'pending' || tab === 'completed';
  const displayRows    = tab === 'pending' ? pending : completed;

  const TH_COLS = [
    {label:'NAME'}, {label:'TEAM & DESIGNATION'}, {label:'SALARY'},
    {label:'DAYS PRESENT', title:'Present days in this month (full + half×0.5)', center:true},
    {label:'MONTHLY TARGET',title:'Current Month Base Target'},
    {label:'CARRYFORWARD',title:'Shortfall from previous month'},{label:'INDIVIDUAL ACHIEVEMENT',cls:'hl-yellow'},
    {label:'TEAM ACHIEVEMENT',cls:'hl-yellow',title:'Click a cell to manage team achievements'},
    {label:'OVERALL BUISNESS'},{label:'FINAL BUISNESS',cls:'hl-green'},
    {label:'SHORTFALL',title:'Target + Carryforward - Final Business'},{label:'INCENTIVE AMOUNT'},
    {label:'FINAL SALARY'},{label:'DEDUCTION & REIMBURSEMENT',title:'Click to manage deductions & reimbursements'},
    {label:'ACCOUNT TRANSFER'},{label:'ACCOUNT NAME'},{label:'ACCOUNT NUMBER'},{label:'BANK NAME'},{label:'IFSC'},
    {label:'ACTION', center:true},
  ];

  return (
    <div className="sm-body">
      {/* Modals */}
      {allocModal && (
        <AllocModal beneficiary={allocModal} calcRows={calcRows}
          allocs={allocs.filter(a=>a.toId===String(allocModal._id||allocModal.id))}
          onSave={handleAllocSave} onClose={()=>setAllocModal(null)}/>
      )}
      {dedModal && (() => {
        const row = calcRows.find(r=>r.id===String(dedModal._id||dedModal.id));
        return row ? (
          <DedModal emp={dedModal} calc={row.calc}
            onSave={data=>{handleDedSave(data);}}
            onClose={()=>setDedModal(null)}/>
        ) : null;
      })()}
      {histModal && (
        <HistModal emp={histModal} inactiveInfo={inactMap[String(histModal._id||histModal.id)]} startMonth={startMonth}
          onClose={()=>setHistModal(null)}/>
      )}

      {/* Tabs */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',padding:'16px 16px 0'}}>
        <div className="sm-tabs" style={{margin:0}}>
          {[['pending',`Pending`],['completed','Completed'],['history','History'],['performance','Performance'],['inactive','Inactive']].map(([t,l])=>(
            <button key={t} className={`sm-tab${tab===t?' active':''}`} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select value={month} onChange={e=>setMonth(Number(e.target.value))}
            style={{padding:'6px 8px',border:'1px solid #d1d5db',borderRadius:4,fontSize:13}}>
            {MONTHS_FULL.map((m,i)=><option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e=>setYear(Number(e.target.value))}
            style={{padding:'6px 8px',border:'1px solid #d1d5db',borderRadius:4,fontSize:13}}>
            {[year-1,year,year+1].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          {/* Start Month Config */}
          {startMonth && (
            <span style={{fontSize:11,color:'#6b7280',background:'#f3f4f6',padding:'4px 8px',borderRadius:4,border:'1px solid #e5e7eb'}}>
              📅 Start: {MONTHS_FULL[startMonth.month]} {startMonth.year}
            </span>
          )}
          {warnLoad && <span style={{fontSize:12,color:'#f59e0b'}}>Loading warnings…</span>}
          {hrmsLoad && <span style={{fontSize:12,color:'#8b5cf6'}}>Loading finance data…</span>}
          <span style={{fontSize:11,color:'#9ca3af',background:'#f3f4f6',padding:'2px 6px',borderRadius:3}}>
            Att: {Object.keys(presentDaysMap).length} emp
          </span>
        </div>
      </div>

      {selectedBeforeStart && (
        <div style={{margin:'10px 16px 0',padding:'10px 12px',background:'#fff7ed',border:'1px solid #fdba74',borderRadius:8,color:'#9a3412',fontSize:12}}>
          Showing blank values because salary rules apply from {MONTHS_FULL[startMonth.month]} {startMonth.year}.
        </div>
      )}

      {loading ? (
        <div style={{textAlign:'center',padding:60,color:'#6b7280',fontSize:14}}>Loading employees…</div>
      ) : error ? (
        <div style={{textAlign:'center',padding:60,color:'#ef4444'}}>❌ {error}</div>
      ) : tab === 'performance' ? (
        <PerfTab
          calcRows={calcRows}
          history={Object.fromEntries(
            Object.entries(histMap).map(([empId, list]) => [
              empId,
              Array.isArray(list) ? list.filter(h => isRecordOnOrAfterStart(h.year, h.month, startMonth)) : []
            ])
          )}
          startMonth={startMonth}
        />
      ) : tab === 'history' ? (
        <>
          <div className="sm-toolbar" style={{borderRadius:8,marginBottom:2}}>
            <h2 style={{margin:0,fontSize:16,color:'#1f2937'}}>Salary History — All Employees</h2>
          </div>
          <div className="sm-table-wrap">
            <table className="sm-table">
              <thead>
                <tr>
                  <th style={{textAlign:'left'}}>NAME</th>
                  <th style={{textAlign:'left'}}>TEAM & DESIGNATION</th>
                  <th>MONTH</th>
                  <th>TARGET</th>
                  <th>ACHIEVED</th>
                  <th>FINAL SALARY</th>
                  <th>PAID ON</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows = [];
                  activeEmps.forEach(emp => {
                    const id = String(emp._id||emp.id);
                    const hist = (histMap[id]||[])
                      .filter(h => isRecordOnOrAfterStart(h.year, h.month, startMonth))
                      .slice()
                      .reverse();
                    hist.forEach((h,i) => {
                      rows.push(
                        <tr key={`${id}_${i}`}>
                          {i===0 ? (
                            <td rowSpan={hist.length} style={{verticalAlign:'top',borderRight:'2px solid #e5e7eb'}}>
                              <div style={{fontWeight:'bold'}}>{emp.first_name} {emp.last_name}</div>
                              <div style={{fontSize:11,color:'#6b7280'}}>{emp.employee_id||''}</div>
                            </td>
                          ) : null}
                          {i===0 ? (
                            <td rowSpan={hist.length} style={{verticalAlign:'top',textAlign:'left',borderRight:'2px solid #e5e7eb'}}>
                              <div style={{fontWeight:'bold',color:'#374151'}}>{teamName(emp, deptMap)}</div>
                              <div style={{fontSize:11,color:'#6b7280'}}>{displayText(emp.designation, '—')}</div>
                            </td>
                          ) : null}
                          <td style={{fontWeight:'bold'}}>{MONTHS_SHORT[h.month]} {h.year}</td>
                          <td>{fmt(h.target)}</td>
                          <td>{fmt(h.achieved)}</td>
                          <td style={{fontWeight:'bold',color:'#2563eb'}}>₹{fmt(h.finalSalary)}</td>
                          <td style={{color:'#6b7280',fontSize:11}}>{h.paidOn}</td>
                        </tr>
                      );
                    });
                    if (hist.length === 0) {
                      rows.push(
                        <tr key={id}>
                          <td style={{textAlign:'left'}}>
                            <div style={{fontWeight:'bold'}}>{emp.first_name} {emp.last_name}</div>
                            <div style={{fontSize:11,color:'#6b7280'}}>{emp.employee_id||''}</div>
                          </td>
                          <td style={{textAlign:'left'}}>
                            <div style={{fontWeight:'bold',color:'#374151'}}>{teamName(emp, deptMap)}</div>
                            <div style={{fontSize:11,color:'#6b7280'}}>{displayText(emp.designation, '—')}</div>
                          </td>
                          <td colSpan={5} style={{textAlign:'center',color:'#9ca3af',fontSize:12}}>No history yet</td>
                        </tr>
                      );
                    }
                  });
                  if (rows.length === 0) {
                    return <tr><td colSpan={7} style={{textAlign:'center',padding:20,color:'#6b7280'}}>No salary history found.</td></tr>;
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === 'inactive' ? (
        <>
          <div className="sm-toolbar" style={{borderRadius:8,marginBottom:2}}>
            <h2 style={{margin:0,fontSize:16,color:'#1f2937'}}>Inactive Employees Record</h2>
          </div>
          <div className="sm-table-wrap">
            <table className="sm-table">
              <thead>
                <tr>
                  <th>NAME</th><th>TEAM & DESIGNATION</th><th>INACTIVE DATE</th><th>LIFETIME SALARY PAID</th>
                  <th style={{textAlign:'center'}}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {[...inactiveEmps, ...activeEmps.filter(e=>inactMap[String(e._id||e.id)])].length===0
                  ? <tr><td colSpan={5} style={{textAlign:'center',padding:20,color:'#6b7280'}}>No inactive employees found.</td></tr>
                  : [...inactiveEmps, ...activeEmps.filter(e=>inactMap[String(e._id||e.id)])].map(emp => {
                      const id = String(emp._id||emp.id);
                      const info = inactMap[id];
                      const hist = histMap[id] || [];
                      const lifetime = hist.reduce((s,h)=>s+num(h.finalSalary),0);
                      return (
                        <tr key={id}>
                          <td><div style={{fontWeight:'bold'}}>{emp.first_name} {emp.last_name}</div><div style={{fontSize:11,color:'#6b7280'}}>{emp.employee_id||''}</div></td>
                          <td><div style={{fontWeight:'bold',color:'#374151'}}>{teamName(emp, deptMap)}</div><div style={{fontSize:11,color:'#6b7280'}}>{displayText(emp.designation, '—')}</div></td>
                          <td style={{color:'#ef4444',fontWeight:'bold'}}>{info?.date||'Unknown'}</td>
                          <td style={{fontWeight:'bold',color:'#059669'}}>₹{fmt(lifetime)}</td>
                          <td style={{textAlign:'center'}}>
                            <button className="sm-btn sm-btn-outline" style={{fontSize:11,padding:'4px 8px'}}
                              onClick={()=>setHistModal(emp)}>View History</button>
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Toolbar with filters */}
          <div className="sm-toolbar">
            <div className="sm-fg">
              <label>Search Employee</label>
              <input type="text" className="sm-input" placeholder="Type name..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="sm-fg">
              <label>Filter by Team</label>
              <select className="sm-input" value={teamF} onChange={e=>setTeamF(e.target.value)}>
                <option value="All">All Teams</option>
                {teams.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="sm-fg">
              <label>Filter by Designation</label>
              <select className="sm-input" value={desigF} onChange={e=>setDesigF(e.target.value)}>
                <option value="All">All Designations</option>
                {desigs.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="sm-table-wrap">
            <table className="sm-table">
              <thead>
                <tr>
                  {TH_COLS.map(({label,title,cls,center})=>(
                    <th key={label} className={cls||''} title={title||''}
                      style={center?{textAlign:'center'}:{}}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0
                  ? <tr><td colSpan={TH_COLS.length} style={{textAlign:'center',padding:20,color:'#6b7280'}}>No employees found in this view.</td></tr>
                  : displayRows.map(({emp, calc, id}) => (
                    <SalRow key={id} emp={emp} calc={calc} deptMap={deptMap} isLockedMonth={selectedBeforeStart}
                      processed={isPro(id)}
                      onTeam={()=>!selectedBeforeStart && setAllocModal(emp)}
                      onDeduct={()=>!selectedBeforeStart && setDedModal(emp)}
                      onToggle={()=>toggleProcessed(id)}
                    />
                  ))
                }
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
 
