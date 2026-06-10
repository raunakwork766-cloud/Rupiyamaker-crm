import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Add as Plus,
  Visibility as Eye,
  CheckCircle,
  Cancel as XCircle,
  Refresh as RefreshCw,
  CloudUpload,
  Download,
  AttachFile,
  Search,
  FilterList as Filter,
  Close as X,
  CalendarToday as Calendar,
  Person as User,
  People as Users,
  AccessTime as Clock,
  Description as FileText,
  Warning as AlertTriangle,
  Settings as SettingsIcon
} from '@mui/icons-material';

import { getISTDateYMD } from '../utils/dateUtils';
import useTabWithHistory from '../hooks/useTabWithHistory';
import useNavbarPageSearch from '../hooks/useNavbarPageSearch';

// Import simplified permission system
import { 
  getPermissionLevel, 
  canViewAll, 
  canViewJunior, 
  canCreate, 
  canEdit, 
  canDelete,
  getPermissionDisplayText,
  getCurrentUserId,
  hasPermission,
  getUserPermissions,
  isSuperAdmin as isSuperAdminCheck
} from '../utils/permissions';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

// Status card configuration — HubSpot dark KPI style
const statusCardConfig = [
  { key: 'pending', label: 'Pending', icon: Clock, kpiClass: 'leave-kpi pending' },
  { key: 'approved', label: 'Approved', icon: CheckCircle, kpiClass: 'leave-kpi approved' },
  { key: 'rejected', label: 'Rejected', icon: XCircle, kpiClass: 'leave-kpi rejected' },
];

const leavePageStyles = `
  .leaves-page { padding: 0; max-width: 100%; background: #000; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Lexend Deca', sans-serif; color: #e2e8f0; }
  .leaves-page .task-top-bar { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 0; border-bottom: 1px solid #1f1f27; background: #000; gap: 16px; flex-wrap: wrap; }
  .leaves-page .task-top-bar-left h1 { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0 0 2px; line-height: 1.2; }
  .leaves-page .task-top-bar-left p { font-size: 13px; color: #6b7a99; margin: 0 0 12px; }
  .leaves-page .task-top-bar-right { display: flex; gap: 8px; align-items: center; padding-top: 4px; flex-wrap: wrap; }
  .leaves-page .task-btn-secondary { background: #1a1a24; color: #c8d0e0; border: 1px solid #2a2a3a; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s, border-color 0.15s; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
  .leaves-page .task-btn-secondary:hover { background: #22222e; border-color: #3a3a50; }
  .leaves-page .task-btn-create { background: #3b82f6; color: #fff; border: none; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s; white-space: nowrap; }
  .leaves-page .task-btn-create:hover { background: #2563eb; }
  .leaves-page .task-btn-settings { background: #1a1a24; color: #f97316; border: 1px solid #78350f; }
  .leaves-page .task-btn-settings:hover { background: #2a1a00; border-color: #92400e; }
  .leaves-page .task-view-toggle-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 24px; background: #000; border-bottom: 1px solid #1f1f27; flex-wrap: wrap; }
  .leaves-page .task-view-toggle-group { display: flex; gap: 0; flex-wrap: wrap; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .leaves-page .task-view-toggle-group::-webkit-scrollbar { display: none; }
  .leaves-page .task-view-toggle-btn { padding: 12px 16px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #6b7a99; cursor: pointer; border-bottom: 3px solid transparent; transition: color 0.15s, border-color 0.15s; white-space: nowrap; }
  .leaves-page .task-view-toggle-btn:hover { color: #c8d0e0; }
  .leaves-page .task-view-toggle-btn.active { color: #f97316; font-weight: 800; border-bottom-color: #f97316; }
  .leaves-page .task-toolbar-right { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-left: auto; flex-shrink: 0; flex-wrap: wrap; }
  .leaves-page .task-search-box--in-bar { position: relative; width: 260px; min-width: 200px; flex-shrink: 0; }
  .leaves-page .task-search-box--in-bar input { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; padding: 6px 32px 6px 32px; color: #c8d0e0; font-size: 13px; width: 100%; outline: none; box-sizing: border-box; }
  .leaves-page .task-search-box--in-bar input::placeholder { color: #4a5570; }
  .leaves-page .task-search-box--in-bar input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .leaves-page .task-search-box--in-bar .search-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: #4a5570; pointer-events: none; display: flex; }
  .leaves-page .task-search-box--in-bar .search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: #4a5570; background: none; border: none; cursor: pointer; padding: 2px; display: flex; align-items: center; }
  .leaves-page .task-filter-dropdown { padding: 6px 28px 6px 10px; border-radius: 3px; border: 1px solid #2a2a3a; background-color: #1a1a24; color: #c8d0e0; font-size: 13px; font-weight: 500; appearance: none; min-height: 32px; cursor: pointer; outline: none; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%236b7a99" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>'); background-repeat: no-repeat; background-position: right 8px center; }
  .leaves-page .task-filter-dropdown:focus { border-color: #3b82f6; }
  .leaves-page .task-select-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .leaves-page .task-select-controls label { display: flex; align-items: center; cursor: pointer; color: #c8d0e0; font-size: 13px; gap: 5px; }
  .leaves-page .task-select-controls span { color: #6b7a99; font-size: 13px; }
  .leaves-page .task-select-btn-del { padding: 5px 12px; background: #1a0a0a; color: #f87171; border: 1px solid #7f1d1d; border-radius: 3px; font-size: 13px; cursor: pointer; }
  .leaves-page .task-select-btn-del:hover { background: #2a0f0f; }
  .leaves-page .task-select-btn-cancel { padding: 5px 12px; background: #1a1a24; color: #6b7a99; border: 1px solid #2a2a3a; border-radius: 3px; font-size: 13px; cursor: pointer; }
  .leaves-page .task-select-btn-cancel:hover { background: #22222e; }
  .leaves-page .leave-page-content { padding: 16px 24px 24px; }
  .leaves-page .leave-kpi-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
  .leaves-page .leave-kpi { display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: 4px; border: 1px solid #1f1f27; background: #000; }
  .leaves-page .leave-kpi.pending { border-color: #78350f; }
  .leaves-page .leave-kpi.approved { border-color: #064e3b; }
  .leaves-page .leave-kpi.rejected { border-color: #7f1d1d; }
  .leaves-page .leave-kpi-icon { width: 36px; height: 36px; border-radius: 4px; background: #1a1a24; border: 1px solid #2a2a3a; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .leaves-page .leave-kpi.pending .leave-kpi-icon { color: #fbbf24; }
  .leaves-page .leave-kpi.approved .leave-kpi-icon { color: #34d399; }
  .leaves-page .leave-kpi.rejected .leave-kpi-icon { color: #f87171; }
  .leaves-page .leave-kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7a99; margin: 0 0 2px; }
  .leaves-page .leave-kpi-val { font-size: 22px; font-weight: 800; color: #f0f0f5; line-height: 1; margin: 0; }
  .leaves-page .leave-filter-meta { font-size: 12px; color: #6b7a99; padding: 6px 10px; border: 1px solid #2a2a3a; border-radius: 3px; background: #1a1a24; white-space: nowrap; }
  .leaves-page .leave-table-wrap { overflow: auto; max-height: calc(100vh - 340px); border: 1px solid #1f1f27; border-radius: 4px; background: #000; }
  .leaves-page .leave-table { width: 100%; border-collapse: collapse; min-width: 900px; text-align: left; }
  .leaves-page .leave-table thead { background: #ffffff; position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); border-bottom: 2px solid #e5e7eb; }
  .leaves-page .leave-table-th { color: #03b0f5; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; padding: 5px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; white-space: nowrap; background: #ffffff; }
  .leaves-page .leave-table tbody tr.leave-row { background: #000; border-bottom: 1px solid #2a2a38; cursor: pointer; transition: background 0.1s; }
  .leaves-page .leave-table tbody tr.leave-row:hover { background: #13131c; }
  .leaves-page .leave-table tbody td { padding: 5px 12px; font-size: 13px; color: #ffffff; font-weight: 600; vertical-align: middle; white-space: nowrap; }
  .leaves-page .leave-table tbody td.leave-name-cell { font-weight: 700; color: #ffffff; }
  .leaves-page .leave-cell-avatar { width: 28px; height: 28px; border-radius: 50%; background: #1a1a24; border: 1px solid #2a2a3a; color: #93c5fd; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; }
  .leaves-page .leave-cell-name-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .leaves-page .leave-cell-sub { font-size: 11px; color: #6b7a99; margin-top: 2px; }
  .leaves-page .leave-type-badge, .leaves-page .leave-status-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 2px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  .leaves-page .leave-type-badge.paid { background: #0a1a2a; color: #60a5fa; border: 1px solid #1e3a5f; }
  .leaves-page .leave-type-badge.casual { background: #1a1030; color: #c4b5fd; border: 1px solid #4c1d95; }
  .leaves-page .leave-type-badge.sick { background: #1a0a0a; color: #f87171; border: 1px solid #7f1d1d; }
  .leaves-page .leave-type-badge.emergency { background: #2a1a00; color: #fbbf24; border: 1px solid #78350f; }
  .leaves-page .leave-type-badge.default { background: #1a1a24; color: #6b7a99; border: 1px solid #2a2a3a; }
  .leaves-page .leave-status-badge.approved { background: #0a2a22; color: #34d399; border: 1px solid #064e3b; }
  .leaves-page .leave-status-badge.rejected { background: #1a0a0a; color: #f87171; border: 1px solid #7f1d1d; }
  .leaves-page .leave-status-badge.pending { background: #2a1a00; color: #fbbf24; border: 1px solid #78350f; }
  .leaves-page .leave-status-badge.default { background: #1a1a24; color: #6b7a99; border: 1px solid #2a2a3a; }
  .leaves-page .task-loading-spinner { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; min-height: 50vh; }
  .leaves-page .task-loading-spinner .spinner { width: 32px; height: 32px; border: 3px solid #1a1a24; border-top-color: #3b82f6; border-radius: 50%; animation: leaveSpin 0.7s linear infinite; margin-bottom: 12px; }
  .leaves-page .task-loading-spinner p { color: #6b7a99; font-size: 14px; margin: 0; }
  .leaves-page .task-empty-state { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; text-align: center; }
  .leaves-page .task-empty-state-title { font-size: 17px; font-weight: 700; color: #c8d0e0; margin: 0 0 6px; }
  .leaves-page .task-empty-state-sub { font-size: 14px; color: #4a5570; margin: 0; }
  .leaves-page .leave-snackbar { position: fixed; top: 16px; right: 16px; z-index: 10050; padding: 10px 14px; border-radius: 4px; font-size: 13px; color: #fff; border: 1px solid; display: flex; align-items: center; gap: 10px; }
  .leaves-page .leave-snackbar.success { background: #0a2a22; border-color: #064e3b; color: #34d399; }
  .leaves-page .leave-snackbar.error { background: #1a0a0a; border-color: #7f1d1d; color: #f87171; }
  .leaves-page .leave-snackbar.warning { background: #2a1a00; border-color: #78350f; color: #fbbf24; }
  .leaves-page .leave-snackbar.info { background: #1e3a5f; border-color: #3b82f6; color: #93c5fd; }
  .leave-modal-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); padding: 16px; }
  .leave-modal-panel { background: #000; border: 1px solid #1f1f27; border-radius: 4px; box-shadow: 0 20px 60px rgba(0,0,0,0.7); max-height: 92vh; overflow-y: auto; animation: leaveModalUp 0.2s ease-out; color: #c8d0e0; }
  .leave-modal-panel input, .leave-modal-panel select, .leave-modal-panel textarea { background: #1a1a24 !important; color: #c8d0e0 !important; border: 1px solid #2a2a3a !important; border-radius: 3px !important; }
  .leave-modal-panel input:focus, .leave-modal-panel select:focus, .leave-modal-panel textarea:focus { border-color: #3b82f6 !important; outline: none !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15) !important; }
  .leave-modal-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid #1f1f27; background: #000; }
  .leave-modal-header h2 { margin: 0; font-size: 16px; font-weight: 700; color: #f0f0f5; }
  .leave-modal-header p { margin: 2px 0 0; font-size: 12px; color: #6b7a99; }
  .leave-modal-close { background: #1a1a24; border: 1px solid #2a2a3a; color: #c8d0e0; width: 32px; height: 32px; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .leave-modal-close:hover { background: #22222e; }
  .leave-modal-body { padding: 16px 20px; }
  .leave-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid #1f1f27; background: #000; }
  .leave-modal-btn-secondary { background: #1a1a24; color: #c8d0e0; border: 1px solid #2a2a3a; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .leave-modal-btn-secondary:hover { background: #22222e; }
  .leave-modal-btn-primary { background: #3b82f6; color: #fff; border: none; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .leave-modal-btn-primary:hover { background: #2563eb; }
  .leave-modal-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
  .leave-modal-btn-success { background: #059669; color: #fff; border: none; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .leave-modal-btn-success:hover { background: #047857; }
  .leave-modal-btn-danger { background: #1a0a0a; color: #f87171; border: 1px solid #7f1d1d; padding: 8px 14px; border-radius: 3px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .leave-modal-btn-danger:hover { background: #2a0f0f; }
  .leave-modal-btn-success.full, .leave-modal-btn-danger.full, .leave-modal-btn-secondary.full { flex: 1; padding: 8px 14px; }
  .leave-detail-modal { width: 100%; max-width: 560px; }
  .leave-detail-body { padding: 16px 20px; }
  .leave-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .leave-detail-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .leave-detail-field.full { grid-column: 1 / -1; }
  .leave-detail-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7a99; }
  .leave-detail-value { border: 1px solid #2a2a3a; border-radius: 3px; padding: 9px 12px; font-size: 13px; font-weight: 500; color: #c8d0e0; min-height: 38px; background: #1a1a24; display: flex; align-items: center; }
  .leave-detail-value.block { align-items: flex-start; white-space: pre-wrap; min-height: 64px; line-height: 1.5; }
  .leave-detail-value.success { color: #34d399; font-weight: 600; }
  .leave-detail-value.danger { color: #f87171; font-weight: 600; }
  .leave-detail-value.muted { color: #6b7a99; }
  .leave-detail-chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 2px; font-size: 11px; font-weight: 600; background: #1a1030; color: #c4b5fd; border: 1px solid #4c1d95; }
  .leave-detail-banner { border-radius: 3px; padding: 10px 12px; font-size: 12px; font-weight: 600; border: 1px solid; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  .leave-detail-banner.success { background: #0a2a22; color: #34d399; border-color: #064e3b; }
  .leave-detail-banner.warning { background: #2a1a00; color: #fbbf24; border-color: #78350f; }
  .leave-detail-banner.danger { background: #1a0a0a; color: #f87171; border-color: #7f1d1d; }
  .leave-detail-banner-btn { background: #059669; color: #fff; border: none; border-radius: 3px; padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer; }
  .leave-detail-banner-btn:hover { background: #047857; }
  .leave-detail-divider { border: none; border-top: 1px solid #1f1f27; margin: 14px 0; }
  .leave-detail-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7a99; margin: 0 0 8px; }
  .leave-detail-table-wrap { border: 1px solid #1f1f27; border-radius: 4px; overflow: hidden; margin-bottom: 12px; }
  .leave-detail-table { width: 100%; border-collapse: collapse; }
  .leave-detail-table th { background: #ffffff; color: #03b0f5; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 5px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
  .leave-detail-table th.center { text-align: center; }
  .leave-detail-table td { padding: 5px 10px; border-bottom: 1px solid #2a2a38; font-size: 13px; color: #ffffff; font-weight: 600; vertical-align: middle; background: #000; white-space: nowrap; }
  .leave-detail-table td.center { text-align: center; }
  .leave-detail-table tr:last-child td { border-bottom: none; }
  .leave-detail-table tr.highlight td { background: #13131c; }
  .leave-detail-you-pill { margin-left: 6px; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 2px; background: #1e3a5f; color: #93c5fd; border: 1px solid #3b82f6; }
  .leave-detail-row-actions { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
  .leave-detail-mini-btn { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 3px; cursor: pointer; border: 1px solid; }
  .leave-detail-mini-btn.approve { background: #0a2a22; color: #34d399; border-color: #064e3b; }
  .leave-detail-mini-btn.approve:hover { background: #064e3b; }
  .leave-detail-mini-btn.reject { background: #1a0a0a; color: #f87171; border-color: #7f1d1d; }
  .leave-detail-mini-btn.reject:hover { background: #2a0f0f; }
  .leave-detail-status-bar { text-align: center; font-size: 13px; font-weight: 700; padding: 10px 12px; border-radius: 3px; border: 1px solid; margin-bottom: 4px; }
  .leave-detail-status-bar.approved { background: #0a2a22; color: #34d399; border-color: #064e3b; }
  .leave-detail-status-bar.rejected { background: #1a0a0a; color: #f87171; border-color: #7f1d1d; }
  .leave-detail-status-bar.pending { background: #2a1a00; color: #fbbf24; border-color: #78350f; }
  .leave-detail-footer-actions { display: flex; gap: 8px; width: 100%; }
  .leave-approval-summary { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 4px; padding: 12px; font-size: 13px; color: #c8d0e0; }
  .leave-approval-summary div { margin-bottom: 4px; }
  .leave-approval-summary div:last-child { margin-bottom: 0; }
  .leave-approval-summary span { color: #6b7a99; }
  .leave-approval-field { margin-bottom: 12px; }
  .leave-approval-field label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7a99; margin-bottom: 6px; }
  .leave-approval-field textarea { width: 100%; box-sizing: border-box; padding: 9px 12px; min-height: 72px; resize: vertical; }
  .leave-settings-modal { width: 100%; max-width: 960px; height: 85vh; display: flex; flex-direction: column; overflow: hidden; }
  .leave-settings-sidebar { width: 260px; border-right: 1px solid #1f1f27; background: #000; display: flex; flex-direction: column; flex-shrink: 0; }
  .leave-settings-main { flex: 1; background: #000; display: flex; flex-direction: column; overflow: hidden; }
  @keyframes leaveSpin { to { transform: rotate(360deg); } }
  @keyframes leaveModalUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes leavePopIn { from { transform: scale(0); } to { transform: scale(1); } }
  .leave-settings-sidebar input, .leave-settings-main input, .leave-settings-sidebar button, .leave-settings-main button { font-family: inherit; }
  .leave-settings-sidebar input, .leave-settings-main input { background: #1a1a24 !important; color: #c8d0e0 !important; border: 1px solid #2a2a3a !important; border-radius: 3px !important; }
  .leave-settings-sidebar input:focus, .leave-settings-main input:focus { border-color: #3b82f6 !important; outline: none !important; }
  .leave-modal-panel label { color: #6b7a99; }
  .leave-modal-panel .text-gray-700, .leave-modal-panel .text-gray-800, .leave-modal-panel .text-gray-900 { color: #c8d0e0 !important; }
  .leave-modal-panel .bg-white { background: #000 !important; }
  .leave-modal-panel .bg-gray-50, .leave-modal-panel .bg-gray-100 { background: #111118 !important; }
  .leave-modal-panel .border-gray-200, .leave-modal-panel .border-gray-300 { border-color: #2a2a3a !important; }
  .leave-modal-panel .text-gray-500, .leave-modal-panel .text-gray-600 { color: #6b7a99 !important; }
  @media (max-width: 768px) { .leaves-page .leave-kpi-row { grid-template-columns: 1fr; } }
`;

const LeaveTypeChip = ({ leavetype, label }) => {
  const typeClass = {
    paid_leave: 'paid',
    casual_leave: 'casual',
    sick_leave: 'sick',
    emergency_leave: 'emergency',
  }[leavetype] || 'default';

  return <span className={`leave-type-badge ${typeClass}`}>{label}</span>;
};

const StatusChip = ({ status, label }) => {
  const statusClass = {
    approved: 'approved',
    rejected: 'rejected',
    pending: 'pending',
  }[status] || 'default';

  return <span className={`leave-status-badge ${statusClass}`}>{label}</span>;
};

const LeavesPage = () => {
  // Add early return with minimal UI to test if component loads
  const [isReady, setIsReady] = useState(false);
    
    // State management
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedTab, setSelectedTab] = useTabWithHistory('tab', 0, { localStorageKey: 'leavesPageTab', isNumeric: true });
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openViewDialog, setOpenViewDialog] = useState(false);
    const [selectedLeave, setSelectedLeave] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  
  // Form state
  const [newLeave, setNewLeave] = useState({
    leave_type: 'paid_leave',
    from_date: '',
    to_date: '',
    reason: '',
    attachments: []
  });
  const [attachmentFile, setAttachmentFile] = useState(null);
  
  // Enhanced leave modal state
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [calcResult, setCalcResult] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSubmitData, setLastSubmitData] = useState(null);

  // Leave approval settings state
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [allRoles, setAllRoles] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [approvalRoutes, setApprovalRoutes] = useState([]);
  const [settingsSelectedRole, setSettingsSelectedRole] = useState(null);
  const [settingsSelectedApprovers, setSettingsSelectedApprovers] = useState([]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsRoleSearch, setSettingsRoleSearch] = useState('');
  const [settingsEmpSearch, setSettingsEmpSearch] = useState('');

  // Approvers for apply modal (fetched based on current user's role)
  const [myApprovers, setMyApprovers] = useState([]);
  const [selectedApproverIds, setSelectedApproverIds] = useState(new Set());
  const [isDefaultApprovers, setIsDefaultApprovers] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    status: '',
    leave_type: '',
    search: ''
  });
  useNavbarPageSearch(useCallback((query) => {
    setFilters((prev) => ({ ...prev, search: query }));
  }, []));
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Select button and bulk delete functionality
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false);

  // Simplified permission checking using new 3-type system
  const permissionLevel = getPermissionLevel('leaves');
  
  // Get current user ID
  const getCurrentUserIdFromStorage = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { user_id } = JSON.parse(userData);
      return user_id;
    }
    return '6852b84716a499bb6868e6a4'; // Default fallback user ID
  };
  
  const currentUserId = getCurrentUserIdFromStorage();
  
  // Permission check functions with proper super admin handling
  const canUserViewAll = () => {
    // Check if user is super admin first
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.is_super_admin) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return canViewAll('leaves');
  };
  
  const canUserViewJunior = () => {
    // Check if user is super admin first
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.is_super_admin) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return canViewJunior('leaves');
  };
  
  const canUserCreate = () => {
    // Check if user is super admin first
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.is_super_admin) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return canCreate('leaves');
  };
  
  const canUserEdit = (recordOwnerId) => {
    // Check if user is super admin first
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.is_super_admin) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return canEdit('leaves', recordOwnerId);
  };
  
  const canUserDelete = (recordOwnerId) => {
    // Check if user is super admin first
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.is_super_admin) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return canDelete('leaves', recordOwnerId);
  };
  
  // Check if current user is super admin
  const isSuperAdmin = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.is_super_admin === true;
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return false;
  };

  // Permission state - updated to use simplified system
  const [permissions, setPermissions] = useState({
    leaves_show: true,
    leaves_own: true,
    leave_admin: canUserViewAll(),
    leaves_create: canUserCreate(),
    leaves_delete: canDelete('leaves'), // Use proper permission function for leaves delete
    leaves_select: hasPermission(getUserPermissions(), 'leaves', 'select') || canDelete('leaves'), // select action
    leave_setting: isSuperAdminCheck(getUserPermissions()) || canUserViewAll() || hasPermission(getUserPermissions(), 'leaves', 'leave_setting'), // settings button
    can_view_all: canUserViewAll(),
    can_approve_reject: isSuperAdmin() || canUserViewJunior() || canUserViewAll(), // Super admin, junior and all can approve/reject
    is_super_admin: isSuperAdmin(),
    permission_level: permissionLevel // Store the permission level
  });

  // Approval dialog state
  const [openApprovalDialog, setOpenApprovalDialog] = useState(false);
  const [approvalLeave, setApprovalLeave] = useState(null);
  const [approvalData, setApprovalData] = useState({
    status: 'approved',
    rejection_reason: '',
    comments: ''
  });

  // Upload dialog state
  const [uploadLeaveId, setUploadLeaveId] = useState(null);
  const [uploadAttachmentFile, setUploadAttachmentFile] = useState(null);
  const [openUploadDialog, setOpenUploadDialog] = useState(false);

  // API base URL
  const API_BASE_URL = '/api'; // Always use proxy

  // Get current user ID
  const getCurrentUserId = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { user_id } = JSON.parse(userData);
      return user_id;
    }
    return '6852b84716a499bb6868e6a4'; // Default fallback user ID
  };

  // Get auth headers
  const getAuthHeaders = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { access_token } = JSON.parse(userData);
      return {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      };
    }
    return { 'Content-Type': 'application/json' };
  };

  const getAuthHeadersForFiles = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { access_token } = JSON.parse(userData);
      return {
        'Authorization': `Bearer ${access_token}`,
      };
    }
    return {};
  };

  // Check user permissions using hierarchical permission system
  const checkUserPermissions = () => {
    const permLevel = getPermissionLevel('leaves');
    const isSuperAdminUser = isSuperAdmin();
    
    // Hierarchical permission logic:
    // 1. page: "*" and actions: "*" = superadmin (can do everything)
    // 2. page: "leaves" and actions: "own" = own leaves only
    // 3. page: "leaves" and actions: "junior" = all leaves + can approve/reject below him (not own)
    // 4. page: "leaves" and actions: "all" = can view all leaves + approve all leaves + view own leaves
    
    let canApproveReject = false;
    let canViewAllLeaves = false;
    let canViewJuniorLeaves = false;
    
    if (isSuperAdminUser) {
      // Super admin can do everything
      canApproveReject = true;
      canViewAllLeaves = true;
      canViewJuniorLeaves = true;
    } else {
      // Regular users based on permission level
      canViewAllLeaves = canUserViewAll();
      canViewJuniorLeaves = canUserViewJunior();
      
      // Junior and All permission levels can approve/reject
      // But junior users cannot approve/reject their own leaves
      canApproveReject = canViewJuniorLeaves || canViewAllLeaves;
    }
    
    const updatedPermissions = {
      leaves_show: true, // Everyone can view their own records
      leaves_own: true,
      leave_admin: canViewAllLeaves,
      leaves_create: canUserCreate(),
      leaves_delete: canDelete('leaves'), // Use proper permission function for leaves delete
      leaves_select: hasPermission(getUserPermissions(), 'leaves', 'select') || canDelete('leaves'),
      leave_setting: isSuperAdminUser || hasPermission(getUserPermissions(), 'leaves', 'leave_setting'),
      can_view_all: canViewAllLeaves,
      can_approve_reject: canApproveReject,
      is_super_admin: isSuperAdminUser,
      permission_level: permLevel // Store the permission level for use elsewhere
    };
    
    console.log('LeavesPage - Updated permissions:', updatedPermissions);
    setPermissions(updatedPermissions);
    
    return updatedPermissions;
  };

  // Legacy compatibility function
  const hasAdminPermission = () => canUserViewAll();

  // Fetch leaves
  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const userId = getCurrentUserId();
      
      if (!userId) {
        console.warn('No user ID found, using default');
        showSnackbar('User ID not found. Please login again.', 'error');
        return;
      }
      
      // Check user permissions
      const canViewAll = canUserViewAll();
      const canViewJunior = canUserViewJunior();
      const isSuperAdminUser = isSuperAdmin();
      
      const queryParams = new URLSearchParams();
      
      // Always send user_id for authentication, but backend will use permissions to filter
      queryParams.append('user_id', userId);
      
      // Send permission level to help backend understand what data to return
      if (isSuperAdminUser) {
        queryParams.append('permission_level', 'superadmin');
      } else if (canViewAll) {
        queryParams.append('permission_level', 'all');
      } else if (canViewJunior) {
        queryParams.append('permission_level', 'junior');
      } else {
        queryParams.append('permission_level', 'own');
      }
      
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.leave_type) queryParams.append('leave_type', filters.leave_type);
      if (filters.search) queryParams.append('search', filters.search);

      const response = await fetch(`${API_BASE_URL}/leaves/?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setLeaves(Array.isArray(data.leaves) ? data.leaves : []);
      } else {
        console.error('API Response not OK:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error details:', errorData);
        
        if (response.status === 401) {
          showSnackbar('Authentication failed. Please login again.', 'error');
        } else if (response.status === 422) {
          showSnackbar('Invalid request parameters. Please refresh the page.', 'error');
        } else {
          throw new Error(`Failed to fetch leaves: ${response.status} - ${errorData.detail || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
      showSnackbar('Failed to fetch leaves. Please check your connection.', 'error');
      setLeaves([]); // Set empty array to prevent undefined errors
    } finally {
      setLoading(false);
    }
  };

  // Delete leave function
  const deleteLeave = async (leaveId) => {
    try {
      const userId = getCurrentUserId();
      
      if (!userId) {
        showSnackbar('User not authenticated', 'error');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/leaves/${leaveId}?user_id=${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          throw new Error(errorData.detail || 'You don\'t have permission to delete this leave');
        }
        if (response.status === 400) {
          throw new Error(errorData.detail || 'You can only delete pending leave applications');
        }
        throw new Error(`Failed to delete leave: ${response.status} - ${errorData.detail || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting leave:', error);
      throw error;
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    try {
      await deleteLeave(leaveId);
      showSnackbar('Leave deleted successfully', 'success');
      fetchLeaves(); // Refresh the list
      fetchStats(); // Refresh stats
    } catch (error) {
      showSnackbar(error.message || 'Failed to delete leave', 'error');
    }
  };

  // Select button and bulk delete functionality
  const handleShowCheckboxes = () => {
    setShowCheckboxes(true);
    setSelectedRows([]);
    setSelectAll(false);
  };

  const handleRowSelect = (leaveId, checked) => {
    setSelectedRows(prev => 
      checked 
        ? [...prev, leaveId] 
        : prev.filter(id => id !== leaveId)
    );
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    setSelectedRows(checked ? filteredLeaves.map(leave => leave.id) : []);
  };

  const handleCancelSelection = () => {
    setSelectedRows([]);
    setSelectAll(false);
    setShowCheckboxes(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} selected leave(s)?`)) {
      return;
    }

    try {
      // Delete all selected leaves
      for (const leaveId of selectedRows) {
        await deleteLeave(leaveId);
      }
      
      showSnackbar(`Successfully deleted ${selectedRows.length} leave(s)`, 'success');
      fetchLeaves(); // Refresh the list
      fetchStats(); // Refresh stats
      
      // Reset selection state
      handleCancelSelection();
    } catch (error) {
      showSnackbar(error.message || 'Failed to delete leaves', 'error');
    }
  };

  // Fetch leave statistics
  const fetchStats = async () => {
    try {
      const userId = getCurrentUserId();
      
      if (!userId) {
        console.warn('No user ID found for stats');
        return;
      }
      
      const queryParams = new URLSearchParams();
      queryParams.append('user_id', userId);
      
      // Add permission level for stats as well
      const isSuperAdminUser = isSuperAdmin();
      const canViewAll = canUserViewAll();
      const canViewJunior = canUserViewJunior();
      
      if (isSuperAdminUser) {
        queryParams.append('permission_level', 'superadmin');
      } else if (canViewAll) {
        queryParams.append('permission_level', 'all');
      } else if (canViewJunior) {
        queryParams.append('permission_level', 'junior');
      } else {
        queryParams.append('permission_level', 'own');
      }

      const response = await fetch(`${API_BASE_URL}/leaves/stats/overview?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStats({
          pending: data.pending || 0,
          approved: data.approved || 0,
          rejected: data.rejected || 0,
          total: data.total || 0
        });
      } else {
        console.warn('Failed to fetch stats, using defaults');
        setStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
    }
  };

  // Fetch user permissions
  const fetchPermissions = async () => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const response = await fetch(`${API_BASE_URL}/leaves/permissions?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        let perms = data.permissions || {
          can_view_own: true,
          can_view_all: false,
          can_approve_reject: false,
          can_create: true,
          is_super_admin: false
        };
        
        // Check if user has admin permissions (page "*" and actions "*" or "admin")
        if (hasAdminPermission()) {
          perms = {
            can_view_own: true,
            can_view_all: true,
            can_approve_reject: true,
            can_create: true,
            is_super_admin: true
          };
        }
        
        // Map new permission structure to old format for backward compatibility
        const mappedPerms = {
          leaves_show: perms.can_view_own,
          leaves_own: perms.can_view_own,
          leave_admin: perms.can_approve_reject,
          leaves_create: perms.can_create,
          leaves_delete: canDelete('leaves'),
          leaves_select: hasPermission(getUserPermissions(), 'leaves', 'select') || canDelete('leaves'),
          leave_setting: perms.is_super_admin || hasPermission(getUserPermissions(), 'leaves', 'leave_setting'),
          can_view_all: perms.can_view_all,
          can_approve_reject: perms.can_approve_reject,
          is_super_admin: perms.is_super_admin
        };
        
        setPermissions(mappedPerms);
      } else {
        console.warn('Failed to fetch permissions, using defaults');
        // Use default permissions if API fails
        setPermissions({
          leaves_show: true,
          leaves_own: true,
          leave_admin: false,
          leaves_create: true,
          leaves_delete: canDelete('leaves'),
          leaves_select: false,
          leave_setting: false,
          can_view_all: false,
          can_approve_reject: false,
          is_super_admin: false
        });
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      // Set default permissions on error
      setPermissions({
        leaves_show: true,
        leaves_own: true,
        leave_admin: false,
        leaves_create: true,
        leaves_delete: canDelete('leaves'),
        leaves_select: false,
        leave_setting: false,
        can_view_all: false,
        can_approve_reject: false,
        is_super_admin: false
      });
    }
  };

  // Create new leave
  const handleCreateLeave = async () => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      // If approvers are the default superadmin fallback, send empty array so
      // backend applies the "any-one" rule instead of "all-must" rule.
      const approverIdsToSend = isDefaultApprovers ? [] : Array.from(selectedApproverIds);

      const response = await fetch(`${API_BASE_URL}/leaves/?${queryParams}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newLeave,
          approver_ids: approverIdsToSend,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const createdLeaveId = data.id;
        
        // Upload attachment if one was selected
        if (attachmentFile && createdLeaveId) {
          await handleUploadAttachment(createdLeaveId);
        }
        
        // Show success screen instead of closing dialog
        setLastSubmitData({ id: createdLeaveId });
        setShowSuccess(true);
        fetchLeaves();
        fetchStats();
        fetchLeaveBalance();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create leave application');
      }
    } catch (error) {
      console.error('Error creating leave:', error);
      showSnackbar(error.message, 'error');
    }
  };

  // Approve or reject leave
  const handleApproveReject = async () => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const response = await fetch(`${API_BASE_URL}/leaves/${approvalLeave.id}/approve?${queryParams}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(approvalData),
      });

      if (response.ok) {
        const actionText = approvalData.status === 'approved' ? 'approved' : 'rejected';
        showSnackbar(`Leave application ${actionText} successfully`, 'success');
        setOpenApprovalDialog(false);
        setApprovalLeave(null);
        setApprovalData({
          status: 'approved',
          rejection_reason: '',
          comments: ''
        });
        fetchLeaves();
        fetchStats();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process leave application');
      }
    } catch (error) {
      console.error('Error processing leave:', error);
      showSnackbar(error.message, 'error');
    }
  };

  // Open approval dialog
  const openApprovalDialogHandler = (leave, status) => {
    setApprovalLeave(leave);
    setApprovalData({
      status: status,
      rejection_reason: '',
      comments: ''
    });
    setOpenApprovalDialog(true);
  };

  // Calculate leave duration
  const calculateDuration = () => {
    if (newLeave.from_date && newLeave.to_date) {
      const fromDate = new Date(newLeave.from_date);
      const toDate = new Date(newLeave.to_date);
      const diffTime = Math.abs(toDate - fromDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  };

  // ═══ ENHANCED LEAVE MODAL HELPERS ═══

  // Ordinal helper: 1→1st, 2→2nd, 3→3rd, 4→4th
  const toOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Get current user name + department from localStorage
  const getUserDisplayName = () => {
    try {
      const userData = localStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        const name = user.name || user.full_name || user.username || 'Employee';
        const dept = user.department_name || user.department || '';
        return { name, department: dept };
      }
    } catch (e) {}
    return { name: 'Employee', department: '' };
  };

  // Fetch employee leave balance
  const fetchLeaveBalance = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/settings/leave-balance/${userId}?user_id=${userId}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setLeaveBalance(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    }
  };

  // Count leave days taken this month by current user
  const getMonthLeaveCount = () => {
    const userId = getCurrentUserId();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return leaves
      .filter(l => {
        if (l.employee_id !== userId) return false;
        const fromDate = new Date(l.from_date);
        return fromDate.getMonth() === currentMonth && fromDate.getFullYear() === currentYear;
      })
      .reduce((sum, l) => sum + (l.duration_days || 0), 0);
  };

  // Calculate monthly leave allocation from yearly balance
  const getMonthlyBalance = () => {
    if (!leaveBalance) return { monthlyPL: 0, monthlyEL: 0, plRemaining: 0, elRemaining: 0, total: 0 };
    const monthlyPL = Math.floor((leaveBalance.paid_leaves_total || 0) / 12);
    const monthlyEL = Math.floor((leaveBalance.earned_leaves_total || 0) / 12);
    // How many days used this month
    const usedThisMonth = getMonthLeaveCount();
    // PL-first deduction to figure out PL/EL used this month
    let rem = usedThisMonth;
    const plUsed = Math.min(rem, monthlyPL); rem -= plUsed;
    const elUsed = Math.min(rem, monthlyEL);
    const plRemaining = Math.max(0, monthlyPL - plUsed);
    const elRemaining = Math.max(0, monthlyEL - elUsed);
    return { monthlyPL, monthlyEL, plRemaining, elRemaining, total: plRemaining + elRemaining };
  };

  // Recalculate leave breakdown when dates change
  const recalcLeave = (fromDateStr, toDateStr) => {
    if (!fromDateStr || !toDateStr) {
      setCalcResult(null);
      return;
    }
    const from = new Date(fromDateStr);
    const to = new Date(toDateStr);
    if (to < from) { setCalcResult(null); return; }

    // Collect all days in range
    const allDays = [];
    const c = new Date(from);
    while (c <= to) { allDays.push(new Date(c)); c.setDate(c.getDate() + 1); }

    // Skip Sundays
    const bizDays = allDays.filter(d => d.getDay() !== 0);
    const sundays = allDays.filter(d => d.getDay() === 0);
    const days = bizDays.length || 1;

    // Use monthly allocation, not yearly remaining
    const mb = getMonthlyBalance();
    const plRemaining = mb.plRemaining;
    const elRemaining = mb.elRemaining;

    // Auto deduct: PL first then EL
    let rem = days;
    const plUsed = Math.min(rem, plRemaining);
    rem -= plUsed;
    const elUsed = Math.min(rem, elRemaining);
    rem -= elUsed;
    const unpaid = Math.max(0, rem);

    const prevDays = getMonthLeaveCount();
    const leaveEnd = prevDays + days;

    // Build chips data
    const chips = bizDays.map((d, i) => {
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
      let type;
      if (i < plUsed) type = 'pl';
      else if (i < plUsed + elUsed) type = 'el';
      else type = 'unpaid';
      return { label, type, date: d };
    });
    const sundayChips = sundays.map(d => ({
      label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }),
      type: 'sunday', date: d
    }));

    setCalcResult({
      days, plUsed, elUsed, unpaid,
      paidTotal: plUsed + elUsed,
      totalAvail: plRemaining + elRemaining,
      chips: [...chips, ...sundayChips],
      leaveEnd, prevDays,
      needDoc: unpaid > 0,
    });
  };

  // Open create dialog with balance fetch + approvers
  const handleOpenCreateDialog = async () => {
    setShowSuccess(false);
    setLastSubmitData(null);
    setCalcResult(null);
    setNewLeave({ leave_type: 'paid_leave', from_date: '', to_date: '', reason: '', attachments: [] });
    setAttachmentFile(null);
    setSelectedApproverIds(new Set());
    setIsDefaultApprovers(false);
    setOpenCreateDialog(true);
    await fetchLeaveBalance();
    // Fetch approvers and auto-select all of them
    const { list: approvers, isDefault } = await fetchMyApprovers();
    if (approvers && approvers.length > 0) {
      setSelectedApproverIds(new Set(approvers.map(a => a.id || a._id)));
    }
  };

  // ═══ LEAVE APPROVAL SETTINGS FUNCTIONS ═══

  // Fetch all roles
  const fetchAllRoles = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/roles/?user_id=${userId}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setAllRoles(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error('Error fetching roles:', e); }
  };

  // Fetch all employees
  const fetchAllEmployees = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/users/?user_id=${userId}&is_active=true`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        // /users/ returns array of user objects with _id, first_name, last_name, designation, is_active
        const users = Array.isArray(data) ? data : (data.employees || data.data || []);
        // Normalize: add a "name" field and filter only active users
        const normalized = users
          .filter(u => u.is_active !== false)
          .map(u => ({
            ...u,
            id: u._id || u.id,
            name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Unknown',
          }));
        setAllEmployees(normalized);
      }
    } catch (e) { console.error('Error fetching employees:', e); }
  };

  // Fetch all approval routes
  const fetchApprovalRoutes = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/settings/leave-approval-routes?user_id=${userId}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setApprovalRoutes(data.data || []);
      }
    } catch (e) { console.error('Error fetching approval routes:', e); }
  };

  // Fetch my approvers (for Apply modal) — returns array
  const fetchMyApprovers = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/settings/leave-approvers-for-me?user_id=${userId}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        const list = data.data || [];
        setMyApprovers(list);
        setIsDefaultApprovers(!!data.is_default);
        return { list, isDefault: !!data.is_default };
      }
    } catch (e) { console.error('Error fetching my approvers:', e); }
    return { list: [], isDefault: false };
  };

  // Open settings modal
  const handleOpenSettings = async () => {
    setSettingsSelectedRole(null);
    setSettingsSelectedApprovers([]);
    setSettingsRoleSearch('');
    setSettingsEmpSearch('');
    setOpenSettingsModal(true);
    await Promise.all([fetchAllRoles(), fetchAllEmployees(), fetchApprovalRoutes()]);
  };

  // When a role is selected in settings, load existing approvers
  const handleSettingsRoleSelect = (roleId) => {
    setSettingsSelectedRole(roleId);
    const existing = approvalRoutes.find(r => r.role_id === roleId);
    setSettingsSelectedApprovers(existing ? existing.approver_ids : []);
  };

  // Toggle approver in settings
  const toggleSettingsApprover = (empId) => {
    setSettingsSelectedApprovers(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  // Save approval route
  const handleSaveApprovalRoute = async () => {
    if (!settingsSelectedRole || settingsSelectedApprovers.length === 0) return;
    setSettingsSaving(true);
    try {
      const userId = getCurrentUserId();
      const role = allRoles.find(r => (r.id || r._id) === settingsSelectedRole);
      const approverNames = settingsSelectedApprovers.map(id => {
        const emp = allEmployees.find(e => (e.id || e._id || e.user_id) === id);
        return emp ? (emp.name || emp.full_name || 'Unknown') : 'Unknown';
      });
      const response = await fetch(`${API_BASE_URL}/settings/leave-approval-routes?user_id=${userId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          role_id: settingsSelectedRole,
          role_name: role ? role.name : '',
          approver_ids: settingsSelectedApprovers,
          approver_names: approverNames,
        }),
      });
      if (response.ok) {
        showSnackbar('Approval route saved successfully', 'success');
        await fetchApprovalRoutes();
        setSettingsSelectedRole(null);
        setSettingsSelectedApprovers([]);
      } else {
        const err = await response.json().catch(() => ({}));
        showSnackbar(err.detail || 'Failed to save', 'error');
      }
    } catch (e) {
      showSnackbar('Error saving approval route', 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Delete approval route
  const handleDeleteApprovalRoute = async (roleId) => {
    if (!window.confirm('Delete this approval route?')) return;
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/settings/leave-approval-routes/${roleId}?user_id=${userId}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (response.ok) {
        showSnackbar('Route deleted', 'success');
        await fetchApprovalRoutes();
      }
    } catch (e) { showSnackbar('Error deleting route', 'error'); }
  };

  // Toggle approver in Apply modal
  const toggleApplyApprover = (approverId) => {
    setSelectedApproverIds(prev => {
      const next = new Set(prev);
      if (next.has(approverId)) next.delete(approverId);
      else next.add(approverId);
      return next;
    });
  };

  // Upload attachment
  const handleUploadAttachment = async (leaveId) => {
    if (!attachmentFile || !leaveId) return;

    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const formData = new FormData();
      formData.append('file', attachmentFile);

      const response = await fetch(`${API_BASE_URL}/leaves/${leaveId}/attachments?${queryParams}`, {
        method: 'POST',
        headers: getAuthHeadersForFiles(),
        body: formData,
      });

      if (response.ok) {
        showSnackbar('Attachment uploaded successfully', 'success');
        setAttachmentFile(null);
        fetchLeaves();
      } else {
        throw new Error('Failed to upload attachment');
      }
    } catch (error) {
      console.error('Error uploading attachment:', error);
      showSnackbar('Failed to upload attachment', 'error');
    }
  };

  // Download attachment
  const handleDownloadAttachment = async (attachment) => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const leaveId = selectedLeave?.id;
      const attachmentId = attachment.attachment_id;

      const response = await fetch(`${API_BASE_URL}/leaves/${leaveId}/attachments/${attachmentId}?${queryParams}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        // Create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.filename || 'attachment';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showSnackbar('Attachment downloaded successfully', 'success');
      } else {
        throw new Error('Failed to download attachment');
      }
    } catch (error) {
      console.error('Error downloading attachment:', error);
      showSnackbar('Failed to download attachment', 'error');
    }
  };

  // Open leave details
  const handleViewLeave = async (leaveId) => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const response = await fetch(`${API_BASE_URL}/leaves/${leaveId}?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedLeave(data);
        setOpenViewDialog(true);
        
        // Force refresh permissions when opening the dialog
        checkUserPermissions();
        // Ensure myApprovers is loaded (needed for fallback when leave has no approvers array)
        if (myApprovers.length === 0) fetchMyApprovers();
      } else if (response.status === 403) {
        showSnackbar('You don\'t have permission to view this leave', 'error');
      } else {
        throw new Error('Failed to fetch leave details');
      }
    } catch (error) {
      console.error('Error fetching leave details:', error);
      showSnackbar('Failed to load leave details', 'error');
    }
  };

  // Show snackbar message
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

  // Get filtered leaves based on selected tab
  const getFilteredLeaves = () => {
    if (!Array.isArray(leaves)) {
      return [];
    }
    
    let filtered = leaves;

    // Filter by tab (0=Pending, 1=Approved, 2=Rejected)
    if (selectedTab === 0) {
      filtered = filtered.filter(leave => leave.status === 'pending');
    } else if (selectedTab === 1) {
      filtered = filtered.filter(leave => leave.status === 'approved');
    } else if (selectedTab === 2) {
      filtered = filtered.filter(leave => leave.status === 'rejected');
    }

    return filtered;
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  // Load data on component mount and when specific dependencies change
  useEffect(() => {
    try {
      fetchLeaves();
      fetchStats();
    } catch (error) {
      console.error('Error in data loading useEffect:', error);
      if (typeof showSnackbar === 'function') {
        showSnackbar('Failed to load component data', 'error');
      }
    }
  }, [filters.status, filters.leave_type, filters.search]);

  // Load permissions only on component mount
  useEffect(() => {
    try {
      // Use the simplified permission system instead of API fetch
      checkUserPermissions();
    } catch (error) {
      console.error('Error in permissions useEffect:', error);
      if (typeof showSnackbar === 'function') {
        showSnackbar('Failed to load permissions', 'error');
      }
    }
  }, []);

  // Memoized filtered leaves based on selected tab and leaves data
  const filteredLeaves = useMemo(() => {
    return getFilteredLeaves();
  }, [leaves, selectedTab]);

  // Update select all checkbox based on selected rows and filtered leaves
  useEffect(() => {
    if (filteredLeaves.length > 0) {
      if (selectedRows.length === filteredLeaves.length) {
        setSelectAll(true);
      } else {
        setSelectAll(false);
      }
    }
  }, [selectedRows, filteredLeaves]);

  // Initialize component readiness
  useEffect(() => {
    setIsReady(true);
  }, []);

  // Progressive loading check - start with minimal UI
  if (!isReady) {
    return (
      <div className="leaves-page task-page-container">
        <style>{leavePageStyles}</style>
        <div className="task-loading-spinner">
          <div className="spinner" />
          <p>Loading leave management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leaves-page task-page-container">
      <style>{leavePageStyles}</style>

      <div className="task-top-bar">
        <div className="task-top-bar-left">
          <h1>Leaves</h1>
          <p>{stats?.total || 0} leave request{(stats?.total || 0) !== 1 ? 's' : ''}</p>
        </div>
        <div className="task-top-bar-right">
          {(permissions.leaves_delete || permissions.leaves_select) && (
            !showCheckboxes ? (
              <button type="button" className="task-btn-secondary" onClick={handleShowCheckboxes}>
                Select{selectedRows.length > 0 ? ` (${selectedRows.length})` : ''}
              </button>
            ) : (
              <div className="task-select-controls">
                <label>
                  <input type="checkbox" checked={selectAll} onChange={(e) => handleSelectAll(e.target.checked)} />
                  Select all
                </label>
                <span>{selectedRows.length} selected</span>
                <button type="button" className="task-select-btn-del" onClick={handleDeleteSelected} disabled={selectedRows.length === 0}>
                  Delete ({selectedRows.length})
                </button>
                <button type="button" className="task-select-btn-cancel" onClick={handleCancelSelection}>
                  Cancel
                </button>
              </div>
            )
          )}
          {(permissions.leaves_create || permissions.leaves_own || permissions.leaves_show) && (
            <button type="button" className="task-btn-create" onClick={handleOpenCreateDialog}>
              <Plus style={{ fontSize: 16 }} /> Apply Leave
            </button>
          )}
          {permissions.leave_setting && (
            <button type="button" className="task-btn-secondary task-btn-settings" onClick={handleOpenSettings}>
              <SettingsIcon style={{ fontSize: 16 }} /> Settings
            </button>
          )}
          <button type="button" className="task-btn-secondary" onClick={() => { fetchLeaves(); fetchStats(); }}>
            <RefreshCw style={{ fontSize: 16 }} /> Refresh
          </button>
        </div>
      </div>

      <div className="task-view-toggle-bar">
        <div className="task-view-toggle-group">
          {[
            { label: `Pending (${stats?.pending || 0})`, value: 0 },
            { label: `Approved (${stats?.approved || 0})`, value: 1 },
            { label: `Rejected (${stats?.rejected || 0})`, value: 2 },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`task-view-toggle-btn${selectedTab === tab.value ? ' active' : ''}`}
              onClick={() => handleTabChange(null, tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="task-toolbar-right">
          <div className="task-search-box--in-bar">
            <Search className="search-icon" style={{ fontSize: 14 }} />
            <input
              type="text"
              placeholder="Search leaves..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            {filters.search && (
              <button type="button" className="search-clear" onClick={() => setFilters({ ...filters, search: '' })} aria-label="Clear search">
                <X style={{ fontSize: 14 }} />
              </button>
            )}
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="task-filter-dropdown"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={filters.leave_type}
            onChange={(e) => setFilters({ ...filters, leave_type: e.target.value })}
            className="task-filter-dropdown"
          >
            <option value="">All Types</option>
            <option value="paid_leave">Paid Leave</option>
            <option value="casual_leave">Casual Leave</option>
            <option value="sick_leave">Sick Leave</option>
            <option value="emergency_leave">Emergency Leave</option>
          </select>
          {(filters.search || filters.status || filters.leave_type) && (
            <span className="leave-filter-meta">
              {filteredLeaves.length} of {leaves.length}
            </span>
          )}
        </div>
      </div>

      <div className="leave-page-content">
        <div className="leave-kpi-row">
          {statusCardConfig.map((config) => {
            const Icon = config.icon;
            const count = stats && typeof stats[config.key] === 'number' ? stats[config.key] : 0;
            return (
              <div key={config.key} className={config.kpiClass}>
                <div className="leave-kpi-icon"><Icon style={{ fontSize: 18 }} /></div>
                <div>
                  <p className="leave-kpi-label">{config.label}</p>
                  <p className="leave-kpi-val">{count}</p>
                </div>
              </div>
            );
          })}
        </div>

        {loading ? (
          <div className="task-loading-spinner">
            <div className="spinner" />
            <p>Loading leaves...</p>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="task-empty-state">
            <p className="task-empty-state-title">No leaves found</p>
            <p className="task-empty-state-sub">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="leave-table-wrap">
            <table className="leave-table">
              <thead>
                <tr>
                  {permissions.leaves_delete && showCheckboxes && (
                    <th className="leave-table-th">
                      <input type="checkbox" checked={selectAll} onChange={(e) => handleSelectAll(e.target.checked)} />
                    </th>
                  )}
                  <th className="leave-table-th">S.No</th>
                  <th className="leave-table-th">Applied On</th>
                  <th className="leave-table-th">Employee Name</th>
                  <th className="leave-table-th">From</th>
                  <th className="leave-table-th">To</th>
                  <th className="leave-table-th">Duration</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((leave, index) => (
                  <tr
                    key={leave.id}
                    className="leave-row"
                    onDoubleClick={() => handleViewLeave(leave.id)}
                    onClick={() => handleViewLeave(leave.id)}
                    title="Click to view leave details"
                  >
                    {permissions.leaves_delete && showCheckboxes && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(leave.id)}
                          onChange={(e) => handleRowSelect(leave.id, e.target.checked)}
                        />
                      </td>
                    )}
                    <td>{index + 1}</td>
                    <td>{formatDate(leave.created_at)}</td>
                    <td className="leave-name-cell">
                      <div className="leave-cell-name-wrap">
                        <div className="leave-cell-avatar">
                          {(leave.employee_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{leave.employee_name || 'Unknown'}</div>
                          {leave.department_name && (
                            <div className="leave-cell-sub">{leave.department_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{formatDate(leave.from_date)}</td>
                    <td>{formatDate(leave.to_date)}</td>
                    <td>{leave.duration_days} day{leave.duration_days > 1 ? 's' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {snackbar.open && (
        <div className={`leave-snackbar ${snackbar.severity}`}>
          <span>{snackbar.message}</span>
          <button type="button" onClick={() => setSnackbar({ ...snackbar, open: false })} className="leave-modal-close" style={{ width: 24, height: 24 }}>
            <X style={{ fontSize: 14 }} />
          </button>
        </div>
      )}

      {openCreateDialog && (
        <div className="leave-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpenCreateDialog(false); }}>
          <div className="leave-modal-panel" style={{ width: '100%', maxWidth: '520px' }}>

            <div className="leave-modal-header">
              <div>
                <h2>Apply for Leave</h2>
                <p>{getUserDisplayName().name}{getUserDisplayName().department ? ` · ${getUserDisplayName().department}` : ''}</p>
              </div>
              <button type="button" onClick={() => setOpenCreateDialog(false)} className="leave-modal-close">✕</button>
            </div>

            {!showSuccess ? (
              <>
                <div className="px-6 py-4">

                  {/* ═══ Total Available Leaves Block (Monthly) ═══ */}
                  {leaveBalance && (() => {
                    const mb = getMonthlyBalance();
                    const plR = mb.plRemaining;
                    const elR = mb.elRemaining;
                    const total = mb.total;
                    const isZero = total === 0;
                    return (
                      <div className="flex items-center justify-between gap-4 p-4 mb-3.5"
                           style={{
                             borderRadius: '16px',
                             background: isZero ? '#FEF2F2' : 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
                             border: isZero ? '2px solid #FECACA' : '2px solid #86EFAC'
                           }}>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider"
                               style={{ color: isZero ? '#DC2626' : '#15803D', letterSpacing: '.06em' }}>
                            Total Available Leaves
                          </div>
                          <div className="text-[40px] font-black leading-none" style={{ color: isZero ? '#DC2626' : '#166534' }}>
                            {total}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: isZero ? '#DC2626' : '#15803D' }}>days this month</div>
                        </div>
                        <div className="flex gap-2.5">
                          <div className="text-center min-w-[68px]" style={{
                            borderRadius: '10px', padding: '10px 14px',
                            background: plR > 0 ? 'rgba(22,163,74,0.15)' : '#F3F4F6',
                            border: plR > 0 ? '1.5px solid #86EFAC' : '1.5px solid #E5E7EB'
                          }}>
                            <div className="text-xl font-black" style={{ color: plR > 0 ? '#166534' : '#9CA3AF' }}>{plR}</div>
                            <div className="text-[10px] font-semibold uppercase" style={{ color: '#6B7280', letterSpacing: '.04em', marginTop: '2px' }}>PL Days</div>
                          </div>
                          <div className="text-center min-w-[68px]" style={{
                            borderRadius: '10px', padding: '10px 14px',
                            background: elR > 0 ? '#FFFBEB' : '#F3F4F6',
                            border: elR > 0 ? '1.5px solid #FCD34D' : '1.5px solid #E5E7EB'
                          }}>
                            <div className="text-xl font-black" style={{ color: elR > 0 ? '#D97706' : '#9CA3AF' }}>{elR}</div>
                            <div className="text-[10px] font-semibold uppercase" style={{ color: '#6B7280', letterSpacing: '.04em', marginTop: '2px' }}>EL Days</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ═══ Month Tracker ═══ */}
                  {(() => {
                    const mDays = getMonthLeaveCount();
                    const leaveEnd = calcResult ? calcResult.leaveEnd : mDays;
                    return (
                      <div className="flex items-center justify-between gap-2 flex-wrap px-3.5 py-2.5 mb-3.5"
                           style={{ borderRadius: '11px', background: '#F5F3FF', border: '1.5px solid #DDD6FE' }}>
                        <span className="text-[13px] font-semibold" style={{ color: '#5B21B6' }}>
                          {calcResult
                            ? <>This will be your <strong>{toOrdinal(leaveEnd)}</strong> leave day this month</>
                            : mDays > 0
                              ? <>You have taken your <strong>{toOrdinal(mDays)}</strong> leave day this month</>
                              : 'No leaves taken this month yet'
                          }
                        </span>
                        {calcResult && mDays > 0 && (
                          <span className="text-xs" style={{ color: '#5B21B6', opacity: 0.8 }}>
                            (previously {mDays} day{mDays > 1 ? 's' : ''} taken)
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* ═══ Info Banner — zero balance warning ═══ */}
                  {leaveBalance && (() => {
                    const total = getMonthlyBalance().total;
                    if (total === 0 && calcResult) {
                      return (
                        <div className="px-3.5 py-3 text-[13px] leading-relaxed mb-3.5"
                             style={{ borderRadius: '11px', background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#7F1D1D' }}>
                          You have 0 leaves available. All {calcResult.days} day{calcResult.days > 1 ? 's' : ''} will be <strong>unpaid</strong> — salary will be deducted.
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <hr style={{ border: 'none', borderTop: '1.5px solid #F3F4F6', margin: '16px 0' }} />

                  {/* ═══ Date Row ═══ */}
                  <div className="grid grid-cols-2 gap-3 mb-3.5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase" style={{ color: '#6B7280', letterSpacing: '.05em' }}>
                        From Date <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input type="date" value={newLeave.from_date}
                        min={getISTDateYMD()}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = { ...newLeave, from_date: val };
                          if (newLeave.to_date && newLeave.to_date < val) updated.to_date = val;
                          setNewLeave(updated);
                          recalcLeave(val, updated.to_date);
                        }}
                        className="w-full px-3 py-2.5 text-sm font-medium outline-none transition"
                        style={{ border: '2px solid #E5E7EB', borderRadius: '10px', color: '#1F2937', background: '#fff', fontFamily: 'Inter, sans-serif' }}
                        onFocus={(e) => e.target.style.borderColor = '#0891B2'}
                        onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase" style={{ color: '#6B7280', letterSpacing: '.05em' }}>
                        To Date <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input type="date" value={newLeave.to_date}
                        min={newLeave.from_date || getISTDateYMD()}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewLeave({ ...newLeave, to_date: val });
                          recalcLeave(newLeave.from_date, val);
                        }}
                        className="w-full px-3 py-2.5 text-sm font-medium outline-none transition"
                        style={{ border: '2px solid #E5E7EB', borderRadius: '10px', color: '#1F2937', background: '#fff', fontFamily: 'Inter, sans-serif' }}
                        onFocus={(e) => e.target.style.borderColor = '#0891B2'}
                        onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  </div>

                  {/* ═══ Day Chips ═══ */}
                  {calcResult && calcResult.chips.length > 0 && (
                    <div className="mb-3.5">
                      <div className="flex items-center gap-2.5 mb-2 text-[10px] font-bold uppercase" style={{ color: '#9CA3AF', letterSpacing: '.07em' }}>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#16A34A' }}></span> PL</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#D97706' }}></span> EL</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#EF4444' }}></span> Unpaid</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#9CA3AF' }}></span> Sunday</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {calcResult.chips.map((chip, i) => {
                          const chipStyles = {
                            pl: { background: '#DCFCE7', color: '#166534', border: '1.5px solid #86EFAC' },
                            el: { background: '#FFFBEB', color: '#78350F', border: '1.5px solid #FCD34D' },
                            unpaid: { background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA' },
                            sunday: { background: '#F3F4F6', color: '#9CA3AF', border: '1.5px solid #E5E7EB' },
                          };
                          const cs = chipStyles[chip.type];
                          return (
                            <span key={i} className="px-2.5 py-1 text-[11px] font-semibold"
                                  style={{ ...cs, borderRadius: '6px' }}>
                              {chip.label}{chip.type === 'sunday' ? ' ✕' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ═══ Summary 3-Box ═══ */}
                  {calcResult && (
                    <div className="grid grid-cols-3 gap-2 mb-3.5">
                      <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px' }}>
                        <div className="text-[10px] font-semibold uppercase" style={{ color: '#9CA3AF', letterSpacing: '.07em' }}>Leave Duration</div>
                        <div className="text-[15px] font-extrabold mt-0.5" style={{ color: '#1F2937' }}>
                          {calcResult.days} day{calcResult.days > 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px' }}>
                        <div className="text-[10px] font-semibold uppercase" style={{ color: '#9CA3AF', letterSpacing: '.07em' }}>Paid (PL+EL)</div>
                        <div className="text-[15px] font-extrabold mt-0.5" style={{ color: '#1F2937' }}>
                          {calcResult.paidTotal > 0 ? `${calcResult.paidTotal}d` : '0'}
                        </div>
                      </div>
                      <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px' }}>
                        <div className="text-[10px] font-semibold uppercase" style={{ color: '#9CA3AF', letterSpacing: '.07em' }}>Unpaid (Deduct)</div>
                        <div className="text-[15px] font-extrabold mt-0.5">
                          {calcResult.unpaid > 0
                            ? <span style={{ color: '#DC2626', fontWeight: 800 }}>{calcResult.unpaid}d salary cut</span>
                            : <span style={{ color: '#16A34A' }}>None ✔</span>
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ═══ Reason / Remarks ═══ */}
                  <div className="flex flex-col gap-1.5 mb-3.5">
                    <label className="text-[11px] font-bold uppercase" style={{ color: '#6B7280', letterSpacing: '.05em' }}>
                      Reason / Remarks
                    </label>
                    <textarea value={newLeave.reason}
                      onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                      placeholder="Brief reason for leave..."
                      rows={3}
                      className="w-full px-3 py-2.5 text-sm font-medium outline-none transition resize-y"
                      style={{ border: '2px solid #E5E7EB', borderRadius: '10px', color: '#1F2937', minHeight: '68px', fontFamily: 'Inter, sans-serif' }}
                      onFocus={(e) => e.target.style.borderColor = '#0891B2'}
                      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </div>

                  {/* ═══ Document Section — only when unpaid > 0 ═══ */}
                  {calcResult && calcResult.needDoc && (
                    <div className="mb-3.5">
                      <div className="p-3.5" style={{ background: '#FFFBEB', border: '2px solid #FCD34D', borderRadius: '12px' }}>
                        <div className="text-[13px] font-bold mb-1" style={{ color: '#92400E' }}>⚠️ Document Required</div>
                        <div className="text-xs leading-relaxed" style={{ color: '#78350F' }}>
                          You are taking {calcResult.unpaid} extra day{calcResult.unpaid > 1 ? 's' : ''} beyond your available leaves. Supporting document is required.
                        </div>
                        <div className="text-xs font-bold mt-1.5" style={{ color: '#92400E' }}>
                          Without a document, your leave will <u>not be approved</u>.
                        </div>
                        <label className="block mt-2.5 p-4 text-center cursor-pointer transition relative"
                               style={{ border: '2px dashed #FCD34D', borderRadius: '9px', background: 'rgba(252,211,77,0.08)' }}>
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                                 onChange={(e) => setAttachmentFile(e.target.files[0])} />
                          <div className="text-xs font-bold" style={{ color: '#92400E' }}>📎 Upload Document (optional before submit)</div>
                          <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>PDF, JPG, PNG — max 5 MB</div>
                        </label>
                        {attachmentFile && (
                          <div className="text-xs font-bold mt-2" style={{ color: '#16A34A' }}>
                            ✅ {attachmentFile.name} attached
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ═══ Approver Selection — matches HTML approver-sec ═══ */}
                  {myApprovers.length > 0 ? (
                    <div className="mb-3.5">
                      <label className="text-[11px] font-bold uppercase block mb-2" style={{ color: '#6B7280', letterSpacing: '.05em' }}>
                        Send Leave Request To <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <div className="flex flex-col gap-1.5">
                        {myApprovers.map(ap => {
                          const apId = ap.id || ap._id;
                          const isSelected = selectedApproverIds.has(apId);
                          return (
                            <div key={apId}
                                 onClick={() => toggleApplyApprover(apId)}
                                 className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition select-none"
                                 style={{
                                   borderRadius: '10px',
                                   border: isSelected ? '2px solid #0891B2' : '2px solid #E5E7EB',
                                   background: isSelected ? '#ECFEFF' : '#fff',
                                 }}>
                              {/* Checkbox */}
                              <div className="w-[18px] h-[18px] flex items-center justify-center flex-shrink-0 text-[11px]"
                                   style={{
                                     borderRadius: '5px',
                                     border: isSelected ? 'none' : '2px solid #D1D5DB',
                                     background: isSelected ? '#0891B2' : '#fff',
                                     color: '#fff',
                                   }}>
                                {isSelected && '✓'}
                              </div>
                              {/* Info */}
                              <div className="flex-1">
                                <div className="text-[13px] font-bold" style={{ color: '#1F2937' }}>
                                  {ap.name || 'Unknown'}
                                </div>
                                {ap.role && (
                                  <div className="text-[11px]" style={{ color: '#9CA3AF', marginTop: '1px' }}>
                                    {ap.role}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {selectedApproverIds.size === 0 && (
                        <div className="text-[11px] font-medium mt-1.5" style={{ color: '#EF4444' }}>
                          Please select at least one approver
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mb-3.5 p-3.5" style={{ background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: '12px' }}>
                      <div className="text-[13px] font-bold mb-1" style={{ color: '#DC2626' }}>⚠️ No Approvers Configured</div>
                      <div className="text-xs leading-relaxed" style={{ color: '#991B1B' }}>
                        No leave approvers have been configured for your role. Please contact your admin to set up leave approval routing in Settings.
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer */}
                <div className="flex gap-2.5 justify-end px-6 pb-5">
                  <button onClick={() => setOpenCreateDialog(false)}
                          className="px-5 py-2.5 text-sm font-bold transition"
                          style={{ borderRadius: '10px', background: '#F3F4F6', color: '#4B5563' }}>
                    Cancel
                  </button>
                  <button onClick={handleCreateLeave}
                    disabled={!newLeave.from_date || !newLeave.to_date || !newLeave.reason.trim() || (myApprovers.length > 0 && selectedApproverIds.size === 0)}
                    className="px-5 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed"
                    style={{
                      borderRadius: '10px',
                      background: (!newLeave.from_date || !newLeave.to_date || !newLeave.reason.trim() || (myApprovers.length > 0 && selectedApproverIds.size === 0)) ? '#E5E7EB' : '#16A34A',
                      color: (!newLeave.from_date || !newLeave.to_date || !newLeave.reason.trim() || (myApprovers.length > 0 && selectedApproverIds.size === 0)) ? '#9CA3AF' : '#fff',
                      boxShadow: (!newLeave.from_date || !newLeave.to_date || !newLeave.reason.trim() || (myApprovers.length > 0 && selectedApproverIds.size === 0)) ? 'none' : '0 3px 12px rgba(22,163,74,0.3)'
                    }}>
                    Submit Application
                  </button>
                </div>
              </>
            ) : (
              /* ═══ Success Screen ═══ */
              <div className="text-center px-6 py-7">
                <div className="text-[52px] mb-2.5" style={{ animation: 'leavePopIn 0.45s cubic-bezier(.34,1.8,.64,1)' }}>✅</div>
                <div className="text-[19px] font-extrabold mb-1.5" style={{ color: '#111827' }}>Leave Application Submitted!</div>
                <p className="text-[13px] leading-relaxed mb-1.5" style={{ color: '#6B7280' }}>Your request has been sent for approval.</p>
                {calcResult && calcResult.unpaid > 0 && (
                  <div className="text-xs font-semibold mb-5" style={{ color: '#D97706' }}>
                    Note: {calcResult.unpaid} unpaid day{calcResult.unpaid > 1 ? 's' : ''} — salary will be deducted.
                  </div>
                )}
                <div className="flex gap-2.5 justify-center flex-wrap">
                  {lastSubmitData && (
                    <button onClick={() => { setOpenCreateDialog(false); handleViewLeave(lastSubmitData.id); }}
                            className="px-5 py-2.5 text-sm font-bold text-white transition"
                            style={{ borderRadius: '10px', background: '#0891B2', boxShadow: '0 3px 12px rgba(8,145,178,0.3)' }}>
                      View Details
                    </button>
                  )}
                  <button onClick={() => {
                            setShowSuccess(false);
                            setCalcResult(null);
                            setNewLeave({ leave_type: 'paid_leave', from_date: '', to_date: '', reason: '', attachments: [] });
                            setAttachmentFile(null);
                            fetchLeaveBalance();
                          }}
                          className="px-5 py-2.5 text-sm font-bold transition"
                          style={{ borderRadius: '10px', background: '#F3F4F6', color: '#374151' }}>
                    Apply Another
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ═══ VIEW LEAVE DETAIL DIALOG — matches leave-application-modal.html det-modal ═══ */}
      {openViewDialog && selectedLeave && (() => {
        // Compute paid vs unpaid for detail display
        const totalDays = selectedLeave.duration_days || 0;
        const leaveType = selectedLeave.leave_type || '';
        const isPaid = leaveType === 'paid_leave' || leaveType === 'casual_leave';
        const paidDays = isPaid ? totalDays : 0;
        const unpaidDays = isPaid ? 0 : totalDays;
        const hasAttachment = selectedLeave.attachments && selectedLeave.attachments.length > 0;

        // Helper: ordinal
        const toOrdinal = (n) => {
          const s = ['th','st','nd','rd'];
          const v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        // Status helpers
        const status = (selectedLeave.status || 'pending').toLowerCase();

        // Multi-approval: get approvers array from backend
        // Fallback: if leave has no stored approvers, show the configured approvers for this role
        const storedApprovers = selectedLeave.approvers || [];
        const approvers = storedApprovers.length > 0
          ? storedApprovers
          : myApprovers.map(a => ({ approver_id: a.id, name: a.name, role: a.role, status: 'pending' }));
        const hasMultiApproval = approvers.length > 0;
        const isCreator = selectedLeave.user_id === currentUserId;
        const approvedCount = approvers.filter(a => (a.status || '').toLowerCase() === 'approved').length;
        const rejectedCount = approvers.filter(a => (a.status || '').toLowerCase() === 'rejected').length;
        const totalApprovers = approvers.length;
        // Check if current user is one of the approvers
        const currentUserApprover = approvers.find(a => a.approver_id === currentUserId);
        const canCurrentUserAct = currentUserApprover && !isCreator && (currentUserApprover.status || '').toLowerCase() === 'pending';
        // Legacy single approver fallback
        const legacyApproverName = selectedLeave.approved_by_name || selectedLeave.rejected_by_name || null;

        return (
        <div className="leave-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpenViewDialog(false); }}>
          <div className="leave-modal-panel leave-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="leave-modal-header">
              <div>
                <h2>Leave Application Details</h2>
                <div className="leave-detail-meta">
                  <StatusChip status={status} label={status.charAt(0).toUpperCase() + status.slice(1)} />
                </div>
              </div>
              <button type="button" onClick={() => setOpenViewDialog(false)} className="leave-modal-close">✕</button>
            </div>

            <div className="leave-detail-body">
              <div className="leave-detail-grid">
                <div className="leave-detail-field">
                  <div className="leave-detail-label">Employee Name</div>
                  <div className="leave-detail-value">{selectedLeave.employee_name || 'Unknown'}</div>
                </div>
                <div className="leave-detail-field">
                  <div className="leave-detail-label">Applied On</div>
                  <div className="leave-detail-value">{formatDate(selectedLeave.created_at)}</div>
                </div>
                <div className="leave-detail-field">
                  <div className="leave-detail-label">From Date</div>
                  <div className="leave-detail-value">{formatDate(selectedLeave.from_date)}</div>
                </div>
                <div className="leave-detail-field">
                  <div className="leave-detail-label">To Date</div>
                  <div className="leave-detail-value">{formatDate(selectedLeave.to_date)}</div>
                </div>
                <div className="leave-detail-field">
                  <div className="leave-detail-label">Leave Duration</div>
                  <div className="leave-detail-value">{totalDays} day{totalDays > 1 ? 's' : ''}</div>
                </div>
                <div className="leave-detail-field">
                  <div className="leave-detail-label">Leave of This Month</div>
                  <div className="leave-detail-value">
                    <span className="leave-detail-chip">{toOrdinal(totalDays)} leave day</span>
                  </div>
                </div>
                <div className="leave-detail-field">
                  <div className="leave-detail-label">Paid Days</div>
                  <div className={`leave-detail-value${paidDays > 0 ? ' success' : ' muted'}`}>
                    {paidDays > 0 ? `${paidDays} day${paidDays > 1 ? 's' : ''} — paid` : '—'}
                  </div>
                </div>
                <div className="leave-detail-field">
                  <div className="leave-detail-label">Salary Deduction</div>
                  <div className={`leave-detail-value${unpaidDays > 0 ? ' danger' : ' success'}`}>
                    {unpaidDays > 0 ? `${unpaidDays} day${unpaidDays > 1 ? 's' : ''} salary cut` : 'None'}
                  </div>
                </div>
                <div className="leave-detail-field full">
                  <div className="leave-detail-label">Reason / Remarks</div>
                  <div className="leave-detail-value block">{selectedLeave.reason || '—'}</div>
                </div>
              </div>

              {(hasAttachment || status === 'pending') && (
                <div className="leave-detail-field full">
                  <div className="leave-detail-label">Document</div>
                  {hasAttachment ? (
                    <div className="leave-detail-banner success">
                      Document uploaded
                      {selectedLeave.attachments.map((att, i) => (
                        <button key={i} type="button" onClick={() => handleDownloadAttachment(att)} className="leave-detail-banner-btn">
                          {att.filename || `File ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="leave-detail-banner warning">Document not uploaded — leave may be rejected</div>
                  )}
                </div>
              )}

              {selectedLeave.rejection_reason && (
                <div className="leave-detail-field full">
                  <div className="leave-detail-label">Rejection Reason</div>
                  <div className="leave-detail-value block danger">{selectedLeave.rejection_reason}</div>
                </div>
              )}

              {selectedLeave.approval_comments && (
                <div className="leave-detail-field full">
                  <div className="leave-detail-label">{status === 'approved' ? 'Approval Comments' : 'Comments'}</div>
                  <div className="leave-detail-value block success">{selectedLeave.approval_comments}</div>
                </div>
              )}

              <hr className="leave-detail-divider" />

              <p className="leave-detail-section-title">Approval Status</p>
              <div className="leave-detail-table-wrap">
                <table className="leave-detail-table">
                  <thead>
                    <tr>
                      <th>Approver</th>
                      <th>Role</th>
                      <th className="center">Status</th>
                      <th className="center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasMultiApproval ? approvers.map((apr, idx) => {
                      const aprStatus = (apr.status || 'pending').toLowerCase();
                      const isCurrentUserRow = apr.approver_id === currentUserId;
                      const canAct = isCurrentUserRow && !isCreator && aprStatus === 'pending';
                      return (
                        <tr key={apr.approver_id || idx} className={isCurrentUserRow ? 'highlight' : undefined}>
                          <td>
                            <span style={{ fontWeight: 600 }}>{apr.name || 'Unknown'}</span>
                            {isCurrentUserRow && <span className="leave-detail-you-pill">You</span>}
                          </td>
                          <td className="muted" style={{ color: '#6b7a99' }}>{apr.role || '—'}</td>
                          <td className="center">
                            <StatusChip status={aprStatus} label={aprStatus === 'approved' ? 'Approved' : aprStatus === 'rejected' ? 'Rejected' : 'Pending'} />
                          </td>
                          <td className="center">
                            {canAct ? (
                              <div className="leave-detail-row-actions">
                                <button type="button" className="leave-detail-mini-btn approve" onClick={() => { setOpenViewDialog(false); openApprovalDialogHandler(selectedLeave, 'approved'); }}>Approve</button>
                                <button type="button" className="leave-detail-mini-btn reject" onClick={() => { setOpenViewDialog(false); openApprovalDialogHandler(selectedLeave, 'rejected'); }}>Reject</button>
                              </div>
                            ) : aprStatus !== 'pending' ? (
                              <span style={{ color: '#4a5570' }}>—</span>
                            ) : isCreator ? (
                              <span style={{ color: '#4a5570', fontSize: 11 }}>Own leave</span>
                            ) : (
                              <span style={{ color: '#4a5570' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td style={{ fontWeight: 600 }}>{legacyApproverName || '—'}</td>
                        <td style={{ color: '#6b7a99' }}>—</td>
                        <td className="center">
                          <StatusChip status={status} label={status.charAt(0).toUpperCase() + status.slice(1)} />
                        </td>
                        <td className="center" style={{ color: '#4a5570' }}>
                          {status === 'pending' ? 'Awaiting…' : '—'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className={`leave-detail-status-bar ${status}`}>
                {status === 'approved'
                  ? `Approved — All approvers confirmed${hasMultiApproval ? ` (${approvedCount}/${totalApprovers})` : ''}`
                  : status === 'rejected'
                    ? `Rejected — ${hasMultiApproval ? `${rejectedCount}/${totalApprovers} rejected` : 'Approver rejected'}`
                    : `Pending — Awaiting approvals${hasMultiApproval ? ` (${approvedCount}/${totalApprovers} approved)` : ''}`}
              </div>
            </div>

            <div className="leave-modal-footer">
              {canCurrentUserAct && status === 'pending' ? (
                <div className="leave-detail-footer-actions">
                  <button type="button" className="leave-modal-btn-success full" onClick={() => { setOpenViewDialog(false); openApprovalDialogHandler(selectedLeave, 'approved'); }}>
                    <CheckCircle style={{ fontSize: 16 }} /> Approve
                  </button>
                  <button type="button" className="leave-modal-btn-danger full" onClick={() => { setOpenViewDialog(false); openApprovalDialogHandler(selectedLeave, 'rejected'); }}>
                    <XCircle style={{ fontSize: 16 }} /> Reject
                  </button>
                </div>
              ) : (
                <button type="button" className="leave-modal-btn-secondary full" onClick={() => setOpenViewDialog(false)} style={{ width: '100%' }}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Approval Dialog */}
      {openApprovalDialog && approvalLeave && (
        <div className="leave-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpenApprovalDialog(false); }}>
          <div className="leave-modal-panel leave-detail-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="leave-modal-header">
              <h2>{approvalData.status === 'approved' ? 'Approve Leave' : 'Reject Leave'}</h2>
              <button type="button" onClick={() => setOpenApprovalDialog(false)} className="leave-modal-close">✕</button>
            </div>

            <div className="leave-modal-body">
              <div className="leave-approval-field">
                <label>Leave Details</label>
                <div className="leave-approval-summary">
                  <div><span>Employee: </span>{approvalLeave.employee_name}</div>
                  <div><span>Type: </span>{approvalLeave.leave_type.replace('_', ' ')}</div>
                  <div><span>Duration: </span>{approvalLeave.duration_days} days</div>
                  <div><span>From: </span>{formatDate(approvalLeave.from_date)}</div>
                  <div><span>To: </span>{formatDate(approvalLeave.to_date)}</div>
                  <div><span>Reason: </span>{approvalLeave.reason}</div>
                </div>
              </div>

              {approvalData.status === 'rejected' && (
                <div className="leave-approval-field">
                  <label>Rejection Reason *</label>
                  <textarea
                    rows={3}
                    value={approvalData.rejection_reason}
                    onChange={(e) => setApprovalData({ ...approvalData, rejection_reason: e.target.value })}
                    placeholder="Please provide a reason for rejection..."
                    required
                  />
                </div>
              )}

              <div className="leave-approval-field">
                <label>Comments (Optional)</label>
                <textarea
                  rows={2}
                  value={approvalData.comments}
                  onChange={(e) => setApprovalData({ ...approvalData, comments: e.target.value })}
                  placeholder="Add any additional comments..."
                />
              </div>
            </div>

            <div className="leave-modal-footer">
              <button type="button" onClick={() => setOpenApprovalDialog(false)} className="leave-modal-btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveReject}
                disabled={approvalData.status === 'rejected' && !approvalData.rejection_reason.trim()}
                className={approvalData.status === 'approved' ? 'leave-modal-btn-success' : 'leave-modal-btn-danger'}
              >
                {approvalData.status === 'approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Attachment Dialog */}

      {/* ═══ LEAVE APPROVAL SETTINGS MODAL — Enterprise CRM Style ═══ */}
      {openSettingsModal && (
        <div className="leave-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setOpenSettingsModal(false); setSettingsRoleSearch(''); setSettingsEmpSearch(''); } }}>
          <div className="leave-modal-panel leave-settings-modal" onClick={(e) => e.stopPropagation()}>

            <div className="leave-modal-header">
              <div className="flex items-center gap-3">
                <div className="leave-kpi-icon" style={{ color: '#f97316' }}><SettingsIcon style={{ fontSize: 18 }} /></div>
                <div>
                  <h2>Leave Approval Routing</h2>
                  <p>Configure which employees approve leaves for each role</p>
                </div>
              </div>
              <button type="button" onClick={() => { setOpenSettingsModal(false); setSettingsRoleSearch(''); setSettingsEmpSearch(''); }} className="leave-modal-close">
                <X style={{ fontSize: 16 }} />
              </button>
            </div>

            {/* ── Main Content — 2 Column Layout ── */}
            <div className="flex flex-1 overflow-hidden">

              {/* ═══ LEFT PANEL — Roles List ═══ */}
              <div className="leave-settings-sidebar">
                {/* Role search */}
                <div className="px-3 py-3 shrink-0" style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <div className="relative">
                    <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#94A3B8' }} />
                    <input
                      type="text"
                      placeholder="Search roles..."
                      value={settingsRoleSearch}
                      onChange={e => setSettingsRoleSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs font-medium"
                      style={{ borderRadius: '8px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#1E293B', outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#F97316'}
                      onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                    />
                  </div>
                </div>

                {/* Role list */}
                <div className="flex-1 overflow-y-auto py-1">
                  {allRoles
                    .filter(r => !settingsRoleSearch || (r.name || '').toLowerCase().includes(settingsRoleSearch.toLowerCase()))
                    .map(role => {
                      const roleId = role.id || role._id;
                      const isActive = settingsSelectedRole === roleId;
                      const route = approvalRoutes.find(r => r.role_id === roleId);
                      const approverCount = route ? (route.approver_ids || []).length : 0;
                      return (
                        <button key={roleId} type="button"
                                onClick={() => handleSettingsRoleSelect(roleId)}
                                className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 transition-all"
                                style={{
                                  background: isActive ? '#fff' : 'transparent',
                                  borderLeft: isActive ? '3px solid #F97316' : '3px solid transparent',
                                  borderBottom: '1px solid #F1F5F9',
                                }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                               style={{
                                 background: isActive ? '#FFF7ED' : '#F1F5F9',
                                 color: isActive ? '#EA580C' : '#64748B',
                                 border: isActive ? '1.5px solid #FDBA74' : '1.5px solid #E2E8F0',
                               }}>
                            {(role.name || 'R').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate" style={{ color: isActive ? '#EA580C' : '#334155' }}>
                              {role.name || 'Unnamed'}
                            </div>
                            {approverCount > 0 && (
                              <div className="text-[10px] font-medium" style={{ color: '#16A34A' }}>
                                {approverCount} approver{approverCount > 1 ? 's' : ''}
                              </div>
                            )}
                            {approverCount === 0 && (
                              <div className="text-[10px]" style={{ color: '#94A3B8' }}>Not configured</div>
                            )}
                          </div>
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#F97316' }}></div>
                          )}
                        </button>
                      );
                    })}
                  {allRoles.length === 0 && (
                    <div className="text-xs text-center py-8" style={{ color: '#94A3B8' }}>Loading roles...</div>
                  )}
                  {allRoles.length > 0 && allRoles.filter(r => !settingsRoleSearch || (r.name || '').toLowerCase().includes(settingsRoleSearch.toLowerCase())).length === 0 && (
                    <div className="text-xs text-center py-6" style={{ color: '#94A3B8' }}>No roles match "{settingsRoleSearch}"</div>
                  )}
                </div>
              </div>

              {/* ═══ RIGHT PANEL — Approver Config ═══ */}
              <div className="leave-settings-main">

                {!settingsSelectedRole ? (
                  /* Empty state */
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#F1F5F9' }}>
                      <Users style={{ fontSize: '28px', color: '#94A3B8' }} />
                    </div>
                    <div className="text-sm font-semibold" style={{ color: '#64748B' }}>Select a Role</div>
                    <div className="text-xs text-center max-w-[260px]" style={{ color: '#94A3B8' }}>
                      Choose a role from the left panel to configure which employees can approve leave requests for that role.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Right panel header */}
                    <div className="px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg text-white" style={{ background: '#F97316' }}>
                              {allRoles.find(r => (r.id || r._id) === settingsSelectedRole)?.name || 'Role'}
                            </span>
                            <span className="text-[11px]" style={{ color: '#94A3B8' }}>→ Approvers</span>
                          </div>
                          <div className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>
                            Employees of this role will send leave requests to the selected approvers below
                          </div>
                        </div>
                        {/* Existing route indicator */}
                        {approvalRoutes.find(r => r.role_id === settingsSelectedRole) && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold"
                               style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                            <CheckCircle style={{ fontSize: '12px' }} /> Configured
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected approvers chips */}
                    {settingsSelectedApprovers.length > 0 && (
                      <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
                        <div className="text-[10px] font-bold uppercase mb-2" style={{ color: '#64748B', letterSpacing: '.06em' }}>
                          Selected Approvers ({settingsSelectedApprovers.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {settingsSelectedApprovers.map(empId => {
                            const emp = allEmployees.find(e => (e.id || e._id || e.user_id) === empId);
                            const empName = emp ? (emp.name || emp.full_name || 'Unknown') : 'Unknown';
                            const empDesig = emp?.designation || '';
                            return (
                              <span key={empId}
                                    className="inline-flex items-center gap-2 pl-1.5 pr-1.5 py-1.5 text-xs font-semibold group"
                                    style={{ borderRadius: '10px', background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                                <span className="w-6 h-6 flex items-center justify-center rounded-lg text-white text-[10px] font-bold"
                                      style={{ background: '#3B82F6' }}>
                                  {empName.charAt(0).toUpperCase()}
                                </span>
                                <span className="flex flex-col leading-tight">
                                  <span className="text-[11px] font-semibold">{empName}</span>
                                  {empDesig && <span className="text-[9px] font-normal" style={{ color: '#6B7280' }}>{empDesig}</span>}
                                </span>
                                <button type="button" onClick={() => toggleSettingsApprover(empId)}
                                        className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-red-100 transition ml-1"
                                        style={{ color: '#94A3B8', fontSize: '14px' }}>×</button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Employee search */}
                    <div className="px-5 pt-3 pb-2 shrink-0">
                      <div className="relative">
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#94A3B8' }} />
                        <input
                          type="text"
                          placeholder="Search employees by name or designation..."
                          value={settingsEmpSearch}
                          onChange={e => setSettingsEmpSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 text-xs font-medium"
                          style={{ borderRadius: '10px', border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#1E293B', outline: 'none' }}
                          onFocus={e => { e.target.style.borderColor = '#3B82F6'; e.target.style.background = '#fff'; }}
                          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.background = '#F8FAFC'; }}
                        />
                      </div>
                    </div>

                    {/* Employee list */}
                    <div className="flex-1 overflow-y-auto px-5 pb-3">
                      {(() => {
                        const filtered = allEmployees.filter(emp => {
                          if (!settingsEmpSearch) return true;
                          const q = settingsEmpSearch.toLowerCase();
                          const name = (emp.name || emp.full_name || '').toLowerCase();
                          const desig = (emp.designation || '').toLowerCase();
                          return name.includes(q) || desig.includes(q);
                        });
                        if (filtered.length === 0) {
                          return (
                            <div className="text-xs text-center py-10" style={{ color: '#94A3B8' }}>
                              {settingsEmpSearch ? `No employees match "${settingsEmpSearch}"` : 'Loading employees...'}
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-col gap-1">
                            {filtered.map(emp => {
                              const empId = emp.id || emp._id || emp.user_id;
                              const isChecked = settingsSelectedApprovers.includes(empId);
                              const empName = emp.name || emp.full_name || 'Unknown';
                              return (
                                <div key={empId}
                                     onClick={() => toggleSettingsApprover(empId)}
                                     className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-all"
                                     style={{
                                       borderRadius: '10px',
                                       background: isChecked ? '#EFF6FF' : 'transparent',
                                       border: isChecked ? '1.5px solid #93C5FD' : '1.5px solid transparent',
                                     }}
                                     onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = '#F8FAFC'; }}
                                     onMouseLeave={e => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}>
                                  {/* Checkbox */}
                                  <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition"
                                       style={{
                                         border: isChecked ? 'none' : '2px solid #CBD5E1',
                                         background: isChecked ? '#3B82F6' : '#fff',
                                       }}>
                                    {isChecked && <span className="text-white text-[11px] font-bold">✓</span>}
                                  </div>
                                  {/* Avatar */}
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                                       style={{
                                         background: isChecked ? '#DBEAFE' : '#F1F5F9',
                                         color: isChecked ? '#1D4ED8' : '#64748B',
                                       }}>
                                    {empName.charAt(0).toUpperCase()}
                                  </div>
                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold truncate" style={{ color: isChecked ? '#1E40AF' : '#334155' }}>
                                      {empName}
                                    </div>
                                    {emp.designation && (
                                      <div className="text-[10px] truncate" style={{ color: '#94A3B8' }}>{emp.designation}</div>
                                    )}
                                  </div>
                                  {isChecked && (
                                    <div className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                         style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                                      Approver
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Bottom Bar ── */}
            <div className="flex items-center justify-between px-5 py-3 shrink-0"
                 style={{ borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div className="text-[11px]" style={{ color: '#94A3B8' }}>
                {approvalRoutes.length} route{approvalRoutes.length !== 1 ? 's' : ''} configured
              </div>
              <div className="flex gap-2.5">
                {settingsSelectedRole && approvalRoutes.find(r => r.role_id === settingsSelectedRole) && (
                  <button onClick={() => handleDeleteApprovalRoute(settingsSelectedRole)}
                          className="px-4 py-2 text-xs font-bold transition"
                          style={{ borderRadius: '8px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                    Delete Route
                  </button>
                )}
                <button onClick={() => { setOpenSettingsModal(false); setSettingsRoleSearch(''); setSettingsEmpSearch(''); }}
                        className="px-4 py-2 text-xs font-bold transition"
                        style={{ borderRadius: '8px', background: '#F1F5F9', color: '#475569' }}>
                  Cancel
                </button>
                <button onClick={handleSaveApprovalRoute}
                        disabled={!settingsSelectedRole || settingsSelectedApprovers.length === 0 || settingsSaving}
                        className="px-5 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed"
                        style={{
                          borderRadius: '8px',
                          background: (!settingsSelectedRole || settingsSelectedApprovers.length === 0 || settingsSaving)
                            ? '#E2E8F0' : 'linear-gradient(135deg, #F97316, #EA580C)',
                          color: (!settingsSelectedRole || settingsSelectedApprovers.length === 0 || settingsSaving) ? '#94A3B8' : '#fff',
                          boxShadow: (!settingsSelectedRole || settingsSelectedApprovers.length === 0 || settingsSaving)
                            ? 'none' : '0 2px 8px rgba(249,115,22,0.3)',
                        }}>
                  {settingsSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openUploadDialog && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
          <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-md mx-auto space-y-6">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
              onClick={() => setOpenUploadDialog(false)}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-green-600 mb-4">UPLOAD ATTACHMENT</h2>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded border border-gray-300">
                <p className="text-sm text-gray-700 font-medium">
                  Upload your attachment for the leave application. Supported formats: PDF, PNG, JPG, DOCX.
                </p>
              </div>
              
              <div>
                <label className="block font-bold text-gray-700 mb-1">Choose File</label>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center px-4 py-2 bg-cyan-500 text-white font-bold rounded-lg shadow cursor-pointer hover:bg-cyan-600 transition">
                    Photo/PDF
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      onChange={(e) => setUploadAttachmentFile(e.target.files[0])}
                    />
                  </label>
                  {uploadAttachmentFile && (
                    <div className="flex items-center gap-1 text-green-600 font-medium">
                      <AttachFile className="w-4 h-4" />
                      <span className="text-sm">{uploadAttachmentFile.name}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setOpenUploadDialog(false)}
                  className="flex-1 px-6 py-3 bg-gray-400 text-white font-bold rounded-lg shadow hover:bg-gray-500 transition text-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (uploadLeaveId && uploadAttachmentFile) {
                      await handleUploadAttachment(uploadLeaveId);
                      setOpenUploadDialog(false);
                    }
                  }}
                  disabled={!uploadAttachmentFile}
                  className="flex-1 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg shadow hover:bg-cyan-700 transition text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Upload Attachment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeavesPage;
