import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Button,
    message,
    Modal
} from 'antd';
import { PlusOutlined, UserOutlined, ExclamationCircleOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import { Search, Filter, User, Building, Calendar, Clock, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';
import EmployeeForm from '../components/hrms/EmployeeFormNew';
import StatusModal from '../components/hrms/StatusModal';
import PasswordManagementModal from '../components/hrms/PasswordManagementModal';
import EmployeeDetails from './EmployeeDetails';
import { formatDate, formatDateTime, getISTTimestamp } from '../utils/dateUtils';
import useTabWithHistory from '../hooks/useTabWithHistory';
import useModalHistory from '../hooks/useModalHistory';
import useNavbarPageSearch from '../hooks/useNavbarPageSearch';

// Import both old and new permission systems for compatibility
import { hasPermission, getUserPermissions } from '../utils/permissions';
import {
    getPermissionLevel,
    canViewAll,
    canViewJunior,
    canCreate,
    canEdit,
    canDelete,
    getPermissionDisplayText,
    getCurrentUserId
} from '../utils/permissions';

import hrmsService from '../services/hrmsService';
import { getMediaUrl, getProfilePictureUrlWithCacheBusting } from '../utils/mediaUtils';
import OrgChartView from '../components/hrms/OrgChartView';

const { confirm } = Modal;

const SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b";

const isLoginEnabled = (employee) => {
    if (!employee) return false;
    const value = employee.login_enabled;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return true;
};

const isOtpRequired = (employee) => {
    if (!employee) return false;
    const value = employee.otp_required;
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    return false;
};

// Display helper: All Employees row data should be shown in capital letters,
// regardless of how older records were entered.
const toDisplayText = (value) => {
    if (value === null || value === undefined) return value;
    const str = String(value).trim();
    if (!str) return str;
    return str.toUpperCase();
};

// CSS Styles for the toggle switches
const toggleStyles = `
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    user-select: none;
  }
  
  .switch input[type="checkbox"] {
    appearance: none;
    width: 48px;
    height: 26px;
    border-radius: 9999px;
    background: #d73f3f;
    position: relative;
    box-shadow: inset 0 0 0 2px #2a2f36;
    transition: background 0.25s ease, box-shadow 0.25s ease;
    cursor: pointer;
  }
  
  .switch input[type="checkbox"]::before {
    content: "";
    position: absolute;
    width: 22px;
    height: 22px;
    left: 2px;
    top: 2px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    transition: transform 0.35s cubic-bezier(0.2,0.8,0.2,1), width 0.15s ease, height 0.15s ease;
  }
  
  .switch input[type="checkbox"]:active::before {
    width: 24px;
    height: 20px;
  }
  
  .switch input[type="checkbox"]:checked {
    background: #3fb950;
    box-shadow: inset 0 0 0 2px rgba(63,185,80,0.55), 0 0 12px rgba(63,185,80,0.35);
  }
  
  .switch input[type="checkbox"]:checked::before {
    transform: translateX(22px);
  }
  
  .switch .state {
    font-size: 0.9rem;
    min-width: 48px;
    font-weight: 600;
    letter-spacing: 0.2px;
  }
  
  .switch .state.on {
    color: #3fb950;
  }
  
  .switch .state.off {
    color: #d73f3f;
  }
  
  .switch .state.mixed {
    color: #58a6ff;
  }

  .switch.switch-mixed input[type="checkbox"] {
    background: #2563eb;
    box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.55), 0 0 10px rgba(37, 99, 235, 0.25);
  }

  .switch.switch-mixed input[type="checkbox"]::before {
    transform: translateX(11px);
    width: 18px;
  }
  
  /* Disabled toggle styles */
  .switch input[type="checkbox"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .switch input[type="checkbox"]:disabled::before {
    opacity: 0.5;
  }
  
  .switch:has(input:disabled) .state {
    opacity: 0.5;
    color: #6c757d !important;
  }
  
  .th-flex {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .tenure {
    color: #9ca3af;
    font-size: 0.85rem;
  }
  
  /* Sticky header styles */
  .sticky-header {
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .table-container {
    max-height: 70vh;
    overflow-y: auto;
    overflow-x: auto;
  }

  .hrms-employees-page .table-container {
    max-height: none;
  }
  
  /* Fixed widths for first 3 columns - NOT sticky, scroll away normally */
  .table-container table thead th:first-child,
  .table-container table tbody td:first-child {
    width: 50px;
    min-width: 50px;
  }
  
  .table-container table thead th:nth-child(2),
  .table-container table tbody td:nth-child(2) {
    width: 80px;
    min-width: 80px;
  }
  
  .table-container table thead th:nth-child(3),
  .table-container table tbody td:nth-child(3) {
    width: 110px;
    min-width: 110px;
  }
  
  /* Sticky fourth column (Employee Name) - dark theme under HRMS page */
  .hrms-employees-page .table-container table thead th:nth-child(4) {
    position: sticky !important;
    left: 0 !important;
    top: 0 !important;
    z-index: 30 !important;
    background: #ffffff !important;
    color: #03b0f5 !important;
    width: 200px;
    min-width: 200px;
  }
  
  .hrms-employees-page .table-container table tbody td:nth-child(4) {
    position: sticky !important;
    left: 0 !important;
    z-index: 2 !important;
    background: #000 !important;
    width: 200px;
    min-width: 200px;
  }
  
  /* Legacy sticky column for other pages */
  .table-container:not(.hrms-table-wrap) table thead th:nth-child(4) {
    position: sticky !important;
    left: 0 !important;
    top: 0 !important;
    background: white !important;
    width: 200px;
    min-width: 200px;
  }
  
  .table-container:not(.hrms-table-wrap) table tbody td:nth-child(4) {
    position: sticky !important;
    left: 0 !important;
    background: rgb(0, 0, 0) !important;
    width: 200px;
    min-width: 200px;
  }
  
  /* Uppercase styling for table data - exclude HRMS employees page */
  .table-container:not(.hrms-table-wrap) table tbody td {
    text-transform: uppercase !important;
  }
  
  .table-container:not(.hrms-table-wrap) table tbody td * {
    text-transform: uppercase !important;
  }
  
  .table-container:not(.hrms-table-wrap) table tbody td span {
    text-transform: uppercase !important;
  }
  
  .table-container:not(.hrms-table-wrap) table tbody td div {
    text-transform: uppercase !important;
  }
  
  /* Exclude certain elements that shouldn't be uppercase */
  .table-container table tbody td .switch .state,
  .table-container table tbody td button,
  .table-container table tbody td .tenure,
  .table-container table tbody td .state.on,
  .table-container table tbody td .state.off,
  .table-container table tbody td .state.mixed {
    text-transform: none !important;
  }
`;

const hrmsEmployeesPageStyles = `
  .hrms-employees-page { padding: 0; max-width: 100%; background: #000; height: calc(100vh - 64px); max-height: calc(100vh - 64px); overflow: hidden; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Lexend Deca', sans-serif; color: #e2e8f0; }
  .hrms-employees-page .task-top-bar { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 0; border-bottom: 1px solid #1f1f27; background: #000; flex-shrink: 0; }
  .hrms-employees-page .task-top-bar-left h1 { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0 0 2px; line-height: 1.2; }
  .hrms-employees-page .task-top-bar-left p { font-size: 13px; color: #6b7a99; margin: 0 0 12px; }
  .hrms-employees-page .task-top-bar-right { display: flex; gap: 8px; align-items: center; padding-top: 4px; flex-wrap: wrap; }
  .hrms-employees-page .task-btn-create { background: #3b82f6; color: #fff; border: none; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s; white-space: nowrap; }
  .hrms-employees-page .task-btn-create:hover { background: #2563eb; }
  .hrms-employees-page .task-btn-secondary { background: #1a1a24; color: #c8d0e0; border: 1px solid #2a2a3a; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s, border-color 0.15s; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; position: relative; }
  .hrms-employees-page .task-btn-secondary:hover { background: #22222e; border-color: #3a3a50; }
  .hrms-employees-page .task-btn-secondary.active-filter { background: #1e3a5f; border-color: #3b82f6; color: #93c5fd; }
  .hrms-employees-page .task-filter-badge { position: absolute; top: -6px; right: -6px; background: #3b82f6; color: #fff; font-size: 10px; font-weight: 700; border-radius: 10px; min-width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
  .hrms-employees-page .task-view-toggle-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 24px; background: #000; border-bottom: 1px solid #1f1f27; flex-wrap: wrap; flex-shrink: 0; }
  .hrms-employees-page .task-view-toggle-group { display: flex; gap: 0; flex-wrap: wrap; flex: 0 1 auto; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .hrms-employees-page .task-view-toggle-group::-webkit-scrollbar { display: none; }
  .hrms-employees-page .task-view-toggle-btn { padding: 12px 16px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #6b7a99; cursor: pointer; border-bottom: 3px solid transparent; transition: color 0.15s, border-color 0.15s; white-space: nowrap; }
  .hrms-employees-page .task-view-toggle-btn:hover { color: #c8d0e0; }
  .hrms-employees-page .task-view-toggle-btn.active { color: #f97316; font-weight: 800; border-bottom-color: #f97316; }
  .hrms-employees-page .task-search-box--in-bar { position: relative; width: 260px; min-width: 200px; flex-shrink: 0; }
  .hrms-employees-page .task-search-box--in-bar input { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; padding: 6px 32px 6px 32px; color: #c8d0e0; font-size: 13px; width: 100%; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
  .hrms-employees-page .task-search-box--in-bar input::placeholder { color: #4a5570; }
  .hrms-employees-page .task-search-box--in-bar input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .hrms-employees-page .task-search-box--in-bar .search-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: #4a5570; pointer-events: none; }
  .hrms-employees-page .task-search-box--in-bar .search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: #4a5570; background: none; border: none; cursor: pointer; padding: 2px; display: flex; align-items: center; }
  .hrms-employees-page .task-search-box--in-bar .search-clear:hover { color: #c8d0e0; }
  .hrms-employees-page .task-toolbar-right { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-left: auto; flex-shrink: 0; flex-wrap: wrap; }
  .hrms-employees-page .hrms-page-content { padding: 0 24px 24px; flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .hrms-employees-page .hrms-page-content--chart { padding: 0; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
  .hrms-employees-page .hrms-page-content--chart > * { flex: 1; min-height: 0; }
  .hrms-employees-page .hrms-table-outer { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .hrms-employees-page .hrms-table-wrap { flex: 1; min-height: 0; overflow: auto; max-height: none; border-top: 1px solid #1f1f27; background: #000; -webkit-overflow-scrolling: touch; }
  .hrms-employees-page .table-container.hrms-table-wrap { max-height: none; flex: 1; min-height: 0; }
  .hrms-employees-page .hrms-table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 1200px; text-align: left; }
  .hrms-employees-page .hrms-table thead { background: #ffffff; border-bottom: 2px solid #e5e7eb; position: relative; z-index: 20; }
  .hrms-employees-page .hrms-table-th { position: sticky; top: 0; z-index: 25; background: #ffffff !important; color: #03b0f5 !important; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 5px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; white-space: nowrap; box-shadow: 0 1px 0 #e5e7eb, 0 4px 8px rgba(0, 0, 0, 0.12); }
  .hrms-employees-page .hrms-table tbody { position: relative; z-index: 1; }
  .hrms-employees-page .hrms-table tbody td { padding: 5px 12px; font-size: 13px; color: #ffffff; font-weight: 600; vertical-align: middle; background: #000; text-transform: uppercase !important; position: relative; z-index: 1; white-space: nowrap; }
  .hrms-employees-page .hrms-table tbody tr.hrms-table-row { background: #000; border-bottom: 1px solid #2a2a38; cursor: pointer; transition: background 0.1s; }
  .hrms-employees-page .hrms-table tbody tr.hrms-table-row:hover td { background: #13131c; }
  .hrms-employees-page .hrms-table tbody td * { text-transform: uppercase !important; }
  .hrms-employees-page .hrms-table tbody td.hrms-name-cell { padding: 5px 12px; font-weight: 700; color: #ffffff; vertical-align: middle; }
  .hrms-employees-page .cell-name-wrap { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .hrms-employees-page .cell-avatar { width: 52px; height: 44px; border-radius: 4px; background: #1a1a24; border: 1px solid #2a2a3a; color: #93c5fd; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex-shrink: 0; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04); }
  .hrms-employees-page .cell-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 3px; display: block; }
  .hrms-employees-page .cell-avatar .cell-avatar-fallback { width: 100%; height: 100%; align-items: center; justify-content: center; }
  .hrms-employees-page .cell-name-text { min-width: 0; line-height: 1.3; }
  .hrms-employees-page .table-container table thead th:nth-child(4) { background: #ffffff !important; color: #03b0f5 !important; left: 0; z-index: 30 !important; box-shadow: 2px 0 4px rgba(0, 0, 0, 0.06), 0 4px 8px rgba(0, 0, 0, 0.12); }
  .hrms-employees-page .table-container table tbody td:nth-child(4) { background: #000 !important; z-index: 2 !important; }
  .hrms-employees-page .table-container table tbody tr:hover td:nth-child(4) { background: #13131c !important; }
  .hrms-employees-page .hrms-action-btn { background: #1a0a0a; color: #f87171; border: 1px solid #7f1d1d; border-radius: 3px; padding: 5px 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .hrms-employees-page .hrms-action-btn:hover:not(:disabled) { background: #2a0f0f; }
  .hrms-employees-page .hrms-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .hrms-employees-page .warning-scroll-btn { position: absolute; top: 50%; transform: translateY(-50%); z-index: 50; background: #1e3a5f; color: #fff; border: 1px solid #3b82f6; padding: 8px; border-radius: 50%; opacity: 0.35; transition: opacity 0.15s; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .hrms-employees-page .warning-scroll-btn:hover { opacity: 1; }
  .hrms-employees-page .warning-scroll-btn.left { left: 8px; }
  .hrms-employees-page .warning-scroll-btn.right { right: 8px; }
  .hrms-employees-page .task-loading-spinner { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; }
  .hrms-employees-page .task-loading-spinner .spinner { width: 32px; height: 32px; border: 3px solid #1a1a24; border-top-color: #3b82f6; border-radius: 50%; animation: hrmsSpin 0.7s linear infinite; margin-bottom: 12px; }
  .hrms-employees-page .task-loading-spinner p { color: #6b7a99; font-size: 14px; margin: 0; }
  .hrms-employees-page .task-empty-state { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; text-align: center; }
  .hrms-employees-page .task-empty-state-title { font-size: 17px; font-weight: 700; color: #c8d0e0; margin: 0 0 6px; }
  .hrms-employees-page .task-empty-state-sub { font-size: 14px; color: #4a5570; margin: 0; }
  @keyframes hrmsSpin { to { transform: rotate(360deg); } }
`;

// Add styles to head
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = toggleStyles;
    document.head.appendChild(styleSheet);
}

// ── Standalone popup shown after employee creation ────────────────────────────
function CreatedEmpPopup({ data, onClose }) {
    const [copied, setCopied] = React.useState(false);

    const allText = [
        `Employee Name: ${data.name}`,
        `Employee ID: ${data.empId}`,
        `Phone: ${data.phone}`,
        `Department: ${data.department}`,
        `Role: ${data.role}`,
        `Designation: ${data.designation}`,
        `Monthly Target: ${data.monthlyTarget}`,
        `Username: ${data.username}`,
        `Password: ${data.password}`,
        `Login URL: ${data.loginUrl}`,
    ].join('\n');

    const handleCopy = async () => {
        let success = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(allText);
                success = true;
            } catch (_) { /* fall through */ }
        }
        if (!success) {
            const ta = document.createElement('textarea');
            ta.value = allText;
            ta.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;opacity:0;z-index:999999;';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try { success = document.execCommand('copy'); } catch (_) { }
            document.body.removeChild(ta);
        }
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } else {
            alert('Copy failed — please select the text and press Ctrl+C.');
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
            onClick={onClose}>
            <div style={{ background: '#0d1117', border: '1px solid #1e3a4a', borderRadius: '12px', width: '100%', maxWidth: '420px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #1e2d3d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#03b0f5', fontWeight: 800, fontSize: '15px' }}>✅ Employee Created</span>
                    <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>

                {/* Text block — click anywhere to copy */}
                <div onClick={handleCopy} title="Click to copy"
                    style={{ margin: '14px 20px', background: '#0a1929', border: '1px solid #1e3a4a', borderRadius: '8px', padding: '14px 16px', cursor: 'pointer', userSelect: 'none', lineHeight: '2' }}>
                    {[
                        ['Employee Name', data.name],
                        ['Employee ID', data.empId],
                        ['Phone', data.phone],
                        ['Department', data.department],
                        ['Role', data.role],
                        ['Designation', data.designation],
                        ['Monthly Target', data.monthlyTarget],
                        ['Username', data.username],
                        ['Password', data.password],
                        ['Login URL', data.loginUrl],
                    ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', gap: '8px', fontSize: '13px' }}>
                            <span style={{ color: '#5a7a8a', minWidth: '110px', flexShrink: 0 }}>{k}:</span>
                            <span style={{ color: k === 'Password' ? '#fbbf24' : '#e6edf3', fontWeight: 600, fontFamily: k === 'Password' || k === 'Username' ? 'monospace' : 'inherit' }}>{v}</span>
                        </div>
                    ))}
                    <div style={{ marginTop: '10px', textAlign: 'center', color: '#1e4060', fontSize: '11px' }}>click to copy all</div>
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid #1e2d3d', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={handleCopy}
                        style={{
                            background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(3,176,245,0.12)',
                            border: `1px solid ${copied ? '#22c55e' : '#03b0f5'}`,
                            color: copied ? '#22c55e' : '#03b0f5',
                            padding: '8px 18px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                            transition: 'all 0.2s'
                        }}>
                        {copied ? '✅ Copied!' : '📋 Copy All'}
                    </button>
                    <button type="button" onClick={onClose}
                        style={{ background: '#03b0f5', border: 'none', color: '#000', padding: '8px 22px', borderRadius: '7px', cursor: 'pointer', fontWeight: 800, fontSize: '13px' }}>
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

const AllEmployees = () => {
    const [activeTab, setActiveTab] = useTabWithHistory('status', 'active', { localStorageKey: 'allEmployeesTab' });
    const [employees, setEmployees] = useState([]);
    const [employeeCounts, setEmployeeCounts] = useState({ active: 0, inactive: 0 });
    const [orgChartSyncVersion, setOrgChartSyncVersion] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    useNavbarPageSearch(setSearchTerm);

    // Filter popup states (matching LeadCRM structure) - Enhanced for multiple selections
    const [showFilterPopup, setShowFilterPopup] = useState(false);
    const [selectedFilterCategory, setSelectedFilterCategory] = useState('department');
    const [selectedDepartments, setSelectedDepartments] = useState([]);
    const [selectedDesignations, setSelectedDesignations] = useState([]);
    const [selectedRoles, setSelectedRoles] = useState([]);

    // Search states for filter options
    const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
    const [designationSearchTerm, setDesignationSearchTerm] = useState('');
    const [roleSearchTerm, setRoleSearchTerm] = useState('');

    // Filter options from settings
    const [allDepartments, setAllDepartments] = useState([]);
    const [allRoles, setAllRoles] = useState([]);
    const [allDesignations, setAllDesignations] = useState([]);
    const [filterDataLoading, setFilterDataLoading] = useState(false);
    const [lockedRoleIds, setLockedRoleIds] = useState([]); // roles hidden from this user per Lock Role config

    const [loading, setLoading] = useState(false);
    const [formVisible, setFormVisible] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedEmployeeForDetails, setSelectedEmployeeForDetails] = useState(null);
    
    // Browser back button closes employee detail view
    useModalHistory(!!selectedEmployeeForDetails, () => setSelectedEmployeeForDetails(null));

    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [onboardingModalVisible, setOnboardingModalVisible] = useState(false);
    const [statusModalLoading, setStatusModalLoading] = useState(false);
    const [passwordModalVisible, setPasswordModalVisible] = useState(false);
    const [selectedEmployeeForPassword, setSelectedEmployeeForPassword] = useState(null);
    const [formKey, setFormKey] = useState(Date.now()); // Add key to force form refresh
    const [masterStatusState, setMasterStatusState] = useState({ checked: false, label: 'Off' });
    const [masterAccessState, setMasterAccessState] = useState({ checked: false, label: 'Off' });
    const [masterOTPState, setMasterOTPState] = useState({ checked: false, label: 'Off' });
    const [createdEmpPopup, setCreatedEmpPopup] = useState(null); // custom popup after employee creation

    // Inactive date picker modal
    const [inactiveDateModal, setInactiveDateModal] = useState({ visible: false, employee: null, date: '' });

    // Add department and role mapping states
    const [departments, setDepartments] = useState({});
    const [roles, setRoles] = useState({});
    const [departmentsLoading, setDepartmentsLoading] = useState(false);

    // Table horizontal scroll controls
    const tableScrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // State for custom confirmation modal
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        title: '',
        content: '',
        onOk: null,
        onCancel: null,
        loading: false
    });

    // Scroll functions for horizontal table navigation
    const updateScrollButtons = useCallback(() => {
        if (tableScrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
        }
    }, []);

    const scrollTable = useCallback((direction) => {
        if (tableScrollRef.current) {
            const scrollAmount = 300;
            tableScrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
            setTimeout(updateScrollButtons, 100);
        }
    }, [updateScrollButtons]);

    // Custom confirmation function
    const showConfirm = (config) => {
        setConfirmModal({
            visible: true,
            title: config.title || 'Confirm',
            content: config.content || 'Are you sure?',
            onOk: async () => {
                setConfirmModal(prev => ({ ...prev, loading: true }));
                try {
                    if (config.onOk) {
                        await config.onOk();
                    }
                } catch (error) {
                    console.error('❌ Error in confirm modal OK handler:', error);
                } finally {
                    // Always close the modal after OK action
                    setConfirmModal({
                        visible: false,
                        title: '',
                        content: '',
                        onOk: null,
                        onCancel: null,
                        loading: false
                    });
                }
            },
            onCancel: () => {
                if (config.onCancel) {
                    config.onCancel();
                }
                // Close the modal after Cancel action
                setConfirmModal({
                    visible: false,
                    title: '',
                    content: '',
                    onOk: null,
                    onCancel: null,
                    loading: false
                });
            },
            loading: false
        });
    };

    // Simplified permission checking using new 3-type system
    const permissionLevel = getPermissionLevel('employees');
    const currentUserId = getCurrentUserId();

    // Permission check functions  
    const canUserViewAll = () => canViewAll('employees');
    const canUserViewJunior = () => canViewJunior('employees');
    const canUserCreate = () => canCreate('employees');
    const canUserEdit = (recordOwnerId) => canEdit('employees', recordOwnerId);
    const canUserDelete = (recordOwnerId) => canDelete('employees', recordOwnerId);
    const canResetPassword = () => hasPermission(getUserPermissions(), 'employees', 'reset_password');
    const canAddEmployee = () => hasPermission(getUserPermissions(), 'employees', 'add_employee');

    // Debug permissions
    const debugPerms = {
        canViewAll: canUserViewAll(),
        canViewJunior: canUserViewJunior(),
        canEdit: canUserEdit()
    };

    const canEditEmployees = canUserEdit() || canUserViewJunior() || canUserViewAll();

    // Load employees based on active tab (skip for chart view — OrgChartView fetches its own data)
    useEffect(() => {
        if (activeTab !== 'chart') {
            fetchEmployees();
        }
    }, [activeTab]);

    // Load departments and roles on component mount
    useEffect(() => {
        fetchDepartmentsAndRoles();
        fetchFilterData(); // Load filter data for the popup
    }, []);

    // Set up scroll listener for table navigation buttons
    useEffect(() => {
        updateScrollButtons();
        const tableContainer = tableScrollRef.current;
        if (tableContainer) {
            tableContainer.addEventListener('scroll', updateScrollButtons);
            return () => {
                tableContainer.removeEventListener('scroll', updateScrollButtons);
            };
        }
    }, [updateScrollButtons]);

    // Update scroll buttons when employees data changes
    useEffect(() => {
        setTimeout(updateScrollButtons, 100);
    }, [employees, updateScrollButtons]);

    const fetchDepartmentsAndRoles = async () => {
        setDepartmentsLoading(true);
        try {
            // Fetch departments and roles in parallel
            const [deptResponse, roleResponse] = await Promise.all([
                hrmsService.getDepartments(),
                hrmsService.getRoles()
            ]);

            console.log('🏢 Raw departments response:', deptResponse);
            console.log('👥 Raw roles response:', roleResponse);

            // Create lookup objects for quick access
            const departmentLookup = {};
            const roleLookup = {};

            if (deptResponse && deptResponse.data) {
                deptResponse.data.forEach(dept => {
                    departmentLookup[dept._id] = dept.name;
                });
            }

            if (roleResponse && roleResponse.data) {
                roleResponse.data.forEach(role => {
                    // Handle both _id and id field names for roles
                    const roleId = role._id || role.id;
                    if (roleId) {
                        roleLookup[roleId] = role.name;
                    }
                });
            }

            setDepartments(departmentLookup);
            setRoles(roleLookup);

            console.log('📋 Loaded departments lookup:', departmentLookup);
            console.log('👥 Loaded roles lookup:', roleLookup);
            console.log('🔍 Total departments loaded:', Object.keys(departmentLookup).length);
            console.log('🔍 Total roles loaded:', Object.keys(roleLookup).length);
        } catch (error) {
            console.error('❌ Error fetching departments and roles:', error);
            message.error('Failed to load departments and roles');
        } finally {
            setDepartmentsLoading(false);
        }
    };

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            // Get all employees using the working API
            const response = await hrmsService.getAllEmployees();

            if (!response || !response.data) {
                console.error('❌ Invalid response from getAllEmployees:', response);
                setEmployees([]);
                return;
            }

            // Process all employees first to normalize their status
            const allEmployeesProcessed = response.data.map(employee => {
                // Default to active unless explicitly set to inactive
                const isExplicitlyInactive = employee.employee_status === false ||
                    employee.employee_status === 'false' ||
                    employee.employee_status === 'inactive' ||
                    employee.employee_status === 'Inactive' ||
                    employee.employee_status === 0 ||
                    employee.employee_status === '0';

                const normalizedStatus = isExplicitlyInactive ? 'inactive' : 'active';

                // Debug log employee data
                console.log(`👤 Employee ${employee.first_name} ${employee.last_name}:`, {
                    department_id: employee.department_id,
                    role_id: employee.role_id,
                    department_name: employee.department_name,
                    role_name: employee.role_name,
                    designation: employee.designation,
                    position: employee.position
                });

                return {
                    ...employee,
                    employee_status: normalizedStatus,
                    department_name: employee.department_name || '-',
                    role_name: employee.role_name || '-',
                    login_enabled: isLoginEnabled(employee),
                    otp_required: isOtpRequired(employee),
                };
            });

            // Filter based on the active tab
            const filteredEmployees = allEmployeesProcessed.filter(employee => {
                if (activeTab === 'active') {
                    return employee.employee_status === 'active';
                } else if (activeTab === 'inactive') {
                    return employee.employee_status === 'inactive';
                }
                return true; // Show all if no specific tab
            });

            // Sort employees: RM007 first, then others by numeric part of employee_id ascending
            const sortedEmployees = filteredEmployees.sort((a, b) => {
                const aId = String(a.employee_id || '');
                const bId = String(b.employee_id || '');

                // RM007 always first
                const aIsRM007 = aId.toUpperCase() === 'RM007';
                const bIsRM007 = bId.toUpperCase() === 'RM007';
                if (aIsRM007 && !bIsRM007) return -1;
                if (!aIsRM007 && bIsRM007) return 1;

                // Extract numeric part (e.g. "RM012" → 12) for correct numeric ordering
                const aNum = parseInt(aId.replace(/[^0-9]/g, ''), 10) || 0;
                const bNum = parseInt(bId.replace(/[^0-9]/g, ''), 10) || 0;
                return aNum - bNum;
            });

            // Always update counts from full dataset regardless of which tab is active
            setEmployeeCounts({
                active: allEmployeesProcessed.filter(e => e.employee_status === 'active').length,
                inactive: allEmployeesProcessed.filter(e => e.employee_status === 'inactive').length,
            });
            setEmployees(sortedEmployees);
            recomputeMasterStates(sortedEmployees);
        } catch (error) {
            console.error('❌ Error fetching employees:', error);
            message.error('Failed to fetch employees. Please check your connection.');
            setEmployees([]);
            recomputeMasterStates([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch filter data from settings (departments, roles, designations)
    const fetchFilterData = async () => {
        try {
            setFilterDataLoading(true);
            console.log('📋 AllEmployees: Fetching filter data from settings...');

            const [departmentsRes, rolesRes, designationsRes] = await Promise.all([
                hrmsService.getDepartments(),
                hrmsService.getRoles(),
                hrmsService.getDesignations()
            ]);

            console.log('📋 AllEmployees: Raw departments response:', departmentsRes);
            console.log('📋 AllEmployees: Raw roles response:', rolesRes);
            console.log('📋 AllEmployees: Raw designations response:', designationsRes);

            // Process departments
            if (departmentsRes && departmentsRes.success && departmentsRes.data) {
                let departments;
                if (Array.isArray(departmentsRes.data)) {
                    // Handle array of strings or objects
                    departments = departmentsRes.data
                        .map(dept => {
                            if (typeof dept === 'string') return dept;
                            if (typeof dept === 'object') return dept.name || dept.department_name || dept.value;
                            return null;
                        })
                        .filter(dept => dept && dept.trim() !== '')
                        .sort();
                } else {
                    console.warn('📋 AllEmployees: Departments data is not an array:', departmentsRes.data);
                    departments = [];
                }
                setAllDepartments(departments);
                console.log('📋 AllEmployees: Processed departments:', departments);
            } else {
                console.warn('📋 AllEmployees: No departments data received:', departmentsRes);
                setAllDepartments([]);
            }

            // Process roles
            if (rolesRes && rolesRes.success && rolesRes.data) {
                const rawRolesData = Array.isArray(rolesRes.data) ? rolesRes.data : [];

                // --- Lock Role: find current user's role and extract its locked_roles ---
                try {
                    const rawUserData = localStorage.getItem('userData');
                    if (rawUserData) {
                        const parsedUser = JSON.parse(rawUserData);
                        const currentUserRoleId = parsedUser.role_id || parsedUser.role?._id || parsedUser.role?.id;
                        const userPerms = getUserPermissions();
                        const isSA = Array.isArray(userPerms) && userPerms.some(p => p.page === '*');
                        if (currentUserRoleId && !isSA) {
                            const currentUserRole = rawRolesData.find(r => typeof r === 'object' && (String(r._id || r.id) === String(currentUserRoleId)));
                            if (currentUserRole?.locked_roles?.length) {
                                // Normalize to plain strings to avoid ObjectId mismatch
                                setLockedRoleIds(currentUserRole.locked_roles.map(id => String(id)));
                            }
                        }
                    }
                } catch (_) { }
                // --- end Lock Role ---

                let roles;
                if (rawRolesData.length > 0) {
                    // Handle array of strings or objects
                    roles = rawRolesData
                        .map(role => {
                            if (typeof role === 'string') return role;
                            if (typeof role === 'object') return role.role_name || role.name || role.value;
                            return null;
                        })
                        .filter(role => role && role.trim() !== '')
                        .sort();
                } else {
                    console.warn('📋 AllEmployees: Roles data is not an array:', rolesRes.data);
                    roles = [];
                }
                setAllRoles(roles);
                console.log('📋 AllEmployees: Processed roles:', roles);
            } else {
                console.warn('📋 AllEmployees: No roles data received:', rolesRes);
                setAllRoles([]);
            }

            // Process designations
            if (designationsRes && designationsRes.success && designationsRes.data) {
                let designations;
                if (Array.isArray(designationsRes.data)) {
                    // Handle array of strings or objects
                    designations = designationsRes.data
                        .map(designation => {
                            if (typeof designation === 'string') return designation;
                            if (typeof designation === 'object') return designation.name || designation.designation_name || designation.value;
                            return null;
                        })
                        .filter(designation => designation && designation.trim() !== '')
                        .sort();
                } else {
                    console.warn('📋 AllEmployees: Designations data is not an array:', designationsRes.data);
                    designations = [];
                }
                setAllDesignations(designations);
                console.log('📋 AllEmployees: Processed designations:', designations);
            } else {
                console.warn('📋 AllEmployees: No designations data received:', designationsRes);
                setAllDesignations([]);
            }

        } catch (error) {
            console.error('📋 AllEmployees: Error fetching filter data:', error);
            // Set empty arrays on error to prevent UI issues
            setAllDepartments([]);
            setAllRoles([]);
            setAllDesignations([]);
        } finally {
            setFilterDataLoading(false);
        }
    };

    const handleTabChange = (key) => {
        setActiveTab(key);
    };

    // Get complete filter options from settings (not just current employee data)
    const getFilterOptions = (category) => {
        switch (category) {
            case 'department':
                return allDepartments;
            case 'designation':
                return allDesignations;
            case 'role':
                return allRoles;
            default:
                return [];
        }
    };

    // Get total active filter count (updated for multiple selections)
    const getActiveFilterCount = () => {
        let count = 0;
        if (selectedDepartments.length > 0) count += selectedDepartments.length;
        if (selectedDesignations.length > 0) count += selectedDesignations.length;
        if (selectedRoles.length > 0) count += selectedRoles.length;
        return count;
    };

    // Get filter count for specific category (updated for multiple selections)
    const getFilterCategoryCount = (category) => {
        switch (category) {
            case 'department':
                return selectedDepartments.length;
            case 'designation':
                return selectedDesignations.length;
            case 'role':
                return selectedRoles.length;
            default:
                return 0;
        }
    };

    // Clear all filters (updated for multiple selections)
    const clearAllFilters = () => {
        setSearchTerm('');
        setSelectedDepartments([]);
        setSelectedDesignations([]);
        setSelectedRoles([]);
        setDepartmentSearchTerm('');
        setDesignationSearchTerm('');
        setRoleSearchTerm('');
        setShowFilterPopup(false);
    };

    const handleRowClick = (employee, e) => {
        // Prevent row click when clicking on action buttons or toggles
        if (e.target.closest('button') ||
            e.target.closest('.action-button') ||
            e.target.closest('.switch') ||
            e.target.closest('input[type="checkbox"]') ||
            e.target.classList.contains('toggle-active') ||
            e.target.classList.contains('toggle-access') ||
            e.target.classList.contains('toggle-otp')) {
            return;
        }

        // Block opening details for employees whose role is locked for this user
        if (lockedRoleIds.length > 0 && lockedRoleIds.includes(String(employee.role_id || ''))) {
            message.error('🔒 This employee\'s role is locked. You cannot view their details.');
            return;
        }

        // Since the /users/ API returns complete data, we can use it directly
        setSelectedEmployeeForDetails(employee);
    };

    const handleBackToTable = () => {
        setSelectedEmployeeForDetails(null);
    };

    const showEmployeeForm = (employee = null) => {
        setSelectedEmployee(employee);
        setFormVisible(true);
        // Refresh form key to force re-rendering and ID regeneration for new employees
        if (!employee) {
            setFormKey(Date.now());
        }
    };

    const handleFormCancel = () => {
        setFormVisible(false);
        setSelectedEmployee(null);
    };

    const handleFormSubmit = async (values, photoFile) => {
        setFormLoading(true);
        try {
            // Ensure new employees are created with active status by default
            const employeeData = {
                ...values,
                employee_status: values.employee_status || 'active' // Default to active if not specified
            };

            let response;
            let employeeId;

            // Create or update employee using updated APIs
            if (selectedEmployee) {
                // Update existing employee
                response = await hrmsService.updateEmployee(selectedEmployee._id, employeeData);
                employeeId = selectedEmployee._id;

                // Show success message and popup for updates
                message.success('Employee updated successfully');

                // Show detailed success modal for updates
                Modal.success({
                    title: 'Employee Updated Successfully',
                    content: (
                        <div>
                            <p>The employee data has been updated successfully.</p>
                            <p><strong>Employee:</strong> {employeeData.first_name} {employeeData.last_name}</p>
                            <p><strong>Employee ID:</strong> {employeeData.employee_id ? employeeData.employee_id : 'N/A'}</p>
                            {photoFile && <p><strong>Profile picture:</strong> Updated</p>}
                        </div>
                    ),
                    okText: 'OK',
                    centered: true
                });

                // Upload photo separately if provided for updates
                if (photoFile && employeeId) {
                    await hrmsService.uploadEmployeePhoto(employeeId, photoFile);
                    message.success('Profile photo updated successfully');
                    // Refresh employee list to show updated profile photo
                    await fetchEmployees();
                    // Refresh navbar profile photo if it's the current user
                    if (window.refreshNavbarProfilePhoto) {
                        await window.refreshNavbarProfilePhoto();
                    }
                }
            } else {
                // Create new employee
                response = await hrmsService.createEmployee(employeeData);
                // hrmsService wraps axios response as { data: axiosResp } so actual JSON is at response.data.data
                const responseBody = response.data?.data || response.data || {};
                employeeId = responseBody._id || responseBody.id || response.data?.id || response.data?._id;

                // Upload photo if provided
                if (photoFile && employeeId) {
                    await hrmsService.uploadEmployeePhoto(employeeId, photoFile);
                    if (window.refreshNavbarProfilePhoto) {
                        await window.refreshNavbarProfilePhoto();
                    }
                }

                // Close form first so user sees the table immediately
                setFormVisible(false);
                setSelectedEmployee(null);
                setFormKey(Date.now());

                // Refresh employee list — new employee appears in table right away
                await fetchEmployees();

                // Resolve display names for the popup
                const empResData = response.data?.data || response.data || {};
                const empName = `${employeeData.first_name || ''} ${employeeData.last_name || ''}`.trim();
                // employee_id is auto-assigned by backend — read from API response, then fall back to finding in refreshed list
                const resolvedEmpId = empResData.employee_id
                    || employees.find(e => String(e._id || e.id) === String(employeeId))?.employee_id
                    || '';
                const deptName = departments[employeeData.department_id] || employeeData.department_id || '—';
                const roleName = roles[employeeData.role_id] || employeeData.role_id || '—';

                // Show the custom creation success popup
                setCreatedEmpPopup({
                    name: empName || '—',
                    empId: resolvedEmpId ? resolvedEmpId : '—',
                    phone: employeeData.phone || '—',
                    department: deptName,
                    role: roleName,
                    designation: employeeData.designation || '—',
                    monthlyTarget: employeeData.monthly_target || '—',
                    username: employeeData.username || '—',
                    password: employeeData.password || '—',
                    loginUrl: window.location.origin,
                });

                return response;
            }

            // Close form and refresh data (for updates)
            setFormVisible(false);
            setSelectedEmployee(null);
            setFormKey(Date.now());
            await fetchEmployees();

            return response;
        } catch (error) {
            console.error('❌ Error submitting employee form:', error);
            console.error('❌ Error details:', error.message);
            console.error('❌ Error stack:', error.stack);

            // Show detailed error message
            if (error.message) {
                message.error(`Failed to save employee: ${error.message}`);
            } else {
                message.error('Failed to save employee data. Please check the console for details.');
            }
            throw error;
        } finally {
            setFormLoading(false);
        }
    };

    const showStatusModal = (employee) => {
        setSelectedEmployee(employee);
        setStatusModalVisible(true);
    };

    const showOnboardingModal = (employee) => {
        setSelectedEmployee(employee);
        setOnboardingModalVisible(true);
    };

    const handleStatusUpdate = async (values) => {
        setStatusModalLoading(true);
        try {
            // Ensure the status is properly formatted for the API
            const statusValue = values.status === 'active' ? 'active' : 'inactive';

            await hrmsService.updateEmployeeStatus(
                selectedEmployee._id,
                statusValue,
                values.remark
            );

            message.success('Employee status updated successfully');
            setStatusModalVisible(false);
            fetchEmployees();
        } catch (error) {
            console.error('Error updating status:', error);
            message.error('Failed to update employee status');
        } finally {
            setStatusModalLoading(false);
        }
    };

    // Temporary function to test inactive employees - you can call this from browser console
    const testInactiveEmployees = async () => {
        try {
            const response = await hrmsService.getEmployees('all');
            const employees = response.data;

            // Set first employee to inactive for testing
            if (employees.length > 0) {
                await hrmsService.updateEmployeeStatus(employees[0]._id, 'inactive', 'Testing inactive status');
                fetchEmployees();
            }
        } catch (error) {
            console.error('Error testing inactive employees:', error);
        }
    };

    // Make the test function available globally for testing
    window.testInactiveEmployees = testInactiveEmployees;

    const handleOnboardingUpdate = async (values) => {
        setStatusModalLoading(true);
        try {
            await hrmsService.updateOnboardingStatus(
                selectedEmployee._id,
                values.status,
                values.remark
            );

            message.success('Onboarding status updated successfully');
            setOnboardingModalVisible(false);
            fetchEmployees();
        } catch (error) {
            console.error('Error updating onboarding status:', error);
            message.error('Failed to update onboarding status');
        } finally {
            setStatusModalLoading(false);
        }
    };

    const handlePasswordManagement = (employee) => {
        setSelectedEmployeeForPassword(employee);
        setPasswordModalVisible(true);
    };

    const handlePasswordModalClose = () => {
        setPasswordModalVisible(false);
        setSelectedEmployeeForPassword(null);
    };

    const handlePasswordUpdateSuccess = () => {
        // Refresh employee list if needed
        fetchEmployees();
    };

    const handleOTPRequiredChange = async (employee, otpRequired) => {
        const employeeId = employee._id;

        try {
            // Update OTP requirement via API
            await hrmsService.updateOTPRequired(employeeId, otpRequired);

            // Log activity for OTP requirement change
            await hrmsService.logEmployeeActivity(employeeId, {
                action: otpRequired ? 'otp_enabled' : 'otp_disabled',
                description: `OTP requirement ${otpRequired ? 'enabled' : 'disabled'}`,
                timestamp: getISTTimestamp()
            });

            // Show toast notification
            message.success(`OTP requirement ${otpRequired ? 'enabled' : 'disabled'} successfully`);

            // Update local state without fetching all employees again
            // This preserves scroll position and prevents page reload
            setEmployees(prevEmployees =>
                prevEmployees.map(emp =>
                    emp._id === employeeId
                        ? { ...emp, otp_required: otpRequired }
                        : emp
                )
            );
        } catch (error) {
            console.error('Error updating OTP requirement:', error);
            message.error('Failed to update OTP requirement');
        }
    };

    const handleDeleteEmployee = async (employee) => {
        try {
            // Check if employee is Super Admin - prevent deletion
            const SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b";
            if (employee.role_id === SUPER_ADMIN_ROLE_ID) {
                message.error('Cannot delete Super Admin employees!');
                return;
            }

            // For testing - let's try without confirmation first
            if (window.confirm(`Are you sure you want to delete ${employee.first_name} ${employee.last_name}?`)) {

                setLoading(true);

                try {
                    // Try to delete the employee
                    const result = await hrmsService.deleteEmployee(employee._id);

                    // Update local state immediately
                    setEmployees(prevEmployees => {
                        const newEmployees = prevEmployees.filter(emp => emp._id !== employee._id);
                        return newEmployees;
                    });

                    message.success('Employee deleted successfully!');

                } catch (deleteError) {

                    // Fallback: Set employee status to inactive
                    await hrmsService.updateEmployeeStatus(employee._id, 'inactive', 'Employee marked as deleted');

                    // Update local state to remove from active list
                    setEmployees(prevEmployees => {
                        const newEmployees = prevEmployees.filter(emp => emp._id !== employee._id);
                        return newEmployees;
                    });

                    message.success('Employee marked as inactive (deleted) successfully!');
                }
            }

        } catch (error) {
            console.error('❌ Error deleting employee:', error);
            console.error('❌ Error response:', error.response);
            console.error('❌ Error data:', error.response?.data);

            if (error.response?.status === 403) {
                message.error('You do not have permission to delete employees');
            } else if (error.response?.status === 404) {
                message.error('Employee not found');
            } else {
                message.error('Failed to delete employee: ' + (error.response?.data?.detail || error.message));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLoginEnabledChange = async (employee, isEnabled) => {
        const employeeId = employee._id;

        // 🔒 Super Admin Protection: Never allow toggling Super Admin users
        if (employee.role_id === SUPER_ADMIN_ROLE_ID) {
            message.error('⛔ Cannot modify login access for Super Admin users!');
            return;
        }

        try {
            // Update login enabled via API
            await hrmsService.updateLoginEnabled(employeeId, isEnabled);
            console.log('Login enabled updated to:', isEnabled);
            // If login is disabled, cascade disable OTP requirement only (not employee status)
            const shouldDisableOtp = !isEnabled && isOtpRequired(employee);
            if (shouldDisableOtp) {
                await hrmsService.updateOTPRequired(employeeId, false);
                await hrmsService.logEmployeeActivity(employeeId, {
                    action: 'otp_disabled',
                    description: 'OTP requirement disabled due to login access removal',
                    timestamp: getISTTimestamp()
                });
            }

            // Log activity for login status change
            await hrmsService.logEmployeeActivity(employeeId, {
                action: isEnabled ? 'login_enabled' : 'login_disabled',
                description: `Login access ${isEnabled ? 'enabled' : 'disabled'}`,
                timestamp: getISTTimestamp()
            });

            // Show toast notification
            message.success(`Login access ${isEnabled ? 'enabled' : 'disabled'} successfully`);

            // Update local state without fetching all employees again
            // This preserves scroll position and prevents page reload
            setEmployees(prevEmployees =>
                prevEmployees.map(emp =>
                    emp._id === employeeId
                        ? {
                            ...emp,
                            login_enabled: isEnabled,
                            ...(shouldDisableOtp ? { otp_required: false } : {}),
                        }
                        : emp
                )
            );
        } catch (error) {
            console.error('Error updating login access:', error);
            message.error('Failed to update login access');
        }
    };

    const handleEmployeeStatusChange = async (employee, isActive) => {
        const newStatus = isActive ? 'active' : 'inactive';
        const employeeId = employee._id;

        // 🔒 Super Admin Protection: Never allow toggling Super Admin users
        if (employee.role_id === SUPER_ADMIN_ROLE_ID) {
            message.error('⛔ Cannot modify status for Super Admin users!');
            return;
        }

        // When marking inactive, ask for the date first
        if (!isActive) {
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            setInactiveDateModal({ visible: true, employee, date: todayStr });
            return;
        }

        await _doStatusUpdate(employee, isActive, null);
    };

    const _doStatusUpdate = async (employee, isActive, inactiveFromDate) => {
        const newStatus = isActive ? 'active' : 'inactive';
        const employeeId = employee._id;

        try {
            // Update status via API
            await hrmsService.updateEmployeeStatus(employeeId, newStatus, `Status changed to ${newStatus}`, inactiveFromDate);

            // If status is set to inactive, cascade disable login and OTP
            if (!isActive) {
                // Disable login if it was enabled
                if (isLoginEnabled(employee)) {
                    await hrmsService.updateLoginEnabled(employeeId, false);
                    await hrmsService.logEmployeeActivity(employeeId, {
                        action: 'login_disabled',
                        description: 'Login access disabled due to inactive status',
                        timestamp: getISTTimestamp()
                    });
                }

                // Disable OTP requirement if it was enabled
                if (isOtpRequired(employee)) {
                    await hrmsService.updateOTPRequired(employeeId, false);
                    await hrmsService.logEmployeeActivity(employeeId, {
                        action: 'otp_disabled',
                        description: 'OTP requirement disabled due to inactive status',
                        timestamp: getISTTimestamp()
                    });
                }
            }

            // Log activity for employee status change
            await hrmsService.logEmployeeActivity(employeeId, {
                action: isActive ? 'status_activated' : 'status_deactivated',
                description: `Employee status changed to ${newStatus}`,
                timestamp: getISTTimestamp()
            });

            // Show toast notification
            message.success(`Employee status updated to ${newStatus}`);

            setEmployeeCounts(prev => ({
                active: isActive ? prev.active + 1 : Math.max(0, prev.active - 1),
                inactive: isActive ? Math.max(0, prev.inactive - 1) : prev.inactive + 1,
            }));
            setOrgChartSyncVersion(v => v + 1);

            // Update local state without fetching all employees again
            // This preserves scroll position and prevents page reload
            if (newStatus === activeTab) {
                // Employee stays in current tab - update their status
                setEmployees(prevEmployees =>
                    prevEmployees.map(emp =>
                        emp._id === employeeId
                            ? {
                                ...emp,
                                employee_status: newStatus,
                                ...(!isActive ? { login_enabled: false, otp_required: false } : {}),
                            }
                            : emp
                    )
                );
            } else {
                // Employee moves to different tab - remove from current view
                // This removes the row without affecting scroll position
                setEmployees(prevEmployees =>
                    prevEmployees.filter(emp => emp._id !== employeeId)
                );
            }
        } catch (error) {
            console.error('Error updating status:', error);
            message.error('Failed to update employee status');
        }
    };

    // Compute master status state (only on full fetch / bulk actions — not per-row toggles)
    const computeMasterStatusState = (employeeList = employees) => {
        const nonSuperAdminEmployees = employeeList.filter(emp => emp.role_id !== SUPER_ADMIN_ROLE_ID);

        if (nonSuperAdminEmployees.length === 0) {
            setMasterStatusState({ checked: false, label: 'Off' });
            return;
        }

        const activeCount = nonSuperAdminEmployees.filter(emp => emp.employee_status === 'active').length;

        if (activeCount === 0) {
            setMasterStatusState({ checked: false, label: 'Off' });
        } else if (activeCount === nonSuperAdminEmployees.length) {
            setMasterStatusState({ checked: true, label: 'On' });
        } else {
            setMasterStatusState({ checked: false, label: 'Mixed' });
        }
    };

    // Compute master access state
    // NOTE: The Login master toggle is intentionally BINARY (On/Off only) — no
    // "Mixed" state. It represents the bulk action direction, so one row-level
    // override should not visually switch the column master off. Only an all-off
    // column reads as Off; any enabled login keeps the master On.
    const computeMasterAccessState = (employeeList = employees) => {
        const toggleableEmployees = employeeList.filter(emp => emp.role_id !== SUPER_ADMIN_ROLE_ID);

        if (toggleableEmployees.length === 0) {
            setMasterAccessState({ checked: false, label: 'Off' });
            return;
        }

        const accessCount = toggleableEmployees.filter(emp => isLoginEnabled(emp)).length;

        if (accessCount > 0) {
            setMasterAccessState({ checked: true, label: 'On' });
        } else {
            setMasterAccessState({ checked: false, label: 'Off' });
        }
    };

    // Compute master OTP state
    const computeMasterOTPState = (employeeList = employees) => {
        const toggleableEmployees = employeeList.filter(emp => emp.role_id !== SUPER_ADMIN_ROLE_ID);

        if (toggleableEmployees.length === 0) {
            setMasterOTPState({ checked: false, label: 'Off' });
            return;
        }

        const otpCount = toggleableEmployees.filter(emp => isOtpRequired(emp)).length;

        if (otpCount === 0) {
            setMasterOTPState({ checked: false, label: 'Off' });
        } else if (otpCount === toggleableEmployees.length) {
            setMasterOTPState({ checked: true, label: 'On' });
        } else {
            setMasterOTPState({ checked: false, label: 'Mixed' });
        }
    };

    const recomputeMasterStates = (employeeList) => {
        computeMasterStatusState(employeeList);
        computeMasterAccessState(employeeList);
        computeMasterOTPState(employeeList);
    };

    // Handle master status toggle - SIMPLIFIED FOR TESTING
    const handleMasterStatusToggle = () => {
        console.log('🔄 Master Status Toggle clicked! Current state:', masterStatusState);

        try {
            // Determine the target state based on current master state
            let targetStatus;
            let actionText;

            if (masterStatusState.label === 'On') {
                targetStatus = false;
                actionText = `deactivate all ${activeTab} employees`;
            } else {
                targetStatus = true;
                actionText = `activate all ${activeTab} employees`;
            }

            // Show custom confirmation modal
            showConfirm({
                title: 'Bulk Status Update',
                content: `Are you sure you want to ${actionText}? This will only affect ${activeTab} employees (current tab).`,
                onOk: async () => {
                    try {
                        console.log(`🔄 Executing bulk status update to: ${targetStatus} for ${activeTab} employees`);
                        const response = await hrmsService.bulkUpdateUserStatus(targetStatus, activeTab);

                        if (response.success) {
                            message.success(`Successfully ${targetStatus ? 'activated' : 'deactivated'} ${response.data.modified_count} ${activeTab} employees`);
                            await fetchEmployees();
                        } else {
                            throw new Error(response.message || 'Bulk update failed');
                        }
                    } catch (error) {
                        console.error('❌ Bulk status update failed:', error);
                        message.error(`Failed to update employee status: ${error.message}`);
                    }
                },
                onCancel: () => {
                    console.log('❌ Bulk status update cancelled');
                }
            });

        } catch (error) {
            console.error('❌ Error in handleMasterStatusToggle:', error);
        }
    };

    // Handle master access toggle
    const handleMasterAccessToggle = () => {
        console.log('🔄 Master Access Toggle clicked! Current state:', masterAccessState);

        try {
            // Determine the target state based on current master state
            let targetLoginEnabled;
            let actionText;

            if (masterAccessState.label === 'On') {
                targetLoginEnabled = false;
                actionText = `disable login access for all ${activeTab} employees`;
            } else {
                targetLoginEnabled = true;
                actionText = `enable login access for all ${activeTab} employees`;
            }

            // Show custom confirmation modal
            showConfirm({
                title: 'Bulk Login Access Update',
                content: `Are you sure you want to ${actionText}? This will only affect ${activeTab} employees (current tab).`,
                onOk: async () => {
                    try {
                        console.log(`🔄 Executing bulk login access update to: ${targetLoginEnabled} for ${activeTab} employees`);
                        const response = await hrmsService.bulkUpdateLoginAccess(targetLoginEnabled, activeTab);

                        if (response.success) {
                            message.success(`Successfully ${targetLoginEnabled ? 'enabled' : 'disabled'} login access for ${response.data.modified_count} ${activeTab} employees`);
                            await fetchEmployees();
                        } else {
                            throw new Error(response.message || 'Bulk update failed');
                        }
                    } catch (error) {
                        console.error('❌ Bulk login access update failed:', error);
                        message.error(`Failed to update login access: ${error.message}`);
                    }
                },
                onCancel: () => {
                    console.log('❌ Bulk login access update cancelled');
                }
            });

        } catch (error) {
            console.error('❌ Error in handleMasterAccessToggle:', error);
        }
    };

    // Handle master OTP toggle
    const handleMasterOTPToggle = () => {
        console.log('🔄 Master OTP Toggle clicked! Current state:', masterOTPState);

        try {
            // Determine the target state based on current master state
            let targetOtpRequired;
            let actionText;

            if (masterOTPState.label === 'On') {
                targetOtpRequired = false;
                actionText = `disable OTP requirement for all ${activeTab} employees`;
            } else {
                targetOtpRequired = true;
                actionText = `enable OTP requirement for all ${activeTab} employees`;
            }

            // Show custom confirmation modal
            showConfirm({
                title: 'Bulk OTP Requirement Update',
                content: `Are you sure you want to ${actionText}? This will only affect ${activeTab} employees (current tab).`,
                onOk: async () => {
                    try {
                        console.log(`🔄 Executing bulk OTP requirement update to: ${targetOtpRequired} for ${activeTab} employees`);
                        const response = await hrmsService.bulkUpdateOTPRequirement(targetOtpRequired, activeTab);

                        if (response.success) {
                            message.success(`Successfully ${targetOtpRequired ? 'enabled' : 'disabled'} OTP requirement for ${response.data.modified_count} ${activeTab} employees`);
                            await fetchEmployees();
                        } else {
                            throw new Error(response.message || 'Bulk update failed');
                        }
                    } catch (error) {
                        console.error('❌ Bulk OTP requirement update failed:', error);
                        message.error(`Failed to update OTP requirement: ${error.message}`);
                    }
                },
                onCancel: () => {
                    console.log('❌ Bulk OTP requirement update cancelled');
                }
            });

        } catch (error) {
            console.error('❌ Error in handleMasterOTPToggle:', error);
        }
    };

    // Format joining date like in the HTML example
    const formatJoiningDate = (dateString) => {
        if (!dateString) return '-';

        const formattedDate = formatDate(dateString);

        // Calculate days since joining
        const date = new Date(dateString);
        const today = new Date();
        const msPerDay = 24 * 60 * 60 * 1000;
        const days = Math.max(0, Math.floor((today - date) / msPerDay));

        return {
            formatted: formattedDate,
            days
        };
    };

    const handleEmployeeUpdateInDetails = async (updatedEmployeeData) => {
        console.log('🔄 AllEmployees: handleEmployeeUpdateInDetails called with:', updatedEmployeeData);
        console.log('🔄 AllEmployees: Current selectedEmployeeForDetails:', selectedEmployeeForDetails);

        // Refresh the employee table
        console.log('🔄 AllEmployees: Refreshing employee table...');
        await fetchEmployees();
        console.log('✅ AllEmployees: Employee table refreshed');

        // If we have a selected employee for details, we should update it with fresh data
        if (selectedEmployeeForDetails) {
            try {
                // If we have the updated data, use it directly to avoid unnecessary API calls
                if (updatedEmployeeData && updatedEmployeeData._id === selectedEmployeeForDetails._id) {
                    console.log('🔄 AllEmployees: Using provided updated data');
                    console.log('✅ AllEmployees: Updated selected employee with fresh data');
                    setSelectedEmployeeForDetails(updatedEmployeeData);
                    return;
                }

                // Otherwise, fetch the updated employee data to keep the details view in sync
                console.log('🔄 AllEmployees: Fetching updated employee data from server...');
                const response = await hrmsService.getEmployees('all');
                const updatedEmployee = response.data.find(emp => emp._id === selectedEmployeeForDetails._id);

                if (updatedEmployee) {
                    // Process the updated employee data the same way we do in fetchEmployees
                    const isExplicitlyInactive = updatedEmployee.employee_status === false ||
                        updatedEmployee.employee_status === 'false' ||
                        updatedEmployee.employee_status === 'inactive' ||
                        updatedEmployee.employee_status === 'Inactive' ||
                        updatedEmployee.employee_status === 0 ||
                        updatedEmployee.employee_status === '0';

                    const normalizedStatus = isExplicitlyInactive ? 'inactive' : 'active';

                    // Get department and role names
                    let departmentName = '-';
                    let roleName = '-';

                    if (updatedEmployee.department_id) {
                        try {
                            const departmentsResponse = await hrmsService.getDepartments();
                            const department = departmentsResponse.data.find(
                                (dept) => dept._id === updatedEmployee.department_id
                            );
                            departmentName = department ? department.name : '-';
                        } catch (error) {
                            console.error('Error fetching departments:', error);
                        }
                    }

                    if (updatedEmployee.role_id) {
                        try {
                            const rolesResponse = await hrmsService.getRoles();
                            const role = rolesResponse.data.find(
                                (role) => role._id === updatedEmployee.role_id
                            );
                            roleName = role ? role.name : '-';
                        } catch (error) {
                            console.error('Error fetching roles:', error);
                        }
                    }

                    // Update the selected employee with all the processed data
                    const processedEmployee = {
                        ...updatedEmployee,
                        department_name: departmentName,
                        role_name: roleName,
                        employee_status: normalizedStatus,
                        normalized_status: normalizedStatus
                    };

                    console.log('🔄 AllEmployees: Updated selected employee with fresh data');
                    setSelectedEmployeeForDetails(processedEmployee);
                }
            } catch (error) {
                console.error('Error fetching updated employee data:', error);
            }
        }
    };

    return (
        <>
            {/* ── Employee Created Success Popup ── */}
            {createdEmpPopup && (
                <CreatedEmpPopup data={createdEmpPopup} onClose={() => setCreatedEmpPopup(null)} />
            )}

            {selectedEmployeeForDetails ? (
                <EmployeeDetails
                    employee={selectedEmployeeForDetails}
                    onBack={handleBackToTable}
                    onEmployeeUpdate={handleEmployeeUpdateInDetails}
                />
            ) : (
                <div className="hrms-employees-page task-page-container">
                    <style>{hrmsEmployeesPageStyles}</style>
                    <div className="task-top-bar">
                        <div className="task-top-bar-left">
                            <h1>Employees</h1>
                            <p>{employees.length} employee{employees.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="task-top-bar-right">
                            {canAddEmployee() && (
                                <button type="button" className="task-btn-create" onClick={() => showEmployeeForm()}>
                                    + Add Employee
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="task-view-toggle-bar">
                        <div className="task-view-toggle-group">
                                <button type="button" onClick={() => handleTabChange('active')} className={`task-view-toggle-btn${activeTab === 'active' ? ' active' : ''}`}>
                                    Active ({employeeCounts.active})
                                </button>
                                <button type="button" onClick={() => handleTabChange('inactive')} className={`task-view-toggle-btn${activeTab === 'inactive' ? ' active' : ''}`}>
                                    Inactive ({employeeCounts.inactive})
                                </button>
                                <button type="button" onClick={() => handleTabChange('chart')} className={`task-view-toggle-btn${activeTab === 'chart' ? ' active' : ''}`}>
                                    Org Chart
                                </button>
                            </div>

                            {activeTab !== 'chart' && (
                            <div className="task-toolbar-right">
                                <div className="task-search-box--in-bar">
                                    <Search size={14} className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search employees..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <button type="button" className="search-clear" onClick={() => setSearchTerm('')} aria-label="Clear search">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className={`task-btn-secondary${getActiveFilterCount() > 0 ? ' active-filter' : ''}`}
                                    onClick={() => setShowFilterPopup(true)}
                                >
                                    <Filter size={14} />
                                    Filter
                                    {getActiveFilterCount() > 0 && (
                                        <span className="task-filter-badge">{getActiveFilterCount()}</span>
                                    )}
                                </button>
                            </div>
                            )}
                        </div>

                    <div className={`hrms-page-content${activeTab === 'chart' ? ' hrms-page-content--chart' : ''}`}>
                        {/* ── Chart View Tab ── */}
                        {activeTab === 'chart' ? (
                            <OrgChartView
                                onStatusChange={handleEmployeeStatusChange}
                                superAdminRoleId={SUPER_ADMIN_ROLE_ID}
                                statusSyncVersion={orgChartSyncVersion}
                            />
                        ) : loading ? (
                            <div className="task-loading-spinner">
                                <div className="spinner" />
                                <p>Loading employees...</p>
                            </div>
                        ) : employees.length > 0 ? (
                            <div className="relative hrms-table-outer">
                                {canScrollLeft && (
                                    <button
                                        type="button"
                                        onClick={() => scrollTable('left')}
                                        className="warning-scroll-btn left"
                                        aria-label="Scroll left"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                )}

                                {canScrollRight && (
                                    <button
                                        type="button"
                                        onClick={() => scrollTable('right')}
                                        className="warning-scroll-btn right"
                                        aria-label="Scroll right"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                )}

                                <div
                                    ref={tableScrollRef}
                                    className="table-container hrms-table-wrap overflow-auto"
                                    onScroll={updateScrollButtons}
                                >
                                    <table className="hrms-table min-w-full w-full">
                                        <thead>
                                            <tr>
                                                <th className="hrms-table-th">
                                                    #
                                                </th>
                                                <th className="hrms-table-th text-nowrap">
                                                    Employee ID
                                                </th>
                                                <th className="hrms-table-th text-nowrap">
                                                    Joining Date
                                                </th>
                                                <th className="hrms-table-th text-nowrap">
                                                    Employee Name
                                                </th>
                                                <th className="hrms-table-th text-nowrap">
                                                    Gender
                                                </th>
                                                <th className="hrms-table-th text-nowrap">
                                                    Designation
                                                </th>
                                                <th className="hrms-table-th text-nowrap">
                                                    Department
                                                </th>
                                                <th className="hrms-table-th text-nowrap">
                                                    Role
                                                </th>
                                                <th className="hrms-table-th text-nowrap">
                                                    Highest Qualification
                                                </th>
                                                <th className="hrms-table-th text-nowrap">
                                                    Current City
                                                </th>
                                                <th className="hrms-table-th text-nowrap">
                                                    Experience
                                                </th>
                                                <th className="hrms-table-th">
                                                    <div className="th-flex">
                                                        <span>Status</span>
                                                        <div
                                                            className={`switch${masterStatusState.label === 'Mixed' ? ' switch-mixed' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (canEditEmployees) handleMasterStatusToggle();
                                                            }}
                                                            style={{ cursor: canEditEmployees ? 'pointer' : 'not-allowed' }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={masterStatusState.label === 'On'}
                                                                onChange={() => {}}
                                                                disabled={!canEditEmployees}
                                                                style={{ pointerEvents: 'none' }}
                                                            />
                                                            <span className={`state ${masterStatusState.label.toLowerCase()}`}>
                                                                {masterStatusState.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </th>
                                                <th className="hrms-table-th">
                                                    <div className="th-flex">
                                                        <span>Login</span>
                                                        <div
                                                            className={`switch${masterAccessState.label === 'Mixed' ? ' switch-mixed' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (canEditEmployees) handleMasterAccessToggle();
                                                            }}
                                                            style={{ cursor: canEditEmployees ? 'pointer' : 'not-allowed' }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={masterAccessState.label === 'On'}
                                                                onChange={() => {}}
                                                                disabled={!canEditEmployees}
                                                                style={{ pointerEvents: 'none' }}
                                                            />
                                                            <span className={`state ${masterAccessState.label.toLowerCase()}`}>
                                                                {masterAccessState.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </th>
                                                <th className="hrms-table-th text-nowrap">
                                                    <div className="th-flex">
                                                        <span>OTP Required</span>
                                                        <div
                                                            className={`switch${masterOTPState.label === 'Mixed' ? ' switch-mixed' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (canEditEmployees) handleMasterOTPToggle();
                                                            }}
                                                            style={{ cursor: canEditEmployees ? 'pointer' : 'not-allowed' }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={masterOTPState.label === 'On'}
                                                                onChange={() => {}}
                                                                disabled={!canEditEmployees}
                                                                style={{ pointerEvents: 'none' }}
                                                            />
                                                            <span className={`state ${masterOTPState.label.toLowerCase()}`}>
                                                                {masterOTPState.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </th>
                                                <th className="hrms-table-th">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employees.filter(employee => {
                                                // NOTE: Locked-role employees are NOT hidden — they remain visible
                                                // but cannot be opened (blocked in handleRowClick)

                                                // Apply dropdown filters first (updated for multiple selections)
                                                if (selectedDepartments.length > 0 && !selectedDepartments.includes(employee.department)) return false;
                                                if (selectedDesignations.length > 0 && !selectedDesignations.includes(employee.designation)) return false;
                                                if (selectedRoles.length > 0 && !selectedRoles.includes(employee.role)) return false;

                                                // If no search term, show employees that pass dropdown filters
                                                if (!searchTerm) return true;

                                                const searchLower = searchTerm.toLowerCase();

                                                // Search in employee ID
                                                const employeeId = employee.employee_id ? employee.employee_id.toString() : '';
                                                if (employeeId.includes(searchLower)) return true;

                                                // Search in name
                                                const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.toLowerCase();
                                                if (fullName.includes(searchLower)) return true;

                                                // Search in department
                                                const department = (employee.department || '').toLowerCase();
                                                if (department.includes(searchLower)) return true;

                                                // Search in role
                                                const role = (employee.role || '').toLowerCase();
                                                if (role.includes(searchLower)) return true;

                                                // Search in designation
                                                const designation = (employee.designation || '').toLowerCase();
                                                if (designation.includes(searchLower)) return true;

                                                // Search in current city
                                                const currentCity = (employee.current_city || '').toLowerCase();
                                                if (currentCity.includes(searchLower)) return true;

                                                return false;
                                            }).map((employee, index) => {
                                                const joinDate = formatJoiningDate(employee.joining_date);
                                                const isActive = employee.employee_status === 'active';
                                                const loginEnabled = isLoginEnabled(employee);
                                                const otpRequired = isOtpRequired(employee);
                                                const isSuperAdminEmployee = employee.role_id === SUPER_ADMIN_ROLE_ID;

                                                return (
                                                    <tr
                                                        key={employee._id}
                                                        onClick={(e) => handleRowClick(employee, e)}
                                                        className="hrms-table-row"
                                                    >
                                                        <td>
                                                            {index + 1}
                                                        </td>
                                                        <td>
                                                            {employee.employee_id ? employee.employee_id : 'No ID'}
                                                        </td>
                                                        <td>
                                                            {joinDate !== '-' ? (
                                                                <>
                                                                    <span>{joinDate.formatted}</span>
                                                                    <br />
                                                                    <small className="tenure">{joinDate.days} days</small>
                                                                </>
                                                            ) : (
                                                                '-'
                                                            )}
                                                        </td>
                                                        <td className="hrms-name-cell">
                                                            <div className="cell-name-wrap">
                                                                <div className="cell-avatar">
                                                                    {employee.profile_photo ? (
                                                                        <img
                                                                            src={getProfilePictureUrlWithCacheBusting(employee.profile_photo)}
                                                                            alt={`${employee.first_name} ${employee.last_name}`}
                                                                            onError={(e) => {
                                                                                e.target.style.display = 'none';
                                                                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <span className="cell-avatar-fallback" style={{ display: employee.profile_photo ? 'none' : 'flex' }}>
                                                                        {employee.first_name ? employee.first_name.charAt(0).toUpperCase() : '?'}
                                                                    </span>
                                                                </div>
                                                                <span className="cell-name-text">{toDisplayText(`${employee.first_name || ''} ${employee.last_name || ''}`.trim()) || 'Unnamed'}</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {toDisplayText(employee.gender) || 'Not Specified'}
                                                        </td>
                                                        <td>
                                                            {toDisplayText(employee.designation || employee.position) || 'Not Specified'}
                                                        </td>
                                                        <td>
                                                            {toDisplayText(departments[employee.department_id] || employee.department_name) || 'Not Specified'}
                                                        </td>
                                                        <td>
                                                            {toDisplayText(roles[employee.role_id] || employee.role_name) || 'Not Specified'}
                                                        </td>
                                                        <td>
                                                            {toDisplayText(employee.highest_qualification) || 'Not Specified'}
                                                        </td>
                                                        <td>
                                                            {toDisplayText(employee.current_city || employee.city) || 'Not Specified'}
                                                        </td>
                                                        <td>
                                                            {toDisplayText(employee.experience_level) || 'Not Specified'}
                                                        </td>
                                                        <td>
                                                            <label className="switch">
                                                                <input
                                                                    type="checkbox"
                                                                    className="toggle-active"
                                                                    checked={isSuperAdminEmployee ? true : isActive}
                                                                    disabled={isSuperAdminEmployee}
                                                                    onChange={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        if (isSuperAdminEmployee) { message.error('⛔ Cannot modify Super Admin!'); return; }
                                                                        console.log('🔄 Status toggle clicked:', e.target.checked);
                                                                        handleEmployeeStatusChange(employee, e.target.checked);
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                    }}
                                                                />
                                                                <span className={`state ${(isSuperAdminEmployee || isActive) ? 'on' : 'off'}`}>
                                                                    {isSuperAdminEmployee ? '🔒 Active' : (isActive ? 'Active' : 'Inactive')}
                                                                </span>
                                                            </label>
                                                        </td>
                                                        <td>
                                                            <label className="switch">
                                                                <input
                                                                    type="checkbox"
                                                                    className="toggle-access"
                                                                    checked={isSuperAdminEmployee ? true : loginEnabled}
                                                                    disabled={isSuperAdminEmployee || !isActive}
                                                                    onChange={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        if (isSuperAdminEmployee) { message.error('⛔ Cannot modify Super Admin!'); return; }
                                                                        console.log('🔄 Login Access toggle clicked:', e.target.checked);
                                                                        handleLoginEnabledChange(employee, e.target.checked);
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                    }}
                                                                />
                                                                <span className={`state ${(isSuperAdminEmployee || loginEnabled) ? 'on' : 'off'}`}>
                                                                    {isSuperAdminEmployee ? '🔒 On' : (loginEnabled ? 'On' : 'Off')}
                                                                </span>
                                                            </label>
                                                        </td>
                                                        <td>
                                                            <label className="switch">
                                                                <input
                                                                    type="checkbox"
                                                                    className="toggle-otp"
                                                                    checked={otpRequired}
                                                                    disabled={!loginEnabled || !isActive}
                                                                    onChange={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        console.log('🔄 OTP toggle clicked:', e.target.checked);
                                                                        handleOTPRequiredChange(employee, e.target.checked);
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                    }}
                                                                />
                                                                <span className={`state ${otpRequired ? 'on' : 'off'}`}>
                                                                    {otpRequired ? 'On' : 'Off'}
                                                                </span>
                                                            </label>
                                                        </td>
                                                        <td>
                                                            <div className="flex items-center gap-2">

                                                            {(() => {
                                                                const SUPER_ADMIN_ROLE_ID = "685292be8d7cdc3a71c4829b";
                                                                const isSuperAdmin = employee.role_id === SUPER_ADMIN_ROLE_ID;

                                                                return canUserDelete(employee._id) ? (
                                                                    <button
                                                                        type="button"
                                                                        className="hrms-action-btn"
                                                                        onClick={(e) => {
                                                                            console.log('🗑️ Delete button clicked!', employee);
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            if (!isSuperAdmin) {
                                                                                handleDeleteEmployee(employee);
                                                                            }
                                                                        }}
                                                                        disabled={isSuperAdmin}
                                                                        title={isSuperAdmin ? 'Cannot delete Super Admin' : 'Delete Employee'}
                                                                    >
                                                                        <DeleteOutlined style={{ fontSize: '14px' }} />
                                                                    </button>
                                                                ) : null;
                                                            })()}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="task-empty-state">
                                <p className="task-empty-state-title">
                                    {activeTab === 'active' ? 'No active employees' : 'No inactive employees'}
                                </p>
                                <p className="task-empty-state-sub">Try adjusting your search or filters.</p>
                            </div>
                        )}
                    </div>

                    {/* Employee Form Modal */}
                    <Modal
                        title={null}
                        open={formVisible}
                        onCancel={handleFormCancel}
                        width={1400}
                        footer={null}
                        destroyOnHidden={true}
                        centered
                        closable={true}
                        closeIcon={
                            <div style={{
                                position: 'absolute',
                                top: '10px',
                                right: '15px',
                                zIndex: 9999,
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'white',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                border: '2px solid white',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                            }}>
                                ×
                            </div>
                        }
                        styles={{
                            body: { padding: 0 },
                            header: { display: 'none' },
                            mask: { backgroundColor: 'rgba(0, 0, 0, 0.6)' }
                        }}
                    >
                        <EmployeeForm
                            key={formKey}
                            employee={selectedEmployee}
                            onFinish={handleFormSubmit}
                            onCancel={handleFormCancel}
                            loading={formLoading}
                        />
                    </Modal>

                    {/* Status Update Modal */}
                    <StatusModal
                        open={statusModalVisible}
                        title="Update Employee Status"
                        confirmLoading={statusModalLoading}
                        onCancel={() => setStatusModalVisible(false)}
                        onSubmit={handleStatusUpdate}
                        type="status"
                        currentValue={selectedEmployee?.employee_status}
                    />

                    {/* Onboarding Update Modal */}
                    <StatusModal
                        open={onboardingModalVisible}
                        title="Update Onboarding Status"
                        confirmLoading={statusModalLoading}
                        onCancel={() => setOnboardingModalVisible(false)}
                        onSubmit={handleOnboardingUpdate}
                        type="onboarding"
                        currentValue={selectedEmployee?.onboarding_status}
                    />

                    {/* Password Management Modal */}
                    <PasswordManagementModal
                        visible={passwordModalVisible}
                        onCancel={handlePasswordModalClose}
                        employee={selectedEmployeeForPassword}
                        onSuccess={handlePasswordUpdateSuccess}
                    />

                    {/* Custom Confirmation Modal */}
                    <Modal
                        title={confirmModal.title}
                        open={confirmModal.visible}
                        onOk={confirmModal.onOk}
                        onCancel={confirmModal.onCancel}
                        okText="Yes, Update All"
                        cancelText="Cancel"
                        okType="primary"
                        confirmLoading={confirmModal.loading}
                        maskClosable={false}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: '16px' }} />
                            <span>{confirmModal.content}</span>
                        </div>
                    </Modal>

                    {/* Inactive Date Picker Modal */}
                    {inactiveDateModal.visible && (
                        <div
                            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}
                            onClick={() => setInactiveDateModal({ visible: false, employee: null, date: '' })}
                        >
                            <div
                                style={{background:'#1a1a1f',border:'1px solid #3a3a42',borderRadius:'12px',padding:'28px 32px',minWidth:'360px',boxShadow:'0 20px 60px rgba(0,0,0,0.8)'}}
                                onClick={e => e.stopPropagation()}
                            >
                                <h3 style={{color:'#fff',fontSize:'16px',fontWeight:700,marginBottom:'6px'}}>Mark Employee as Inactive</h3>
                                <p style={{color:'#a1a1aa',fontSize:'13px',marginBottom:'20px'}}>
                                    {inactiveDateModal.employee
                                        ? `${inactiveDateModal.employee.first_name || ''} ${inactiveDateModal.employee.last_name || ''}`.trim()
                                        : ''}
                                    &nbsp;— kis date se inactive hai?
                                </p>
                                <label style={{display:'block',color:'#a1a1aa',fontSize:'12px',marginBottom:'6px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>
                                    Inactive From Date
                                </label>
                                <input
                                    type="date"
                                    value={inactiveDateModal.date}
                                    onChange={e => setInactiveDateModal(prev => ({ ...prev, date: e.target.value }))}
                                    style={{
                                        width:'100%',padding:'10px 12px',borderRadius:'8px',border:'1px solid #3a3a42',
                                        background:'#0d0d10',color:'#fff',fontSize:'14px',outline:'none',
                                        colorScheme:'dark',marginBottom:'24px'
                                    }}
                                />
                                <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
                                    <button
                                        onClick={() => setInactiveDateModal({ visible: false, employee: null, date: '' })}
                                        style={{padding:'9px 20px',borderRadius:'8px',border:'1px solid #3a3a42',background:'transparent',color:'#a1a1aa',fontSize:'13px',cursor:'pointer',fontWeight:600}}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        disabled={!inactiveDateModal.date}
                                        onClick={async () => {
                                            const { employee, date } = inactiveDateModal;
                                            setInactiveDateModal({ visible: false, employee: null, date: '' });
                                            await _doStatusUpdate(employee, false, date);
                                        }}
                                        style={{padding:'9px 20px',borderRadius:'8px',border:'none',background: inactiveDateModal.date ? '#ef4444' : '#4b5563',color:'#fff',fontSize:'13px',cursor: inactiveDateModal.date ? 'pointer' : 'not-allowed',fontWeight:700}}
                                    >
                                        Confirm Inactive
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filter Popup (matching LeadCRM style) */}
                    {showFilterPopup && (
                        <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-[1000]">
                            <div className="bg-[#1b2230] border border-gray-600 rounded-lg p-1 w-[700px] max-w-[90vw] h-[550px] flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-semibold text-white">Filter Employees</h2>
                                    <div className="flex items-center gap-3">
                                        {filterDataLoading && (
                                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                                <div className="animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
                                                <span>Loading filters...</span>
                                            </div>
                                        )}
                                        {process.env.NODE_ENV === 'development' && (
                                            <button
                                                onClick={fetchFilterData}
                                                className="px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                                                disabled={filterDataLoading}
                                            >
                                                Reload
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setShowFilterPopup(false)}
                                            className="text-gray-400 hover:text-white text-2xl"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-6 flex-1 overflow-hidden">
                                    {/* Debug Information */}
                                    {process.env.NODE_ENV === 'development' && (
                                        <div className="col-span-3 bg-gray-800 p-2 rounded text-xs text-gray-400 mb-2">
                                            <strong>Debug Info:</strong><br />
                                            Departments ({allDepartments.length}): {JSON.stringify(allDepartments.slice(0, 3))}<br />
                                            Roles ({allRoles.length}): {JSON.stringify(allRoles.slice(0, 3))}<br />
                                            Designations ({allDesignations.length}): {JSON.stringify(allDesignations.slice(0, 3))}<br />
                                            Loading: {filterDataLoading.toString()}
                                        </div>
                                    )}

                                    {/* Left side - Filter Categories */}
                                    <div className="col-span-1 border-r border-gray-600 pr-4">
                                        <h3 className="text-base font-medium text-gray-300 mb-4">Filter Categories</h3>
                                        <div className="space-y-3">
                                            <button
                                                onClick={() => setSelectedFilterCategory('department')}
                                                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${selectedFilterCategory === 'department'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-300 hover:bg-[#2a3441]'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Building className="w-5 h-5" />
                                                        <span className="text-base">Department</span>
                                                    </div>
                                                    {getFilterCategoryCount('department') > 0 && (
                                                        <span className="bg-red-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center">
                                                            {getFilterCategoryCount('department')}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => setSelectedFilterCategory('designation')}
                                                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'designation'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-300 hover:bg-[#2a3441]'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4" />
                                                        Designation
                                                    </div>
                                                    {getFilterCategoryCount('designation') > 0 && (
                                                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                            {getFilterCategoryCount('designation')}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => setSelectedFilterCategory('role')}
                                                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'role'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-300 hover:bg-[#2a3441]'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Users className="w-4 h-4" />
                                                        Role
                                                    </div>
                                                    {getFilterCategoryCount('role') > 0 && (
                                                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                            {getFilterCategoryCount('role')}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Middle section - Filter Options */}
                                    <div className="col-span-2 overflow-y-auto">
                                        {/* Department Filter */}
                                        {selectedFilterCategory === 'department' && (
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="text-lg font-semibold text-white">Department Filter</h4>
                                                    {selectedDepartments.length > 0 && (
                                                        <button
                                                            onClick={() => setSelectedDepartments([])}
                                                            className="text-sm text-red-400 hover:text-red-300"
                                                        >
                                                            Clear ({selectedDepartments.length})
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Search input for departments */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Search departments..."
                                                        value={departmentSearchTerm}
                                                        onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                                                        className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-gray-300 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                                    />
                                                    {departmentSearchTerm && (
                                                        <button
                                                            onClick={() => setDepartmentSearchTerm('')}
                                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-2 max-h-72 overflow-y-auto">
                                                    {getFilterOptions('department')
                                                        .filter(dept => dept.toLowerCase().includes(departmentSearchTerm.toLowerCase()))
                                                        .length > 0 ? (
                                                        getFilterOptions('department')
                                                            .filter(dept => dept.toLowerCase().includes(departmentSearchTerm.toLowerCase()))
                                                            .map((dept) => (
                                                                <label key={dept} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a3441] cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        value={dept}
                                                                        checked={selectedDepartments.includes(dept)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setSelectedDepartments([...selectedDepartments, dept]);
                                                                            } else {
                                                                                setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                                                                            }
                                                                        }}
                                                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                                    />
                                                                    <span className="text-gray-300">{dept}</span>
                                                                </label>
                                                            ))
                                                    ) : (
                                                        <div className="p-3 text-gray-400 text-center">
                                                            {filterDataLoading ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <div className="animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
                                                                    Loading departments...
                                                                </div>
                                                            ) : departmentSearchTerm ? (
                                                                `No departments found for "${departmentSearchTerm}"`
                                                            ) : (
                                                                'No departments available'
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Designation Filter */}
                                        {selectedFilterCategory === 'designation' && (
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="text-lg font-semibold text-white">Designation Filter</h4>
                                                    {selectedDesignations.length > 0 && (
                                                        <button
                                                            onClick={() => setSelectedDesignations([])}
                                                            className="text-sm text-red-400 hover:text-red-300"
                                                        >
                                                            Clear ({selectedDesignations.length})
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Search input for designations */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Search designations..."
                                                        value={designationSearchTerm}
                                                        onChange={(e) => setDesignationSearchTerm(e.target.value)}
                                                        className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-gray-300 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                                    />
                                                    {designationSearchTerm && (
                                                        <button
                                                            onClick={() => setDesignationSearchTerm('')}
                                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-2 max-h-72 overflow-y-auto">
                                                    {getFilterOptions('designation')
                                                        .filter(designation => designation.toLowerCase().includes(designationSearchTerm.toLowerCase()))
                                                        .length > 0 ? (
                                                        getFilterOptions('designation')
                                                            .filter(designation => designation.toLowerCase().includes(designationSearchTerm.toLowerCase()))
                                                            .map((designation) => (
                                                                <label key={designation} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a3441] cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        value={designation}
                                                                        checked={selectedDesignations.includes(designation)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setSelectedDesignations([...selectedDesignations, designation]);
                                                                            } else {
                                                                                setSelectedDesignations(selectedDesignations.filter(d => d !== designation));
                                                                            }
                                                                        }}
                                                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                                    />
                                                                    <span className="text-gray-300">{designation}</span>
                                                                </label>
                                                            ))
                                                    ) : (
                                                        <div className="p-3 text-gray-400 text-center">
                                                            {filterDataLoading ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <div className="animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
                                                                    Loading designations...
                                                                </div>
                                                            ) : designationSearchTerm ? (
                                                                `No designations found for "${designationSearchTerm}"`
                                                            ) : (
                                                                'No designations available'
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Role Filter */}
                                        {selectedFilterCategory === 'role' && (
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="text-lg font-semibold text-white">Role Filter</h4>
                                                    {selectedRoles.length > 0 && (
                                                        <button
                                                            onClick={() => setSelectedRoles([])}
                                                            className="text-sm text-red-400 hover:text-red-300"
                                                        >
                                                            Clear ({selectedRoles.length})
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Search input for roles */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Search roles..."
                                                        value={roleSearchTerm}
                                                        onChange={(e) => setRoleSearchTerm(e.target.value)}
                                                        className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-gray-300 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                                    />
                                                    {roleSearchTerm && (
                                                        <button
                                                            onClick={() => setRoleSearchTerm('')}
                                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-2 max-h-72 overflow-y-auto">
                                                    {getFilterOptions('role')
                                                        .filter(role => role.toLowerCase().includes(roleSearchTerm.toLowerCase()))
                                                        .length > 0 ? (
                                                        getFilterOptions('role')
                                                            .filter(role => role.toLowerCase().includes(roleSearchTerm.toLowerCase()))
                                                            .map((role) => (
                                                                <label key={role} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a3441] cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        value={role}
                                                                        checked={selectedRoles.includes(role)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setSelectedRoles([...selectedRoles, role]);
                                                                            } else {
                                                                                setSelectedRoles(selectedRoles.filter(r => r !== role));
                                                                            }
                                                                        }}
                                                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                                    />
                                                                    <span className="text-gray-300">{role}</span>
                                                                </label>
                                                            ))
                                                    ) : (
                                                        <div className="p-3 text-gray-400 text-center">
                                                            {filterDataLoading ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <div className="animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
                                                                    Loading roles...
                                                                </div>
                                                            ) : roleSearchTerm ? (
                                                                `No roles found for "${roleSearchTerm}"`
                                                            ) : (
                                                                'No roles available'
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer with action buttons */}
                                <div className="flex justify-between items-center pt-4 border-t border-gray-600">
                                    <button
                                        onClick={clearAllFilters}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                        Clear All Filters
                                    </button>
                                    <button
                                        onClick={() => setShowFilterPopup(false)}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Apply Filters
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default AllEmployees;
