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
  reporting_change: { label: 'Reporting Updated', tone: 'slate', Icon: User },
  note: { label: 'Remark Added', tone: 'slate', Icon: MessageSquareText },
  remark: { label: 'Remark Added', tone: 'slate', Icon: MessageSquareText },
  remark_added: { label: 'Remark Added', tone: 'slate', Icon: MessageSquareText },
  note_updated: { label: 'Remark Updated', tone: 'slate', Icon: MessageSquareText },
  note_deleted: { label: 'Remark Deleted', tone: 'slate', Icon: MessageSquareText },
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
  { value: 'note', label: 'Remarks' },
  { value: 'document', label: 'Documents' },
  { value: 'task', label: 'Tasks' },
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
  partnerSalary: "Partner's Salary",
  partner_salary: "Partner's Salary",
  yearlyBonus: 'Bonus',
  yearly_bonus: 'Bonus',
  bonusDivision: 'Bonus Duration',
  bonus_division: 'Bonus Duration',
  loanRequired: 'Loan Required',
  loan_required: 'Loan Required',
  loan_amount: 'Loan Amount',
  companyName: 'Company Name',
  company_name: 'Company Name',
  companyType: 'Decide Bank For Case',
  company_type: 'Decide Bank For Case',
  processingBanks: 'Decide Bank For Case',
  processing_banks: 'Decide Bank For Case',
  processing_bank: 'Processing Bank',
  bank_name: 'Bank Name',
  bankName: 'Bank Name',
  selectedBanks: 'Decide Bank For Case',
  companyCategory: 'Company Category',
  company_category: 'Company Category',
  cibilScore: 'CIBIL Score',
  cibil_score: 'CIBIL Score',
  obligations: 'Obligation Rows',
  foirPercent: 'FOIR %',
  foir_percent: 'FOIR %',
  customFoirPercent: 'Custom FOIR %',
  custom_foir_percent: 'Custom FOIR %',
  totalBtPos: 'Total BT POS',
  total_bt_pos: 'Total BT POS',
  totalObligation: 'Total Obligation',
  totalObligations: 'Total Obligation',
  total_obligation: 'Total Obligation',
  total_obligations: 'Total Obligation',
  eligibility: 'Eligibility Details',
  ceCompanyCategory: 'Company Category',
  ceFoirPercent: 'FOIR %',
  ceCustomFoirPercent: 'Custom FOIR %',
  ceMonthlyEmiCanPay: 'EMI Can Pay',
  monthly_emi_can_pay: 'EMI Can Pay',
  ceTenureMonths: 'Tenure',
  tenure_months: 'Tenure',
  ceTenureYears: 'Tenure (Years)',
  tenure_years: 'Tenure (Years)',
  ceRoi: 'ROI %',
  roi: 'ROI %',
  ceMultiplier: 'Multiplier',
  multiplier: 'Multiplier',
  loanEligibilityStatus: 'Eligibility Status',
  loan_eligibility_status: 'Eligibility Status',
  totalIncome: 'Total Income',
  total_income: 'Total Income',
  foirAmount: 'FOIR Amount',
  foir_amount: 'FOIR Amount',
  finalEligibility: 'FOIR Eligibility',
  final_eligibility: 'FOIR Eligibility',
  foirEligibility: 'FOIR Eligibility',
  foir_eligibility: 'FOIR Eligibility',
  multiplierEligibility: 'Multiplier Eligibility',
  multiplier_eligibility: 'Multiplier Eligibility',
};

const CHECK_ELIGIBILITY_FIELDS = [
  {
    key: 'totalIncome',
    label: 'Total Income',
    aliases: ['totalIncome', 'total_income'],
    type: 'currency',
  },
  {
    key: 'companyCategory',
    label: 'Company Category',
    aliases: ['company_category', 'ceCompanyCategory', 'companyCategory'],
  },
  {
    key: 'foirPercent',
    label: 'FOIR %',
    aliases: ['foir_percent', 'ceFoirPercent', 'foirPercent'],
    type: 'percent',
  },
  {
    key: 'customFoirPercent',
    label: 'Custom FOIR %',
    aliases: ['custom_foir_percent', 'ceCustomFoirPercent', 'customFoirPercent'],
    type: 'percent',
  },
  {
    key: 'foirAmount',
    label: 'FOIR Amount',
    aliases: ['foirAmount', 'foir_amount'],
    type: 'currency',
  },
  {
    key: 'totalObligation',
    label: 'Total Obligation',
    aliases: ['totalObligation', 'totalObligations', 'total_obligation', 'total_obligations'],
    type: 'currency',
  },
  {
    key: 'monthlyEmiCanPay',
    label: 'EMI Can Pay',
    aliases: ['monthly_emi_can_pay', 'ceMonthlyEmiCanPay'],
    type: 'currency',
  },
  {
    key: 'tenure',
    label: 'Tenure',
    aliases: ['tenure_months', 'ceTenureMonths', 'required_tenure'],
    type: 'tenure',
  },
  {
    key: 'tenureYears',
    label: 'Tenure (Years)',
    aliases: ['tenure_years', 'ceTenureYears'],
  },
  {
    key: 'roi',
    label: 'ROI %',
    aliases: ['roi', 'ceRoi'],
    type: 'percent',
  },
  {
    key: 'totalBtPos',
    label: 'Total BT POS',
    aliases: ['totalBtPos', 'total_bt_pos'],
    type: 'currency',
  },
  {
    key: 'foirEligibility',
    label: 'FOIR Eligibility',
    aliases: ['finalEligibility', 'final_eligibility', 'foirEligibility', 'foir_eligibility'],
    type: 'currency',
  },
  {
    key: 'multiplier',
    label: 'Multiplier',
    aliases: ['multiplier', 'ceMultiplier'],
  },
  {
    key: 'multiplierEligibility',
    label: 'Multiplier Eligibility',
    aliases: ['multiplierEligibility', 'multiplier_eligibility'],
    type: 'currency',
  },
  {
    key: 'eligibilityStatus',
    label: 'Eligibility Status',
    aliases: ['loan_eligibility_status', 'loanEligibilityStatus'],
  },
];

const CHECK_ELIGIBILITY_ALIAS_TO_FIELD = new Map();
CHECK_ELIGIBILITY_FIELDS.forEach((field) => {
  field.aliases.forEach((alias) => CHECK_ELIGIBILITY_ALIAS_TO_FIELD.set(alias, field));
  CHECK_ELIGIBILITY_ALIAS_TO_FIELD.set(field.key, field);
});

const FRONTEND_LABEL_OVERRIDES = {
  'partner salary': "Partner's Salary",
  "partner's salary": "Partner's Salary",
  'partner_salary': "Partner's Salary",
  'yearly bonus': 'Bonus',
  'yearly_bonus': 'Bonus',
  'bonus division': 'Bonus Duration',
  'bonus_division': 'Bonus Duration',
  'company type': 'Decide Bank For Case',
  'company_type': 'Decide Bank For Case',
  'processing banks': 'Decide Bank For Case',
  'selected banks': 'Decide Bank For Case',
  'monthly emi can pay': 'EMI Can Pay',
  'monthly_emi_can_pay': 'EMI Can Pay',
  'tenure months': 'Tenure',
  'tenure_months': 'Tenure',
  'rate of interest (roi)': 'ROI %',
  'roi': 'ROI %',
  'ce roi': 'ROI %',
  'ceRoi': 'ROI %',
  'final eligibility': 'FOIR Eligibility',
  'final_eligibility': 'FOIR Eligibility',
  'foir eligibility': 'FOIR Eligibility',
  'multiplier eligibility': 'Multiplier Eligibility',
  'multiplier_eligibility': 'Multiplier Eligibility',
  'loan eligibility status': 'Eligibility Status',
  'loan_eligibility_status': 'Eligibility Status',
  'sub status': 'Sub-status',
};

const OBLIGATION_CURRENCY_FIELDS = new Set([
  'salary',
  'partnerSalary',
  'partner_salary',
  'yearlyBonus',
  'yearly_bonus',
  'loanRequired',
  'loan_required',
  'loan_amount',
  'totalBtPos',
  'total_bt_pos',
  'totalObligation',
  'totalObligations',
  'total_obligation',
  'total_obligations',
  'ceMonthlyEmiCanPay',
  'monthly_emi_can_pay',
  'totalIncome',
  'total_income',
  'foirAmount',
  'foir_amount',
  'finalEligibility',
  'final_eligibility',
  'foirEligibility',
  'foir_eligibility',
  'multiplierEligibility',
  'multiplier_eligibility',
]);

const OBLIGATION_PERCENT_FIELDS = new Set([
  'foirPercent',
  'foir_percent',
  'customFoirPercent',
  'custom_foir_percent',
  'ceFoirPercent',
  'ceCustomFoirPercent',
  'ceRoi',
  'roi',
]);

const OBLIGATION_HIDDEN_FIELDS = new Set(['dynamic_fields', 'dynamic_details']);

const HIDDEN_ACTIVITY_TYPES = new Set([
  'department_transfer',
  'transfer',
  'transferred',
  'reassignment',
]);

const HIDDEN_REASSIGNMENT_ACTIONS = new Set([
  'requested',
  'approved',
  'approved_direct',
  'rejected',
  'auto_rejected',
  'direct',
]);

const CREATED_FIELD_LABELS = {
  custom_lead_id: 'Lead ID',
  first_name: 'First Name',
  last_name: 'Last Name',
  customer_name: 'Customer Name',
  email: 'Email',
  phone: 'Phone',
  mobile_number: 'Mobile Number',
  alternative_phone: 'Alternative Phone',
  loan_type: 'Loan Type',
  loan_type_name: 'Loan Type',
  processing_bank: 'Processing Bank',
  loan_amount: 'Loan Amount',
  status: 'Status',
  sub_status: 'Sub-status',
  priority: 'Priority',
  source: 'Source',
  campaign_name: 'Source Name',
  data_code: 'Data Code',
  product_name: 'Product Name',
  xyz: 'XYZ',
  pincode_city: 'Pincode & City',
  department_id: 'Department',
  assigned_to: 'Assigned To',
  assign_report_to: 'Reporting Users',
  created_by: 'Created By',
  created_by_role: 'Created By Role',
  created_at: 'Created On',
  created_date: 'Created Date',
  form_share: 'Form Share',
  notes: 'Remarks',
  note: 'Remarks',
  remarks: 'Remarks',
  financial_details: 'Financial Details',
  personal_details: 'Personal Details',
  identity_details: 'Identity Details',
  emergency_contact: 'Emergency Contact',
  references: 'References',
  obligations: 'Obligations',
  eligibility: 'Eligibility',
  check_eligibility: 'Check Eligibility',
  eligibility_details: 'Eligibility Details',
  applicant_form: 'Applicant Form',
  co_applicant_form: 'Co-applicant Form',
  obligation_data: 'Obligation Data',
  process_data: 'Process Data',
  process: 'Process',
  cibil_score: 'CIBIL Score',
  loan_eligibility: 'Loan Eligibility',
  company_name: 'Company Name',
  company_type: 'Decide Bank For Case',
  company_category: 'Company Category',
  salary: 'Salary',
  partnerSalary: "Partner's Salary",
  partner_salary: "Partner's Salary",
  yearlyBonus: 'Bonus',
  yearly_bonus: 'Bonus',
  bonusDivision: 'Bonus Duration',
  bonus_division: 'Bonus Duration',
  totalIncome: 'Total Income',
  total_income: 'Total Income',
  foir_percent: 'FOIR %',
  custom_foir_percent: 'Custom FOIR %',
  foirAmount: 'FOIR Amount',
  foir_amount: 'FOIR Amount',
  monthly_emi_can_pay: 'EMI Can Pay',
  tenure_months: 'Tenure',
  tenure_years: 'Tenure (Years)',
  roi: 'ROI %',
  multiplier: 'Multiplier',
  totalObligation: 'Total Obligation',
  totalObligations: 'Total Obligation',
  total_obligation: 'Total Obligation',
  total_obligations: 'Total Obligation',
  totalBtPos: 'Total BT POS',
  total_bt_pos: 'Total BT POS',
  finalEligibility: 'FOIR Eligibility',
  final_eligibility: 'FOIR Eligibility',
  foirEligibility: 'FOIR Eligibility',
  foir_eligibility: 'FOIR Eligibility',
  multiplierEligibility: 'Multiplier Eligibility',
  multiplier_eligibility: 'Multiplier Eligibility',
  loanEligibilityStatus: 'Eligibility Status',
  loan_eligibility_status: 'Eligibility Status',
  ceCompanyCategory: 'Company Category',
  ceFoirPercent: 'FOIR %',
  ceCustomFoirPercent: 'Custom FOIR %',
  ceMonthlyEmiCanPay: 'EMI Can Pay',
  ceTenureMonths: 'Tenure',
  ceTenureYears: 'Tenure (Years)',
  ceRoi: 'ROI %',
  ceMultiplier: 'Multiplier',
};

const CREATED_FIELD_HIDDEN_KEYS = new Set([
  '_id',
  'id',
  'updated_at',
  'activity',
  'activities',
  'activity_history',
  'override_created_by_id',
  'override_created_at',
  '_force_override_created_at',
  'status_name',
  'status_color',
  'sub_status_name',
  'assigned_to_name',
  'assigned_to_email',
  'assigned_user_name',
  'assigned_user_email',
  'created_by_name',
  'creator_name',
  'department_name',
  'reporting_user_names',
  'reporters',
  'loan_type_id',
  'previous_assigned_to',
]);

const CREATED_FIELD_SENSITIVE_TOKENS = ['password', 'token', 'secret', 'otp'];

const CREATED_OBLIGATION_FIELD_ORDER = [
  'product',
  'bank',
  'tenure',
  'roi',
  'total_loan',
  'outstanding',
  'emi',
  'action',
];

const CREATED_OBLIGATION_FIELD_ALIASES = {
  product: ['product'],
  bank: ['bank_name', 'bankName', 'bank'],
  tenure: ['tenure'],
  roi: ['roi'],
  total_loan: ['total_loan', 'totalLoan'],
  outstanding: ['outstanding'],
  emi: ['emi'],
  action: ['action'],
};

const CREATED_OBLIGATION_FIELD_LABELS = {
  product: 'Product',
  bank: 'Bank',
  tenure: 'Tenure',
  roi: 'ROI',
  total_loan: 'Total Loan',
  outstanding: 'Outstanding',
  emi: 'EMI',
  action: 'Action',
};

const CUSTOMER_NAME_FIELD_KEYS = new Set([
  'first_name',
  'last_name',
  'customer_name',
  'dynamic_fields.customer_name',
]);

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

const CREATED_STATUS_FIELD_KEYS = new Set(['status', 'sub_status']);
const CREATED_ASSIGNMENT_FIELD_KEYS = new Set(['assigned_to', 'assign_report_to', 'created_by', 'department_id']);
const CREATED_META_FIELD_KEYS = new Set(['created_at', 'created_date', 'created_by_role', 'priority', 'form_share']);

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

function isHiddenTransferActivity(activity) {
  const activityType = String(activity?.activity_type || activity?.type || '').toLowerCase();
  const action = String(activity?.action || '').toLowerCase();
  const detailKeys = Object.keys(activity?.details || {}).join(' ').toLowerCase();

  if (HIDDEN_ACTIVITY_TYPES.has(activityType) || activityType.includes('transfer') || activityType.includes('reassignment')) {
    return true;
  }
  if (['department_transfer', 'transfer', 'transferred'].includes(action)) return true;
  if (detailKeys.includes('reassignment') || detailKeys.includes('transfer_notes')) return true;
  return activityType === 'reassignment' && HIDDEN_REASSIGNMENT_ACTIONS.has(action);
}

function shouldHideCreatedField(fieldKey) {
  const normalizedKey = String(fieldKey || '').toLowerCase();
  const lastSegment = normalizedKey.split('.').pop();
  if (CREATED_FIELD_HIDDEN_KEYS.has(normalizedKey) || CREATED_FIELD_HIDDEN_KEYS.has(lastSegment)) return true;
  return CREATED_FIELD_SENSITIVE_TOKENS.some((token) => lastSegment.includes(token));
}

function formatCreatedLabelPart(value) {
  const text = String(value || '').replace(/_/g, ' ').replace(/-/g, ' ').trim();
  if (!text) return 'Field';
  const overrides = {
    id: 'ID',
    pan: 'PAN',
    ifsc: 'IFSC',
    cibil: 'CIBIL',
    foir: 'FOIR',
    roi: 'ROI',
    emi: 'EMI',
    bt: 'BT',
    pos: 'POS',
    xyz: 'XYZ',
    aadhar: 'Aadhaar',
  };
  return text
    .split(/\s+/)
    .map((part) => overrides[part.toLowerCase()] || `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getCreatedFieldLabel(path) {
  const fieldKey = path.join('.');
  if (CREATED_FIELD_LABELS[fieldKey]) return CREATED_FIELD_LABELS[fieldKey];

  const labels = [];
  path.forEach((segment) => {
    if (segment === 'dynamic_fields') return;
    if (/^\d+$/.test(String(segment))) {
      if (labels.length) labels[labels.length - 1] = `${labels[labels.length - 1]} ${segment}`;
      else labels.push(`Item ${segment}`);
      return;
    }
    labels.push(CREATED_FIELD_LABELS[segment] || formatCreatedLabelPart(segment));
  });
  return labels.length ? labels.join(' - ') : 'Field';
}

function formatCreatedFieldValue(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const parts = value
      .filter((item) => !isEmptyDisplayValue(item))
      .map((item) => formatCreatedFieldValue(item))
      .filter((item) => item && item !== 'Not set');
    return parts.length ? parts.join(', ') : 'Not set';
  }
  if (isPlainObject(value)) {
    const preferred = value.display_value || value.display || value.name || value.label || value.value;
    if (!isEmptyDisplayValue(preferred)) return formatCreatedFieldValue(preferred);
    try {
      return JSON.stringify(value);
    } catch {
      return normalizeDisplayValue(value);
    }
  }
  return normalizeDisplayValue(value);
}

function splitDisplayList(value) {
  if (Array.isArray(value)) return value.map(normalizeDisplayValue).filter((item) => item !== 'Not set');
  const text = normalizeDisplayValue(value);
  if (text === 'Not set') return [];
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isObjectIdText(value) {
  return OBJECT_ID_PATTERN.test(String(value || '').trim());
}

function getPersonName(value) {
  if (isEmptyDisplayValue(value)) return null;
  if (typeof value === 'string') return isObjectIdText(value) ? null : normalizeDisplayValue(value);
  if (isPlainObject(value)) {
    const fullName =
      value.name ||
      value.full_name ||
      value.display_name ||
      value.label ||
      [value.first_name, value.last_name].filter(Boolean).join(' ').trim();
    return fullName && !isObjectIdText(fullName) ? normalizeDisplayValue(fullName) : null;
  }
  return null;
}

function buildUserNameMap(leadData) {
  const map = new Map();

  const addUser = (user) => {
    if (!isPlainObject(user)) return;
    const id = getObjectId(user.id || user._id || user.user_id || user.employee_id);
    const name = getPersonName(user);
    if (id && name) map.set(String(id), name);
  };

  if (Array.isArray(leadData?.reporters)) leadData.reporters.forEach(addUser);
  if (Array.isArray(leadData?.assigned_to)) leadData.assigned_to.forEach(addUser);
  if (isPlainObject(leadData?.assigned_to)) addUser(leadData.assigned_to);
  if (Array.isArray(leadData?.assign_report_to)) leadData.assign_report_to.forEach(addUser);
  if (isPlainObject(leadData?.assign_report_to)) addUser(leadData.assign_report_to);

  const assignedId = getObjectId(leadData?.assigned_to);
  const assignedName = leadData?.assigned_to_name || leadData?.assigned_user_name || parseAssignedToName(leadData);
  if (assignedId && assignedName) map.set(String(assignedId), normalizeDisplayValue(assignedName));

  return map;
}

function resolveUserValue(value, leadData, explicitNames) {
  const names = splitDisplayList(explicitNames).filter((item) => item && !isObjectIdText(item));
  if (names.length) return names.join(', ');

  if (Array.isArray(value)) {
    const userMap = buildUserNameMap(leadData);
    const resolved = value
      .map((item) => {
        const directName = getPersonName(item);
        if (directName) return directName;
        const id = getObjectId(item);
        return id ? userMap.get(String(id)) || null : null;
      })
      .filter(Boolean);
    if (resolved.length) return resolved.join(', ');
    const hasOnlyIds = value.every((item) => {
      const id = getObjectId(item);
      return id && isObjectIdText(id);
    });
    return hasOnlyIds ? 'Not set' : normalizeDisplayValue(value);
  }

  const directName = getPersonName(value);
  if (directName) return directName;
  const id = getObjectId(value);
  if (id) {
    const mapped = buildUserNameMap(leadData).get(String(id));
    if (mapped) return mapped;
    if (isObjectIdText(id)) return 'Not set';
  }
  return normalizeDisplayValue(value);
}

function getReportingUsersDisplay(activity, leadData) {
  const details = activity?.details || {};
  const explicitNames =
    details.reporting_user_names ||
    details.reporting_to_names ||
    details.reporter_names ||
    leadData?.reporting_user_names ||
    (Array.isArray(leadData?.reporters) ? leadData.reporters.map((item) => item.name || getPersonName(item)).filter(Boolean) : null);

  return resolveUserValue(
    details.reporting_users || details.assign_report_to || leadData?.assign_report_to,
    leadData,
    explicitNames
  );
}

function normalizeActivityFieldLabel(label) {
  const raw = String(label || '').trim();
  const normalized = raw.replace(/_/g, ' ').trim().toLowerCase();
  const compact = raw.replace(/_/g, '').trim();
  if (FRONTEND_LABEL_OVERRIDES[raw] || FRONTEND_LABEL_OVERRIDES[normalized]) {
    return FRONTEND_LABEL_OVERRIDES[raw] || FRONTEND_LABEL_OVERRIDES[normalized];
  }
  const checkField = CHECK_ELIGIBILITY_ALIAS_TO_FIELD.get(raw) || CHECK_ELIGIBILITY_ALIAS_TO_FIELD.get(compact);
  if (checkField) return checkField.label;
  if (['first name', 'last name', 'customer name'].includes(normalized)) return 'Customer Name';
  if (['assign report to', 'reporting to', 'reporting users'].includes(normalized)) return 'Reporting Users';
  if (normalized === 'sub status') return 'Sub-status';
  return label;
}

function getFrontendFieldLabel(fieldKey, fallbackLabel) {
  const rawKey = String(fieldKey || '').trim();
  const lastSegment = rawKey.split('.').pop() || rawKey;
  const fromFallback = fallbackLabel ? normalizeActivityFieldLabel(fallbackLabel) : null;
  const checkField = CHECK_ELIGIBILITY_ALIAS_TO_FIELD.get(rawKey) || CHECK_ELIGIBILITY_ALIAS_TO_FIELD.get(lastSegment);
  if (checkField) return checkField.label;
  if (OBLIGATION_DATA_FIELD_LABELS[rawKey] || OBLIGATION_DATA_FIELD_LABELS[lastSegment]) {
    return OBLIGATION_DATA_FIELD_LABELS[rawKey] || OBLIGATION_DATA_FIELD_LABELS[lastSegment];
  }
  if (CREATED_FIELD_LABELS[rawKey] || CREATED_FIELD_LABELS[lastSegment]) {
    return CREATED_FIELD_LABELS[rawKey] || CREATED_FIELD_LABELS[lastSegment];
  }
  if (fromFallback && fromFallback !== fallbackLabel) return fromFallback;
  return fromFallback || titleize(lastSegment || rawKey);
}

/**
 * Strict check: does this field have an EXPLICIT frontend label/name?
 *
 * The lead-activity timeline must only show fields the frontend actually names.
 * Fields that exist only in the backend (internal keys, ad-hoc/compound keys,
 * un-labelled nested data) must be hidden — we never invent a label by
 * titleizing a raw backend key. Only the backend VALUE is shown, paired with the
 * known frontend label.
 */
function hasExplicitFrontendLabel(fieldKey) {
  const rawKey = String(fieldKey || '').trim();
  if (!rawKey) return false;
  const lastSegment = rawKey.split('.').pop() || rawKey;
  const normalized = rawKey.replace(/_/g, ' ').trim().toLowerCase();
  const lastNormalized = lastSegment.replace(/_/g, ' ').trim().toLowerCase();
  const compact = rawKey.replace(/_/g, '').trim();
  const lastCompact = lastSegment.replace(/_/g, '').trim();

  if (
    CHECK_ELIGIBILITY_ALIAS_TO_FIELD.has(rawKey) ||
    CHECK_ELIGIBILITY_ALIAS_TO_FIELD.has(lastSegment) ||
    CHECK_ELIGIBILITY_ALIAS_TO_FIELD.has(compact) ||
    CHECK_ELIGIBILITY_ALIAS_TO_FIELD.has(lastCompact)
  ) return true;

  if (
    OBLIGATION_DATA_FIELD_LABELS[rawKey] || OBLIGATION_DATA_FIELD_LABELS[lastSegment] ||
    CREATED_FIELD_LABELS[rawKey] || CREATED_FIELD_LABELS[lastSegment] ||
    CREATED_OBLIGATION_FIELD_LABELS[lastSegment] ||
    FRONTEND_LABEL_OVERRIDES[rawKey.toLowerCase()] ||
    FRONTEND_LABEL_OVERRIDES[normalized] ||
    FRONTEND_LABEL_OVERRIDES[lastNormalized]
  ) return true;

  // Created-obligation aliases (bank_name, totalLoan, …) map to a known label.
  for (const aliases of Object.values(CREATED_OBLIGATION_FIELD_ALIASES)) {
    if (aliases.includes(lastSegment)) return true;
  }

  // Names/reporting/status are resolved to frontend labels in dedicated code.
  if (CUSTOMER_NAME_FIELD_KEYS.has(rawKey) || CUSTOMER_NAME_FIELD_KEYS.has(lastSegment)) return true;
  if (['assign_report_to', 'reporting_users', 'reporting_to'].includes(lastSegment)) return true;
  if (lastSegment === 'sub_status' || lastSegment === 'status') return true;

  return false;
}

function normalizeLegacyActivityTextLabels(value) {
  if (typeof value !== 'string' || !value.includes(':')) return value;
  return value
    .split('\n')
    .map((line) => {
      const colonIndex = line.indexOf(':');
      if (colonIndex <= 0) return line;
      const label = line.slice(0, colonIndex).trim();
      const rest = line.slice(colonIndex);
      return `${normalizeActivityFieldLabel(label)}${rest}`;
    })
    .join('\n');
}

function formatActivityDisplayValue(value) {
  const displayValue = normalizeDisplayValue(value);
  return normalizeLegacyActivityTextLabels(displayValue);
}

function getCustomerNameDisplay(rows, leadData) {
  const directRow = rows.find((row) => ['customer_name', 'dynamic_fields.customer_name'].includes(row.field_key));
  if (directRow && directRow.display_value !== 'Not set') return directRow.display_value;

  const leadCustomerName =
    leadData?.customer_name ||
    leadData?.dynamic_fields?.customer_name ||
    [leadData?.first_name, leadData?.last_name].filter(Boolean).join(' ').trim();
  if (!isEmptyDisplayValue(leadCustomerName)) return normalizeDisplayValue(leadCustomerName);

  const firstName = rows.find((row) => row.field_key === 'first_name')?.display_value;
  const lastName = rows.find((row) => row.field_key === 'last_name')?.display_value;
  const combined = [firstName, lastName].filter((item) => item && item !== 'Not set').join(' ').trim();
  return combined || null;
}

function applyCreatedRowsDisplayFixes(rows, activity, leadData) {
  const fixedRows = [];
  const customerName = getCustomerNameDisplay(rows, leadData);
  if (customerName) {
    fixedRows.push({
      field_key: 'customer_name',
      label: 'Customer Name',
      display_value: customerName,
    });
  }

  const reportingDisplay = getReportingUsersDisplay(activity, leadData);

  rows.forEach((row) => {
    if (CUSTOMER_NAME_FIELD_KEYS.has(row.field_key)) return;
    if (row.field_key === 'assign_report_to') {
      const fallbackValue = splitDisplayList(row.display_value).every(isObjectIdText) ? 'Not set' : row.display_value;
      const displayValue = reportingDisplay !== 'Not set' ? reportingDisplay : fallbackValue;
      if (displayValue === 'Not set') return;
      fixedRows.push({
        ...row,
        label: 'Reporting Users',
        display_value: displayValue,
      });
      return;
    }
    fixedRows.push(row);
  });

  const seen = new Set();
  return fixedRows.filter((row) => {
    const signature = `${row.field_key}:${row.display_value}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return row.display_value && row.display_value !== 'Not set';
  });
}

function normalizeCreatedFieldRows(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows
    .map((item, index) => {
      const fieldKey = String(item?.field_key || item?.key || item?.name || `field_${index}`);
      if (shouldHideCreatedField(fieldKey)) return null;
      // Only show fields that have an explicit frontend label — never a titleized
      // raw backend key. If the frontend doesn't name it, it isn't shown.
      if (!hasExplicitFrontendLabel(fieldKey)) return null;
      const displayValue = formatCreatedFieldValue(item?.display_value ?? item?.value);
      if (displayValue === 'Not set') return null;
      const label = getFrontendFieldLabel(fieldKey, item?.label || getCreatedFieldLabel(fieldKey.split('.')));
      const signature = `${fieldKey}:${displayValue}`;
      if (seen.has(signature)) return null;
      seen.add(signature);
      return {
        field_key: fieldKey,
        label,
        display_value: displayValue,
      };
    })
    .filter(Boolean);
}

function buildCreatedRowsFromLeadData(leadData) {
  if (!isPlainObject(leadData)) return [];
  const rows = [];
  const seen = new Set();

  const displayOverrides = {
    created_by: leadData.created_by_name || leadData.creator_name,
    assigned_to: leadData.assigned_to_name || leadData.assigned_user_name || parseAssignedToName(leadData),
    department_id: leadData.department_name,
    assign_report_to: Array.isArray(leadData.reporting_user_names)
      ? leadData.reporting_user_names.join(', ')
      : undefined,
    status: leadData.status_name || leadData.status,
    sub_status: leadData.sub_status_name || leadData.sub_status,
  };

  const addRow = (path, rawValue) => {
    const fieldKey = path.join('.');
    const value = displayOverrides[fieldKey] ?? rawValue;
    if (isEmptyDisplayValue(value) || shouldHideCreatedField(fieldKey)) return;
    // Strict: skip anything the frontend doesn't have a named label for.
    if (!hasExplicitFrontendLabel(fieldKey)) return;
    const displayValue = formatCreatedFieldValue(value);
    if (displayValue === 'Not set') return;
    const label = getFrontendFieldLabel(fieldKey, getCreatedFieldLabel(path));
    const signature = `${fieldKey}:${displayValue}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    rows.push({ field_key: fieldKey, label, display_value: displayValue });
  };

  const walk = (value, path) => {
    const fieldKey = path.join('.');
    if (displayOverrides[fieldKey] !== undefined) {
      addRow(path, displayOverrides[fieldKey]);
      return;
    }
    if (isEmptyDisplayValue(value) || shouldHideCreatedField(fieldKey)) return;
    if (isPlainObject(value)) {
      Object.entries(value).forEach(([key, childValue]) => walk(childValue, [...path, key]));
      return;
    }
    if (Array.isArray(value)) {
      if (value.every((item) => !Array.isArray(item) && !isPlainObject(item))) {
        addRow(path, value);
        return;
      }
      value.forEach((item, index) => walk(item, [...path, String(index + 1)]));
      return;
    }
    addRow(path, value);
  };

  Object.entries(leadData).forEach(([key, value]) => {
    if (shouldHideCreatedField(key)) return;
    if (key === 'phone' && leadData.mobile_number && leadData.phone === leadData.mobile_number) return;
    if (key === 'loan_type' && leadData.loan_type_name && leadData.loan_type === leadData.loan_type_name) return;
    walk(value, [key]);
  });

  return rows;
}

function getCreatedFieldRows(activity, leadData) {
  const detailRows =
    activity?.details?.created_field_values ||
    activity?.details?.created_fields ||
    activity?.details?.field_values ||
    activity?.details?.initial_values;
  const normalizedRows = normalizeCreatedFieldRows(detailRows);
  const rows = normalizedRows.length ? normalizedRows : buildCreatedRowsFromLeadData(leadData);
  return applyCreatedRowsDisplayFixes(rows, activity, leadData);
}

function isCreatedObligationField(fieldKey) {
  return /(?:^|\.)obligations\.\d+\./.test(String(fieldKey || ''));
}

function normalizeObligationFieldKey(fieldKey) {
  const parts = String(fieldKey || '').split('.');
  return parts[parts.length - 1] || '';
}

function getCreatedObligationRows(activity, leadData, createdRows) {
  const directRows = activity?.details?.created_obligation_rows;
  if (Array.isArray(directRows) && directRows.length > 0) {
    return directRows
      .map((row, index) => {
        const values = {};
        Object.entries(row || {}).forEach(([key, value]) => {
          if (isEmptyDisplayValue(value)) return;
          const canonicalKey = Object.entries(CREATED_OBLIGATION_FIELD_ALIASES).find(([, aliases]) =>
            aliases.includes(key)
          )?.[0] || key;
          if (isEmptyDisplayValue(values[canonicalKey])) values[canonicalKey] = formatCreatedFieldValue(value);
        });
        return Object.keys(values).length ? { row_number: index + 1, values } : null;
      })
      .filter(Boolean);
  }

  const sourceRows = createdRows || getCreatedFieldRows(activity, leadData);
  const grouped = new Map();

  sourceRows.forEach((item) => {
    const match = String(item.field_key || '').match(/(?:^|\.)obligations\.(\d+)\.(.+)$/);
    if (!match) return;
    const rowNumber = Number(match[1]);
    const rawFieldKey = normalizeObligationFieldKey(match[2]);
    const displayValue = formatCreatedFieldValue(item.display_value ?? item.value);
    if (!rowNumber || displayValue === 'Not set') return;

    if (!grouped.has(rowNumber)) grouped.set(rowNumber, {});
    const rowValues = grouped.get(rowNumber);

    const canonicalKey = Object.entries(CREATED_OBLIGATION_FIELD_ALIASES).find(([, aliases]) =>
      aliases.includes(rawFieldKey)
    )?.[0] || rawFieldKey;

    if (isEmptyDisplayValue(rowValues[canonicalKey])) {
      rowValues[canonicalKey] = displayValue;
    }
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([rowNumber, values]) => ({ row_number: rowNumber, values }))
    .filter((row) => Object.values(row.values).some((value) => !isEmptyDisplayValue(value)));
}

function getCreatedObligationColumns(obligationRows) {
  const presentKeys = new Set();
  obligationRows.forEach((row) => {
    Object.entries(row.values || {}).forEach(([key, value]) => {
      if (!isEmptyDisplayValue(value)) presentKeys.add(key);
    });
  });

  const orderedKeys = CREATED_OBLIGATION_FIELD_ORDER.filter((key) => presentKeys.has(key));
  const extraKeys = Array.from(presentKeys)
    .filter((key) => !CREATED_OBLIGATION_FIELD_ORDER.includes(key))
    .sort();

  return [...orderedKeys, ...extraKeys].map((key) => ({
    key,
    label: getFrontendFieldLabel(key, CREATED_OBLIGATION_FIELD_LABELS[key] || formatCreatedLabelPart(key)),
  }));
}

function filterCreatedRowsForTab(rows, activeFilter) {
  if (!activeFilter || activeFilter === 'all') return rows;

  if (activeFilter === 'status') {
    return rows.filter((row) => CREATED_STATUS_FIELD_KEYS.has(row.field_key));
  }

  if (activeFilter === 'assignment') {
    return rows.filter((row) => CREATED_ASSIGNMENT_FIELD_KEYS.has(row.field_key));
  }

  if (activeFilter === 'field_update') {
    return rows.filter(
      (row) =>
        !CREATED_STATUS_FIELD_KEYS.has(row.field_key) &&
        !CREATED_ASSIGNMENT_FIELD_KEYS.has(row.field_key) &&
        !CREATED_META_FIELD_KEYS.has(row.field_key)
    );
  }

  return rows;
}

function shouldShowCreatedObligations(activeFilter) {
  return !activeFilter || activeFilter === 'all' || activeFilter === 'field_update';
}

function formatCurrencyValue(value) {
  const raw = String(value ?? '').replace(/[₹,\s]/g, '');
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return normalizeDisplayValue(value);
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(numeric)}`;
}

function compactObjectValue(value) {
  if (!isPlainObject(value)) return normalizeDisplayValue(value);
  const bankAndCategory = [value.bank_name || value.bankName, value.category_name || value.categoryName || value.display]
    .filter((item) => !isEmptyDisplayValue(item))
    .map(normalizeDisplayValue)
    .join(' - ');
  if (bankAndCategory) return bankAndCategory;
  const preferred = value.display || value.category_name || value.bank_name || value.company_name || value.name || value.label || value.value;
  if (preferred) return normalizeDisplayValue(preferred);

  const pieces = Object.entries(value)
    .filter(([, itemValue]) => !isEmptyDisplayValue(itemValue) && !Array.isArray(itemValue) && !isPlainObject(itemValue))
    .slice(0, 4)
    .map(([key, itemValue]) => `${getFrontendFieldLabel(key)}: ${formatActivityDisplayValue(itemValue)}`);

  return pieces.length ? pieces.join(', ') : `${Object.keys(value).length} fields`;
}

function formatPercentValue(value) {
  const text = normalizeDisplayValue(value);
  if (text === 'Not set') return text;
  if (text.toLowerCase() === 'custom') return 'Custom';
  return text.includes('%') ? text : `${text}%`;
}

function formatTenureValue(value) {
  const text = normalizeDisplayValue(value);
  if (text === 'Not set') return text;
  if (/month|year/i.test(text)) return text;
  return `${text} Months`;
}

function formatCheckEligibilityValue(field, value, emptyValue = 'Not set') {
  if (isEmptyDisplayValue(value)) return emptyValue;
  if (Array.isArray(value)) {
    const values = value
      .map((item) => (isPlainObject(item) ? compactObjectValue(item) : normalizeDisplayValue(item)))
      .filter((item) => item !== 'Not set');
    return values.length ? values.join(', ') : emptyValue;
  }
  if (isPlainObject(value)) return compactObjectValue(value);
  if (field?.type === 'currency') return formatCurrencyValue(value);
  if (field?.type === 'percent') return formatPercentValue(value);
  if (field?.type === 'tenure') return formatTenureValue(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return normalizeDisplayValue(value);
}

function formatObligationDataValue(fieldKey, value, emptyValue = 'Not set') {
  if (isEmptyDisplayValue(value)) return emptyValue;

  const checkField = CHECK_ELIGIBILITY_ALIAS_TO_FIELD.get(fieldKey);
  if (checkField) return formatCheckEligibilityValue(checkField, value, emptyValue);

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

function collectCheckEligibilitySourceObjects(leadData) {
  const dynamicFields = leadData?.dynamic_fields || leadData?.dynamicFields || {};
  const dynamicDetails = leadData?.dynamic_details || leadData?.dynamicDetails || {};
  const obligationData = dynamicFields?.obligation_data || dynamicDetails?.obligation_data || leadData?.obligation_data || {};
  const processData = leadData?.process_data || dynamicFields?.process || dynamicFields?.process_data || {};
  return [
    dynamicFields?.check_eligibility,
    dynamicDetails?.check_eligibility,
    leadData?.check_eligibility,
    obligationData?.check_eligibility,
    dynamicFields?.eligibility_details,
    dynamicDetails?.eligibility_details,
    leadData?.eligibility_details,
    obligationData?.eligibility_details,
    obligationData?.eligibility,
    dynamicFields?.eligibility,
    leadData?.eligibility,
    obligationData,
    processData,
    dynamicFields,
    dynamicDetails,
    leadData,
  ].filter((item) => isPlainObject(item) && Object.keys(item).length > 0);
}

function getFieldFromSources(field, sourceObjects) {
  for (const source of sourceObjects) {
    for (const alias of field.aliases) {
      if (source[alias] !== undefined && !isEmptyDisplayValue(source[alias])) return source[alias];
    }
  }
  return undefined;
}

function buildCheckEligibilityRowsFromSources(sourceObjects, rowValues = new Map()) {
  const seenDisplay = new Set();
  return CHECK_ELIGIBILITY_FIELDS
    .map((field) => {
      const value = rowValues.has(field.key) ? rowValues.get(field.key) : getFieldFromSources(field, sourceObjects);
      const displayValue = rowValues.has(field.key)
        ? formatActivityDisplayValue(value)
        : formatCheckEligibilityValue(field, value);
      if (displayValue === 'Not set') return null;
      const signature = `${field.label}:${displayValue}`;
      if (seenDisplay.has(signature)) return null;
      seenDisplay.add(signature);
      return {
        field_key: field.key,
        label: field.label,
        display_value: displayValue,
      };
    })
    .filter(Boolean);
}

function buildCreatedCheckEligibilityRowValues(createdRows = []) {
  const rowValues = new Map();
  createdRows.forEach((item) => {
    const fieldKey = String(item?.field_key || '');
    const lastSegment = fieldKey.split('.').pop() || fieldKey;
    const field = CHECK_ELIGIBILITY_ALIAS_TO_FIELD.get(fieldKey) || CHECK_ELIGIBILITY_ALIAS_TO_FIELD.get(lastSegment);
    if (!field || rowValues.has(field.key)) return;
    const displayValue = item?.display_value ?? item?.value;
    if (!isEmptyDisplayValue(displayValue)) rowValues.set(field.key, displayValue);
  });
  return rowValues;
}

function getCheckEligibilityRows(leadData, createdRows = []) {
  const rowValues = buildCreatedCheckEligibilityRowValues(createdRows);
  const sourceObjects = rowValues.size > 0 ? [] : collectCheckEligibilitySourceObjects(leadData);
  return buildCheckEligibilityRowsFromSources(sourceObjects, rowValues);
}

function isCreatedCheckEligibilityField(fieldKey) {
  const key = String(fieldKey || '');
  const lastSegment = key.split('.').pop() || key;
  if (CHECK_ELIGIBILITY_ALIAS_TO_FIELD.has(key) || CHECK_ELIGIBILITY_ALIAS_TO_FIELD.has(lastSegment)) return true;
  return (
    key.includes('check_eligibility') ||
    key.includes('eligibility_details') ||
    key.includes('obligation_data.eligibility')
  );
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
    .map((key) => [key, getFrontendFieldLabel(key)]);

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

  list = list.filter((activity) => !isHiddenTransferActivity(activity));

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
    return normalizeActivityFieldLabel(
      normalizeDisplayValue(details.field_display_name || details.field_name || activity.description || 'Field Updated')
    );
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

function getChangeRows(activity, leadData) {
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
        oldValue: resolveUserValue(details.from_user || details.from_user_id, leadData, details.from_user_name),
        newValue: resolveUserValue(details.to_user || details.to_user_id || details.assigned_to, leadData, details.to_user_name || details.assigned_to_name),
      },
    ];
  }

  if (type === 'reporting_change') {
    return [
      {
        label: 'Reporting Users',
        oldValue: resolveUserValue(details.removed_reporters || details.from || details.from_user_id, leadData, details.removed_reporter_names || details.from_reporting_name || details.from_user_name),
        newValue: resolveUserValue(details.added_reporters || details.to || details.to_user_id, leadData, details.added_reporter_names || details.to_reporting_name || details.to_user_name),
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

function getDetailLines(activity, leadData, activeFilter = 'all') {
  const type = getType(activity);
  const details = activity.details || {};

  if (isObligationRowActivity(activity) || isObligationDataActivity(activity)) return [];

  if (['create', 'created'].includes(type)) {
    const lines = [
      ['Created by', details.created_by_name || activity.user_name],
      ['Assigned to', details.assigned_to_name || parseAssignedToName(leadData)],
      ['Reporting users', getReportingUsersDisplay(activity, leadData)],
      ['Status', details.initial_status_name || details.status_name || details.status || leadData?.status_name || leadData?.status],
      ['Sub-status', details.initial_sub_status_name || details.sub_status_name || details.sub_status || leadData?.sub_status_name || leadData?.sub_status],
      ['Created on', formatFullDateTime(activity.created_at)],
    ];

    const filteredLines = activeFilter === 'status'
      ? lines.filter(([label]) => ['Status', 'Sub-status', 'Created on'].includes(label))
      : activeFilter === 'assignment'
        ? lines.filter(([label]) => ['Created by', 'Assigned to', 'Reporting users', 'Created on'].includes(label))
        : activeFilter === 'field_update'
          ? lines.filter(([label]) => ['Created by', 'Created on'].includes(label))
          : lines;

    return filteredLines.filter(([, value]) => normalizeDisplayValue(value) !== 'Not set');
  }

  if (['note', 'remark', 'remark_added'].includes(type)) {
    return [['Remarks', details.note_text || details.remark || details.comment || activity.description]].filter(
      ([, value]) => normalizeDisplayValue(value) !== 'Not set'
    );
  }

  if (['status_change', 'status_changed', 'sub_status_change'].includes(type) && details.remark) {
    return [['Remarks', details.remark]].filter(([, value]) => normalizeDisplayValue(value) !== 'Not set');
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

  const hasChangeRows = getChangeRows(activity, leadData).length > 0;
  if (!hasChangeRows && activity.description) return [['Details', activity.description]];
  return [];
}

function matchesFilter(activity, filter, leadData) {
  if (filter === 'all') return true;
  const type = getType(activity);
  const isCreateActivity = ['create', 'created'].includes(type);
  if (isCreateActivity) {
    const details = activity.details || {};
    if (filter === 'field_update') return getCreatedFieldRows(activity, leadData).length > 0;
    if (filter === 'status') {
      return !isEmptyDisplayValue(details.initial_status_name || details.initial_status || leadData?.status_name || leadData?.status);
    }
    if (filter === 'assignment') {
      return (
        !isEmptyDisplayValue(details.assigned_to_name || details.assigned_to || leadData?.assigned_to_name || leadData?.assigned_to) ||
        getReportingUsersDisplay(activity, leadData) !== 'Not set'
      );
    }
    return false;
  }
  if (filter === 'task') return type.startsWith('task_');
  if (filter === 'status') return ['status_change', 'status_changed', 'sub_status_change', 'document_status'].includes(type);
  if (filter === 'assignment') return ['assignment', 'assigned', 'reporting_change'].includes(type);
  if (filter === 'note') return ['note', 'remark', 'remark_added', 'note_updated', 'note_deleted'].includes(type);
  if (filter === 'document') return ['attachment_uploaded', 'document', 'document_status', 'document_delete'].includes(type);
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

function CheckEligibilitySnapshot({ rows, compact = false }) {
  if (!rows?.length) return null;
  return (
    <div className={`${compact ? 'border-t border-cyan-100' : 'border-t border-emerald-100'} p-3`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase text-slate-500">Check Eligibility</div>
        <span className="rounded-md bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-800">
          {rows.length} value{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((item) => (
          <div key={item.field_key} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="mb-1 text-[10px] font-bold text-slate-500">{item.label}</div>
            <div className="break-words text-xs font-semibold text-slate-900">{item.display_value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ObligationRowDetails({ activity, leadData }) {
  const details = activity.details || {};
  const rowData = Array.isArray(details.row_data) ? details.row_data : [];
  const changedFields = Array.isArray(details.changed_fields) && details.changed_fields.length > 0
    ? details.changed_fields
    : parseLegacyObligationChanges(activity);
  const operation = normalizeDisplayValue(details.operation);
  const operationLabel = operation !== 'Not set' ? titleize(operation) : 'Updated';
  const checkEligibilityRows = getCheckEligibilityRows(leadData);

  if (!rowData.length && !changedFields.length && !checkEligibilityRows.length) return null;

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
	                    {getFrontendFieldLabel(item.field_key, item.label)}
	                  </th>
	                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
	                {rowData.map((item) => (
	                  <td key={item.field_key || item.label} className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-900">
	                    {formatActivityDisplayValue(item.display_value ?? item.value)}
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
	              <div className="mb-2 text-[11px] font-bold text-slate-700">
	                {getFrontendFieldLabel(change.field_key, change.label)}
	              </div>
	              <div className="flex items-center gap-2 text-xs">
	                <span className="min-w-0 flex-1 whitespace-pre-line break-words rounded-md bg-rose-50 px-2 py-1 font-semibold text-rose-800">
	                  {formatActivityDisplayValue(change.old_display ?? change.old_value)}
	                </span>
	                <ArrowRight size={13} className="shrink-0 text-slate-400" />
	                <span className="min-w-0 flex-1 whitespace-pre-line break-words rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
	                  {formatActivityDisplayValue(change.new_display ?? change.new_value)}
	                </span>
	              </div>
	            </div>
	          ))}
	        </div>
	      )}

	      <CheckEligibilitySnapshot rows={checkEligibilityRows} compact />
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
    if (displayValue !== undefined && !isObjectSummaryText(displayValue)) {
      return formatActivityDisplayValue(displayValue);
    }
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
	                  {getFrontendFieldLabel(change.field_key, change.label)}
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
          <div className="whitespace-pre-line break-words text-xs font-semibold text-slate-800">{formatActivityDisplayValue(oldValue)}</div>
        </div>
        <div className="hidden items-center justify-center bg-slate-50 text-slate-400 sm:flex">
          <ArrowRight size={15} />
        </div>
        <div className="min-w-0 p-3 sm:border-l">
          <div className="mb-1 text-[10px] font-bold text-emerald-700">New Value</div>
          <div className="whitespace-pre-line break-words text-xs font-semibold text-slate-800">{formatActivityDisplayValue(newValue)}</div>
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
          <div className="mb-1 text-[10px] font-bold text-slate-500">{normalizeActivityFieldLabel(label)}</div>
          <div className="whitespace-pre-line break-words text-xs font-semibold text-slate-900">{formatActivityDisplayValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function CreatedObligationRows({ rows }) {
  if (!rows.length) return null;
  const columns = getCreatedObligationColumns(rows);
  if (!columns.length) return null;

  return (
    <div className="border-t border-emerald-100 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase text-slate-500">Obligation Rows</div>
        <span className="rounded-md bg-cyan-100 px-2 py-1 text-[10px] font-bold text-cyan-800">
          {rows.length} row{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-[760px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="w-16 px-3 py-2 font-bold text-slate-500">Row</th>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-bold text-slate-500">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.row_number} className="border-b border-slate-100 last:border-b-0">
                <td className="px-3 py-2 font-bold text-slate-700">{row.row_number}</td>
                {columns.map((column) => (
                  <td key={`${row.row_number}-${column.key}`} className="px-3 py-2 font-semibold text-slate-900">
                    <span className="block min-w-0 break-words">
                      {formatCreatedFieldValue(row.values?.[column.key])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreatedLeadSnapshot({ activity, leadData, activeFilter }) {
  const allRows = getCreatedFieldRows(activity, leadData);
  const obligationRows = shouldShowCreatedObligations(activeFilter)
    ? getCreatedObligationRows(activity, leadData, allRows)
    : [];
  const checkEligibilityRows = shouldShowCreatedObligations(activeFilter)
    ? getCheckEligibilityRows(leadData, allRows)
    : [];
  const rows = filterCreatedRowsForTab(
    allRows.filter((item) => !isCreatedObligationField(item.field_key) && !isCreatedCheckEligibilityField(item.field_key)),
    activeFilter
  );
  if (!rows.length && !obligationRows.length && !checkEligibilityRows.length) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-white px-3 py-2">
        <div className="text-xs font-bold text-slate-900">Created Lead Data</div>
	        <span className="rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">
	          {rows.length} field{rows.length === 1 ? '' : 's'}
	          {obligationRows.length ? `, ${obligationRows.length} obligation row${obligationRows.length === 1 ? '' : 's'}` : ''}
	          {checkEligibilityRows.length ? `, ${checkEligibilityRows.length} eligibility value${checkEligibilityRows.length === 1 ? '' : 's'}` : ''}
	        </span>
      </div>
      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((item, index) => (
            <div key={`${item.field_key}-${index}`} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="mb-1 text-[10px] font-bold text-slate-500">{item.label}</div>
              <div className="break-words text-xs font-semibold text-slate-900">{item.display_value}</div>
            </div>
          ))}
        </div>
	      )}
	      <CreatedObligationRows rows={obligationRows} />
	      <CheckEligibilitySnapshot rows={checkEligibilityRows} />
	    </div>
	  );
	}

function ActivityCard({ activity, isLast, leadData, activeFilter }) {
  const config = getConfig(activity);
  const tone = TONE_STYLES[config.tone] || TONE_STYLES.slate;
  const Icon = config.Icon;
  const changeRows = getChangeRows(activity, leadData).filter(
    (row) => normalizeDisplayValue(row.oldValue) !== 'Not set' || normalizeDisplayValue(row.newValue) !== 'Not set'
  );
  const detailLines = getDetailLines(activity, leadData, activeFilter);
  const showObligationRow = isObligationRowActivity(activity);
  const showObligationData = isObligationDataActivity(activity);
  const showCreatedSnapshot = ['create', 'created'].includes(getType(activity));

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
          {showObligationRow && <ObligationRowDetails activity={activity} leadData={leadData} />}
          {showObligationData && <ObligationDataDetails activity={activity} leadData={leadData} />}
          <DetailLines lines={detailLines} />
          {showCreatedSnapshot && <CreatedLeadSnapshot activity={activity} leadData={leadData} activeFilter={activeFilter} />}
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
    } catch {
      setError('Activity history load nahi ho paayi. Dobara try karein.');
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
      if (!matchesFilter(activity, filter, leadData)) return false;
      if (!query) return true;
      return getSearchText(activity).includes(query);
    });
  }, [activities, filter, leadData, searchTerm]);

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
      { label: 'Fields', value: activities.filter((activity) => matchesFilter(activity, 'field_update', leadData)).length, Icon: ClipboardList },
      { label: 'Status', value: activities.filter((activity) => matchesFilter(activity, 'status', leadData)).length, Icon: Activity },
      { label: 'Remarks', value: activities.filter((activity) => matchesFilter(activity, 'note', leadData)).length, Icon: MessageSquareText },
      { label: 'Documents', value: activities.filter((activity) => matchesFilter(activity, 'document', leadData)).length, Icon: FileText },
    ],
    [activities, leadData]
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
            {summaryItems.map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500">{item.label}</span>
                  {React.createElement(item.Icon, { size: 13, className: 'text-slate-400' })}
                </div>
                <div className="mt-1 text-lg font-bold text-slate-950">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(240px,1fr)_auto]">
          <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100">
            <Search size={16} className="shrink-0 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search activity, user, status, field, remark..."
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400"
              />
          </label>

          <div className="flex min-h-10 flex-wrap items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 p-1" role="tablist" aria-label="Lead activity filters">
            {FILTERS.map((item) => {
              const count = item.value === 'all'
                ? activities.length
                : activities.filter((activity) => matchesFilter(activity, item.value, leadData)).length;
              const selected = filter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  role="tab"
                  aria-selected={selected}
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
	                  activeFilter={filter}
	                />
              ))}
            </div>
          ))}
      </div>
    </section>
  );
}
