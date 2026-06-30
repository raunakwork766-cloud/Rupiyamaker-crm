/**
 * SalaryManagement.jsx
 * Exact React port of the HTML salary spreadsheet.
 * Light theme · Super Admin only · Standalone page (/hr-salary)
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
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
const cleanPercentText = v => {
  const n = num(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
};
const getSalaryHoldType = hold => hold?.hold_type || (hold?.hold_percentage != null ? 'percentage' : (hold?.hold_amount != null || hold?.salary_amount != null ? 'amount' : 'full'));
const computeSalaryHoldAmount = (hold, grossAccountTransfer) => {
  if (!hold) return 0;
  const payableBase = Math.max(0, num(grossAccountTransfer));
  const holdType = getSalaryHoldType(hold);
  let requested = payableBase;
  if (holdType === 'percentage') {
    const pct = Math.min(100, Math.max(0, num(hold.hold_percentage)));
    requested = (payableBase * pct) / 100;
  } else if (holdType === 'amount') {
    requested = num(hold.hold_amount ?? hold.salary_amount);
  }
  return Math.min(payableBase, Math.max(0, Math.round(requested)));
};
const getSalaryHoldRuleText = hold => {
  if (!hold) return '';
  const holdType = getSalaryHoldType(hold);
  if (holdType === 'percentage') return `${cleanPercentText(hold.hold_percentage)}% hold`;
  if (holdType === 'amount') return `${inr(hold.hold_amount ?? hold.salary_amount)} hold`;
  return 'Full hold';
};
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
const toSafeNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const formatAttendanceDays = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
};
const hasText = value => String(value || '').trim().length > 0;
const employeeDisplayName = emp => `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim();
const getSalaryPaymentDetails = (emp) => {
  const accountName = emp.salary_account_name || employeeDisplayName(emp);
  const hasBank = hasText(emp.salary_account_number) || hasText(emp.salary_bank_name) || hasText(emp.salary_ifsc_code);
  const hasUpi = hasText(emp.salary_upi_id);
  const prefersUpi = String(emp.salary_payment_mode || '').toLowerCase() === 'upi';

  if (prefersUpi && hasUpi) {
    return { mode: 'UPI', accountName, accountNumber: emp.salary_upi_id || '', bankName: '', ifsc: '' };
  }
  if (hasBank) {
    return {
      mode: 'Bank',
      accountName,
      accountNumber: emp.salary_account_number || '',
      bankName: emp.salary_bank_name || '',
      ifsc: emp.salary_ifsc_code || '',
    };
  }
  if (hasUpi) {
    return { mode: 'UPI', accountName, accountNumber: emp.salary_upi_id || '', bankName: '', ifsc: '' };
  }
  return { mode: '', accountName: '', accountNumber: '', bankName: '', ifsc: '' };
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
const getAttendanceRuleSettings = (settings = {}) => ({
  minHalfDayHours: toSafeNumber(
    settings.half_day_minimum_working_hours ?? settings.minimum_working_hours_half_day,
    4.5
  ),
  minFullDayHours: toSafeNumber(
    settings.full_day_working_hours ?? settings.minimum_working_hours_full_day,
    8
  ),
  freeAbscondingDays: toSafeNumber(
    settings.free_absconding_days ?? settings.consecutive_absent_absconding_days,
    2
  )
});
const getDayNumericValue = (status) => {
  switch (status) {
    case 'P': return 1;
    case 'L': return 1;
    case 'HD': return 0.5;
    case 'WK': return 1;
    case 'LV': return 0;
    case 'AB': return 0;
    case 'A': return 0;
    case 'SP': return 1;
    case 'S0': return 0;
    case 'H': return null;
    case 'W': return null;
    default: return null;
  }
};
const applyAttendanceRules = (records, settings, year, month) => {
  if (!settings) return records;
  const MIN_DAYS_FOR_SUNDAY = settings.minimum_working_days_for_sunday ?? 4;
  return records.map(record => {
    const updated = { ...record };
    const daysInM = new Date(year, month, 0).getDate();

    for (let d = 1; d <= daysInM; d++) {
      const dateObj = new Date(year, month - 1, d);
      if (dateObj.getDay() !== 0) continue;

      const currentSunValue = updated[`day${d}`];
      if (currentSunValue && currentSunValue !== 'W') continue;
      if (updated[`day${d}_manualOverride`]) continue;

      const monDay = d + 1;
      let presentDays = 0;
      let hasAnyData = false;

      for (let w = Math.max(1, d - 6); w <= Math.min(daysInM, d - 1); w++) {
        const wDow = new Date(year, month - 1, w).getDay();
        if (wDow === 0) continue;
        const s = updated[`day${w}`];
        if (s === 'P' || s === 'L' || s === 'HD' || s === 'AB' || s === 'LV' || s === 'WK' || s === 'A') hasAnyData = true;
        if (s === 'P' || s === 'L' || s === 'HD' || s === 'H' || s === 'WK') presentDays++;
      }
      if (monDay <= daysInM) {
        const ms = updated[`day${monDay}`];
        if (ms === 'P' || ms === 'L' || ms === 'HD' || ms === 'AB' || ms === 'LV' || ms === 'WK' || ms === 'A') hasAnyData = true;
      }
      if (!hasAnyData) continue;
      if (presentDays >= MIN_DAYS_FOR_SUNDAY) {
        updated[`day${d}`] = 'SP';
      }
    }
    return updated;
  });
};
const calculateMonthlyStats = (record, selectedYear, selectedMonth, daysInMonth, holidays, attendanceSettings = {}) => {
  let presentScore = 0;
  let actualPresent = 0;
  let plLeaveDaysTaken = 0;
  let elLeaveDaysTaken = 0;
  let absconding = 0;
  let absentDays = 0;
  let sundayZeroDays = 0;
  let holidaysCount = 0;
  let halfDaysCount = 0;

  const { startDay, endDay, effectiveDays } = getEffectiveAttendanceWindow(
    selectedYear,
    selectedMonth,
    daysInMonth,
    record.joining_date || record.date_of_joining || null,
    record.inactive_from_date || null
  );
  const { minHalfDayHours, freeAbscondingDays } = getAttendanceRuleSettings(attendanceSettings);

  for (let day = 1; day <= daysInMonth; day++) {
    if (day < startDay || day > endDay) continue;
    const dayKey = `day${day}`;
    const rawStatus = record[dayKey];
    const leaveUnits = Number(record[`${dayKey}_leaveUnits`] || 0);
    const workingHours = Number(record[`${dayKey}_workingHours`] || 0);
    const isLeaveHalfDay = rawStatus === 'HD' && leaveUnits > 0;
    const status = (rawStatus === 'HD' && !isLeaveHalfDay && Number.isFinite(workingHours) && workingHours >= 0 && workingHours < minHalfDayHours)
      ? 'A'
      : rawStatus;
    const val = getDayNumericValue(status);

    if (status === 'H') {
      holidaysCount++;
    } else if (status === 'LV') {
      if (isEarnedLeaveType(record[`${dayKey}_leaveType`])) {
        elLeaveDaysTaken += leaveUnits || 1;
      } else {
        plLeaveDaysTaken += leaveUnits || 1;
      }
    } else if (status === 'AB') {
      absconding++;
    } else if (status === 'A') {
      absentDays++;
    } else if (status === 'S0') {
      sundayZeroDays++;
    } else if (status === 'HD') {
      halfDaysCount++;
      presentScore += 0.5;
      actualPresent += 0.5;
      if (leaveUnits > 0) {
        if (isEarnedLeaveType(record[`${dayKey}_leaveType`])) {
          elLeaveDaysTaken += leaveUnits;
        } else {
          plLeaveDaysTaken += leaveUnits;
        }
      }
    } else if (val !== null) {
      presentScore += val;
      if (val > 0) actualPresent += val;
    }
  }

  presentScore = actualPresent;

  const plAllotted = record.paidLeavesTotal ?? record.plMonthly ?? 1;
  const plRemaining = record.paidLeavesRemaining ?? null;

  const plDays = plRemaining != null ? plRemaining : plAllotted;
  const elAllotted = record.earnedLeavesTotal ?? record.elMonthly ?? 0;
  const elRemaining = record.earnedLeavesRemaining ?? null;
  const elDays = elRemaining != null ? elRemaining : elAllotted;

  const graceMonthly = record.graceMonthlyLimit != null ? record.graceMonthlyLimit : 0;
  const graceRemainingMonthly = record.graceRemaining != null
    ? Math.min(record.graceRemaining, graceMonthly)
    : graceMonthly;

  const plAutoRemaining = plRemaining != null
    ? plRemaining
    : Math.max(0, plDays - plLeaveDaysTaken);
  const elAutoRemaining = elRemaining != null
    ? elRemaining
    : Math.max(0, elDays - elLeaveDaysTaken);

  const baseScore = Math.max(0, presentScore) + plLeaveDaysTaken + elLeaveDaysTaken;
  const shortfallBeforeAutoLeave = Math.max(0, effectiveDays - baseScore);
  const plAutoScore = Math.min(shortfallBeforeAutoLeave, plAutoRemaining);
  const remainingShortfall = shortfallBeforeAutoLeave - plAutoScore;
  const elAutoScore = Math.min(Math.max(0, remainingShortfall), elAutoRemaining);

  const earnedBeforeAbscondingPenalty = Math.min(
    effectiveDays,
    baseScore + plAutoScore + elAutoScore
  );
  const chargedAbsconding = Math.max(0, absconding - freeAbscondingDays);
  const finalScore = Math.max(0, earnedBeforeAbscondingPenalty - chargedAbsconding);

  const plScore = plLeaveDaysTaken + plAutoScore;
  const elScore = elLeaveDaysTaken + elAutoScore;
  const workingDays = effectiveDays - holidaysCount;
  const attendancePercentage = workingDays > 0 ? ((Math.max(0, presentScore) / workingDays) * 100).toFixed(1) : '0';

  return {
    presentScore,
    actualPresent,
    plScore,
    elScore,
    plDays,
    elDays,
    graceRemaining: graceRemainingMonthly,
    graceTotal: graceMonthly,
    finalScore,
    effectiveDays,
    absconding,
    absentDays,
    holidays: holidaysCount,
    workingDays,
    attendancePercentage,
    present: presentScore,
    late: 0,
    leave: plScore + elScore,
    halfDay: halfDaysCount
  };
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
const slugPart = value => String(value || '')
  .replace(/[^a-z0-9]+/gi, '_')
  .replace(/^_+|_+$/g, '');
const exportFileBase = (month, year, suffix = '') =>
  ['Salary', MONTHS_FULL[month], year, suffix].filter(Boolean).map(slugPart).join('_');

const SALARY_EXPORT_COLUMNS = [
  { header: 'S.No', key: 'sno', width: 8 },
  { header: 'Employee Name', key: 'employeeName', width: 24 },
  { header: 'Employee ID', key: 'employeeId', width: 16 },
  { header: 'Team', key: 'team', width: 22 },
  { header: 'Designation', key: 'designation', width: 22 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Salary', key: 'monthlySalary', width: 14, money: true },
  { header: 'Days Present', key: 'daysPresent', width: 12 },
  { header: 'Monthly Target', key: 'monthlyTarget', width: 16, money: true },
  { header: 'Carry Forward', key: 'carryForward', width: 16, money: true },
  { header: 'Individual Achievement', key: 'individualAchievement', width: 20, money: true },
  { header: 'Team Achievement', key: 'teamAchievement', width: 18, money: true },
  { header: 'Overall Business', key: 'overallBusiness', width: 18, money: true },
  { header: 'Final Business', key: 'finalBusiness', width: 16, money: true },
  { header: 'Shortfall', key: 'shortfall', width: 14, money: true },
  { header: 'Incentive Amount', key: 'incentiveAmount', width: 16, money: true },
  { header: 'Attendance Deduction', key: 'attendanceDeduction', width: 18, money: true },
  { header: 'Proration Deduction', key: 'prorationDeduction', width: 18, money: true },
  { header: 'Total Deductions', key: 'totalDeductions', width: 16, money: true },
  { header: 'Total Reimbursements', key: 'totalReimbursements', width: 18, money: true },
  { header: 'Advance Recovered', key: 'advanceRecovered', width: 18, money: true },
  { header: 'Advance Due', key: 'advanceDue', width: 16, money: true },
  { header: 'Final Salary', key: 'finalSalary', width: 16, money: true },
  { header: 'Salary Held Amount', key: 'salaryHeldAmount', width: 18, money: true },
  { header: 'Account Transfer', key: 'accountTransfer', width: 18, money: true },
  { header: 'Salary Hold Rule', key: 'salaryHold', width: 18 },
  { header: 'Payment Mode', key: 'paymentMode', width: 14 },
  { header: 'Account/UPI Name', key: 'accountName', width: 24 },
  { header: 'Account Number / UPI ID', key: 'accountNumber', width: 24 },
  { header: 'Bank Name', key: 'bankName', width: 22 },
  { header: 'IFSC', key: 'ifsc', width: 16 },
];

const SALARY_PDF_COLUMNS = [
  'sno', 'employeeName', 'employeeId', 'team', 'status', 'monthlySalary', 'daysPresent',
  'monthlyTarget', 'finalBusiness', 'shortfall', 'incentiveAmount', 'totalDeductions',
  'totalReimbursements', 'finalSalary', 'salaryHeldAmount', 'accountTransfer', 'salaryHold'
];

const HISTORY_EXPORT_COLUMNS = [
  { header: 'S.No', key: 'sno', width: 8 },
  { header: 'Employee Name', key: 'employeeName', width: 24 },
  { header: 'Employee ID', key: 'employeeId', width: 16 },
  { header: 'Team', key: 'team', width: 22 },
  { header: 'Designation', key: 'designation', width: 22 },
  { header: 'Month', key: 'monthLabel', width: 14 },
  { header: 'Target', key: 'target', width: 16, money: true },
  { header: 'Achieved', key: 'achieved', width: 16, money: true },
  { header: 'Individual Achievement', key: 'individualAchievement', width: 20, money: true },
  { header: 'Team Achievement', key: 'teamAchievement', width: 18, money: true },
  { header: 'Shortfall', key: 'shortfall', width: 14, money: true },
  { header: 'Final Salary', key: 'finalSalary', width: 16, money: true },
  { header: 'Paid On', key: 'paidOn', width: 16 },
];

const INACTIVE_EXPORT_COLUMNS = [
  { header: 'S.No', key: 'sno', width: 8 },
  { header: 'Employee Name', key: 'employeeName', width: 24 },
  { header: 'Employee ID', key: 'employeeId', width: 16 },
  { header: 'Team', key: 'team', width: 22 },
  { header: 'Designation', key: 'designation', width: 22 },
  { header: 'Inactive Date', key: 'inactiveDate', width: 16 },
  { header: 'Lifetime Salary Paid', key: 'lifetimeSalaryPaid', width: 20, money: true },
];

const PERFORMANCE_BASE_COLUMNS = [
  { header: 'S.No', key: 'sno', width: 8 },
  { header: 'Employee Name', key: 'employeeName', width: 24 },
  { header: 'Employee ID', key: 'employeeId', width: 16 },
  { header: 'Team', key: 'team', width: 22 },
  { header: 'Designation', key: 'designation', width: 22 },
];

const buildPerformanceMonths = perfDate =>
  Array.from({ length: 4 }, (_, i) => new Date(perfDate.getFullYear(), perfDate.getMonth() + i));

const buildPerformanceExportColumns = perfMonths => [
  ...PERFORMANCE_BASE_COLUMNS,
  ...perfMonths.flatMap((date, index) => {
    const key = `m${index}`;
    const label = `${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
    return [
      { header: `${label} Target`, key: `${key}Target`, width: 16, money: true },
      { header: `${label} Achieved`, key: `${key}Achieved`, width: 16, money: true },
      { header: `${label} Individual`, key: `${key}Individual`, width: 16, money: true },
      { header: `${label} Team`, key: `${key}Team`, width: 16, money: true },
      { header: `${label} Status`, key: `${key}Status`, width: 14 },
    ];
  })
];

const buildSalaryExportRows = (rows, deptMap, processed, month, year) => rows.map(({ emp, calc, id }, index) => {
  const completed = processed.includes(periodK(id, month, year));
  const paymentDetails = getSalaryPaymentDetails(emp);
  return {
    sno: index + 1,
    employeeName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
    employeeId: emp.employee_id || '',
    team: teamName(emp, deptMap, ''),
    designation: displayText(emp.designation, ''),
    status: completed ? 'Completed' : 'Pending',
    monthlySalary: Math.round(num(calc.monthlySalary)),
    daysPresent: calc.hasPresentData ? formatAttendanceDays(calc.finalScore) : '',
    monthlyTarget: Math.round(num(calc.totalTarget)),
    carryForward: Math.round(num(calc.cf)),
    individualAchievement: Math.round(num(calc.indi)),
    teamAchievement: Math.round(num(calc.teamRcvd)),
    overallBusiness: Math.round(num(calc.overallBiz)),
    finalBusiness: Math.round(num(calc.finalBiz)),
    shortfall: Math.round(num(calc.shortfall)),
    incentiveAmount: Math.round(num(calc.incentive)),
    attendanceDeduction: Math.round(num(calc.attendanceDed)),
    prorationDeduction: Math.round(num(calc.prorationDed)),
    totalDeductions: Math.round(num(calc.totalDeds)),
    totalReimbursements: Math.round(num(calc.totalReimb)),
    advanceRecovered: Math.round(num(calc.advRecovered)),
    advanceDue: Math.round(num(calc.remainingAdv)),
    finalSalary: Math.round(num(calc.finalSalary)),
    salaryHeldAmount: Math.round(num(calc.salaryHoldAmount)),
    accountTransfer: Math.round(num(calc.accountTransfer)),
    salaryHold: calc.isSalaryHeld ? (calc.salaryHoldRule || 'Held') : '',
    paymentMode: paymentDetails.mode,
    accountName: paymentDetails.accountName,
    accountNumber: paymentDetails.accountNumber,
    bankName: paymentDetails.bankName,
    ifsc: paymentDetails.ifsc,
  };
});

const buildHistoryExportRows = (employees, histMap, deptMap, startMonth) => {
  const rows = [];
  employees.forEach(emp => {
    const id = String(emp._id || emp.id);
    const hist = (histMap[id] || [])
      .filter(h => isRecordOnOrAfterStart(h.year, h.month, startMonth))
      .slice()
      .reverse();
    hist.forEach(h => {
      rows.push({
        sno: rows.length + 1,
        employeeName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        employeeId: emp.employee_id || '',
        team: teamName(emp, deptMap, ''),
        designation: displayText(emp.designation, ''),
        monthLabel: `${MONTHS_SHORT[h.month]} ${h.year}`,
        target: Math.round(num(h.target)),
        achieved: Math.round(num(h.achieved)),
        individualAchievement: Math.round(num(h.indi || h.achieved)),
        teamAchievement: Math.round(num(h.team)),
        shortfall: Math.round(num(h.shortfall)),
        finalSalary: Math.round(num(h.finalSalary)),
        paidOn: h.paidOn || '',
      });
    });
  });
  return rows;
};

const buildInactiveExportRows = (inactiveEmps, activeEmps, inactMap, histMap, deptMap) => {
  const seen = new Set();
  return [...inactiveEmps, ...activeEmps.filter(e => inactMap[String(e._id || e.id)])]
    .filter(emp => {
      const id = String(emp._id || emp.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((emp, index) => {
      const id = String(emp._id || emp.id);
      const hist = histMap[id] || [];
      return {
        sno: index + 1,
        employeeName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        employeeId: emp.employee_id || '',
        team: teamName(emp, deptMap, ''),
        designation: displayText(emp.designation, ''),
        inactiveDate: inactMap[id]?.date || 'Unknown',
        lifetimeSalaryPaid: Math.round(hist.reduce((s, h) => s + num(h.finalSalary), 0)),
      };
    });
};

const buildPerformanceExportRows = (calcRows, histMap, deptMap, startMonth, perfDate) => {
  const perfMonths = buildPerformanceMonths(perfDate);
  return calcRows.map(({ emp, calc, id }, index) => {
    const row = {
      sno: index + 1,
      employeeName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
      employeeId: emp.employee_id || '',
      team: teamName(emp, deptMap, ''),
      designation: displayText(emp.designation, ''),
    };
    const empHist = histMap[id] || [];
    perfMonths.forEach((date, monthIndex) => {
      const key = `m${monthIndex}`;
      const isCur = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      const isBeforeStart = isBeforeSalaryStart(date.getFullYear(), date.getMonth(), startMonth);
      const hRec = empHist.find(h => h.month === date.getMonth() && h.year === date.getFullYear());
      let target = null;
      let achieved = null;
      let individual = null;
      let team = null;

      if (!isBeforeStart && isCur) {
        target = calc.totalTarget;
        achieved = calc.overallBiz;
        individual = calc.indi;
        team = calc.teamRcvd;
      } else if (!isBeforeStart && hRec) {
        target = hRec.target;
        achieved = hRec.achieved;
        individual = hRec.indi || hRec.achieved;
        team = hRec.team || 0;
      }

      row[`${key}Target`] = target == null ? '' : Math.round(num(target));
      row[`${key}Achieved`] = achieved == null ? '' : Math.round(num(achieved));
      row[`${key}Individual`] = individual == null ? '' : Math.round(num(individual));
      row[`${key}Team`] = team == null ? '' : Math.round(num(team));
      row[`${key}Status`] = target == null || achieved == null
        ? 'No Data'
        : achieved >= target ? 'Achieved' : 'Missed';
    });
    return row;
  });
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const exportRowsExcel = async (rows, columns, title, fileBase) => {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RupiyaMe CRM';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Salary');
  columns.forEach((col, index) => {
    sheet.getColumn(index + 1).width = col.width;
  });
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  sheet.getCell(1, 1).alignment = { horizontal: 'center' };

  sheet.addRow([]);
  const headerRow = sheet.addRow(columns.map(col => col.header));
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      right: { style: 'thin', color: { argb: 'FFBFDBFE' } },
    };
  });

  rows.forEach(row => {
    const excelRow = sheet.addRow(columns.map(col => row[col.key]));
    excelRow.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];
      cell.alignment = { vertical: 'middle', horizontal: col.money ? 'right' : 'left', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      if (col.money) cell.numFmt = '#,##0';
    });
  });

  sheet.views = [{ state: 'frozen', ySplit: 3 }];
  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }), `${fileBase}.xlsx`);
};

const exportRowsPdf = async (rows, columns, pdfColumnKeys, title, fileBase) => {
  const { default: jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule.autoTable;
  const pdfColumns = columns.filter(col => pdfColumnKeys.includes(col.key));
  const moneyKeys = new Set(pdfColumns.filter(col => col.money).map(col => col.key));
  const pdfMoney = value => `Rs. ${fmt(Math.round(num(value)))}`;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
  doc.setFontSize(16);
  doc.text(title, 30, 32);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 30, 48);

  autoTable(doc, {
    startY: 64,
    head: [pdfColumns.map(col => col.header)],
    body: rows.map(row => pdfColumns.map(col => moneyKeys.has(col.key) ? pdfMoney(row[col.key]) : (row[col.key] ?? ''))),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 24, right: 24 },
  });

  doc.save(`${fileBase}.pdf`);
};

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

    // ── 0. Fetch attendance settings + defaults used by Attendance page ─────
    let attendanceSettings = {
      default_earned_leave_monthly: 0,
      default_paid_leave_monthly: 1.0,
      minimum_working_days_for_sunday: 4,
      free_absconding_days: 2,
    };
    try {
      const sRes = await fetch(`${API}/settings/attendance-settings?user_id=${uid}`, { headers: hdrs });
      if (sRes.ok) {
        const sData = await sRes.json();
        const s = sData?.data || sData || {};
        attendanceSettings = {
          ...attendanceSettings,
          ...s
        };
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
    // Key: employee_id (RM###) + mongo _id, same as AttendancePage balanceMap
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
          if ((empId || mongoId) && balData && typeof balData === 'object' && Object.keys(balData).length > 0) {
            if (empId) balanceMap[empId] = balData;
            if (mongoId) balanceMap[mongoId] = balData;
          }
        }
      });
    } catch (e) { console.warn('[SalaryMgmt] Leave balance fetch error:', e); }

    // ── 3. Convert numeric day.status → string (same as AttendancePage convertToCalendarFormat)
    //       Then run calculateMonthlyStats logic exactly ────────────────────
    const calendarRecords = employees.map(e => {
      const mongoId = String(e.user_mongo_id || '');
      const employeeId = String(e.employee_id || '');
      const recordId = employeeId || mongoId;
      if (!recordId) return null;

      const record = {
        id: recordId,
        employeeId,
        mongoId: mongoId || employeeId,
        joining_date: e.joining_date || e.date_of_joining || '',
        inactive_from_date: e.inactive_from_date || null,
      };

      // Map each day to attendance page format.
      (e.days || []).forEach(day => {
        const dayKey = `day${day.day}`;
        record[`${dayKey}_leaveType`] = day.leave_type || null;
        record[`${dayKey}_leaveUnits`] = Number(day.leave_units || 0);
        const workingHours = Number(day.total_working_hours ?? day.working_hours ?? 0);
        record[`${dayKey}_workingHours`] = Number.isFinite(workingHours) ? workingHours : 0;

        if (day.status !== null && day.status !== undefined) {
          const s = parseFloat(day.status);
          if      (s === 1.5)              record[dayKey] = 'H';
          else if (s === 2.0 || s === 2)   record[dayKey] = 'WK';
          else if (s === 1.0 || s === 1)   record[dayKey] = day.is_weekend ? 'SP' : 'P';
          else if (s === 0.5)              record[dayKey] = 'HD';
          else if (s === 0 || s === 0.0)   record[dayKey] = day.is_weekend ? 'S0' : 'LV';
          else if (s === -1 || s === -1.0) record[dayKey] = 'A';
          else if (s === -2 || s === -2.0) record[dayKey] = 'AB';
          else if (day.status === 'L')      record[dayKey] = 'L';
          else                              record[dayKey] = '';
        } else if (day.is_holiday) {
          record[dayKey] = 'H';
        } else if (day.is_weekend) {
          record[dayKey] = 'W';
        } else {
          record[dayKey] = '';
        }
      });

      return record;
    }).filter(Boolean);

    const enrichedData = calendarRecords.map(r => {
      const bal = balanceMap[r.id] ?? balanceMap[r.mongoId] ?? null;
      return {
        ...r,
        // Keep exact leave management behavior: DB values are source of truth.
        earnedLeavesTotal: bal != null ? (bal.earned_leaves_total ?? 0) : 0,
        earnedLeavesUsed: bal != null ? (bal.earned_leaves_used ?? 0) : 0,
        earnedLeavesRemaining: bal != null ? (bal.earned_leaves_remaining ?? 0) : 0,
        paidLeavesTotal: bal != null
          ? (bal.paid_leaves_total ?? attendanceSettings.default_paid_leave_monthly ?? 1)
          : (attendanceSettings.default_paid_leave_monthly ?? 1),
        paidLeavesUsed: bal != null ? (bal.paid_leaves_used ?? 0) : 0,
        paidLeavesRemaining: bal != null ? (bal.paid_leaves_remaining ?? 0) : null,
        graceTotal: bal != null ? (bal.grace_leaves_total ?? 0) : 0,
        graceUsed: bal != null ? (bal.grace_leaves_used ?? 0) : 0,
        graceRemaining: bal != null ? (bal.grace_leaves_remaining ?? 0) : 0,
        elMonthly: attendanceSettings.default_earned_leave_monthly ?? 0,
        plMonthly: attendanceSettings.default_paid_leave_monthly ?? 1.0,
        graceMonthlyLimit: bal != null ? (bal.grace_leaves_total ?? 0) : 0,
      };
    });

    const ruledData = applyAttendanceRules(enrichedData, attendanceSettings, year, month);

    const map = {};
    ruledData.forEach(record => {
      if (!record || !record.id) return;
      const stats = calculateMonthlyStats(
        record,
        year,
        month,
        totalDaysInMonth,
        [],
        attendanceSettings
      );
      const entry = {
        presentScore: stats.actualPresent ?? stats.presentScore ?? 0,
        attendanceFinalDays: stats.finalScore ?? 0,
        finalScore: stats.finalScore ?? 0,
        totalDays: totalDaysInMonth,
        effectiveDays: stats.effectiveDays,
        plAdded: stats.plScore ?? stats.plDays ?? 0,
        elAdded: stats.elScore ?? stats.elDays ?? 0,
        abscondingDays: stats.absconding || 0,
        absentDays: stats.absentDays || 0,
      };
      if (record.mongoId) map[record.mongoId] = entry;
      map[record.id] = entry;
      if (record.employeeId && String(record.employeeId) !== String(record.id)) {
        map[record.employeeId] = entry;
      }
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
// attendanceDeduction = eligible unpaid days * perDaySalary
// prorationDeduction  = non-eligible days from joining/inactive window
// finalSalary     = monthlySalary + incentive - attendanceDeduction - prorationDeduction
// accountTransfer = finalSalary - totalDeductions + totalReimbursements - salaryHoldAmount
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
  // eligibleSalary = perDaySalary * effectiveDays (max entitled salary this month)
  // earnedSalary   = perDaySalary * earnedScore
  // attendanceDed  = max(0, eligibleSalary - earnedSalary)
  // prorationDed   = max(0, monthlySalary - eligibleSalary)
  const hasPresentData  = presentDays != null && totalDaysInMonth > 0;
  const effDays         = (effectiveDays != null && effectiveDays > 0) ? effectiveDays : totalDaysInMonth;
  const _plAdded        = plAdded || 0;
  const _elAdded        = elAdded || 0;
  const perDaySalary    = hasPresentData ? monthlySalary / totalDaysInMonth : 0;
  const eligibleSal     = hasPresentData ? Math.round(perDaySalary * effDays) : monthlySalary;
  // earnedScore: presentDays already includes PL — just cap at effectiveDays
  const earnedScore     = hasPresentData ? Math.min(presentDays, effDays) : effDays;
  const earnedSal       = hasPresentData ? Math.round(perDaySalary * earnedScore) : monthlySalary;
  const absentDays      = hasPresentData ? Math.max(0, effDays - earnedScore) : 0;
  const prorationDed    = hasPresentData ? Math.max(0, monthlySalary - eligibleSal) : 0;
  const attendanceDed   = hasPresentData ? Math.max(0, eligibleSal - earnedSal) : 0;

  const finalSalary   = monthlySalary + incentive - attendanceDed - prorationDed;

  // deductions
  const empDeds       = deducts.filter(d => d.empId === id && !d.isReimbursement);
  const empReimb      = deducts.filter(d => d.empId === id && d.isReimbursement);
  const totalDeds     = empDeds.reduce((s,d) => s + num(d.amount), 0) +
                        warnDeducts.reduce((s,w) => s + num(w.penalty_amount), 0);
  const totalReimb    = empReimb.reduce((s,r) => s + num(r.amount), 0);
  const advRecovered  = empDeds.filter(d => d.type === 'Advance Recovery').reduce((s,d) => s + num(d.amount), 0);
  const remainingAdv  = Math.max(0, num(advanceBalance) - advRecovered);

  const grossAccountTransfer = finalSalary - totalDeds + totalReimb;
  const salaryHoldAmount = computeSalaryHoldAmount(salaryHold, grossAccountTransfer);
  const isSalaryHeld = !!salaryHold;
  const salaryHoldRule = getSalaryHoldRuleText(salaryHold);
  const accountTransfer = grossAccountTransfer - salaryHoldAmount;

  return { id, indi, givenAway, teamRcvd, availIndi, baseTarget, cf, totalTarget,
           overallBiz, finalBiz, shortfall, excessBiz, incentive, iRate,
           monthlySalary, perDaySalary, absentDays, attendanceDed: attendanceDed, prorationDed, hasPresentData,
           plAdded: _plAdded, elAdded: _elAdded, rawPresentScore: rawPresentScore ?? null,
           totalDaysInMonth: totalDaysInMonth || 0,
           effectiveDays: effDays,
           finalScore: presentDays,  // finalScore = the attendance page "Final" value passed in
           finalSalary, totalDeds, totalReimb, advRecovered, remainingAdv,
           grossAccountTransfer, salaryHoldAmount, accountTransfer, isSalaryHeld, salaryHold, salaryHoldRule,
           empDeds, empReimb, warnDeducts };
};

// ─── CSS injected once ────────────────────────────────────────────────────────
const CSS = `
.sm-body {
  font-family: Inter, Arial, sans-serif;
  margin: 0;
  background: #f4f6fb;
  color: #172033;
  min-height: 100vh;
  padding: 16px 0 24px;
}
.sm-page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin: 0 16px 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e3e8f2;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}
.sm-page-title { display: flex; flex-direction: column; gap: 12px; min-width: 260px; }
.sm-page-title h1 { margin: 0; font-size: 20px; line-height: 1.2; font-weight: 800; color: #111827; letter-spacing: 0; }
.sm-page-actions { display: flex; gap: 8px; align-items: center; justify-content: flex-start; flex-wrap: wrap; }
.sm-period-select {
  height: 34px;
  padding: 6px 28px 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #ffffff;
  color: #1f2937;
  font-size: 13px;
  font-weight: 700;
  outline: none;
}
.sm-period-select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12); }
.sm-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid #dbe3ef;
  background: #f8fafc;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.sm-pill--warn { color: #b45309; background: #fffbeb; border-color: #fde68a; }
.sm-pill--load { color: #6d28d9; background: #f5f3ff; border-color: #ddd6fe; }
.sm-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f1f5f9;
  padding: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  margin: 0;
}
.sm-tab {
  min-height: 34px;
  padding: 8px 18px;
  cursor: pointer;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 800;
  color: #475569;
  border-radius: 7px;
  transition: background .18s, color .18s, box-shadow .18s;
  letter-spacing: 0;
}
.sm-tab:hover { color: #111827; background: #e8eef7; }
.sm-tab.active { background: #ffffff; color: #1d4ed8; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.10); }
.sm-toolbar {
  display: flex;
  gap: 12px;
  background: #ffffff;
  padding: 14px 16px;
  border: 1px solid #e3e8f2;
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
  margin: 0 16px 0;
  align-items: flex-end;
  flex-wrap: wrap;
}
.sm-toolbar h2 { letter-spacing: 0; }
.sm-fg { display: flex; flex-direction: column; gap: 5px; }
.sm-fg label { font-size: 11px; font-weight: 800; color: #475569; letter-spacing: .02em; text-transform: uppercase; }
.sm-input {
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  font-size: 13px;
  min-width: 190px;
  background: #ffffff;
  color: #1f2937;
  outline: none;
}
.sm-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12); }
.sm-table-wrap {
  overflow-x: auto;
  background: #ffffff;
  border: 1px solid #e3e8f2;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  border-radius: 0 0 10px 10px;
  margin: 0 16px 24px;
}
.sm-table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 13px; white-space: nowrap; }
.sm-table th,
.sm-table td {
  border-right: 1px solid #e6ebf3;
  border-bottom: 1px solid #e6ebf3;
  padding: 8px 10px;
  text-align: left !important;
  vertical-align: top;
}
.sm-table th:last-child, .sm-table td:last-child { border-right: none; }
.sm-table tr:last-child td { border-bottom: none; }
.sm-table th {
  background: #eef3f9;
  font-weight: 800;
  color: #334155;
  position: sticky;
  top: 0;
  z-index: 5;
  font-size: 11px;
  letter-spacing: .02em;
  text-transform: uppercase;
}
.sm-table th.hl-yellow { background: #fef3c7; color: #92400e; min-width: 160px; white-space: normal; }
.sm-table th.hl-green  { background: #dcfce7; color: #166534; min-width: 130px; }
.sm-table tbody tr:nth-child(even) { background: #fbfdff; }
.sm-table tbody tr:hover { background: #f1f7ff; }
.sm-table tbody tr.processed { background: #ecfdf5 !important; }
.sm-team-cell { cursor: pointer; color: #1d4ed8; font-weight: 800; background: #eff6ff !important; transition: background .2s; }
.sm-team-cell:hover { background: #dbeafe !important; }
.sm-team-cell.locked { cursor: not-allowed; color: #94a3b8; background: #f3f4f6 !important; }
.sm-team-cell.locked:hover { background: #e5e7eb !important; }
.sm-ded-cell { cursor: pointer; background: #fff7ed !important; transition: background .2s; }
.sm-ded-cell:hover { background: #ffedd5 !important; }
.sm-ded-cell.locked { cursor: not-allowed; background: #f3f4f6 !important; color: #94a3b8; }
.sm-ded-cell.locked:hover { background: #e5e7eb !important; }
.sm-lock-alert { margin: 10px 16px 0; padding: 10px 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; color: #991b1b; font-size: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.sm-lock-alert strong { color: #7f1d1d; }
.sm-lock-alert-actions { display: flex; align-items: center; gap: 8px; }
.sm-overlay { display: flex; position: fixed; inset: 0; background: rgba(15, 23, 42, .62); z-index: 1000; justify-content: center; align-items: center; }
.sm-modal { background: white; padding: 24px; border-radius: 10px; width: 90%; max-width: 680px; box-shadow: 0 24px 48px rgba(15, 23, 42, .22); max-height: 90vh; overflow-y: visible; }
.sm-modal h2 { margin-top: 0; font-size: 18px; margin-bottom: 8px; }
.sm-fg2 { margin-bottom: 16px; }
.sm-fg2 label { display: block; font-weight: bold; margin-bottom: 6px; font-size: 14px; }
.sm-fc { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; }
.sm-dd-wrap { position: relative; }
.sm-dd-list { display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #d1d5db; max-height: 150px; overflow-y: auto; z-index: 10; border-radius: 0 0 4px 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1); }
.sm-dd-item { padding: 8px; cursor: pointer; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
.sm-dd-item:hover { background: #f3f4f6; }
.sm-info-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
.sm-btn { padding: 8px 14px; border: none; border-radius: 7px; cursor: pointer; font-weight: 800; font-size: 13px; transition: background .18s, border-color .18s, color .18s, box-shadow .18s; }
.sm-btn-primary { background: #2563eb; color: white; box-shadow: 0 6px 14px rgba(37, 99, 235, .18); }
.sm-btn-primary:hover { background: #1d4ed8; }
.sm-btn-secondary { background: #e5e7eb; color: #374151; }
.sm-btn-secondary:hover { background: #d1d5db; }
.sm-btn-outline { background: white; border: 1px solid #cbd5e1; color: #334155; }
.sm-btn-outline:hover { background: #f8fafc; border-color: #94a3b8; }
.sm-btn-outline.active { background: #eff6ff; border-color: #2563eb; color: #2563eb; }
.sm-btn-danger { background: white; border: 1px solid #ef4444; color: #ef4444; width: 100%; }
.sm-btn-danger:hover { background: #fef2f2; }
.sm-export-wrap { position: relative; display: inline-flex; }
.sm-export-btn { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.sm-export-menu { position: absolute; top: calc(100% + 6px); right: 0; background: white; border: 1px solid #d1d5db; border-radius: 8px; box-shadow: 0 16px 34px rgba(15,23,42,.18); min-width: 170px; z-index: 20; overflow: hidden; }
.sm-export-menu button { width: 100%; border: none; background: white; color: #1f2937; padding: 10px 12px; text-align: left; cursor: pointer; font-size: 13px; font-weight: bold; display: flex; align-items: center; gap: 8px; }
.sm-export-menu button:hover { background: #eff6ff; color: #1d4ed8; }
.sm-flex-right { display: flex; justify-content: flex-end; gap: 8px; }
.sm-list-table { width: 100%; font-size: 13px; text-align: left; border-collapse: collapse; }
.sm-list-table td { padding: 5px 4px; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
.sm-perf-cell { padding: 9px; border-radius: 7px; width: 180px; box-shadow: 0 1px 2px rgba(0,0,0,.05); border: 1px solid transparent; transition: transform .2s, box-shadow .2s; }
.sm-perf-cell:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(15,23,42,.10); }
.sm-perf-success { background: linear-gradient(135deg,#ecfdf5,#f0fdf4); border-color: #a7f3d0; }
.sm-perf-danger  { background: linear-gradient(135deg,#fef2f2,#fff1f2); border-color: #fecaca; }
.sm-perf-nodata  { background: #f9fafb; border-color: #f3f4f6; display: flex; align-items: center; justify-content: flex-start; min-height: 48px; }
.sm-badge { padding: 2px 5px; border-radius: 4px; font-size: 8px; font-weight: bold; color: white; letter-spacing: .5px; }
.sm-badge-s { background: #10b981; }
.sm-badge-d { background: #ef4444; }
.sm-status-processed { background: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
.sm-status-pending   { background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
@media (max-width: 768px) {
  .sm-page-head { padding: 12px; }
  .sm-page-actions, .sm-tabs { width: 100%; }
  .sm-tabs { overflow-x: auto; justify-content: flex-start; }
  .sm-tab { padding: 8px 14px; }
  .sm-input { min-width: 100%; }
  .sm-fg { width: 100%; }
}
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
        <td colSpan={19} style={{color:'#d1d5db',textAlign:'center'}}>—</td>
      </tr>
    );
  }

  // finalScore IS the "Final" from attendance page — use it directly as present days
  const finalScore       = calc.hasPresentData ? calc.finalScore : null;
  const totalDaysInMonth = calc.totalDaysInMonth || 0;
  const isMidMonthJoiner = calc.hasPresentData && calc.effectiveDays < totalDaysInMonth;
  const paymentDetails = getSalaryPaymentDetails(emp);
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
                {isMidMonthJoiner && <span style={{color:'#8b5cf6'}}> (eligible)</span>}
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
      <td
        className={`sm-team-cell${processed ? ' locked' : ''}`}
        onClick={onTeam}
        title={processed ? 'Salary is completed. Undo first to edit team achievement.' : 'Click to manage team achievements'}
      >
        {fmt(calc.teamRcvd)||'0'}
      </td>
      <td>{fmt(calc.overallBiz)}</td>
      <td>{fmt(calc.finalBiz)}</td>
      <td style={{fontWeight:'bold',color:calc.shortfall>0?'#ef4444':'inherit'}}>{fmt(calc.shortfall)}</td>
      <td>{fmt(Math.round(calc.incentive))||'0'}</td>
      <td>
        <div style={{fontWeight:'bold'}}>{fmt(Math.round(calc.finalSalary))}</div>
        {calc.isSalaryHeld && (
          <div style={{fontSize:10,color:'#fb923c',marginTop:1,fontWeight:'bold'}}>
            {calc.salaryHoldRule || 'salary held'} · {fmt(calc.salaryHoldAmount)}
          </div>
        )}
        {calc.hasPresentData && calc.attendanceDed > 0 && (
          <div style={{fontSize:10,color:'#ef4444',marginTop:1}}>
            -{fmt(calc.attendanceDed)} att.
          </div>
        )}
        {calc.hasPresentData && calc.prorationDed > 0 && (
          <div style={{fontSize:10,color:'#8b5cf6',marginTop:1}}>
            -{fmt(calc.prorationDed)} prorated
          </div>
        )}
      </td>
      {/* DEDUCTION & REIMBURSEMENT — clickable */}
      <td
        className={`sm-ded-cell${processed ? ' locked' : ''}`}
        onClick={onDeduct}
        title={processed ? 'Salary is completed. Undo first to edit deductions or reimbursements.' : 'Click to manage deductions and reimbursements'}
      >
        {calc.hasPresentData && calc.attendanceDed > 0 && (
          <div style={{fontWeight:'bold',fontSize:12,color:'#f97316'}}>
            -{fmt(calc.attendanceDed)} absent
          </div>
        )}
        {calc.hasPresentData && calc.prorationDed > 0 && (
          <div style={{fontWeight:'bold',fontSize:12,color:'#8b5cf6'}}>
            -{fmt(calc.prorationDed)} prorated
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
        <div>{fmt(Math.round(calc.accountTransfer))}</div>
        {calc.isSalaryHeld && (
          <div style={{fontSize:10,color:'#6b7280',fontWeight:'normal',lineHeight:1.2}}>
            held {fmt(calc.salaryHoldAmount)}<br />
            gross {fmt(Math.round(calc.grossAccountTransfer || 0))}
          </div>
        )}
      </td>
      <td style={{fontSize:11,fontWeight:600,color:paymentDetails.mode === 'UPI' ? '#7c3aed' : '#2563eb'}}>{paymentDetails.mode}</td>
      <td style={{fontFamily:'monospace',fontSize:11}}>{paymentDetails.accountName}</td>
      <td style={{fontFamily:'monospace',fontSize:11}}>{paymentDetails.accountNumber}</td>
      <td style={{fontSize:11}}>{paymentDetails.bankName}</td>
      <td style={{fontFamily:'monospace',fontSize:11}}>{paymentDetails.ifsc}</td>
      <td style={{textAlign:'center'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:4}}>
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
function PerfTab({ calcRows, history, startMonth, perfDate, setPerfDate }) {
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
  const [perfDate, setPerfDate] = useState(() => new Date(now.getFullYear(), now.getMonth()));

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
  const [lockNotice,  setLockNotice]  = useState(null); // { id, name }
  const [exportOpen,  setExportOpen]  = useState(false);
  const [exporting,   setExporting]   = useState('');

  useEffect(() => {
    setLockNotice(null);
    setExportOpen(false);
  }, [month, year, tab]);

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
      const attendanceFinalDays = attData ? (attData.attendanceFinalDays ?? attData.finalScore) : null;
      const c = calcRow(empWithMonthlyValues, allocs, mergedDeds, adv, cf, ws,
        attendanceFinalDays,
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
  const isCompletedSalary = useCallback(
    (id) => !selectedBeforeStart && processed.includes(periodK(String(id), month, year)),
    [processed, month, year, selectedBeforeStart]
  );
  const pending   = selectedBeforeStart ? filtered : filtered.filter(r => !isPro(r.id));
  const completed = selectedBeforeStart ? [] : filtered.filter(r =>  isPro(r.id));

  // ── actions ─────────────────────────────────────────────────────────────────
  const showCompletedSalaryLock = useCallback((emp, options = {}) => {
    const id = String(emp?._id || emp?.id || '');
    const name = `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim() || 'this employee';
    setLockNotice({
      id,
      name,
      area: options.area || 'salary details',
      editType: options.editType || null,
    });
  }, []);

  const toggleProcessed = useCallback((id) => {
    if (selectedBeforeStart) return;
    setLockNotice(null);
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
    const allExistingAllocs = loadJ(LS.ALLOCS, []);
    const removing = data.__remove ? allExistingAllocs.find(a => a.id === data.__remove) : null;
    const affectedIds = [data.fromId, data.toId, removing?.fromId, removing?.toId]
      .filter(Boolean)
      .map(id => String(id));
    const lockedId = affectedIds.find(id => isCompletedSalary(id));
    if (lockedId) {
      const emp = activeEmps.find(e => String(e._id || e.id) === lockedId);
      showCompletedSalaryLock(emp || { id: lockedId }, { area: 'team achievements', editType: 'team' });
      alert('This salary is already completed. Use Undo first, then edit team achievements.');
      return;
    }

    let newAllocs;
    if (data.__remove) {
      newAllocs = allExistingAllocs.filter(a=>a.id!==data.__remove);
    } else {
      const full = {...data, month, year};
      newAllocs = [...allExistingAllocs.filter(a=>!(a.fromId===full.fromId&&a.toId===full.toId&&a.month===month&&a.year===year)), full];
    }
    saveJ(LS.ALLOCS, newAllocs);
    setAllocs(newAllocs.filter(a=>a.month===month&&a.year===year));
  }, [month, year, isCompletedSalary, activeEmps, showCompletedSalaryLock]);

  // deductions
  const handleDedSave = useCallback((data) => {
    const allExistingDeds = loadJ(LS.DEDUCTS, []);
    const removing = data.__remove ? allExistingDeds.find(d => d.id === data.__remove) : null;
    const affectedEmpId = data.__add?.empId || removing?.empId;
    if (affectedEmpId && isCompletedSalary(affectedEmpId)) {
      const emp = activeEmps.find(e => String(e._id || e.id) === String(affectedEmpId));
      showCompletedSalaryLock(emp || { id: affectedEmpId }, { area: 'deductions/reimbursements', editType: 'deduction' });
      alert('This salary is already completed. Use Undo first, then edit deductions or reimbursements.');
      return;
    }

    let newDeds;
    if (data.__remove) {
      newDeds = allExistingDeds.filter(d=>d.id!==data.__remove);
    } else {
      newDeds = [...allExistingDeds, {...data.__add, month, year}];
    }
    saveJ(LS.DEDUCTS, newDeds);
    setDeducts(newDeds.filter(d=>d.month===month&&d.year===year));
  }, [month, year, isCompletedSalary, activeEmps, showCompletedSalaryLock]);

  const undoCompletedAndOpenLockedEdit = useCallback(() => {
    if (!lockNotice?.id) return;
    const emp = activeEmps.find(e => String(e._id || e.id) === String(lockNotice.id));
    toggleProcessed(lockNotice.id);
    setTab('pending');
    setLockNotice(null);
    if (!emp) return;
    if (lockNotice.editType === 'team') {
      setAllocModal(emp);
    } else if (lockNotice.editType === 'deduction') {
      setDedModal(emp);
    }
  }, [lockNotice, activeEmps, toggleProcessed]);

  // guard removed — route is open to all authenticated users

  const showSalaryView = tab === 'pending' || tab === 'completed';
  const displayRows    = tab === 'pending' ? pending : completed;
  const activeTabExportPayload = useMemo(() => {
    const monthLabel = `${MONTHS_FULL[month]} ${year}`;
    if (tab === 'pending' || tab === 'completed') {
      const label = tab === 'pending' ? 'Pending' : 'Completed';
      const sourceRows = tab === 'pending' ? pending : completed;
      return {
        rows: buildSalaryExportRows(sourceRows, deptMap, processed, month, year),
        columns: SALARY_EXPORT_COLUMNS,
        pdfColumnKeys: SALARY_PDF_COLUMNS,
        title: `Salary ${label} - ${monthLabel}`,
        fileBase: exportFileBase(month, year, label),
        emptyMessage: `No ${label.toLowerCase()} salary data found for this month/filter.`,
        isMonthlySalaryTab: true,
      };
    }

    if (tab === 'history') {
      return {
        rows: buildHistoryExportRows(activeEmps, histMap, deptMap, startMonth),
        columns: HISTORY_EXPORT_COLUMNS,
        pdfColumnKeys: HISTORY_EXPORT_COLUMNS.map(col => col.key),
        title: 'Salary History - All Employees',
        fileBase: 'Salary_History_All_Employees',
        emptyMessage: 'No salary history found.',
      };
    }

    if (tab === 'performance') {
      const perfMonths = buildPerformanceMonths(perfDate);
      const endDate = perfMonths[perfMonths.length - 1];
      const rangeLabel = `${MONTHS_SHORT[perfDate.getMonth()]} ${perfDate.getFullYear()} - ${MONTHS_SHORT[endDate.getMonth()]} ${endDate.getFullYear()}`;
      const columns = buildPerformanceExportColumns(perfMonths);
      return {
        rows: buildPerformanceExportRows(calcRows, histMap, deptMap, startMonth, perfDate),
        columns,
        pdfColumnKeys: columns.map(col => col.key),
        title: `Salary Performance - ${rangeLabel}`,
        fileBase: `Salary_Performance_${slugPart(rangeLabel)}`,
        emptyMessage: 'No performance data found.',
      };
    }

    if (tab === 'inactive') {
      return {
        rows: buildInactiveExportRows(inactiveEmps, activeEmps, inactMap, histMap, deptMap),
        columns: INACTIVE_EXPORT_COLUMNS,
        pdfColumnKeys: INACTIVE_EXPORT_COLUMNS.map(col => col.key),
        title: 'Inactive Employees Record',
        fileBase: 'Salary_Inactive_Employees',
        emptyMessage: 'No inactive employees found.',
      };
    }

    return null;
  }, [
    tab, month, year, pending, completed, deptMap, processed,
    activeEmps, inactiveEmps, histMap, startMonth, calcRows, inactMap, perfDate
  ]);

  const handleSalaryExport = useCallback(async (type) => {
    setExportOpen(false);
    if (activeTabExportPayload?.isMonthlySalaryTab && selectedBeforeStart) {
      alert(`Salary data starts from ${MONTHS_FULL[startMonth.month]} ${startMonth.year}.`);
      return;
    }

    if (!activeTabExportPayload) {
      alert('No export available for this tab.');
      return;
    }

    const { rows, columns, pdfColumnKeys, title, fileBase, emptyMessage } = activeTabExportPayload;
    if (rows.length === 0) {
      alert(emptyMessage || 'No data found for this tab.');
      return;
    }

    setExporting(type);
    try {
      if (type === 'excel') {
        await exportRowsExcel(rows, columns, title, fileBase);
      } else {
        await exportRowsPdf(rows, columns, pdfColumnKeys, title, fileBase);
      }
    } catch (err) {
      console.error('[SalaryMgmt] export failed:', err);
      alert(`Export failed: ${err?.message || err}`);
    } finally {
      setExporting('');
    }
  }, [activeTabExportPayload, selectedBeforeStart, startMonth]);

  const TH_COLS = [
    {label:'NAME'}, {label:'TEAM & DESIGNATION'}, {label:'SALARY'},
    {label:'DAYS PRESENT', title:'Attendance page Final days used for salary calculation', center:true},
    {label:'MONTHLY TARGET',title:'Current Month Base Target'},
    {label:'CARRYFORWARD',title:'Shortfall from previous month'},{label:'INDIVIDUAL ACHIEVEMENT',cls:'hl-yellow'},
    {label:'TEAM ACHIEVEMENT',cls:'hl-yellow',title:'Click a cell to manage team achievements'},
    {label:'OVERALL BUISNESS'},{label:'FINAL BUISNESS',cls:'hl-green'},
    {label:'SHORTFALL',title:'Target + Carryforward - Final Business'},{label:'INCENTIVE AMOUNT'},
    {label:'FINAL SALARY'},{label:'DEDUCTION & REIMBURSEMENT',title:'Click to manage deductions & reimbursements'},
    {label:'ACCOUNT TRANSFER'},{label:'PAYMENT MODE'},{label:'ACCOUNT/UPI NAME'},{label:'ACCOUNT NUMBER / UPI ID'},{label:'BANK NAME'},{label:'IFSC'},
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
      <div className="sm-page-head">
        <div className="sm-page-title">
          <h1>Salary Management</h1>
          <div className="sm-tabs">
            {[['pending',`Pending`],['completed','Completed'],['history','History'],['performance','Performance'],['inactive','Inactive']].map(([t,l])=>(
              <button key={t} className={`sm-tab${tab===t?' active':''}`} onClick={()=>setTab(t)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="sm-page-actions">
          <select className="sm-period-select" value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {MONTHS_FULL.map((m,i)=><option key={m} value={i}>{m}</option>)}
          </select>
          <select className="sm-period-select" value={year} onChange={e=>setYear(Number(e.target.value))}>
            {[year-1,year,year+1].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          {/* Start Month Config */}
          {startMonth && (
            <span className="sm-pill">
              Start: {MONTHS_FULL[startMonth.month]} {startMonth.year}
            </span>
          )}
          {warnLoad && <span className="sm-pill sm-pill--warn">Loading warnings</span>}
          {hrmsLoad && <span className="sm-pill sm-pill--load">Loading finance</span>}
          <span className="sm-pill">
            Att: {Object.keys(presentDaysMap).length} emp
          </span>
          <div className="sm-export-wrap">
            <button
              className="sm-btn sm-btn-primary sm-export-btn"
              onClick={() => !exporting && setExportOpen(v => !v)}
              disabled={!!exporting}
              title="Export current tab data"
            >
              <Download size={14} strokeWidth={2} />
              {exporting ? 'Exporting...' : 'Export'}
              {!exporting && <ChevronDown size={12} strokeWidth={2.2} />}
            </button>
            {exportOpen && !exporting && (
              <div className="sm-export-menu">
                <button onClick={() => handleSalaryExport('excel')}><FileSpreadsheet size={15} strokeWidth={2} /> Excel (.xlsx)</button>
                <button onClick={() => handleSalaryExport('pdf')}><FileText size={15} strokeWidth={2} /> PDF (.pdf)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedBeforeStart && (
        <div style={{margin:'10px 16px 0',padding:'10px 12px',background:'#fff7ed',border:'1px solid #fdba74',borderRadius:8,color:'#9a3412',fontSize:12}}>
          Showing blank values because salary rules apply from {MONTHS_FULL[startMonth.month]} {startMonth.year}.
        </div>
      )}

      {lockNotice && (
        <div className="sm-lock-alert">
          <span>
            Salary for <strong>{lockNotice.name}</strong> is already completed. Undo it first to edit {lockNotice.area || 'salary details'}.
          </span>
          <div className="sm-lock-alert-actions">
            <button className="sm-btn sm-btn-danger" style={{width:'auto',padding:'6px 12px'}} onClick={undoCompletedAndOpenLockedEdit}>
              Undo & Edit
            </button>
            <button className="sm-btn sm-btn-secondary" style={{padding:'6px 12px'}} onClick={() => setLockNotice(null)}>
              Dismiss
            </button>
          </div>
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
          perfDate={perfDate}
          setPerfDate={setPerfDate}
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
                      style={{}}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0
                  ? <tr><td colSpan={TH_COLS.length} style={{textAlign:'center',padding:20,color:'#6b7280'}}>No employees found in this view.</td></tr>
                  : displayRows.map(({emp, calc, id}) => (
                    <SalRow key={id} emp={emp} calc={calc} deptMap={deptMap} isLockedMonth={selectedBeforeStart}
                      processed={isPro(id)}
                      onTeam={()=>{
                        if (selectedBeforeStart) return;
                        if (isCompletedSalary(id)) {
                          showCompletedSalaryLock(emp, { area: 'team achievements', editType: 'team' });
                          return;
                        }
                        setAllocModal(emp);
                      }}
                      onDeduct={()=>{
                        if (selectedBeforeStart) return;
                        if (isCompletedSalary(id)) {
                          showCompletedSalaryLock(emp, { area: 'deductions/reimbursements', editType: 'deduction' });
                          return;
                        }
                        setDedModal(emp);
                      }}
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
 
