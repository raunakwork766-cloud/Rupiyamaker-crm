import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  MessageSquareText,
  RefreshCw,
  Route,
  Search,
  User,
  UserCheck,
} from 'lucide-react';

const TYPE_CONFIG = {
  create: { label: 'Lead Created', tone: 'emerald', Icon: UserCheck },
  created: { label: 'Lead Created', tone: 'emerald', Icon: UserCheck },
  field_update: { label: 'Field Updated', tone: 'blue', Icon: ClipboardList },
  update: { label: 'Lead Updated', tone: 'blue', Icon: ClipboardList },
  updated: { label: 'Lead Updated', tone: 'blue', Icon: ClipboardList },
  status_change: { label: 'Status Changed', tone: 'amber', Icon: Activity },
  status_changed: { label: 'Status Changed', tone: 'amber', Icon: Activity },
  sub_status_change: { label: 'Sub-status Changed', tone: 'amber', Icon: Activity },
  assignment: { label: 'Lead Assigned', tone: 'cyan', Icon: UserCheck },
  assigned: { label: 'Lead Assigned', tone: 'cyan', Icon: UserCheck },
  department_transfer: { label: 'Department Transfer', tone: 'rose', Icon: Route },
  transfer: { label: 'Department Transfer', tone: 'rose', Icon: Route },
  transferred: { label: 'Department Transfer', tone: 'rose', Icon: Route },
  reporting_change: { label: 'Reporting Updated', tone: 'slate', Icon: User },
  note: { label: 'Note Added', tone: 'slate', Icon: MessageSquareText },
  remark: { label: 'Note Added', tone: 'slate', Icon: MessageSquareText },
  remark_added: { label: 'Note Added', tone: 'slate', Icon: MessageSquareText },
  note_updated: { label: 'Note Updated', tone: 'slate', Icon: MessageSquareText },
  note_deleted: { label: 'Note Deleted', tone: 'slate', Icon: MessageSquareText },
  attachment_uploaded: { label: 'Document Uploaded', tone: 'teal', Icon: FileText },
  document: { label: 'Document Uploaded', tone: 'teal', Icon: FileText },
  document_status: { label: 'Document Status', tone: 'teal', Icon: FileText },
  document_delete: { label: 'Document Deleted', tone: 'teal', Icon: FileText },
  task_added: { label: 'Task Created', tone: 'emerald', Icon: CheckSquare },
  task_updated: { label: 'Task Updated', tone: 'blue', Icon: CheckSquare },
  task_completed: { label: 'Task Completed', tone: 'emerald', Icon: CheckSquare },
  question_validation: { label: 'Questions Validated', tone: 'violet', Icon: CheckSquare },
  login_form_updated: { label: 'Sent to Login', tone: 'indigo', Icon: FileText },
  file_sent_to_login: { label: 'Sent to Login', tone: 'indigo', Icon: FileText },
  public_form_update: { label: 'Public Form Updated', tone: 'indigo', Icon: FileText },
  delete: { label: 'Lead Deleted', tone: 'rose', Icon: AlertCircle },
  deleted: { label: 'Lead Deleted', tone: 'rose', Icon: AlertCircle },
};

const TONE_STYLES = {
  emerald: {
    bg: '#ecfdf5',
    border: '#a7f3d0',
    text: '#047857',
    soft: '#d1fae5',
  },
  blue: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1d4ed8',
    soft: '#dbeafe',
  },
  amber: {
    bg: '#fffbeb',
    border: '#fde68a',
    text: '#b45309',
    soft: '#fef3c7',
  },
  cyan: {
    bg: '#ecfeff',
    border: '#a5f3fc',
    text: '#0e7490',
    soft: '#cffafe',
  },
  rose: {
    bg: '#fff1f2',
    border: '#fecdd3',
    text: '#be123c',
    soft: '#ffe4e6',
  },
  slate: {
    bg: '#f8fafc',
    border: '#e2e8f0',
    text: '#475569',
    soft: '#f1f5f9',
  },
  teal: {
    bg: '#f0fdfa',
    border: '#99f6e4',
    text: '#0f766e',
    soft: '#ccfbf1',
  },
  violet: {
    bg: '#f5f3ff',
    border: '#ddd6fe',
    text: '#6d28d9',
    soft: '#ede9fe',
  },
  indigo: {
    bg: '#eef2ff',
    border: '#c7d2fe',
    text: '#4338ca',
    soft: '#e0e7ff',
  },
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'field_update', label: 'Fields' },
  { value: 'status', label: 'Status' },
  { value: 'assignment', label: 'Assigned' },
  { value: 'note', label: 'Notes' },
  { value: 'document', label: 'Docs' },
  { value: 'task', label: 'Tasks' },
  { value: 'transfer', label: 'Transfers' },
];

const JUNK_FIELD_NAMES = new Set([
  'workplace',
  'employer',
  'company',
  'organization',
  'employer_name',
  'birth_place',
  'birthplace',
  'birth place',
  'Workplace',
  'Employer',
  'Company',
  'Organization',
  'Employer Name',
  'Birth Place',
  'Birthplace',
]);

const OBLIGATION_DATA_FIELD_LABELS = {
  salary: 'Salary',
  partnerSalary: 'Partner Salary',
  yearlyBonus: 'Yearly Bonus',
  bonusDivision: 'Bonus Division',
  loanRequired: 'Loan Required',
  loan_required: 'Loan Required',
  loan_amount: 'Loan Amount',
  companyName: 'Company Name',
  company_name: 'Company Name',
  companyType: 'Processing Banks',
  processingBanks: 'Processing Banks',
  processing_banks: 'Processing Banks',
  processing_bank: 'Processing Bank',
  bank_name: 'Bank Name',
  bankName: 'Bank Name',
  selectedBanks: 'Selected Banks',
  companyCategory: 'Company Category',
  cibilScore: 'CIBIL Score',
  cibil_score: 'CIBIL Score',
  obligations: 'Obligation Rows',
  foirPercent: 'FOIR %',
  customFoirPercent: 'Custom FOIR %',
  totalBtPos: 'Total BT POS',
  total_bt_pos: 'Total BT POS',
  totalObligation: 'Total Obligation',
  total_obligation: 'Total Obligation',
  eligibility: 'Eligibility',
  ceCompanyCategory: 'Company Category',
  ceFoirPercent: 'FOIR %',
  ceCustomFoirPercent: 'Custom FOIR %',
  ceMonthlyEmiCanPay: 'Monthly EMI Can Pay',
  ceTenureMonths: 'Tenure Months',
  ceTenureYears: 'Tenure Years',
  ceRoi: 'ROI',
  ceMultiplier: 'Multiplier',
  loanEligibilityStatus: 'Eligibility Status',
};

const OBLIGATION_CURRENCY_FIELDS = new Set([
  'salary',
  'partnerSalary',
  'yearlyBonus',
  'loanRequired',
  'loan_required',
  'loan_amount',
  'totalBtPos',
  'total_bt_pos',
  'totalObligation',
  'total_obligation',
  'ceMonthlyEmiCanPay',
]);

const OBLIGATION_PERCENT_FIELDS = new Set([
  'foirPercent',
  'customFoirPercent',
  'ceFoirPercent',
  'ceCustomFoirPercent',
  'ceRoi',
]);

const OBLIGATION_HIDDEN_FIELDS = new Set(['dynamic_fields', 'dynamic_details']);

function getType(activity) {
  return activity?.action || activity?.activity_type || 'update';
}

function getConfig(activity) {
  const type = getType(activity);
  if (TYPE_CONFIG[type]) return TYPE_CONFIG[type];
  return {
    label: titleize(type),
    tone: 'slate',
    Icon: ClipboardList,
  };
}

function titleize(value) {
  const text = String(value || '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : 'Activity';
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatFullDateTime(value) {
  const date = parseDate(value);
  if (!date) return 'Date not available';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function formatTime(value) {
  const date = parseDate(value);
  if (!date) return '--:--';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function formatDateLabel(value) {
  const date = parseDate(value);
  if (!date) return 'Date not available';

  const toISTDateString = (input) =>
    new Date(input.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).toDateString();

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const activityDay = toISTDateString(date);
  if (activityDay === toISTDateString(today)) return 'Today';
  if (activityDay === toISTDateString(yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function normalizeDisplayValue(value) {
  if (value === undefined || value === null) return 'Not set';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Not set';
    return value.map(normalizeDisplayValue).join(', ');
  }
  if (typeof value === 'object') {
    const preferred = value.name || value.first_name || value.label || value.value;
    if (preferred) return normalizeDisplayValue(preferred);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const text = String(value).trim();
  if (!text || ['null', 'undefined', 'none', 'nan'].includes(text.toLowerCase())) return 'Not set';
  return text;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isObjectSummaryText(value) {
  return typeof value === 'string' && /^\[Object with \d+ fields\]$/i.test(value.trim());
}

function isEmptyDisplayValue(value) {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  const text = String(value).trim().toLowerCase();
  return !text || ['null', 'undefined', 'none', 'nan', 'n/a'].includes(text);
}

function formatCurrencyValue(value) {
  const raw = String(value ?? '').replace(/[₹,\s]/g, '');
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return normalizeDisplayValue(value);
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(numeric)}`;
}

function compactObjectValue(value) {
  if (!isPlainObject(value)) return normalizeDisplayValue(value);
  const preferred = value.display || value.category_name || value.bank_name || value.company_name || value.name || value.label || value.value;
  if (preferred) return normalizeDisplayValue(preferred);

  const pieces = Object.entries(value)
    .filter(([, itemValue]) => !isEmptyDisplayValue(itemValue) && !Array.isArray(itemValue) && !isPlainObject(itemValue))
    .slice(0, 4)
    .map(([key, itemValue]) => `${titleize(key)}: ${normalizeDisplayValue(itemValue)}`);

  return pieces.length ? pieces.join(', ') : `${Object.keys(value).length} fields`;
}

function formatObligationDataValue(fieldKey, value, emptyValue = 'Not set') {
  if (isEmptyDisplayValue(value)) return emptyValue;

  if (Array.isArray(value)) {
    if (fieldKey === 'obligations') return `${value.length} row${value.length === 1 ? '' : 's'}`;
    const values = value
      .map((item) => (isPlainObject(item) ? compactObjectValue(item) : normalizeDisplayValue(item)))
      .filter((item) => item !== 'Not set');
    return values.length ? values.join(', ') : emptyValue;
  }

  if (isPlainObject(value)) return compactObjectValue(value);
  if (OBLIGATION_CURRENCY_FIELDS.has(fieldKey)) return formatCurrencyValue(value);
  if (OBLIGATION_PERCENT_FIELDS.has(fieldKey)) {
    const text = normalizeDisplayValue(value);
    return text === 'Not set' || text.includes('%') ? text : `${text}%`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return normalizeDisplayValue(value);
}

function getLeadObligationData(leadData) {
  const candidates = [
    leadData?.dynamic_fields?.obligation_data,
    leadData?.obligation_data,
    leadData?.dynamicFields?.obligation_data,
    leadData?.dynamic_details?.obligation_data,
    leadData?.data?.dynamic_fields?.obligation_data,
    leadData?.data?.obligation_data,
  ];

  const existing = candidates.find((item) => isPlainObject(item) && Object.keys(item).length > 0);
  if (existing) return existing;

  const fallback = {};
  Object.keys(OBLIGATION_DATA_FIELD_LABELS).forEach((key) => {
    if (leadData?.[key] !== undefined) fallback[key] = leadData[key];
  });
  return Object.keys(fallback).length ? fallback : null;
}

function buildObligationDataSnapshot(source) {
  if (!isPlainObject(source)) return [];

  const seen = new Set();
  const labeledEntries = Object.entries(OBLIGATION_DATA_FIELD_LABELS).filter(
    ([key]) => !OBLIGATION_HIDDEN_FIELDS.has(key) && source[key] !== undefined
  );
  const extraEntries = Object.keys(source)
    .filter((key) => !OBLIGATION_DATA_FIELD_LABELS[key] && !OBLIGATION_HIDDEN_FIELDS.has(key))
    .sort()
    .map((key) => [key, titleize(key)]);

  return [...labeledEntries, ...extraEntries]
    .map(([key, label]) => ({
      field_key: key,
      label,
      display_value: formatObligationDataValue(key, source[key]),
    }))
    .filter((item) => {
      if (item.display_value === 'Not set') return false;
      const signature = `${item.label}:${item.display_value}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
}

function getObjectId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value === '[object Object]' ? null : value;
  if (typeof value === 'object') return value.$oid || value.oid || value.id || value._id || null;
  return String(value);
}

function getStoredUserId() {
  const direct = localStorage.getItem('userId') || localStorage.getItem('user_id');
  if (direct) return direct;
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user._id || user.id || null;
  } catch {
    return null;
  }
}

function resolveUserId(userId, leadData) {
  const directUserId = getObjectId(userId);
  if (directUserId) return directUserId;
  const stored = getStoredUserId();
  if (stored) return stored;

  const fallback = leadData?.assigned_to || leadData?.created_by || leadData?.user_id;
  if (Array.isArray(fallback)) return getObjectId(fallback[0]);
  if (typeof fallback === 'string') {
    try {
      const parsed = JSON.parse(fallback);
      if (Array.isArray(parsed)) return getObjectId(parsed[0]);
    } catch {
      return fallback;
    }
  }
  return getObjectId(fallback);
}

function resolveLeadId(leadId, leadData) {
  const directLeadId = getObjectId(leadId);
  if (directLeadId) return directLeadId;
  return getObjectId(leadData?._id || leadData?.id);
}

function parseAssignedToName(leadData) {
  if (!leadData) return null;
  if (leadData.assigned_to_name) return normalizeDisplayValue(leadData.assigned_to_name);
  if (leadData.assignedToName) return normalizeDisplayValue(leadData.assignedToName);

  try {
    let assignedTo = leadData.assigned_to;
    if (typeof assignedTo === 'string') {
      try {
        assignedTo = JSON.parse(assignedTo);
      } catch {
        return assignedTo.length < 60 && !/^[a-f0-9]{24}$/i.test(assignedTo) ? assignedTo : null;
      }
    }
    if (Array.isArray(assignedTo) && assignedTo.length > 0) {
      const first = assignedTo[0];
      if (typeof first === 'object' && first !== null) {
        return first.name || first.username || first.first_name || null;
      }
      if (typeof first === 'string' && first.length < 60 && !/^[a-f0-9]{24}$/i.test(first)) return first;
    }
  } catch {
    return null;
  }
  return null;
}

function getCreatedAt(leadData) {
  return (
    leadData?.created_at ||
    leadData?.createdAt ||
    leadData?.created_date ||
    leadData?.lead_date ||
    leadData?.login_created_at ||
    null
  );
}

function normalizeResponsePayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.activities)) return payload.activities;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function enrichCreateActivity(activity, leadData, resolvedLeadId) {
  const createdByName =
    normalizeDisplayValue(activity?.details?.created_by_name || activity?.user_name || leadData?.created_by_name || 'System');
  const assignedToName = activity?.details?.assigned_to_name || parseAssignedToName(leadData);

  return {
    ...activity,
    _id: activity?._id || `__created_${resolvedLeadId}`,
    action: activity?.action || activity?.activity_type || 'create',
    activity_type: activity?.activity_type || activity?.action || 'create',
    description: activity?.description || 'Lead created',
    user_name: activity?.user_name || createdByName,
    created_at: activity?.created_at || getCreatedAt(leadData),
    details: {
      ...(activity?.details || {}),
      created_by_name: activity?.details?.created_by_name || createdByName,
      assigned_to_name: assignedToName || activity?.details?.assigned_to_name,
    },
  };
}

function normalizeActivities(rawActivities, leadData, resolvedLeadId) {
  let list = rawActivities
    .filter(Boolean)
    .map((activity, index) => ({
      ...activity,
      _id: activity._id || activity.id || `activity_${index}`,
      details: activity.details && typeof activity.details === 'object' ? activity.details : {},
      created_at: activity.created_at || activity.timestamp || activity.date || activity.updated_at || getCreatedAt(leadData),
    }))
    .map((activity) => {
      const type = getType(activity);
      if (['create', 'created'].includes(type)) {
        return enrichCreateActivity(activity, leadData, resolvedLeadId);
      }
      return activity;
    });

  const hasCreate = list.some((activity) => ['create', 'created'].includes(getType(activity)));
  if (!hasCreate && leadData) {
    list.push(enrichCreateActivity({}, leadData, resolvedLeadId));
  }

  list = list.filter((activity) => {
    if (getType(activity) !== 'field_update') return true;
    const fieldName = normalizeDisplayValue(
      activity.details?.field_display_name || activity.details?.field_name || activity.description
    );
    return !JUNK_FIELD_NAMES.has(fieldName);
  });

  return list.sort((a, b) => {
    const bDate = parseDate(b.created_at)?.getTime() || 0;
    const aDate = parseDate(a.created_at)?.getTime() || 0;
    return bDate - aDate;
  });
}

function getUserName(activity) {
  return normalizeDisplayValue(
    activity.user_name ||
      activity.performed_by_name ||
      activity.created_by_name ||
      activity.details?.user_name ||
      activity.details?.performed_by_name ||
      'System'
  );
}

function getActivityTitle(activity) {
  const type = getType(activity);
  const details = activity.details || {};
  if (isObligationRowActivity(activity)) {
    const operation = titleize(details.operation || '');
    const rowLabel = details.field_display_name || `Obligation Row ${details.row_index || ''}`.trim();
    return operation ? `${rowLabel} ${operation}` : rowLabel;
  }
  if (isObligationDataActivity(activity)) return 'Obligation Data';
  if (type === 'field_update') {
    return normalizeDisplayValue(details.field_display_name || details.field_name || activity.description || 'Field Updated');
  }
  return getConfig(activity).label;
}

function isObligationRowActivity(activity) {
  const details = activity?.details || {};
  const fieldName = normalizeDisplayValue(details.field_display_name || activity?.description || '');
  return details.activity_subtype === 'obligation_row' || /^Obligation Row/i.test(fieldName);
}

function isObligationDataActivity(activity) {
  const details = activity?.details || {};
  const fieldName = normalizeDisplayValue(details.field_display_name || details.field_name || activity?.description || '');
  const fieldKey = normalizeDisplayValue(details.field_key || details.field_name || '').toLowerCase();
  return (
    details.activity_subtype === 'obligation_data' ||
    /^Obligation Data/i.test(fieldName) ||
    fieldKey.includes('obligation_data') ||
    fieldKey.includes('obligation data')
  );
}

function getChangeRows(activity) {
  const type = getType(activity);
  const details = activity.details || {};

  if (isObligationRowActivity(activity) || isObligationDataActivity(activity)) return [];

  if (type === 'field_update') {
    return [
      {
        label: getActivityTitle(activity),
        oldValue: details.old_value ?? details.from ?? details.previous_value,
        newValue: details.new_value ?? details.to ?? details.current_value,
      },
    ];
  }

  if (['status_change', 'status_changed'].includes(type)) {
    return [
      {
        label: 'Status',
        oldValue: details.from_status_name || details.old_status || details.from_status || details.from,
        newValue: details.to_status_name || details.new_status || details.to_status || details.to,
      },
    ];
  }

  if (type === 'sub_status_change') {
    return [
      {
        label: 'Sub-status',
        oldValue: details.from_sub_status_name || details.from_sub_status || details.old_sub_status,
        newValue: details.to_sub_status_name || details.to_sub_status || details.new_sub_status,
      },
    ];
  }

  if (['assignment', 'assigned'].includes(type)) {
    return [
      {
        label: 'Assigned To',
        oldValue: details.from_user_name || details.from_user || details.from_user_id,
        newValue: details.to_user_name || details.assigned_to_name || details.to_user || details.to_user_id,
      },
    ];
  }

  if (['department_transfer', 'transfer', 'transferred'].includes(type)) {
    return [
      {
        label: 'Department',
        oldValue: details.from_department_name || details.from_department || details.from,
        newValue: details.to_department_name || details.to_department || details.department || details.to,
      },
    ];
  }

  if (type === 'reporting_change') {
    return [
      {
        label: 'Reporting To',
        oldValue: details.from_reporting_name || details.from_user_name || details.from,
        newValue: details.to_reporting_name || details.to_user_name || details.to,
      },
    ];
  }

  if (type === 'document_status') {
    return [
      {
        label: 'Document Status',
        oldValue: details.old_status || details.from_status,
        newValue: details.new_status || details.to_status || details.status,
      },
    ];
  }

  return [];
}

function getDetailLines(activity) {
  const type = getType(activity);
  const details = activity.details || {};

  if (isObligationRowActivity(activity) || isObligationDataActivity(activity)) return [];

  if (['create', 'created'].includes(type)) {
    return [
      ['Created by', details.created_by_name || activity.user_name],
      ['Assigned to', details.assigned_to_name],
      ['Created on', formatFullDateTime(activity.created_at)],
    ].filter(([, value]) => normalizeDisplayValue(value) !== 'Not set');
  }

  if (['note', 'remark', 'remark_added'].includes(type)) {
    return [['Note', details.note_text || details.comment || activity.description]].filter(
      ([, value]) => normalizeDisplayValue(value) !== 'Not set'
    );
  }

  if (['document', 'attachment_uploaded', 'document_delete'].includes(type)) {
    return [
      ['File', details.filename || details.document_name || details.name || activity.description],
      ['Status', details.status],
    ].filter(([, value]) => normalizeDisplayValue(value) !== 'Not set');
  }

  if (type.startsWith('task_')) {
    return [
      ['Task', details.task_title || details.title || activity.description],
      ['Status', details.status],
    ].filter(([, value]) => normalizeDisplayValue(value) !== 'Not set');
  }

  if (['login_form_updated', 'file_sent_to_login', 'public_form_update'].includes(type)) {
    return [
      ['Form', details.form_type || details.form_updated],
      ['Details', activity.description],
    ].filter(([, value]) => normalizeDisplayValue(value) !== 'Not set');
  }

  const hasChangeRows = getChangeRows(activity).length > 0;
  if (!hasChangeRows && activity.description) return [['Details', activity.description]];
  return [];
}

function matchesFilter(activity, filter) {
  if (filter === 'all') return true;
  const type = getType(activity);
  if (filter === 'task') return type.startsWith('task_');
  if (filter === 'status') return ['status_change', 'status_changed', 'sub_status_change', 'document_status'].includes(type);
  if (filter === 'assignment') return ['assignment', 'assigned', 'reporting_change'].includes(type);
  if (filter === 'note') return ['note', 'remark', 'remark_added', 'note_updated', 'note_deleted'].includes(type);
  if (filter === 'document') return ['attachment_uploaded', 'document', 'document_status', 'document_delete'].includes(type);
  if (filter === 'transfer') return ['department_transfer', 'transfer', 'transferred'].includes(type);
  return type === filter;
}

function getSearchText(activity) {
  const pieces = [
    getConfig(activity).label,
    getActivityTitle(activity),
    activity.description,
    getUserName(activity),
    activity.created_at,
    JSON.stringify(activity.details || {}),
  ];
  return pieces.filter(Boolean).join(' ').toLowerCase();
}

function groupByDate(activities) {
  return activities.reduce((groups, activity) => {
    const dateKey = formatDateLabel(activity.created_at);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(activity);
    return groups;
  }, {});
}

function parseLegacyObligationChanges(activity) {
  const text = activity?.details?.new_value;
  if (!text || typeof text !== 'string') return [];
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line.includes(':') && line.includes('→'))
    .map((line) => {
      const [labelPart, valuePart = ''] = line.split(':');
      const [oldDisplay = 'Not Set', newDisplay = ''] = valuePart.split('→').map((part) => part.trim());
      return {
        label: labelPart.trim(),
        old_display: oldDisplay,
        new_display: newDisplay,
      };
    });
}

function ObligationRowDetails({ activity }) {
  const details = activity.details || {};
  const rowData = Array.isArray(details.row_data) ? details.row_data : [];
  const changedFields = Array.isArray(details.changed_fields) && details.changed_fields.length > 0
    ? details.changed_fields
    : parseLegacyObligationChanges(activity);
  const operation = normalizeDisplayValue(details.operation);
  const operationLabel = operation !== 'Not set' ? titleize(operation) : 'Updated';

  if (!rowData.length && !changedFields.length) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-cyan-200 bg-cyan-50/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-200 bg-white px-3 py-2">
        <div className="text-xs font-bold text-slate-900">Obligation Table Row</div>
        <span className="rounded-md bg-cyan-100 px-2 py-1 text-[10px] font-bold text-cyan-800">{operationLabel}</span>
      </div>

      {rowData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full border-collapse bg-white text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {rowData.map((item) => (
                  <th key={item.field_key || item.label} className="px-3 py-2 font-bold text-slate-500">
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {rowData.map((item) => (
                  <td key={item.field_key || item.label} className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-900">
                    {normalizeDisplayValue(item.display_value ?? item.value)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {changedFields.length > 0 && (
        <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
          {changedFields.map((change, index) => (
            <div key={`${change.field_key || change.label}-${index}`} className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="mb-2 text-[11px] font-bold text-slate-700">{change.label}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 break-words rounded-md bg-rose-50 px-2 py-1 font-semibold text-rose-800">
                  {normalizeDisplayValue(change.old_display ?? change.old_value)}
                </span>
                <ArrowRight size={13} className="shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 break-words rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                  {normalizeDisplayValue(change.new_display ?? change.new_value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ObligationDataDetails({ activity, leadData }) {
  const details = activity.details || {};
  const changedFields = Array.isArray(details.changed_fields) && details.changed_fields.length > 0
    ? details.changed_fields
    : parseLegacyObligationChanges(activity);
  const activityObject = isPlainObject(details.new_object) && Object.keys(details.new_object).length > 0
    ? details.new_object
    : isPlainObject(details.old_object) && Object.keys(details.old_object).length > 0
      ? details.old_object
      : null;
  const snapshotItems = buildObligationDataSnapshot(activityObject || getLeadObligationData(leadData));

  const getChangeDisplay = (change, side) => {
    const displayKey = side === 'old' ? 'old_display' : 'new_display';
    const valueKey = side === 'old' ? 'old_value' : 'new_value';
    const displayValue = change[displayKey];
    if (displayValue !== undefined && !isObjectSummaryText(displayValue)) return normalizeDisplayValue(displayValue);
    return formatObligationDataValue(change.field_key, change[valueKey], side === 'old' ? 'Not set' : 'Removed');
  };

  if (!changedFields.length && !snapshotItems.length) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-blue-200 bg-blue-50/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 bg-white px-3 py-2">
        <div className="text-xs font-bold text-slate-900">Obligation Data</div>
        <span className="rounded-md bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-800">
          {changedFields.length ? `${changedFields.length} changed` : `${snapshotItems.length} values`}
        </span>
      </div>

      {changedFields.length > 0 && (
        <div className="border-b border-blue-100 p-3">
          <div className="mb-2 text-[11px] font-bold uppercase text-slate-500">Changed Fields</div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {changedFields.map((change, index) => (
              <div key={`${change.field_key || change.label}-${index}`} className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="mb-2 text-[11px] font-bold text-slate-700">
                  {change.label || OBLIGATION_DATA_FIELD_LABELS[change.field_key] || titleize(change.field_key)}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 break-words rounded-md bg-rose-50 px-2 py-1 font-semibold text-rose-800">
                    {getChangeDisplay(change, 'old')}
                  </span>
                  <ArrowRight size={13} className="shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 break-words rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                    {getChangeDisplay(change, 'new')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {snapshotItems.length > 0 && (
        <div className="p-3">
          <div className="mb-2 text-[11px] font-bold uppercase text-slate-500">Saved Values</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {snapshotItems.map((item) => (
              <div key={item.field_key} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="mb-1 text-[10px] font-bold text-slate-500">{item.label}</div>
                <div className="break-words text-xs font-semibold text-slate-900">{item.display_value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChangeRow({ label, oldValue, newValue }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600">
        {label}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)]">
        <div className="min-w-0 border-b border-slate-200 p-3 sm:border-b-0 sm:border-r">
          <div className="mb-1 text-[10px] font-bold text-rose-700">Old Value</div>
          <div className="break-words text-xs font-semibold text-slate-800">{normalizeDisplayValue(oldValue)}</div>
        </div>
        <div className="hidden items-center justify-center bg-slate-50 text-slate-400 sm:flex">
          <ArrowRight size={15} />
        </div>
        <div className="min-w-0 p-3 sm:border-l">
          <div className="mb-1 text-[10px] font-bold text-emerald-700">New Value</div>
          <div className="break-words text-xs font-semibold text-slate-800">{normalizeDisplayValue(newValue)}</div>
        </div>
      </div>
    </div>
  );
}

function DetailLines({ lines }) {
  if (!lines.length) return null;
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {lines.map(([label, value]) => (
        <div key={`${label}-${normalizeDisplayValue(value)}`} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="mb-1 text-[10px] font-bold text-slate-500">{label}</div>
          <div className="break-words text-xs font-semibold text-slate-900">{normalizeDisplayValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function ActivityCard({ activity, isLast, leadData }) {
  const config = getConfig(activity);
  const tone = TONE_STYLES[config.tone] || TONE_STYLES.slate;
  const Icon = config.Icon;
  const changeRows = getChangeRows(activity).filter(
    (row) => normalizeDisplayValue(row.oldValue) !== 'Not set' || normalizeDisplayValue(row.newValue) !== 'Not set'
  );
  const detailLines = getDetailLines(activity);
  const showObligationRow = isObligationRowActivity(activity);
  const showObligationData = isObligationDataActivity(activity);

  return (
    <div className="grid grid-cols-[58px_28px_minmax(0,1fr)] gap-3 sm:grid-cols-[74px_32px_minmax(0,1fr)]">
      <div className="pt-1 text-right">
        <div className="text-[11px] font-bold text-slate-700">{formatTime(activity.created_at)}</div>
      </div>

      <div className="flex flex-col items-center">
        <div className="z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-sm" style={{ color: tone.text, borderColor: tone.border }}>
          <Icon size={17} />
        </div>
        {!isLast && <div className="mt-2 w-px flex-1 bg-slate-200" />}
      </div>

      <article className="mb-4 min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-l-4 p-3 sm:p-4" style={{ borderLeftColor: tone.text }}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-bold" style={{ color: tone.text, backgroundColor: tone.bg, borderColor: tone.border }}>
                <Icon size={13} />
                {config.label}
              </span>
              <h4 className="mt-2 break-words text-sm font-bold text-slate-950">{getActivityTitle(activity)}</h4>
              {activity.description && activity.description !== getActivityTitle(activity) && !showObligationRow && !showObligationData && (
                <p className="mt-1 break-words text-xs font-medium text-slate-600">{activity.description}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-700">
                <User size={12} />
                <span className="truncate">{getUserName(activity)}</span>
              </span>
              <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-600">
                <CalendarDays size={12} />
                <span className="truncate">{formatFullDateTime(activity.created_at)}</span>
              </span>
            </div>
          </div>

          {changeRows.map((row) => (
            <ChangeRow key={row.label} {...row} />
          ))}
          {showObligationRow && <ObligationRowDetails activity={activity} />}
          {showObligationData && <ObligationDataDetails activity={activity} leadData={leadData} />}
          <DetailLines lines={detailLines} />
        </div>
      </article>
    </div>
  );
}

export default function LeadActivity({ leadId, userId, leadData }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const resolvedLeadId = useMemo(() => resolveLeadId(leadId, leadData), [leadId, leadData]);
  const resolvedUserId = useMemo(() => resolveUserId(userId, leadData), [userId, leadData]);

  const isLoginLead = Boolean(leadData && (leadData.original_lead_id || leadData.login_created_at || leadData.login_id));

  const fetchActivities = useCallback(async () => {
    if (!resolvedLeadId || !resolvedUserId) {
      setActivities([]);
      setError('Lead activity load karne ke liye lead ID ya user ID missing hai.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const basePath = isLoginLead
        ? `/api/lead-login/login-leads/${encodeURIComponent(resolvedLeadId)}/activities`
        : `/api/leads/${encodeURIComponent(resolvedLeadId)}/activities`;
      const params = new URLSearchParams({
        user_id: resolvedUserId,
        limit: '500',
      });
      const token = localStorage.getItem('token');
      const response = await fetch(`${basePath}?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);
      const payload = await response.json();
      const normalized = normalizeActivities(normalizeResponsePayload(payload), leadData, resolvedLeadId);
      setActivities(normalized);
    } catch (err) {
      setError('Activity history load nahi ho paayi. Refresh karke dobara try karein.');
      setActivities(leadData ? normalizeActivities([], leadData, resolvedLeadId) : []);
    } finally {
      setIsLoading(false);
    }
  }, [isLoginLead, leadData, resolvedLeadId, resolvedUserId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const filteredActivities = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return activities.filter((activity) => {
      if (!matchesFilter(activity, filter)) return false;
      if (!query) return true;
      return getSearchText(activity).includes(query);
    });
  }, [activities, filter, searchTerm]);

  const groupedActivities = useMemo(() => groupByDate(filteredActivities), [filteredActivities]);
  const sortedDates = useMemo(
    () =>
      Object.keys(groupedActivities).sort((a, b) => {
        const bTime = parseDate(groupedActivities[b]?.[0]?.created_at)?.getTime() || 0;
        const aTime = parseDate(groupedActivities[a]?.[0]?.created_at)?.getTime() || 0;
        return bTime - aTime;
      }),
    [groupedActivities]
  );

  const summaryItems = useMemo(
    () => [
      { label: 'Total', value: activities.length, Icon: Activity },
      { label: 'Fields', value: activities.filter((activity) => matchesFilter(activity, 'field_update')).length, Icon: ClipboardList },
      { label: 'Status', value: activities.filter((activity) => matchesFilter(activity, 'status')).length, Icon: Activity },
      { label: 'Notes', value: activities.filter((activity) => matchesFilter(activity, 'note')).length, Icon: MessageSquareText },
      { label: 'Docs', value: activities.filter((activity) => matchesFilter(activity, 'document')).length, Icon: FileText },
    ],
    [activities]
  );

  return (
    <section className="w-full bg-slate-100 text-slate-950">
      <div className="border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Activity size={16} />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-950">Leads Activity</h3>
                <p className="text-xs font-medium text-slate-500">
                  {filteredActivities.length} shown of {activities.length} activities
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:min-w-[520px]">
            {summaryItems.map(({ label, value, Icon }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500">{label}</span>
                  <Icon size={13} className="text-slate-400" />
                </div>
                <div className="mt-1 text-lg font-bold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(240px,1fr)_auto_auto]">
          <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search activity, user, status, field, note..."
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400"
            />
          </label>

          <div className="flex min-h-10 flex-wrap items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 p-1">
            {FILTERS.map((item) => {
              const count = item.value === 'all'
                ? activities.length
                : activities.filter((activity) => matchesFilter(activity, item.value)).length;
              const selected = filter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`h-8 rounded-md px-2.5 text-xs font-bold transition ${
                    selected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-slate-950'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${selected ? 'bg-white/15 text-white' : 'bg-white text-slate-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={fetchActivities}
            disabled={isLoading}
            title="Refresh activity"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-sm font-bold text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-3 py-4 sm:px-4">
        {!isLoading && error && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            <AlertCircle size={16} />
            <span className="min-w-0 flex-1">{error}</span>
          </div>
        )}

        {isLoading && (
          <div className="flex min-h-[220px] items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600">
            <RefreshCw size={18} className="animate-spin" />
            Loading activities...
          </div>
        )}

        {!isLoading && filteredActivities.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
            <Activity size={34} className="mx-auto mb-3 text-slate-400" />
            <div className="text-sm font-bold text-slate-800">No activity found</div>
            <div className="mt-1 text-xs font-medium text-slate-500">Search ya filter change karke dobara dekhein.</div>
          </div>
        )}

        {!isLoading &&
          sortedDates.map((dateKey) => (
            <div key={dateKey} className="mb-2">
              <div className="sticky top-0 z-[1] mb-3 flex items-center gap-3 bg-slate-100 py-1">
                <div className="h-px flex-1 bg-slate-300" />
                <div className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-bold text-slate-700 shadow-sm">
                  <CalendarDays size={13} />
                  {dateKey}
                </div>
                <div className="h-px flex-1 bg-slate-300" />
              </div>

              {(groupedActivities[dateKey] || []).map((activity, index, dateActivities) => (
                <ActivityCard
                  key={activity._id || `${dateKey}-${index}`}
                  activity={activity}
                  isLast={index === dateActivities.length - 1}
                  leadData={leadData}
                />
              ))}
            </div>
          ))}
      </div>
    </section>
  );
}
