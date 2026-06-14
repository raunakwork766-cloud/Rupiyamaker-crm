/**
 * FinanceManagement.jsx
 * Employee Finance Management — Reimbursements, Advance Salary, Fine & Deductions
 * Dark theme · HRMS sub-module
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { isSuperAdmin, getUserPermissions, hasPermission } from '../utils/permissions';

// ─── constants ────────────────────────────────────────────────────────────────
const API = '/api';
const REIMBURSEMENT_CATEGORIES = [
  'Travel', 'Food & Meals', 'Medical', 'Accommodation',
  'Office Supplies', 'Communication', 'Training', 'Others'
];
const ADVANCE_REASONS = [
  'Medical Emergency', 'Family Emergency', 'Education Fee',
  'Home Repair', 'Vehicle Purchase', 'Personal Need', 'Others'
];
const DEFAULT_DEDUCTION_TYPES = [
  'Late Arrival Fine', 'Absence Fine', 'Equipment Damage',
  'Loan Repayment', 'Advance Recovery', 'Others'
];
const LS_DEDUCT_TYPES = 'fin_deduction_types';
const loadDeductionTypes = () => {
  try { const v = localStorage.getItem(LS_DEDUCT_TYPES); return v ? JSON.parse(v) : DEFAULT_DEDUCTION_TYPES; } catch { return DEFAULT_DEDUCTION_TYPES; }
};
const saveDeductionTypes = (arr) => localStorage.setItem(LS_DEDUCT_TYPES, JSON.stringify(arr));
const MONTHS_LIST = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: '#78350f' },
  approved: { label: 'Approved', color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: '#064e3b' },
  rejected: { label: 'Rejected', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: '#7f1d1d' },
  paid:     { label: 'Paid',     color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: '#1e3a5f' },
};
const TABS = ['Reimbursements', 'Advance Salary', 'Deductions'];

// ─── helpers ─────────────────────────────────────────────────────────────────
const getUid  = () => localStorage.getItem('userId') || localStorage.getItem('user_id')
  || (() => { try { return JSON.parse(localStorage.getItem('userData') || '{}')._id; } catch { return null; } })();
const tok     = () => localStorage.getItem('token') || '';
const inr     = n  => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = d  => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const mkid    = () => Math.random().toString(36).slice(2, 9);

// ─── LS fallback keys ─────────────────────────────────────────────────────────
const LS = {
  REIMB:  'fin_reimbursements',
  ADV:    'fin_advances',
  DEDUCT: 'fin_deductions',
};
const loadLS  = (k)    => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : []; } catch { return []; } };
const saveLS  = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ─── API helpers ─────────────────────────────────────────────────────────────
const apiFetch = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
};

// ─── Inline styles ─────────────────────────────────────────────────────────
const styles = `
.fin-page { padding: 0; max-width: 100%; background: #060608; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Lexend Deca', sans-serif; color: #e2e8f0; }

/* ── Header ── */
.fin-header { padding: 18px 24px 0; background: #060608; border-bottom: 1px solid #1a1a27; }
.fin-header-top { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding-bottom: 16px; }
.fin-header-left { display: flex; align-items: center; gap: 14px; }
.fin-header-icon { width: 42px; height: 42px; border-radius: 10px; background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(37,99,235,.35); flex-shrink: 0; }
.fin-header-title { font-size: 20px; font-weight: 800; color: #f0f0f8; margin: 0 0 2px; letter-spacing: -0.3px; }
.fin-header-sub { font-size: 12px; color: #c8d0e0; margin: 0; }
.fin-header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

/* ── Buttons ── */
.fin-btn-primary { background: #2563eb; color: #fff; border: none; padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background .15s, box-shadow .15s; white-space: nowrap; }
.fin-btn-primary:hover { background: #1d4ed8; box-shadow: 0 4px 12px rgba(37,99,235,.3); }
.fin-btn-ghost { background: transparent; color: #c8d0e0; border: 1px solid #22222e; padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .15s; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
.fin-btn-ghost:hover { background: #111120; border-color: #2e2e42; color: #c8d0e8; }

/* ── Tabs ── */
.fin-tabs-bar { display: flex; align-items: center; gap: 0; padding: 0 24px; background: #060608; }
.fin-tab { display: inline-flex; align-items: center; gap: 7px; padding: 12px 16px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #c8d0e0; cursor: pointer; border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; white-space: nowrap; position: relative; }
.fin-tab:hover { color: #9aaac8; }
.fin-tab.active { color: #60a5fa; border-bottom-color: #2563eb; }
.fin-tab-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0; transition: opacity .15s; }
.fin-tab.active .fin-tab-dot { opacity: 1; }

/* ── Toolbar ── */
.fin-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 24px; background: #060608; border-bottom: 1px solid #1a1a27; }
.fin-search-wrap { position: relative; }
.fin-search { background: #111120; border: 1px solid #1e1e2e; border-radius: 6px; padding: 6px 12px 6px 34px; color: #c8d0e0; font-size: 13px; width: 260px; outline: none; transition: border-color .15s, box-shadow .15s; }
.fin-search:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
.fin-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #c8d0e0; pointer-events: none; }
.fin-select { padding: 6px 28px 6px 10px; border-radius: 6px; border: 1px solid #1e1e2e; background: #111120; color: #c8d0e0; font-size: 13px; outline: none; cursor: pointer; appearance: none; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%235a6785" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>'); background-repeat: no-repeat; background-position: right 8px center; transition: border-color .15s; }
.fin-select:focus { border-color: #2563eb; }
.fin-toolbar-count { margin-left: auto; font-size: 12px; color: #c8d0e0; font-weight: 600; white-space: nowrap; }

/* ── KPI Cards ── */
.fin-content { padding: 18px 24px 32px; }
.fin-kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
.fin-kpi { padding: 16px; border-radius: 10px; border: 1px solid #161622; background: #0c0c16; position: relative; overflow: hidden; transition: border-color .2s, box-shadow .2s; }
.fin-kpi:hover { border-color: #22223a; box-shadow: 0 4px 20px rgba(0,0,0,.4); }
.fin-kpi-accent { position: absolute; top: 0; left: 0; right: 0; height: 2px; border-radius: 10px 10px 0 0; }
.fin-kpi-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.fin-kpi-icon-wrap { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.fin-kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #c8d0e0; margin: 0 0 5px; }
.fin-kpi-val { font-size: 24px; font-weight: 800; color: #f0f0f8; line-height: 1; margin: 0; letter-spacing: -0.5px; }
.fin-kpi-sub { font-size: 11px; color: #c8d0e0; margin: 4px 0 0; font-weight: 500; }

/* ── Table ── */
.fin-table-wrap { overflow: auto; border: 1px solid #161622; border-radius: 8px; background: #000; }
.fin-table { width: 100%; border-collapse: collapse; min-width: 860px; text-align: left; }
.fin-table thead tr { background: #ffffff; }
.fin-table th { padding: 5px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: #03b0f5; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
.fin-table td { padding: 5px 12px; font-size: 13px; color: #c8d0e0; border-bottom: 1px solid #111120; white-space: nowrap; vertical-align: middle; }
.fin-table tbody tr { background: #000; transition: background .1s; cursor: pointer; }
.fin-table tbody tr:hover td { background: #080810; }
.fin-table tbody tr:last-child td { border-bottom: none; }
.fin-name-strong { font-weight: 700; color: #e2e8f0; }
.fin-amount-green { color: #34d399; font-weight: 700; font-variant-numeric: tabular-nums; }
.fin-amount-yellow { color: #fbbf24; font-weight: 700; font-variant-numeric: tabular-nums; }
.fin-amount-red { color: #f87171; font-weight: 700; font-variant-numeric: tabular-nums; }
.fin-text-muted { color: #c8d0e0; }

/* ── Status Badge ── */
.fin-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; border: 1px solid; white-space: nowrap; letter-spacing: .2px; }
.fin-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

/* ── Action Buttons ── */
.fin-action-btn { padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid; background: transparent; transition: background .12s, transform .1s; display: inline-flex; align-items: center; gap: 4px; }
.fin-action-btn:active { transform: scale(.96); }
.fin-btn-approve { color: #34d399; border-color: rgba(52,211,153,.25); }
.fin-btn-approve:hover { background: rgba(52,211,153,.1); border-color: #064e3b; }
.fin-btn-reject  { color: #f87171; border-color: rgba(248,113,113,.25); }
.fin-btn-reject:hover  { background: rgba(248,113,113,.1); border-color: #7f1d1d; }
.fin-btn-paid    { color: #60a5fa; border-color: rgba(96,165,250,.25); }
.fin-btn-paid:hover    { background: rgba(96,165,250,.1); border-color: #1e3a5f; }
.fin-btn-view    { color: #a78bfa; border-color: rgba(167,139,250,.25); }
.fin-btn-view:hover    { background: rgba(167,139,250,.1); border-color: #3b2b6e; }
.fin-btn-actions { display: flex; gap: 5px; align-items: center; }

/* ── Empty state ── */
.fin-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 20px; color: #c8d0e0; }
.fin-empty svg { margin-bottom: 14px; }
.fin-empty-title { font-size: 15px; font-weight: 700; color: #e2e8f0; margin: 0 0 6px; }
.fin-empty-sub { font-size: 13px; color: #c8d0e0; margin: 0; }

/* ── Modal ── */
.fin-overlay { position: fixed; inset: 0; background: rgba(0,0,5,.75); backdrop-filter: blur(2px); z-index: 9000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.fin-modal { background: #0d0d18; border: 1px solid #1e1e2e; border-radius: 12px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 80px rgba(0,0,0,.7); }
.fin-modal-header { display: flex; align-items: center; gap: 12px; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid #161622; }
.fin-modal-header-left { display: flex; align-items: center; gap: 12px; }
.fin-modal-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.fin-modal-title { font-size: 15px; font-weight: 700; color: #f0f0f8; margin: 0; }
.fin-modal-subtitle { font-size: 11px; color: #c8d0e0; margin: 2px 0 0; }
.fin-modal-body  { padding: 20px 22px; }
.fin-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid #161622; background: #090910; border-radius: 0 0 12px 12px; }
.fin-close-btn { background: none; border: none; color: #c8d0e0; cursor: pointer; padding: 6px; display: flex; align-items: center; border-radius: 6px; transition: background .15s, color .15s; }
.fin-close-btn:hover { background: #1e1e2e; color: #f0f0f8; }

/* ── Form ── */
.fin-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.fin-form-row.single { grid-template-columns: 1fr; }
.fin-form-group { display: flex; flex-direction: column; gap: 5px; }
.fin-form-label { font-size: 11px; font-weight: 700; color: #c8d0e0; text-transform: uppercase; letter-spacing: .5px; }
.fin-form-group input, .fin-form-group select, .fin-form-group textarea { background: #111120; border: 1px solid #1e1e2e; border-radius: 6px; color: #c8d0e8; padding: 8px 12px; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; font-family: inherit; }
.fin-form-group input:focus, .fin-form-group select:focus, .fin-form-group textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
.fin-form-group input::placeholder { color: #2e3a55; }
.fin-form-group textarea { resize: vertical; min-height: 80px; }
.fin-form-divider { height: 1px; background: #161622; margin: 16px 0; }

/* ── Detail modal ── */
.fin-detail-grid { display: grid; grid-template-columns: 130px 1fr; gap: 8px 12px; margin-bottom: 4px; }
.fin-detail-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #c8d0e0; display: flex; align-items: center; padding-top: 1px; }
.fin-detail-val { font-size: 13px; color: #c8d0e8; }
.fin-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #c8d0e0; margin: 14px 0 10px; display: flex; align-items: center; gap: 8px; }
.fin-section-title::after { content: ''; flex: 1; height: 1px; background: #161622; }
.fin-info-box { background: rgba(37,99,235,.07); border: 1px solid rgba(37,99,235,.18); border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #93c5fd; }
.fin-notes-area { background: #111120; border: 1px solid #1e1e2e; border-radius: 6px; color: #c8d0e8; padding: 8px 12px; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; resize: vertical; min-height: 72px; font-family: inherit; transition: border-color .15s; }
.fin-notes-area:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }

/* ── Loading spinner ── */
@keyframes finSpin { to { transform: rotate(360deg); } }
.fin-spinner { width: 28px; height: 28px; border: 2px solid #161622; border-top-color: #2563eb; border-radius: 50%; animation: finSpin .7s linear infinite; margin: 0 auto 12px; }

/* ── Select / Bulk delete ── */
.fin-checkbox { width: 15px; height: 15px; accent-color: #2563eb; cursor: pointer; flex-shrink: 0; }
.fin-table tbody tr.selected td { background: rgba(37,99,235,.08) !important; }
.fin-bulk-bar { display: flex; align-items: center; gap: 10px; padding: 8px 24px; background: rgba(37,99,235,.12); border-bottom: 1px solid rgba(37,99,235,.25); font-size: 13px; color: #93c5fd; font-weight: 600; }
.fin-btn-delete { background: transparent; color: #f87171; border: 1px solid rgba(248,113,113,.35); padding: 5px 14px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: background .12s; }
.fin-btn-delete:hover { background: rgba(248,113,113,.12); border-color: #7f1d1d; }
.fin-btn-delete:disabled { opacity: .5; cursor: not-allowed; }

@media (max-width: 640px) {
  .fin-kpi-row { grid-template-columns: repeat(2, 1fr); }
  .fin-form-row { grid-template-columns: 1fr; }
  .fin-search { width: 180px; }
}
`;

// ─── StatusBadge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className="fin-badge" style={{ color: c.color, background: c.bg, borderColor: c.border }}>
      <span className="fin-badge-dot" />
      {c.label}
    </span>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color, accentColor }) => (
  <div className="fin-kpi">
    <div className="fin-kpi-accent" style={{ background: accentColor || color }} />
    <div className="fin-kpi-top">
      <div className="fin-kpi-icon-wrap" style={{ background: `${color}15` }}>
        <svg width="18" height="18" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
    </div>
    <p className="fin-kpi-label">{label}</p>
    <p className="fin-kpi-val">{value}</p>
    {sub && <p className="fin-kpi-sub">{sub}</p>}
  </div>
);

// ─── Detail side panel / modal ─────────────────────────────────────────────
const DetailModal = ({ open, onClose, record, type, onAction, onDelete, canDelete, isAdmin, loading }) => {
  const [notes, setNotes] = useState('');
  if (!open || !record) return null;
  const isReimb = type === 'reimb';
  const isAdv   = type === 'adv';
  const typeLabel   = isReimb ? 'Reimbursement' : isAdv ? 'Advance Salary' : 'Deduction';
  const iconColor   = isReimb ? '#60a5fa' : isAdv ? '#fbbf24' : '#f87171';
  const iconBg      = isReimb ? 'rgba(96,165,250,.12)' : isAdv ? 'rgba(251,191,36,.12)' : 'rgba(248,113,113,.12)';
  const DetailRow = ({ label, children }) => (
    <div className="fin-detail-grid" style={{ gridTemplateColumns: '120px 1fr', display:'grid', gap:'6px 10px', marginBottom:'8px' }}>
      <span className="fin-detail-label">{label}</span>
      <span className="fin-detail-val">{children}</span>
    </div>
  );
  return (
    <div className="fin-overlay" onClick={onClose}>
      <div className="fin-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="fin-modal-header">
          <div className="fin-modal-header-left">
            <div className="fin-modal-icon" style={{ background: iconBg }}>
              <svg width="18" height="18" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                {isReimb ? <><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></> : isAdv ? <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></> : <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>}
              </svg>
            </div>
            <div>
              <p className="fin-modal-title">{typeLabel} Details</p>
              <p className="fin-modal-subtitle">#{record._id?.slice(-6)?.toUpperCase() || 'N/A'}</p>
            </div>
          </div>
          <button className="fin-close-btn" onClick={onClose}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="fin-modal-body">
          <p className="fin-section-title">Basic Information</p>
          <DetailRow label="Employee">{record.employee_name || '—'}</DetailRow>
          <DetailRow label="Amount"><span style={{ color: isAdv ? '#fbbf24' : isReimb ? '#34d399' : '#f87171', fontWeight: 700 }}>{inr(record.amount)}</span></DetailRow>
          {isReimb && <DetailRow label="Category">{record.category || '—'}</DetailRow>}
          {isAdv   && <DetailRow label="Reason">{record.reason || '—'}</DetailRow>}
          {isAdv   && <DetailRow label="Repayment">{record.repayment_months ? `${record.repayment_months} months · ${inr(record.monthly_deduction)}/mo` : '—'}</DetailRow>}
          {isAdv && record.status === 'approved' && (
            <DetailRow label="Recovery">
              <span style={{ color: '#34d399' }}>Paid: {inr(record.paid_amount || 0)}</span>
              <span style={{ color: '#c8d0e0', margin: '0 6px' }}>·</span>
              <span style={{ color: '#f87171' }}>Due: {inr(record.amount - (record.paid_amount || 0))}</span>
            </DetailRow>
          )}
          {!isReimb && !isAdv && <DetailRow label="Type">{record.deduction_type || '—'}</DetailRow>}
          <DetailRow label="Date">{fmtDate(record.date || record.created_at)}</DetailRow>
          <DetailRow label="Status"><StatusBadge status={record.status} /></DetailRow>
          {record.description && <DetailRow label="Description"><span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{record.description}</span></DetailRow>}
          {record.approved_by && <DetailRow label="Actioned By">{record.approved_by}</DetailRow>}
          {record.actioned_at && <DetailRow label="Actioned On">{fmtDate(record.actioned_at)}</DetailRow>}
          {record.notes && (
            <>
              <p className="fin-section-title">Notes</p>
              <p style={{ color: '#c8d0e0', fontSize: 13, margin: 0, lineHeight: 1.6 }}>{record.notes}</p>
            </>
          )}
          {isAdmin && record.status === 'pending' && (
            <>
              <p className="fin-section-title" style={{ marginTop: 18 }}>Take Action</p>
              <div className="fin-form-group" style={{ marginBottom: 14 }}>
                <label className="fin-form-label">Notes / Reason (optional)</label>
                <textarea className="fin-notes-area" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add a note for this action..." />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="fin-action-btn fin-btn-approve" style={{ padding: '6px 14px', fontSize: 13 }} disabled={loading} onClick={() => onAction('approved', record, notes)}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  Approve
                </button>
                <button className="fin-action-btn fin-btn-reject" style={{ padding: '6px 14px', fontSize: 13 }} disabled={loading} onClick={() => onAction('rejected', record, notes)}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  Reject
                </button>
              </div>
            </>
          )}
          {isAdmin && isReimb && record.status === 'approved' && (
            <div style={{ marginTop: 16 }}>
              <button className="fin-action-btn fin-btn-paid" style={{ padding: '6px 14px', fontSize: 13 }} disabled={loading} onClick={() => onAction('paid', record, notes)}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                Mark as Paid
              </button>
            </div>
          )}
        </div>
        <div className="fin-modal-footer" style={{ justifyContent: 'space-between' }}>
          {canDelete && onDelete
            ? <button className="fin-btn-delete" onClick={() => onDelete(record, type)} disabled={loading} style={{ fontSize: 13, padding: '6px 14px' }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Delete
              </button>
            : <span />}
          <button className="fin-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ─── Create Reimbursement Modal ───────────────────────────────────────────────
const CreateReimbModal = ({ open, onClose, onSubmit, loading, employees, isAdmin, approvers = [] }) => {
  const blank = { employee_id: '', employee_name: '', category: '', amount: '', date: '', description: '' };
  const [form, setForm] = useState(blank);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSubmit = () => {
    if (!form.category || !form.amount || !form.date) return alert('Please fill required fields.');
    onSubmit(form);
    setForm(blank);
  };
  if (!open) return null;
  return (
    <div className="fin-overlay" onClick={onClose}>
      <div className="fin-modal" onClick={e => e.stopPropagation()}>
        <div className="fin-modal-header">
          <div className="fin-modal-header-left">
            <div className="fin-modal-icon" style={{ background: 'rgba(96,165,250,.12)' }}>
              <svg width="18" height="18" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <div>
              <p className="fin-modal-title">New Reimbursement Claim</p>
              <p className="fin-modal-subtitle">Submit an expense for approval</p>
            </div>
          </div>
          <button className="fin-close-btn" onClick={onClose}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>
        <div className="fin-modal-body">
          {/* Approver info banner */}
          {approvers.length > 0 && (
            <div className="fin-info-box" style={{ marginBottom: 14, fontSize: 12 }}>
              <strong>Will be sent to:</strong>{' '}
              {approvers.map(a => a.name).join(', ')}
              {approvers[0]?.is_default && <span style={{ color: '#fbbf24', marginLeft: 6 }}>(default — no specific approver configured for your role)</span>}
            </div>
          )}
          {isAdmin && (
            <div className="fin-form-row single">
              <div className="fin-form-group">
                <label className="fin-form-label">Employee *</label>
                <select value={form.employee_id} onChange={e => { const emp = employees.find(x => x._id === e.target.value); set('employee_id', e.target.value); set('employee_name', emp ? `${emp.first_name} ${emp.last_name}` : ''); }}>
                  <option value="">Select employee...</option>
                  {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.first_name} {emp.last_name}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="fin-form-row">
            <div className="fin-form-group">
              <label className="fin-form-label">Category *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select category...</option>
                {REIMBURSEMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="fin-form-group">
              <label className="fin-form-label">Amount (₹) *</label>
              <input type="number" min="1" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="fin-form-row single">
            <div className="fin-form-group">
              <label className="fin-form-label">Expense Date *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          <div className="fin-form-row single">
            <div className="fin-form-group">
              <label className="fin-form-label">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of the expense..." />
            </div>
          </div>
        </div>
        <div className="fin-modal-footer">
          <button className="fin-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="fin-btn-primary" disabled={loading} onClick={handleSubmit}>
            {loading ? 'Submitting…' : 'Submit Claim'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Create Advance Salary Modal ─────────────────────────────────────────────
const CreateAdvModal = ({ open, onClose, onSubmit, loading, employees, isAdmin, approvers = [] }) => {
  const blank = { employee_id: '', employee_name: '', amount: '', reason: '', repayment_months: '1', description: '' };
  const [form, setForm] = useState(blank);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const monthly = form.amount && form.repayment_months ? Math.ceil(Number(form.amount) / Number(form.repayment_months)) : 0;
  const handleSubmit = () => {
    if (!form.amount || !form.reason || !form.repayment_months) return alert('Please fill required fields.');
    onSubmit({ ...form, monthly_deduction: monthly });
    setForm(blank);
  };
  if (!open) return null;
  return (
    <div className="fin-overlay" onClick={onClose}>
      <div className="fin-modal" onClick={e => e.stopPropagation()}>
        <div className="fin-modal-header">
          <div className="fin-modal-header-left">
            <div className="fin-modal-icon" style={{ background: 'rgba(251,191,36,.12)' }}>
              <svg width="18" height="18" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div>
              <p className="fin-modal-title">Request Advance Salary</p>
              <p className="fin-modal-subtitle">Submit a salary advance request</p>
            </div>
          </div>
          <button className="fin-close-btn" onClick={onClose}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>
        <div className="fin-modal-body">
          {/* Approver info banner */}
          {approvers.length > 0 && (
            <div className="fin-info-box" style={{ marginBottom: 14, fontSize: 12 }}>
              <strong>Will be sent to:</strong>{' '}
              {approvers.map(a => a.name).join(', ')}
              {approvers[0]?.is_default && <span style={{ color: '#fbbf24', marginLeft: 6 }}>(default — no specific approver configured for your role)</span>}
            </div>
          )}
          {isAdmin && (
            <div className="fin-form-row single">
              <div className="fin-form-group">
                <label className="fin-form-label">Employee *</label>
                <select value={form.employee_id} onChange={e => { const emp = employees.find(x => x._id === e.target.value); set('employee_id', e.target.value); set('employee_name', emp ? `${emp.first_name} ${emp.last_name}` : ''); }}>
                  <option value="">Select employee...</option>
                  {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.first_name} {emp.last_name}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="fin-form-row">
            <div className="fin-form-group">
              <label className="fin-form-label">Advance Amount (₹) *</label>
              <input type="number" min="1" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
            </div>
            <div className="fin-form-group">
              <label className="fin-form-label">Repayment Period *</label>
              <select value={form.repayment_months} onChange={e => set('repayment_months', e.target.value)}>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>
          {monthly > 0 && (
            <div className="fin-info-box">
              <strong style={{ color: '#60a5fa' }}>{inr(monthly)}/month</strong> will be deducted from salary for <strong>{form.repayment_months} month{form.repayment_months > 1 ? 's' : ''}</strong>
            </div>
          )}
          <div className="fin-form-row single">
            <div className="fin-form-group">
              <label className="fin-form-label">Reason *</label>
              <select value={form.reason} onChange={e => set('reason', e.target.value)}>
                <option value="">Select reason...</option>
                {ADVANCE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="fin-form-row single">
            <div className="fin-form-group">
              <label className="fin-form-label">Additional Details</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Explain your situation..." />
            </div>
          </div>
        </div>
        <div className="fin-modal-footer">
          <button className="fin-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="fin-btn-primary" disabled={loading} onClick={handleSubmit}>
            {loading ? 'Submitting…' : 'Request Advance'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Create Deduction Modal ───────────────────────────────────────────────────
const CreateDeductModal = ({ open, onClose, onSubmit, loading, employees, approvers = [], deductionTypes = DEFAULT_DEDUCTION_TYPES, selectedMonth, selectedYear }) => {
  const defaultDate = selectedMonth != null && selectedYear != null
    ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
    : '';
  const blank = { employee_id: '', employee_name: '', deduction_type: '', amount: '', date: defaultDate, description: '' };
  const [form, setForm] = useState(blank);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Reset date when month/year prop changes
  React.useEffect(() => {
    if (selectedMonth != null && selectedYear != null) {
      const d = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      setForm(p => ({ ...p, date: d }));
    }
  }, [selectedMonth, selectedYear]);

  const handleSubmit = () => {
    if (!form.employee_id || !form.deduction_type || !form.amount || !form.date) return alert('Please fill all required fields.');
    onSubmit(form);
    setForm({ ...blank, date: defaultDate });
  };
  if (!open) return null;

  // Derive month range for the date input so user stays within selected month
  const monthMin = selectedMonth != null && selectedYear != null
    ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
    : undefined;
  const lastDay = selectedMonth != null && selectedYear != null
    ? new Date(selectedYear, selectedMonth + 1, 0).getDate()
    : undefined;
  const monthMax = lastDay
    ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    : undefined;

  return (
    <div className="fin-overlay" onClick={onClose}>
      <div className="fin-modal" onClick={e => e.stopPropagation()}>
        <div className="fin-modal-header">
          <div className="fin-modal-header-left">
            <div className="fin-modal-icon" style={{ background: 'rgba(248,113,113,.12)' }}>
              <svg width="18" height="18" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <p className="fin-modal-title">Add Deduction</p>
              <p className="fin-modal-subtitle">
                {selectedMonth != null ? `Applies to ${MONTHS_LIST[selectedMonth]} ${selectedYear}` : 'Record a salary deduction or fine'}
              </p>
            </div>
          </div>
          <button className="fin-close-btn" onClick={onClose}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>
        <div className="fin-modal-body">
          {/* Month banner */}
          {selectedMonth != null && (
            <div className="fin-info-box" style={{ marginBottom: 14, fontSize: 12, background: 'rgba(220,38,38,0.08)', borderColor: '#7f1d1d' }}>
              📅 This deduction will apply to <strong style={{ color: '#fca5a5' }}>{MONTHS_LIST[selectedMonth]} {selectedYear}</strong> salary only
            </div>
          )}
          {/* Approver info banner */}
          {approvers.length > 0 && (
            <div className="fin-info-box" style={{ marginBottom: 14, fontSize: 12 }}>
              <strong>Will be reviewed by:</strong>{' '}
              {approvers.map(a => a.name).join(', ')}
              {approvers[0]?.is_default && <span style={{ color: '#fbbf24', marginLeft: 6 }}>(default)</span>}
            </div>
          )}
          <div className="fin-form-row single">
            <div className="fin-form-group">
              <label className="fin-form-label">Employee *</label>
              <select value={form.employee_id} onChange={e => { const emp = employees.find(x => x._id === e.target.value); set('employee_id', e.target.value); set('employee_name', emp ? `${emp.first_name} ${emp.last_name}` : ''); }}>
                <option value="">Select employee...</option>
                {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.first_name} {emp.last_name}</option>)}
              </select>
            </div>
          </div>
          <div className="fin-form-row">
            <div className="fin-form-group">
              <label className="fin-form-label">Deduction Type *</label>
              <select value={form.deduction_type} onChange={e => set('deduction_type', e.target.value)}>
                <option value="">Select type...</option>
                {deductionTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="fin-form-group">
              <label className="fin-form-label">Amount (₹) *</label>
              <input type="number" min="1" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="fin-form-row single">
            <div className="fin-form-group">
              <label className="fin-form-label">Effective Date * {selectedMonth != null && <span style={{ color: '#fca5a5', fontSize: 11 }}>(within {MONTHS_LIST[selectedMonth]} {selectedYear})</span>}</label>
              <input type="date" value={form.date} min={monthMin} max={monthMax} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          <div className="fin-form-row single">
            <div className="fin-form-group">
              <label className="fin-form-label">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Reason for this deduction..." />
            </div>
          </div>
        </div>
        <div className="fin-modal-footer">
          <button className="fin-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="fin-btn-primary" style={{ background: '#dc2626' }} disabled={loading} onClick={handleSubmit}>
            {loading ? 'Saving…' : 'Add Deduction'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// ─── Edit Modal ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════
const EditRecordModal = ({ open, onClose, record, type, onSave, loading, employees, deductionTypes = DEFAULT_DEDUCTION_TYPES }) => {
  const [form, setForm] = useState({});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  React.useEffect(() => {
    if (record) setForm({
      employee_id:    record.employee_id || '',
      employee_name:  record.employee_name || '',
      amount:         record.amount || '',
      date:           record.date ? record.date.slice(0, 10) : (record.created_at ? record.created_at.slice(0, 10) : ''),
      description:    record.description || '',
      // type-specific
      category:       record.category || '',
      reason:         record.reason || '',
      repayment_months: record.repayment_months || '',
      deduction_type: record.deduction_type || '',
    });
  }, [record]);

  if (!open || !record) return null;
  const isReimb = type === 'reimb';
  const isAdv   = type === 'adv';
  const isDeduct = type === 'deduct';

  const handleSubmit = () => {
    if (!form.amount || !form.date) return alert('Amount and date are required.');
    const patch = {
      amount:      Number(form.amount),
      date:        form.date,
      description: form.description,
      ...(isReimb  ? { category: form.category } : {}),
      ...(isAdv    ? { reason: form.reason, repayment_months: Number(form.repayment_months) || undefined } : {}),
      ...(isDeduct ? { deduction_type: form.deduction_type, employee_id: form.employee_id, employee_name: form.employee_name } : {}),
    };
    onSave(patch);
  };

  const title = isReimb ? 'Edit Reimbursement' : isAdv ? 'Edit Advance Request' : 'Edit Deduction';
  const iconColor = isReimb ? '#60a5fa' : isAdv ? '#fbbf24' : '#f87171';

  return (
    <div className="fin-overlay" onClick={onClose}>
      <div className="fin-modal" onClick={e => e.stopPropagation()}>
        <div className="fin-modal-header">
          <div className="fin-modal-header-left">
            <div className="fin-modal-icon" style={{ background: `${iconColor}18` }}>
              <svg width="18" height="18" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div>
              <p className="fin-modal-title">{title}</p>
              <p className="fin-modal-subtitle">#{record._id?.slice(-6)?.toUpperCase()}</p>
            </div>
          </div>
          <button className="fin-close-btn" onClick={onClose}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="fin-modal-body">
          {/* Employee (deduction only — non-admin sees own) */}
          {isDeduct && employees.length > 0 && (
            <div className="fin-form-row single">
              <div className="fin-form-group">
                <label className="fin-form-label">Employee *</label>
                <select value={form.employee_id} onChange={e => { const emp = employees.find(x => x._id === e.target.value); set('employee_id', e.target.value); set('employee_name', emp ? `${emp.first_name} ${emp.last_name}` : ''); }}>
                  <option value="">Select employee...</option>
                  {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.first_name} {emp.last_name}</option>)}
                </select>
              </div>
            </div>
          )}
          {/* Type-specific top field */}
          {isReimb && (
            <div className="fin-form-row single">
              <div className="fin-form-group">
                <label className="fin-form-label">Category</label>
                <select value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Select category...</option>
                  {REIMBURSEMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}
          {isAdv && (
            <div className="fin-form-row">
              <div className="fin-form-group">
                <label className="fin-form-label">Reason</label>
                <select value={form.reason} onChange={e => set('reason', e.target.value)}>
                  <option value="">Select reason...</option>
                  {ADVANCE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="fin-form-group">
                <label className="fin-form-label">Repayment Months</label>
                <input type="number" min="1" max="24" value={form.repayment_months} onChange={e => set('repayment_months', e.target.value)} placeholder="e.g. 3" />
              </div>
            </div>
          )}
          {isDeduct && (
            <div className="fin-form-row single">
              <div className="fin-form-group">
                <label className="fin-form-label">Deduction Type *</label>
                <select value={form.deduction_type} onChange={e => set('deduction_type', e.target.value)}>
                  <option value="">Select type...</option>
                  {deductionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}
          {/* Common fields */}
          <div className="fin-form-row">
            <div className="fin-form-group">
              <label className="fin-form-label">Amount (₹) *</label>
              <input type="number" min="1" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
            </div>
            <div className="fin-form-group">
              <label className="fin-form-label">Date *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          <div className="fin-form-row single">
            <div className="fin-form-group">
              <label className="fin-form-label">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Notes about this record..." />
            </div>
          </div>
        </div>
        <div className="fin-modal-footer">
          <button className="fin-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="fin-btn-primary" disabled={loading} onClick={handleSubmit}
            style={{ background: isDeduct ? '#dc2626' : isAdv ? '#d97706' : '#2563eb' }}>
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// ─── Main Component ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════
export default function FinanceManagement() {
  const perms     = getUserPermissions();
  const isAdmin   = isSuperAdmin(perms) ||
                    hasPermission(perms, 'employees', 'show') ||
                    hasPermission(perms, 'hr_finance', 'manage');

  // canDelete: anyone who can see the finance page can select & delete records.
  // This is intentionally broader than isAdmin (which gates approval/rejection actions).
  const canDelete = isAdmin || isSuperAdmin(perms) ||
                    hasPermission(perms, 'finance', 'show') ||
                    hasPermission(perms, 'finance', 'manage') ||
                    hasPermission(perms, 'hrms', 'show') ||
                    hasPermission(perms, 'hrms', 'manage') ||
                    perms.length > 0; // any authenticated user with any role can delete their visible records

  const [activeTab, setActiveTab]   = useState('Reimbursements');
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);

  // ── Finance Settings ──────────────────────────────────────────────
  const now = new Date();
  const [showSettings,     setShowSettings]     = useState(false);
  const [filterMonth,      setFilterMonth]      = useState(now.getMonth());      // 0-indexed
  const [filterYear,       setFilterYear]       = useState(now.getFullYear());
  const [deductionTypes,   setDeductionTypes]   = useState(loadDeductionTypes);
  const [newTypeInput,     setNewTypeInput]     = useState('');

  const addDeductionType = () => {
    const t = newTypeInput.trim();
    if (!t || deductionTypes.includes(t)) return;
    const updated = [...deductionTypes, t];
    setDeductionTypes(updated);
    saveDeductionTypes(updated);
    setNewTypeInput('');
  };
  const removeDeductionType = (t) => {
    if (DEFAULT_DEDUCTION_TYPES.includes(t)) return; // can't remove built-ins
    const updated = deductionTypes.filter(x => x !== t);
    setDeductionTypes(updated);
    saveDeductionTypes(updated);
  };

  // Finance approvers per type (fetched from settings)
  const [financeApprovers, setFinanceApprovers] = useState({
    reimbursement: [],
    advance_salary: [],
    deduction: [],
  });

  // Data
  const [reimbs,  setReimbs]  = useState([]);
  const [advs,    setAdvs]    = useState([]);
  const [deducts, setDeducts] = useState([]);
  const [employees, setEmps]  = useState([]);

  // Modals
  const [showCreateReimb,  setShowCreateReimb]  = useState(false);
  const [showCreateAdv,    setShowCreateAdv]    = useState(false);
  const [showCreateDeduct, setShowCreateDeduct] = useState(false);
  const [detailRecord,     setDetailRecord]     = useState(null);
  const [detailType,       setDetailType]       = useState('reimb');
  const [confirmAction,    setConfirmAction]    = useState(null); // {record, newStatus}

  // ── Selection state for bulk delete ──────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting,    setDeleting]    = useState(false);

  // ── fetch employees ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch(`/users?user_id=${getUid()}&include_all=false`);
        setEmps(Array.isArray(data) ? data : []);
      } catch { setEmps([]); }
    })();
  }, []);

  // ── fetch finance approvers for current user's role ───────────────
  useEffect(() => {
    const uid = getUid();
    if (!uid) return;
    const fetchApprovers = async (type) => {
      try {
        const res = await apiFetch(`/settings/finance-approvers-for-me?user_id=${uid}&finance_type=${type}`);
        return res.data || [];
      } catch { return []; }
    };
    (async () => {
      const [reimb, adv, ded] = await Promise.all([
        fetchApprovers('reimbursement'),
        fetchApprovers('advance_salary'),
        fetchApprovers('deduction'),
      ]);
      setFinanceApprovers({ reimbursement: reimb, advance_salary: adv, deduction: ded });
    })();
  }, []);

  // ── fetch / seed data from API or localStorage ───────────────────
  const fetchReimbs = useCallback(async () => {
    try {
      const data = await apiFetch(`/hrms/reimbursements?user_id=${getUid()}`);
      const list = Array.isArray(data) ? data : (data.items || []);
      setReimbs(list);
      saveLS(LS.REIMB, list);
    } catch {
      setReimbs(loadLS(LS.REIMB));
    }
  }, []);

  const fetchAdvs = useCallback(async () => {
    try {
      const data = await apiFetch(`/hrms/advance-salary?user_id=${getUid()}`);
      const list = Array.isArray(data) ? data : (data.items || []);
      setAdvs(list);
      saveLS(LS.ADV, list);
    } catch {
      setAdvs(loadLS(LS.ADV));
    }
  }, []);

  const fetchDeducts = useCallback(async () => {
    try {
      const data = await apiFetch(`/hrms/deductions?user_id=${getUid()}`);
      const list = Array.isArray(data) ? data : (data.items || []);
      setDeducts(list);
      saveLS(LS.DEDUCT, list);
    } catch {
      setDeducts(loadLS(LS.DEDUCT));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchReimbs(), fetchAdvs(), fetchDeducts()]).finally(() => setLoading(false));
  }, [fetchReimbs, fetchAdvs, fetchDeducts]);

  // ── filtered lists ───────────────────────────────────────────────
  const uid = getUid();
  const filterData = (list, kind) => list.filter(r => {
    if (!isAdmin && r.employee_id && r.employee_id !== uid) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    // Month filter: applies to Deductions tab
    if (kind === 'deductions') {
      const d = new Date(r.date || r.created_at || '');
      if (!isNaN(d.getTime())) {
        if (d.getFullYear() !== filterYear || d.getMonth() !== filterMonth) return false;
      }
    }
    const q = search.toLowerCase();
    if (!q) return true;
    return (r.employee_name || '').toLowerCase().includes(q) ||
           (r.category || r.reason || r.deduction_type || '').toLowerCase().includes(q) ||
           (r.description || '').toLowerCase().includes(q);
  });

  const filteredReimbs  = useMemo(() => filterData(reimbs, 'reimbursements'),  [reimbs,  search, statusFilter, isAdmin, uid, filterMonth, filterYear]);
  const filteredAdvs    = useMemo(() => filterData(advs, 'advance-salary'),    [advs,    search, statusFilter, isAdmin, uid, filterMonth, filterYear]);
  const filteredDeducts = useMemo(() => filterData(deducts, 'deductions'), [deducts, search, statusFilter, isAdmin, uid, filterMonth, filterYear]);

  // ── KPI counts ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const src = activeTab === 'Reimbursements' ? reimbs : activeTab === 'Advance Salary' ? advs : deducts;
    const mine = isAdmin ? src : src.filter(r => !r.employee_id || r.employee_id === uid);
    return {
      total:    mine.length,
      pending:  mine.filter(r => r.status === 'pending').length,
      approved: mine.filter(r => r.status === 'approved').length,
      rejected: mine.filter(r => r.status === 'rejected').length,
      paid:     mine.filter(r => r.status === 'paid').length,
      totalAmt: mine.reduce((s, r) => s + Number(r.amount || 0), 0),
      pendAmt:  mine.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0),
      appAmt:   mine.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.amount || 0), 0),
    };
  }, [activeTab, reimbs, advs, deducts, isAdmin, uid]);

  // ── create handlers ──────────────────────────────────────────────
  const handleCreateReimb = async (form) => {
    setSaving(true);
    const approvers = financeApprovers.reimbursement || [];
    const rec = {
      _id: mkid(), employee_id: form.employee_id || uid,
      employee_name: form.employee_name || 'Me',
      category: form.category, amount: Number(form.amount),
      date: form.date, description: form.description,
      status: 'pending', created_at: new Date().toISOString(),
      approver_ids: approvers.map(a => a.id),
      approver_names: approvers.map(a => a.name),
    };
    try {
      await apiFetch(`/hrms/reimbursements?user_id=${getUid()}`, { method: 'POST', body: JSON.stringify(rec) });
      await fetchReimbs();
    } catch {
      const updated = [...reimbs, rec];
      setReimbs(updated);
      saveLS(LS.REIMB, updated);
    }
    setSaving(false);
    setShowCreateReimb(false);
  };

  const handleCreateAdv = async (form) => {
    setSaving(true);
    const approvers = financeApprovers.advance_salary || [];
    const rec = {
      _id: mkid(), employee_id: form.employee_id || uid,
      employee_name: form.employee_name || 'Me',
      amount: Number(form.amount), reason: form.reason,
      repayment_months: Number(form.repayment_months),
      monthly_deduction: form.monthly_deduction,
      paid_amount: 0, description: form.description,
      status: 'pending', created_at: new Date().toISOString(),
      approver_ids: approvers.map(a => a.id),
      approver_names: approvers.map(a => a.name),
    };
    try {
      await apiFetch(`/hrms/advance-salary?user_id=${getUid()}`, { method: 'POST', body: JSON.stringify(rec) });
      await fetchAdvs();
    } catch {
      const updated = [...advs, rec];
      setAdvs(updated);
      saveLS(LS.ADV, updated);
    }
    setSaving(false);
    setShowCreateAdv(false);
  };

  const handleCreateDeduct = async (form) => {
    setSaving(true);
    const approvers = financeApprovers.deduction || [];
    // Derive month/year from the actual date entered by user (not from filter month)
    // This ensures deduction is applied to the correct salary month
    let dedMonth = selectedMonth;  // 0-indexed fallback
    let dedYear  = selectedYear;
    if (form.date) {
      const d = new Date(form.date);
      if (!isNaN(d.getTime())) {
        dedMonth = d.getMonth();   // 0-indexed (Jan=0)
        dedYear  = d.getFullYear();
      }
    }
    const rec = {
      _id: mkid(), employee_id: form.employee_id,
      employee_name: form.employee_name,
      deduction_type: form.deduction_type,
      amount: Number(form.amount), date: form.date,
      // Store month/year derived from actual date so salary page filters correctly
      month: dedMonth,  // 0-indexed (Jan=0)
      year:  dedYear,
      description: form.description,
      status: 'approved', created_at: new Date().toISOString(),
      approver_ids: approvers.map(a => a.id),
      approver_names: approvers.map(a => a.name),
    };
    try {
      await apiFetch(`/hrms/deductions?user_id=${getUid()}`, { method: 'POST', body: JSON.stringify(rec) });
      await fetchDeducts();
    } catch {
      const updated = [...deducts, rec];
      setDeducts(updated);
      saveLS(LS.DEDUCT, updated);
    }
    setSaving(false);
    setShowCreateDeduct(false);
  };

  // ── action handler (approve/reject/paid) ─────────────────────────
  const handleAction = async (newStatus, record, notes) => {
    setSaving(true);
    const patch = { status: newStatus, notes, approved_by: 'Admin', actioned_at: new Date().toISOString() };
    const isR = detailType === 'reimb';
    const isA = detailType === 'adv';
    const endMap = { reimb: 'reimbursements', adv: 'advance-salary', deduct: 'deductions' };
    try {
      await apiFetch(`/hrms/${endMap[detailType]}/${record._id}?user_id=${getUid()}`, {
        method: 'PATCH', body: JSON.stringify(patch)
      });
      if (isR) await fetchReimbs();
      else if (isA) await fetchAdvs();
      else await fetchDeducts();
    } catch {
      const updater = (list, setter, key) => {
        const updated = list.map(r => r._id === record._id ? { ...r, ...patch } : r);
        setter(updated); saveLS(key, updated);
      };
      if (isR) updater(reimbs, setReimbs, LS.REIMB);
      else if (isA) updater(advs, setAdvs, LS.ADV);
      else updater(deducts, setDeducts, LS.DEDUCT);
    }
    setSaving(false);
    setDetailRecord(null);
  };

  // ── edit handler ─────────────────────────────────────────────────
  const [editRecord, setEditRecord] = useState(null); // record being edited
  const [editType,   setEditType]   = useState('deduct');

  const handleEditSave = async (updatedFields) => {
    setSaving(true);
    const endMap = { reimb: 'reimbursements', adv: 'advance-salary', deduct: 'deductions' };
    const kind = endMap[editType];
    try {
      await apiFetch(`/hrms/${kind}/${editRecord._id}?user_id=${getUid()}`, {
        method: 'PATCH', body: JSON.stringify(updatedFields)
      });
      if (editType === 'reimb') await fetchReimbs();
      else if (editType === 'adv') await fetchAdvs();
      else await fetchDeducts();
    } catch {
      // Optimistic update fallback
      const updater = (list, setter, key) => {
        const updated = list.map(r => r._id === editRecord._id ? { ...r, ...updatedFields } : r);
        setter(updated); saveLS(key, updated);
      };
      if (editType === 'reimb') updater(reimbs, setReimbs, LS.REIMB);
      else if (editType === 'adv') updater(advs, setAdvs, LS.ADV);
      else updater(deducts, setDeducts, LS.DEDUCT);
    }
    setSaving(false);
    setEditRecord(null);
  };

  // ── selection helpers ────────────────────────────────────────────
  const currentList = activeTab === 'Reimbursements' ? filteredReimbs
    : activeTab === 'Advance Salary' ? filteredAdvs : filteredDeducts;
  const currentKind = activeTab === 'Reimbursements' ? 'reimbursements'
    : activeTab === 'Advance Salary' ? 'advance-salary' : 'deductions';

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === currentList.length && currentList.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentList.map(r => r._id)));
    }
  };

  // Clear selection on tab change
  const handleTabChange = (key) => {
    setActiveTab(key);
    setSearch('');
    setStatus('all');
    setSelectedIds(new Set());
  };

  // ── bulk delete ──────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected record${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/hrms/bulk-delete?user_id=${getUid()}`, {
        method: 'POST',
        body: JSON.stringify({ kind: currentKind, ids: [...selectedIds] }),
      });
    } catch { /* best-effort — still refresh */ }
    setSelectedIds(new Set());
    // Refresh the active tab
    if (activeTab === 'Reimbursements') await fetchReimbs();
    else if (activeTab === 'Advance Salary') await fetchAdvs();
    else await fetchDeducts();
    setDeleting(false);
  };

  // ── single delete (from detail modal) ────────────────────────────
  const handleSingleDelete = async (record, type) => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    const endMap = { reimb: 'reimbursements', adv: 'advance-salary', deduct: 'deductions' };
    setDeleting(true);
    try {
      await apiFetch(`/hrms/${endMap[type]}/${record._id}?user_id=${getUid()}`, { method: 'DELETE' });
    } catch { /* best-effort */ }
    setDetailRecord(null);
    if (type === 'reimb') await fetchReimbs();
    else if (type === 'adv') await fetchAdvs();
    else await fetchDeducts();
    setDeleting(false);
  };

  // ── row click to open detail ─────────────────────────────────────
  const openDetail = (record, type) => { setDetailRecord(record); setDetailType(type); };

  // ── table renderers ──────────────────────────────────────────────
  const EmptyRow = ({ colSpan, icon, title, sub }) => (
    <tr><td colSpan={colSpan}>
      <div className="fin-empty">
        <svg width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">{icon}</svg>
        <p className="fin-empty-title">{title}</p>
        <p className="fin-empty-sub">{sub}</p>
      </div>
    </td></tr>
  );

  const ReimbTable = () => (
    <div className="fin-table-wrap">
      <table className="fin-table">
        <thead>
          <tr>
            {canDelete && <th style={{ width: 36, padding: '5px 8px' }}>
              <input type="checkbox" className="fin-checkbox"
                checked={filteredReimbs.length > 0 && filteredReimbs.every(r => selectedIds.has(r._id))}
                onChange={toggleSelectAll} title="Select all" />
            </th>}
            {isAdmin && <th>Employee</th>}
            <th>Category</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Description</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredReimbs.length === 0
            ? <EmptyRow colSpan={isAdmin ? 8 : 6}
                icon={<><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>}
                title="No reimbursement claims" sub="Submit a new claim to get started" />
            : filteredReimbs.map(r => (
            <tr key={r._id} className={selectedIds.has(r._id) ? 'selected' : ''} onClick={() => openDetail(r, 'reimb')}>
              {canDelete && <td style={{ padding: '5px 8px', width: 36 }} onClick={e => toggleSelect(r._id, e)}>
                <input type="checkbox" className="fin-checkbox" checked={selectedIds.has(r._id)} onChange={() => {}} />
              </td>}
              {isAdmin && <td className="fin-name-strong">{r.employee_name}</td>}
              <td>{r.category}</td>
              <td className="fin-amount-green">{inr(r.amount)}</td>
              <td className="fin-text-muted">{fmtDate(r.date)}</td>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description || <span className="fin-text-muted">—</span>}</td>
              <td><StatusBadge status={r.status} /></td>
              <td onClick={e => e.stopPropagation()}>
                <div className="fin-btn-actions">
                  <button className="fin-action-btn fin-btn-view" onClick={() => openDetail(r, 'reimb')}>View</button>
                  {isAdmin && (
                    <button className="fin-action-btn" style={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,.25)' }}
                      onClick={() => { setEditRecord(r); setEditType('reimb'); }}>
                      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                  )}
                  {isAdmin && r.status === 'pending' && (<>
                    <button className="fin-action-btn fin-btn-approve" onClick={() => handleAction('approved', r, '')}>Approve</button>
                    <button className="fin-action-btn fin-btn-reject"  onClick={() => handleAction('rejected', r, '')}>Reject</button>
                  </>)}
                  {isAdmin && r.status === 'approved' && (
                    <button className="fin-action-btn fin-btn-paid" onClick={() => handleAction('paid', r, '')}>Mark Paid</button>
                  )}
                  {canDelete && (
                    <button className="fin-action-btn fin-btn-delete" style={{ color: '#f87171', borderColor: 'rgba(248,113,113,.25)' }}
                      onClick={() => handleSingleDelete(r, 'reimb')} disabled={deleting}>
                      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const AdvTable = () => (
    <div className="fin-table-wrap">
      <table className="fin-table">
        <thead>
          <tr>
            {canDelete && <th style={{ width: 36, padding: '5px 8px' }}>
              <input type="checkbox" className="fin-checkbox"
                checked={filteredAdvs.length > 0 && filteredAdvs.every(r => selectedIds.has(r._id))}
                onChange={toggleSelectAll} title="Select all" />
            </th>}
            {isAdmin && <th>Employee</th>}
            <th>Amount</th>
            <th>Reason</th>
            <th>Repayment</th>
            <th>Remaining</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredAdvs.length === 0
            ? <EmptyRow colSpan={isAdmin ? 8 : 6}
                icon={<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>}
                title="No advance requests" sub="Request a salary advance to get started" />
            : filteredAdvs.map(r => (
            <tr key={r._id} className={selectedIds.has(r._id) ? 'selected' : ''} onClick={() => openDetail(r, 'adv')}>
              {canDelete && <td style={{ padding: '5px 8px', width: 36 }} onClick={e => toggleSelect(r._id, e)}>
                <input type="checkbox" className="fin-checkbox" checked={selectedIds.has(r._id)} onChange={() => {}} />
              </td>}
              {isAdmin && <td className="fin-name-strong">{r.employee_name}</td>}
              <td className="fin-amount-yellow">{inr(r.amount)}</td>
              <td>{r.reason}</td>
              <td className="fin-text-muted">{r.repayment_months ? `${r.repayment_months} mo · ${inr(r.monthly_deduction)}/mo` : '—'}</td>
              <td style={{ color: r.status === 'approved' ? '#f87171' : undefined }}>
                {r.status === 'approved' ? inr(r.amount - (r.paid_amount || 0)) : <span className="fin-text-muted">—</span>}
              </td>
              <td><StatusBadge status={r.status} /></td>
              <td onClick={e => e.stopPropagation()}>
                <div className="fin-btn-actions">
                  <button className="fin-action-btn fin-btn-view" onClick={() => openDetail(r, 'adv')}>View</button>
                  {isAdmin && (
                    <button className="fin-action-btn" style={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,.25)' }}
                      onClick={() => { setEditRecord(r); setEditType('adv'); }}>
                      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                  )}
                  {isAdmin && r.status === 'pending' && (<>
                    <button className="fin-action-btn fin-btn-approve" onClick={() => handleAction('approved', r, '')}>Approve</button>
                    <button className="fin-action-btn fin-btn-reject"  onClick={() => handleAction('rejected', r, '')}>Reject</button>
                  </>)}
                  {canDelete && (
                    <button className="fin-action-btn fin-btn-delete" style={{ color: '#f87171', borderColor: 'rgba(248,113,113,.25)' }}
                      onClick={() => handleSingleDelete(r, 'adv')} disabled={deleting}>
                      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const DeductTable = () => (
    <div className="fin-table-wrap">
      <table className="fin-table">
        <thead>
          <tr>
            {canDelete && <th style={{ width: 36, padding: '5px 8px' }}>
              <input type="checkbox" className="fin-checkbox"
                checked={filteredDeducts.length > 0 && filteredDeducts.every(r => selectedIds.has(r._id))}
                onChange={toggleSelectAll} title="Select all" />
            </th>}
            <th>Employee</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredDeducts.length === 0
            ? <EmptyRow colSpan={isAdmin ? 7 : 6}
                icon={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                title="No deductions recorded" sub="Add a deduction to track salary adjustments" />
            : filteredDeducts.map(r => (
            <tr key={r._id} className={selectedIds.has(r._id) ? 'selected' : ''} onClick={() => openDetail(r, 'deduct')}>
              {canDelete && <td style={{ padding: '5px 8px', width: 36 }} onClick={e => toggleSelect(r._id, e)}>
                <input type="checkbox" className="fin-checkbox" checked={selectedIds.has(r._id)} onChange={() => {}} />
              </td>}
              <td className="fin-name-strong">{r.employee_name}</td>
              <td>{r.deduction_type}</td>
              <td className="fin-amount-red">{inr(r.amount)}</td>
              <td className="fin-text-muted">{fmtDate(r.date)}</td>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description || <span className="fin-text-muted">—</span>}</td>
              <td onClick={e => e.stopPropagation()}>
                <div className="fin-btn-actions">
                  <button className="fin-action-btn fin-btn-view" onClick={() => openDetail(r, 'deduct')}>View</button>
                  {isAdmin && (
                    <button className="fin-action-btn" style={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,.25)' }}
                      onClick={() => { setEditRecord(r); setEditType('deduct'); }}>
                      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button className="fin-action-btn fin-btn-delete" style={{ color: '#f87171', borderColor: 'rgba(248,113,113,.25)' }}
                      onClick={() => handleSingleDelete(r, 'deduct')} disabled={deleting}>
                      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── KPI config per tab ───────────────────────────────────────────
  const kpiConfig = activeTab === 'Reimbursements' ? [
    { icon: <><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>, label: 'Total Claims',  value: kpis.total,    sub: `Total: ${inr(kpis.totalAmt)}`,            color: '#60a5fa', accentColor: '#2563eb' },
    { icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,                    label: 'Pending',      value: kpis.pending,  sub: inr(kpis.pendAmt),                         color: '#fbbf24', accentColor: '#d97706' },
    { icon: <><polyline points="20 6 9 17 4 12"/></>,                                                       label: 'Approved',     value: kpis.approved, sub: inr(kpis.appAmt),                          color: '#34d399', accentColor: '#059669' },
    { icon: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>, label: 'Paid Out', value: kpis.paid, sub: 'Reimbursed',                              color: '#a78bfa', accentColor: '#7c3aed' },
  ] : activeTab === 'Advance Salary' ? [
    { icon: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,                                  label: 'Total Requests', value: kpis.total,  sub: `Total: ${inr(kpis.totalAmt)}`,            color: '#fbbf24', accentColor: '#d97706' },
    { icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,                    label: 'Pending',      value: kpis.pending,  sub: inr(kpis.pendAmt),                         color: '#fb923c', accentColor: '#ea580c' },
    { icon: <><polyline points="20 6 9 17 4 12"/></>,                                                       label: 'Approved',     value: kpis.approved, sub: inr(kpis.appAmt),                          color: '#34d399', accentColor: '#059669' },
    { icon: <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>, label: 'Rejected', value: kpis.rejected, sub: 'Declined',               color: '#f87171', accentColor: '#dc2626' },
  ] : [
    { icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>, label: 'Total Deductions', value: kpis.total, sub: 'All time',      color: '#f87171', accentColor: '#dc2626' },
    { icon: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>, label: 'Total Amount', value: inr(kpis.totalAmt), sub: 'Deducted',                  color: '#fb923c', accentColor: '#ea580c' },
    { icon: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>, label: 'Affected Employees', value: new Set((isAdmin ? deducts : deducts.filter(d => d.employee_id === uid)).map(d => d.employee_id)).size, sub: 'Unique employees', color: '#a78bfa', accentColor: '#7c3aed' },
    { icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>, label: 'This Month', value: (isAdmin ? deducts : deducts.filter(d => d.employee_id === uid)).filter(d => { const now = new Date(); const da = new Date(d.date || d.created_at || ''); return da.getFullYear() === now.getFullYear() && da.getMonth() === now.getMonth(); }).length, sub: 'Current month', color: '#60a5fa', accentColor: '#2563eb' },
  ];

  // ── Status filter options ─────────────────────────────────────────
  const statusOpts = activeTab === 'Reimbursements'
    ? ['all', 'pending', 'approved', 'rejected', 'paid']
    : activeTab === 'Advance Salary'
    ? ['all', 'pending', 'approved', 'rejected']
    : ['all'];

  const currentCount = activeTab === 'Reimbursements' ? filteredReimbs.length
    : activeTab === 'Advance Salary' ? filteredAdvs.length : filteredDeducts.length;

  return (
    <div className="fin-page">
      <style>{styles}</style>

      {/* Header */}
      <div className="fin-header">
        <div className="fin-header-top">
          <div className="fin-header-left">
            <div className="fin-header-icon">
              <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <div>
              <p className="fin-header-title">Employee Finance</p>
              <p className="fin-header-sub">Reimbursements · Advance Salary · Deductions</p>
            </div>
          </div>
          <div className="fin-header-actions">
            {activeTab === 'Reimbursements' && (
              <button className="fin-btn-primary" onClick={() => setShowCreateReimb(true)}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Claim
              </button>
            )}
            {activeTab === 'Advance Salary' && (
              <button className="fin-btn-primary" onClick={() => setShowCreateAdv(true)}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Request Advance
              </button>
            )}
            {activeTab === 'Deductions' && isAdmin && (
              <button className="fin-btn-primary" style={{ background: '#dc2626' }} onClick={() => setShowCreateDeduct(true)}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Deduction
              </button>
            )}
            <button className="fin-btn-ghost" onClick={() => { fetchReimbs(); fetchAdvs(); fetchDeducts(); }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Refresh
            </button>
            {isAdmin && (
              <button
                className="fin-btn-ghost"
                onClick={() => setShowSettings(s => !s)}
                style={{ borderColor: showSettings ? '#3b82f6' : undefined, color: showSettings ? '#60a5fa' : undefined }}
                title="Finance Settings"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                </svg>
                Settings
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="fin-tabs-bar">
          {[
            { key: 'Reimbursements', icon: <><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>, label: 'Reimbursements' },
            { key: 'Advance Salary', icon: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>, label: 'Advance Salary' },
            { key: 'Deductions',     icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>, label: 'Deductions' },
          ].map(t => (
            <button key={t.key} className={`fin-tab${activeTab === t.key ? ' active' : ''}`}
              onClick={() => handleTabChange(t.key)}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">{t.icon}</svg>
              {t.label}
              <span className="fin-tab-dot" />
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="fin-toolbar">
        <div className="fin-search-wrap">
          <svg className="fin-search-icon" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input className="fin-search" placeholder="Search employee, category..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {statusOpts.length > 1 && (
          <select className="fin-select" value={statusFilter} onChange={e => setStatus(e.target.value)}>
            {statusOpts.map(s => <option key={s} value={s}>{s === 'all' ? 'All Status' : STATUS_CONFIG[s]?.label || s}</option>)}
          </select>
        )}
        {/* Month / Year quick selectors — visible on Deductions tab */}
        {activeTab === 'Deductions' && (
          <>
            <div style={{ width: '1px', background: '#1e1e2e', height: '20px', margin: '0 4px' }} />
            <svg width="13" height="13" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="fin-select" style={{ minWidth: '120px' }}>
              {MONTHS_LIST.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="fin-select" style={{ minWidth: '80px' }}>
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </>
        )}
        <span className="fin-toolbar-count">{currentCount} record{currentCount !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Settings Panel ────────────────────────────────────────────── */}
      {showSettings && isAdmin && (
        <div style={{ margin: '0 24px 0', background: '#0c0c16', border: '1px solid #1e1e2e', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" fill="none" stroke="#60a5fa" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>Finance Settings</span>
            </div>
            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Month / Year selector */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>
              📅 Active Month (Deductions filter &amp; default date)
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(Number(e.target.value))}
                className="fin-select"
                style={{ minWidth: '130px' }}
              >
                {MONTHS_LIST.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select
                value={filterYear}
                onChange={e => setFilterYear(Number(e.target.value))}
                className="fin-select"
                style={{ minWidth: '90px' }}
              >
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Deductions will be filtered &amp; created for this month
              </span>
              <button
                className="fin-btn-ghost"
                style={{ padding: '5px 12px', fontSize: '12px' }}
                onClick={() => { setFilterMonth(now.getMonth()); setFilterYear(now.getFullYear()); }}
              >
                Reset to Today
              </button>
            </div>
          </div>

          {/* Deduction Types Manager */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>
              🏷️ Deduction Types
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {deductionTypes.map(t => (
                <div key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#111120', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: '#c8d0e0' }}>
                  {t}
                  {!DEFAULT_DEDUCTION_TYPES.includes(t) && (
                    <button
                      onClick={() => removeDeductionType(t)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '0', display: 'flex', alignItems: 'center', fontSize: '11px' }}
                      title="Remove type"
                    >
                      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                  {DEFAULT_DEDUCTION_TYPES.includes(t) && (
                    <span style={{ fontSize: '9px', color: '#4b5563', fontWeight: 600 }}>built-in</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                value={newTypeInput}
                onChange={e => setNewTypeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDeductionType()}
                placeholder="Add new type (e.g. Uniform Charge)..."
                style={{ background: '#111120', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '6px 12px', color: '#c8d0e0', fontSize: '13px', outline: 'none', flex: 1, maxWidth: '300px' }}
              />
              <button className="fin-btn-primary" style={{ background: '#dc2626', padding: '6px 14px', fontSize: '12px' }} onClick={addDeductionType}>
                + Add Type
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active month banner — shows when not current month, on Deductions tab */}
      {activeTab === 'Deductions' && (filterMonth !== now.getMonth() || filterYear !== now.getFullYear()) && (
        <div style={{ margin: '8px 24px 0', background: 'rgba(220,38,38,0.08)', border: '1px solid #7f1d1d', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Showing deductions for <strong style={{ marginLeft: 4 }}>{MONTHS_LIST[filterMonth]} {filterYear}</strong>
          <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: '11px', textDecoration: 'underline', marginLeft: 4 }}>Change month</button>
        </div>
      )}

      {/* Bulk delete bar — visible when items are selected */}
      {canDelete && selectedIds.size > 0 && (
        <div className="fin-bulk-bar">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          {selectedIds.size} selected
          <button className="fin-btn-delete" onClick={handleBulkDelete} disabled={deleting}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            {deleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
          </button>
          <button className="fin-btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Content */}
      <div className="fin-content">
        {loading ? (
          <div className="fin-empty" style={{ padding: '80px 20px' }}>
            <div className="fin-spinner" />
            <p className="fin-empty-title">Loading data…</p>
          </div>
        ) : (
          <>
            {activeTab === 'Reimbursements' && <ReimbTable />}
            {activeTab === 'Advance Salary'  && <AdvTable />}
            {activeTab === 'Deductions'       && <DeductTable />}
          </>
        )}
      </div>

      <CreateReimbModal  open={showCreateReimb}  onClose={() => setShowCreateReimb(false)}  onSubmit={handleCreateReimb}  loading={saving} employees={employees} isAdmin={isAdmin} approvers={financeApprovers.reimbursement} />
      <CreateAdvModal    open={showCreateAdv}    onClose={() => setShowCreateAdv(false)}    onSubmit={handleCreateAdv}    loading={saving} employees={employees} isAdmin={isAdmin} approvers={financeApprovers.advance_salary} />
      <CreateDeductModal open={showCreateDeduct} onClose={() => setShowCreateDeduct(false)} onSubmit={handleCreateDeduct} loading={saving} employees={employees} approvers={financeApprovers.deduction} deductionTypes={deductionTypes} selectedMonth={filterMonth} selectedYear={filterYear} />
      <DetailModal
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        record={detailRecord}
        type={detailType}
        onAction={handleAction}
        onDelete={handleSingleDelete}
        canDelete={canDelete}
        isAdmin={isAdmin}
        loading={saving || deleting}
      />
      <EditRecordModal
        open={!!editRecord}
        onClose={() => setEditRecord(null)}
        record={editRecord}
        type={editType}
        onSave={handleEditSave}
        loading={saving}
        employees={employees}
        deductionTypes={deductionTypes}
      />
    </div>
  );
}
