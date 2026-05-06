import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshCurrentUserPermissions } from '../../utils/immediatePermissionRefresh';

const API_BASE_URL = '/api';

// Human-readable labels for action keys shown in column headers
const ACTION_LABELS = {
    show:                 'Show in Sidebar',
    delete:               'Delete',
    post:                 'Create Feed',
    duplicate_lead:       'Duplicate Lead',
    bank_name_permission: 'Bank Name Permission',
    view_team:            'View Team',
    view_all:             'View All',
    view_data_code:       'View Data Code',
    status_change:        'Status Change',
    rollback_login:       'Roll Back Login',
    download_obligation:  'Download Obligation',
    download_attachments: 'Download Attachments',
    channel:              'View Channel Name',
    edit:                 'Edit Data',
    warning_setting:      'Warning Setting',
    interview_setting:    'Interview Setting',
    add_employee:         'Add Employee',
    reset_password:       'Reset Password',
    lock_role:            'Lock Role',
    leave_setting:        'Leave Setting',
    leave_management:     'Leave Management',
    update_attendance:    'Update Attendance',
    create_app:           'Create App',
    edit_app:             'Edit App',
    share_app:            'Share App',
    create:               'Create Announcement',
};

// Human-readable labels for the module group headers
const MODULE_LABELS = {
    feeds:           'Feed',
    dashboard:       'Dashboard',
    'Leads CRM':     'Lead CRM',
    login:           'Login CRM PLOD',
    tasks:           'Task',
    tickets:         'Tickets',
    warnings:        'Warnings',
    interview:       'Interview',
    employees:       'HRMS Employee',
    leaves:          'HRMS Leave',
    attendance:      'HRMS Attendance',
    dialer_report:   'HRMS Dialer Report',
    offer_letter:    'HRMS Offer Letter',
    apps:            'Apps',
    notification:    'Announcement',
    reports:         'Report',
    settings:        'Setting',
};

const allPermissions = {
    'feeds': ['show', 'post', 'delete'],
    'dashboard': ['show'],
    'Leads CRM': {
        'Create LEAD': ['show', 'duplicate_lead', 'bank_name_permission'],
        'PL & ODD LEADS': ['show', 'view_team', 'view_all', 'view_data_code', 'status_change', 'rollback_login', 'download_obligation', 'download_attachments', 'delete'],
    },
    'login': ['show', 'view_team', 'view_all', 'channel', 'edit', 'delete'],
    'tasks': ['show', 'view_team', 'view_all', 'delete'],
    'tickets': ['show', 'view_team', 'view_all', 'delete'],
    'warnings': ['show', 'view_team', 'view_all', 'warning_setting', 'delete', 'delete_mistake'],
    'interview': ['show', 'view_team', 'view_all', 'interview_setting', 'delete'],
    'employees': ['show', 'view_team', 'view_all', 'add_employee', 'reset_password', 'lock_role', 'delete'],
    'leaves': ['show', 'view_team', 'view_all', 'leave_setting', 'delete'],
    'attendance': ['show', 'view_team', 'view_all', 'leave_management', 'update_attendance'],
    'dialer_report': ['show'],
    'offer_letter': ['show'],
    'apps': ['show', 'create_app', 'edit_app', 'share_app'],
    'notification': ['show', 'create', 'delete'],
    'reports': ['show'],
    'settings': ['show'],
};

// Build flat module list
const permissionModules = [];
Object.entries(allPermissions).forEach(([module, actions]) => {
    if (typeof actions === 'object' && !Array.isArray(actions)) {
        Object.entries(actions).forEach(([section, sectionActions]) => {
            if (Array.isArray(sectionActions)) {
                permissionModules.push({
                    label: `${MODULE_LABELS[module] || module} › ${section}`,
                    originalModule: module,
                    section,
                    actions: sectionActions,
                    isNested: true,
                });
            }
        });
    } else if (Array.isArray(actions)) {
        permissionModules.push({
            label: MODULE_LABELS[module] || module,
            originalModule: module,
            section: null,
            actions,
            isNested: false,
        });
    }
});

const getPageKey = (mod) => {
    if (mod.isNested) {
        const dbModule = mod.originalModule === 'Leads CRM' ? 'leads' : mod.originalModule.toLowerCase();
        const dbSection = mod.section.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_');
        return `${dbModule}.${dbSection}`;
    }
    return mod.originalModule;
};

// Backward-compat alias: UI action name → old DB action name(s)
const ACTION_ALIASES = {
    view_team: ['view_team', 'junior'],
    view_all: ['view_all', 'all'],
    status_change: ['status_change', 'status_update'],
    interview_setting: ['interview_setting', 'settings'],
    update_attendance: ['update_attendance', 'update'],
    reset_password: ['reset_password', 'password'],
    warning_setting: ['warning_setting', 'issue'],
    delete_mistake: ['delete_mistake', 'view_mistakes'],
};

const checkRolePerm = (role, mod, action) => {
    if (!role.permissions || !Array.isArray(role.permissions)) return false;
    if (role.permissions.some(p => p.page === '*')) return true;
    const perm = role.permissions.find(p => p.page === getPageKey(mod));
    if (!perm || !perm.actions) return false;
    const candidates = ACTION_ALIASES[action] || [action];
    return candidates.some(a => perm.actions.includes(a));
};

const getPermissionsCount = (permissions) => {
    if (!permissions || !Array.isArray(permissions)) return 0;
    // Super Admin: count all UI-defined action columns
    if (permissions.some(p => p.page === '*')) {
        let total = 0;
        Object.values(allPermissions).forEach(actions => {
            if (typeof actions === 'object' && !Array.isArray(actions)) {
                Object.values(actions).forEach(sa => { if (Array.isArray(sa)) total += sa.length; });
            } else if (Array.isArray(actions)) {
                total += actions.length;
            }
        });
        return total;
    }
    // Regular roles: count only UI-column checkmarks (alias-resolved)
    // Build pageKey -> Set<UI action names> map
    const pageUIActions = {};
    permissionModules.forEach(mod => {
        const key = getPageKey(mod);
        pageUIActions[key] = mod.actions; // array of UI action names
    });
    const hasNestedLeads = permissions.some(p => p.page && p.page.startsWith('leads.'));
    let total = 0;
    permissions.forEach(perm => {
        if (!perm.page || !perm.actions) return;
        if (!Array.isArray(perm.actions) || perm.actions.length === 0) return;
        if (perm.page === 'leads' && hasNestedLeads) return; // skip legacy flat leads
        const uiActions = pageUIActions[perm.page];
        if (!uiActions) return; // page not in UI (loan-types, hrms, etc.)
        // Count how many UI action columns are satisfied by this role's DB actions
        for (const uiAction of uiActions) {
            const candidates = ACTION_ALIASES[uiAction] || [uiAction];
            if (candidates.some(c => perm.actions.includes(c))) {
                total++;
            }
        }
    });
    return total;
};

// Column left offsets for sticky positioning
const COL = { name: 0, dept: 200, report: 320, perms: 440, sa: 520 };
const COL_OFFSETS = [COL.name, COL.dept, COL.report, COL.perms];

// Style helpers
const thFixed = () => ({
    position: 'sticky', left: COL.name, zIndex: 60, background: '#000', color: '#fff',
    padding: '12px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '0.5px', borderBottom: '2px solid #333', borderRight: '2px solid #444',
    whiteSpace: 'nowrap', textAlign: 'left', cursor: 'pointer', minWidth: '200px', userSelect: 'none',
});
const thSticky = (colIndex) => ({
    position: 'sticky', left: COL_OFFSETS[colIndex], zIndex: 60, background: '#000', color: '#fff',
    padding: '12px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '0.5px', borderBottom: '2px solid #333',
    borderRight: colIndex === 3 ? '3px solid #444' : '1px solid #222',
    whiteSpace: 'nowrap', textAlign: colIndex === 3 ? 'center' : 'left',
    cursor: 'pointer', minWidth: colIndex === 1 || colIndex === 2 ? '120px' : colIndex === 3 ? '80px' : '70px',
    userSelect: 'none',
});
const thSA = () => ({
    position: 'sticky', left: COL.sa, zIndex: 60, background: '#000', color: '#ffd700',
    padding: '12px 10px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '0.5px', borderBottom: '2px solid #333', borderRight: '3px solid #ffd70044',
    whiteSpace: 'nowrap', textAlign: 'center', minWidth: '70px', userSelect: 'none',
});
const tdFixed = () => ({
    position: 'sticky', left: COL.name, zIndex: 10, padding: '10px 16px',
    borderRight: '2px solid #333', background: '#050505', minWidth: '200px', maxWidth: '260px',
});
const tdSticky = (colIndex, rowBg) => ({
    position: 'sticky', left: COL_OFFSETS[colIndex], zIndex: 10, padding: '10px 16px',
    borderRight: colIndex === 3 ? '3px solid #333' : '1px solid #222',
    background: rowBg || '#000', whiteSpace: 'nowrap',
});
const tdSA = (rowBg) => ({
    position: 'sticky', left: COL.sa, zIndex: 10, padding: '6px 10px', textAlign: 'center',
    borderRight: '3px solid #1a1400', background: rowBg || '#000',
});

export default function RoleCompare({ embedded = false }) {
    const navigate = useNavigate();
    const [roles, setRoles] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('name');
    const [sortAsc, setSortAsc] = useState(true);
    const [saving, setSaving] = useState(new Set());
    const [toast, setToast] = useState(null);
    const [lockRolesModal, setLockRolesModal] = useState(null); // { roleId, roleName, selectedIds, searchTxt, mod, hasLockPermission }
    const [compareFilter, setCompareFilter] = useState([]);
    const [compareOpen, setCompareOpen] = useState(false);
    const [compareSearch, setCompareSearch] = useState('');
    const compareRef = useRef(null);

    // Close compare dropdown on outside click
    useEffect(() => {
        const handler = (e) => { if (compareRef.current && !compareRef.current.contains(e.target)) setCompareOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Auto-dismiss toast
    useEffect(() => {
        if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }
    }, [toast]);

    const getAuthInfo = useCallback(() => {
        const userData = localStorage.getItem('userData');
        if (!userData) return { user_id: null, authHeaders: {} };
        const parsed = JSON.parse(userData);
        const user_id = parsed.user_id || parsed.id || parsed._id;
        const token = localStorage.getItem('token') || parsed.token || '';
        return { user_id, authHeaders: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) } };
    }, []);

    const fetchRoles = useCallback(async () => {
        setLoading(true);
        try {
            const { user_id, authHeaders } = getAuthInfo();
            if (!user_id) return;
            const roleUrls = [
                `${API_BASE_URL}/roles?user_id=${user_id}`,
                `${API_BASE_URL}/roles/?user_id=${user_id}`,
                `${API_BASE_URL}/roles/`,
                `${API_BASE_URL}/roles`,
            ];
            let rolesData = null;
            for (const url of roleUrls) {
                try {
                    const res = await fetch(url, { headers: authHeaders });
                    if (res.ok) { rolesData = await res.json(); break; }
                } catch (_) { /* try next */ }
            }
            if (rolesData && Array.isArray(rolesData)) setRoles(rolesData);
            const deptsRes = await fetch(`${API_BASE_URL}/departments/?user_id=${user_id}`, { headers: authHeaders });
            if (deptsRes.ok) {
                const deptsData = await deptsRes.json();
                setDepartments(Array.isArray(deptsData) ? deptsData : []);
            }
        } catch (e) {
            console.error('RoleCompare fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, [getAuthInfo]);

    useEffect(() => { fetchRoles(); }, [fetchRoles]);

    const saveRole = useCallback(async (roleId, newPermissions, prevPermissions) => {
        setRoles(prev => prev.map(r => (r.id || r._id) === roleId ? { ...r, permissions: newPermissions } : r));
        setSaving(prev => new Set([...prev, roleId]));
        try {
            const { authHeaders } = getAuthInfo();
            const res = await fetch(`${API_BASE_URL}/roles/${roleId}`, {
                method: 'PUT',
                headers: authHeaders,
                body: JSON.stringify({ permissions: newPermissions }),
            });
            if (!res.ok) throw new Error('Save failed');
            setToast({ msg: '✓ Saved', type: 'success' });

            // If the saved role is the current user's role, refresh permissions immediately
            try {
                const userData = localStorage.getItem('userData');
                if (userData) {
                    const parsed = JSON.parse(userData);
                    const currentRoleId = parsed.role_id || parsed.role?._id || parsed.role?.id;
                    if (currentRoleId && currentRoleId === roleId) {
                        await refreshCurrentUserPermissions();
                    }
                }
            } catch (_) { /* non-critical */ }
        } catch (e) {
            setRoles(prev => prev.map(r => (r.id || r._id) === roleId ? { ...r, permissions: prevPermissions } : r));
            setToast({ msg: '✗ Save failed', type: 'error' });
        } finally {
            setSaving(prev => { const n = new Set(prev); n.delete(roleId); return n; });
        }
    }, [getAuthInfo]);

    const saveLockRoles = useCallback(async (roleId, newLockedIds, prevLockedIds) => {
        // Optimistic update
        setRoles(prev => prev.map(r => (r.id || r._id) === roleId ? { ...r, locked_roles: newLockedIds } : r));
        setSaving(prev => new Set([...prev, roleId]));
        try {
            const { authHeaders } = getAuthInfo();
            const res = await fetch(`${API_BASE_URL}/roles/${roleId}`, {
                method: 'PUT',
                headers: authHeaders,
                body: JSON.stringify({ locked_roles: newLockedIds }),
            });
            if (!res.ok) throw new Error('Save failed');
            setToast({ msg: `✓ Locked ${newLockedIds.length} role(s)`, type: 'success' });
        } catch (e) {
            setRoles(prev => prev.map(r => (r.id || r._id) === roleId ? { ...r, locked_roles: prevLockedIds } : r));
            setToast({ msg: '✗ Save failed', type: 'error' });
        } finally {
            setSaving(prev => { const n = new Set(prev); n.delete(roleId); return n; });
        }
    }, [getAuthInfo]);

    const doTogglePermission = useCallback((roleId, mod, action) => {
        const role = roles.find(r => (r.id || r._id) === roleId);
        if (!role) return;
        const prevPerms = role.permissions || [];
        const pageKey = getPageKey(mod);
        const hasPerm = checkRolePerm(role, mod, action);
        // All alias variants for this action (to remove old DB names too)
        const aliasSet = new Set(ACTION_ALIASES[action] || [action]);
        let newPerms;
        if (hasPerm) {
            if (action === 'show') {
                // CASCADE: Removing 'show' wipes ALL permissions for this page section.
                // This ensures no orphan inner-permissions remain when sidebar access is revoked.
                newPerms = prevPerms.filter(p => p.page !== pageKey);
            } else {
                // Remove only this action (and its aliases)
                newPerms = prevPerms.map(p => {
                    if (p.page !== pageKey) return p;
                    const newActions = (p.actions || []).filter(a => !aliasSet.has(a));
                    return newActions.length ? { ...p, actions: newActions } : null;
                }).filter(Boolean);
            }
        } else {
            // Add — always use the canonical UI action name
            const existing = prevPerms.find(p => p.page === pageKey);
            if (existing) {
                // Remove any old alias names first, then add the canonical name
                const cleaned = (existing.actions || []).filter(a => !aliasSet.has(a));
                newPerms = prevPerms.map(p => p.page === pageKey ? { ...p, actions: [...cleaned, action] } : p);
            } else {
                newPerms = [...prevPerms, { page: pageKey, actions: [action] }];
            }
        }

        // Cleanup ghost entries before saving:
        // 1) Drop any unified non-dotted "leads" entry when dotted leads.* entries exist
        // 2) Drop any entry with empty actions array (ghost from older saves)
        const hasDottedLeads = newPerms.some(p => p.page && typeof p.page === 'string' && p.page.startsWith('leads.'));
        const cleanedPerms = newPerms.filter(p => {
            if (!p || !p.page) return false;
            if (p.page === 'leads' && hasDottedLeads) return false;
            if (Array.isArray(p.actions) && p.actions.length === 0) return false;
            return true;
        });

        saveRole(roleId, cleanedPerms, prevPerms);
    }, [roles, saveRole]);

    const togglePermission = useCallback((roleId, mod, action) => {
        // Special workflow for employees.lock_role:
        // 1) First-time grant should enable permission and immediately open lock-role selector.
        // 2) Existing grant should open selector for editing locked role targets.
        if (action === 'lock_role' && getPageKey(mod) === 'employees') {
            const role = roles.find(r => (r.id || r._id) === roleId);
            if (!role) return;

            // Show-first check also applies to lock_role
            if (!checkRolePerm(role, mod, 'show')) {
                setToast({ msg: '⚠ Enable "Show in Sidebar" for this section first', type: 'warning' });
                return;
            }

            const hasLockPermission = checkRolePerm(role, mod, action);

            if (!hasLockPermission) {
                doTogglePermission(roleId, mod, action);
            }

            setLockRolesModal({
                roleId,
                roleName: role?.name || '',
                selectedIds: [...(role?.locked_roles || [])],
                searchTxt: '',
                mod,
                hasLockPermission: true,
            });
            return;
        }

        // SHOW-FIRST RULE: Non-show actions cannot be granted until 'show' is enabled.
        // This ensures sidebar visibility is always explicitly set before inner permissions.
        if (action !== 'show' && mod.actions.includes('show')) {
            const role = roles.find(r => (r.id || r._id) === roleId);
            if (role && !checkRolePerm(role, mod, 'show')) {
                setToast({ msg: '⚠ Enable "Show in Sidebar" for this section first', type: 'warning' });
                return;
            }
        }

        doTogglePermission(roleId, mod, action);
    }, [roles, doTogglePermission]);

    const toggleSuperAdmin = useCallback((roleId, currentlyIsSA) => {
        const role = roles.find(r => (r.id || r._id) === roleId);
        if (!role) return;
        const prevPerms = role.permissions || [];
        const newPerms = currentlyIsSA
            ? prevPerms.filter(p => p.page !== '*')
            : [{ page: '*', actions: '*' }];
        saveRole(roleId, newPerms, prevPerms);
    }, [roles, saveRole]);

    const getDeptName = (id) => departments.find(d => (d.id || d._id) === id)?.name || '-';
    const getReportNames = (role) => {
        const ids = role.reporting_ids || (role.reporting_id ? [role.reporting_id] : []);
        const names = ids.map(rid => roles.find(r => (r.id || r._id) === rid)?.name).filter(Boolean);
        return names.length > 0 ? names.join(', ') : 'Top Level';
    };

    const sortedRoles = useMemo(() => {
        let list = roles.filter(r => {
            if (compareFilter.length > 0 && !compareFilter.includes(r.id || r._id)) return false;
            if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
        list = [...list].sort((a, b) => {
            let av = '', bv = '';
            if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
            else if (sortKey === 'dept') { av = getDeptName(a.department_id); bv = getDeptName(b.department_id); }
            else if (sortKey === 'report') { av = getReportNames(a); bv = getReportNames(b); }
            else if (sortKey === 'perms') { return sortAsc ? getPermissionsCount(a.permissions) - getPermissionsCount(b.permissions) : getPermissionsCount(b.permissions) - getPermissionsCount(a.permissions); }
            return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
        return list;
    }, [roles, departments, search, compareFilter, sortKey, sortAsc]);

    const handleSort = (key) => {
        if (sortKey === key) setSortAsc(p => !p);
        else { setSortKey(key); setSortAsc(true); }
    };

    const SortIcon = ({ k }) => (
        <span className="ml-1 text-xs opacity-60">
            {sortKey === k ? (sortAsc ? '▲' : '▼') : '⇅'}
        </span>
    );

    const handleDownload = () => {
        const getDeptNameLocal = (id) => departments.find(d => (d.id || d._id) === id)?.name || '-';
        const getReportNamesLocal = (role) => {
            const ids = role.reporting_ids || (role.reporting_id ? [role.reporting_id] : []);
            const names = ids.map(rid => roles.find(r => (r.id || r._id) === rid)?.name).filter(Boolean);
            return names.length > 0 ? names.join(', ') : 'Top Level';
        };

        // Build action column headers
        const actionHeaders = permissionModules.map(mod =>
            mod.actions.map(a => `<th style="background:#111;color:#aaa;padding:6px 4px;font-size:10px;border:1px solid #222;white-space:nowrap;text-align:center;min-width:56px;">${ACTION_LABELS[a] || a}</th>`).join('')
        ).join('');
        const moduleHeaders = permissionModules.map((mod, i) =>
            `<th colspan="${mod.actions.length}" style="background:#0a0a0a;color:#ffd700;padding:10px 8px;font-size:10px;font-weight:700;text-transform:uppercase;${i > 0 ? 'border-left:3px solid #ffd700;' : ''}border-bottom:1px solid #222;text-align:center;white-space:nowrap;">${mod.label}</th>`
        ).join('');

        const rows = sortedRoles.map((role, ri) => {
            const superAdmin = role.permissions?.some(p => p.page === '*');
            const permCount = getPermissionsCount(role.permissions);
            const cells = permissionModules.map((mod, mi) =>
                mod.actions.map((action, ai) => {
                    const has = checkRolePerm(role, mod, action);
                    return `<td style="text-align:center;padding:8px 4px;${ai === 0 && mi > 0 ? 'border-left:3px solid #1a1400;' : 'border-left:1px solid #111;'}background:${has ? '#001a00' : 'transparent'};">${has ? '<span style="color:#00e676;font-size:14px;font-weight:700;">✓</span>' : '<span style="color:#222;font-size:12px;">·</span>'}</td>`;
                }).join('')
            ).join('');
            return `<tr style="border-bottom:1px solid #1a1a1a;background:${ri % 2 === 0 ? '#000' : '#050505'};">
                <td style="padding:10px 16px;border-right:2px solid #1a1a1a;background:#050505;min-width:200px;max-width:260px;">
                    <span style="display:flex;align-items:center;gap:8px;">
                        <span style="width:8px;height:8px;border-radius:50%;background:${superAdmin ? '#ffd700' : '#fff'};flex-shrink:0;display:inline-block;"></span>
                        <span style="font-weight:600;color:#fff;font-size:12px;">${role.name}</span>
                        ${superAdmin ? '<span style="background:#ffd700;color:#000;font-size:8px;font-weight:800;padding:1px 5px;border-radius:4px;">SA</span>' : ''}
                    </span>
                </td>
                <td style="padding:10px 16px;border-right:1px solid #111;white-space:nowrap;">
                    ${role.department_id ? `<span style="background:#111;border:1px solid #333;color:#ccc;padding:2px 8px;border-radius:4px;font-size:11px;">${getDeptNameLocal(role.department_id)}</span>` : '<span style="color:#444;">-</span>'}
                </td>
                <td style="padding:10px 16px;border-right:1px solid #111;white-space:nowrap;color:#aaa;font-size:11px;">${getReportNamesLocal(role)}</td>
                <td style="padding:10px 16px;border-right:1px solid #111;text-align:center;">
                    <span style="background:${permCount > 0 ? '#1a2600' : '#111'};color:${permCount > 0 ? '#7fff00' : '#444'};font-weight:700;padding:2px 8px;border-radius:4px;font-size:11px;">${permCount}</span>
                </td>
                ${cells}
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Roles & Permissions - ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#000;color:#fff;padding:20px;}
h1{font-size:1.6rem;font-weight:800;margin-bottom:4px;}
p.sub{color:#555;font-size:0.8rem;margin-bottom:20px;}
.wrapper{overflow-x:auto;}
table{border-collapse:collapse;font-size:12px;min-width:max-content;width:100%;}
thead th{position:sticky;top:0;z-index:10;}
</style>
</head>
<body>

<p class="sub">Generated on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · ${roles.length} roles · ${permissionModules.length} modules</p>
<div class="wrapper">
<table>
<thead>
<tr>
<th style="background:#000;color:#fff;padding:12px 16px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #333;border-right:2px solid #333;white-space:nowrap;min-width:200px;">Role Name</th>
<th style="background:#000;color:#fff;padding:12px 16px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #333;border-right:1px solid #222;white-space:nowrap;min-width:120px;">Department</th>
<th style="background:#000;color:#fff;padding:12px 16px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #333;border-right:1px solid #222;white-space:nowrap;min-width:120px;">Reports To</th>
<th style="background:#000;color:#fff;padding:12px 16px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #333;border-right:1px solid #222;white-space:nowrap;min-width:80px;">Perms</th>
${moduleHeaders}
</tr>
<tr>
<th style="background:#000;border-top:1px solid #222;border-bottom:1px solid #222;"></th>
<th style="background:#000;border-top:1px solid #222;border-bottom:1px solid #222;"></th>
<th style="background:#000;border-top:1px solid #222;border-bottom:1px solid #222;"></th>
<th style="background:#000;border-top:1px solid #222;border-bottom:1px solid #222;"></th>
${actionHeaders}
</tr>
</thead>
<tbody>${rows}</tbody>
</table>
</div>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Roles_Permissions_${new Date().toISOString().slice(0,10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div style={{ background: '#000', minHeight: embedded ? '300px' : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#fff' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid #333', borderTop: '3px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
                    <p>Loading roles...</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: '#000', height: embedded ? 'auto' : '100vh', minHeight: embedded ? '400px' : undefined, color: '#fff', fontFamily: 'Segoe UI, sans-serif', display: 'flex', flexDirection: 'column' }}>
            {/* Lock Roles Modal */}
            {lockRolesModal && (
                <div style={{ position: 'fixed', inset: 0, background: '#000c', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setLockRolesModal(null)}>
                    <div style={{ background: '#111', border: '2px solid #f59e0b', borderRadius: '14px', width: '460px', maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 64px #000e' }}
                        onClick={e => e.stopPropagation()}>

                        {/* Modal header */}
                        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid #222' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                <span style={{ fontSize: '22px' }}>🔒</span>
                                <div>
                                    <h2 style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1rem', margin: 0 }}>Lock Roles</h2>
                                    <p style={{ color: '#666', fontSize: '11px', margin: 0 }}>for <strong style={{ color: '#ccc' }}>{lockRolesModal.roleName}</strong></p>
                                </div>
                                <button onClick={() => setLockRolesModal(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#555', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
                            </div>
                            <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 10px', lineHeight: '1.5' }}>
                                Selected roles will be <strong style={{ color: '#f59e0b' }}>hidden</strong> from the role dropdown in Employee forms, and employees with those roles <strong style={{ color: '#f59e0b' }}>cannot be viewed</strong> by users of this role.
                            </p>
                            <input
                                value={lockRolesModal.searchTxt}
                                onChange={e => setLockRolesModal(p => ({ ...p, searchTxt: e.target.value }))}
                                placeholder="Search roles to lock…"
                                style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '6px 12px', borderRadius: '7px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                                autoFocus
                            />
                        </div>

                        {/* Role list */}
                        <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
                            {roles
                                .filter(r => {
                                    if ((r.id || r._id) === lockRolesModal.roleId) return false; // skip self
                                    if (lockRolesModal.searchTxt && !r.name.toLowerCase().includes(lockRolesModal.searchTxt.toLowerCase())) return false;
                                    return true;
                                })
                                .map(r => {
                                    const rid = r.id || r._id;
                                    const locked = lockRolesModal.selectedIds.includes(rid);
                                    return (
                                        <div key={rid}
                                            onClick={() => setLockRolesModal(p => ({ ...p, selectedIds: locked ? p.selectedIds.filter(x => x !== rid) : [...p.selectedIds, rid] }))}
                                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 20px', cursor: 'pointer', background: locked ? '#200d00' : 'transparent', borderLeft: locked ? '3px solid #f59e0b' : '3px solid transparent', transition: 'background 0.15s' }}
                                            onMouseEnter={e => { if (!locked) e.currentTarget.style.background = '#1a1a1a'; }}
                                            onMouseLeave={e => { if (!locked) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            {/* Checkbox */}
                                            <div style={{ width: '17px', height: '17px', border: `2px solid ${locked ? '#f59e0b' : '#444'}`, borderRadius: '4px', background: locked ? '#f59e0b' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {locked && <span style={{ color: '#000', fontSize: '11px', fontWeight: '900' }}>✓</span>}
                                            </div>
                                            <span style={{ color: locked ? '#fff' : '#bbb', fontSize: '13px', fontWeight: locked ? '700' : '400' }}>{r.name}</span>
                                            {r.permissions?.some(p => p.page === '*') && <span style={{ background: '#ffd700', color: '#000', fontSize: '8px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px' }}>SA</span>}
                                            {locked && <span style={{ marginLeft: 'auto', fontSize: '13px' }}>🔒</span>}
                                        </div>
                                    );
                                })
                            }
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '14px 22px', borderTop: '1px solid #222', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: '#666', fontSize: '12px', flex: 1 }}>
                                {lockRolesModal.selectedIds.length > 0
                                    ? <><strong style={{ color: '#f59e0b' }}>{lockRolesModal.selectedIds.length}</strong> role(s) will be locked</>
                                    : 'No roles locked'}
                            </span>
                            <button onClick={() => setLockRolesModal(null)}
                                style={{ background: 'transparent', border: '1px solid #444', color: '#aaa', padding: '7px 18px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                                Cancel
                            </button>
                            {lockRolesModal.hasLockPermission && (
                                <button
                                    onClick={() => {
                                        const role = roles.find(r => (r.id || r._id) === lockRolesModal.roleId);
                                        if (lockRolesModal.mod) {
                                            doTogglePermission(lockRolesModal.roleId, lockRolesModal.mod, 'lock_role');
                                        }
                                        if ((role?.locked_roles || []).length > 0) {
                                            saveLockRoles(lockRolesModal.roleId, [], role?.locked_roles || []);
                                        }
                                        setLockRolesModal(null);
                                    }}
                                    style={{ background: 'transparent', border: '1px solid #ef4444', color: '#fca5a5', padding: '7px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                                    title="Disable lock role permission and clear locked roles"
                                >
                                    Remove Permission
                                </button>
                            )}
                            <button onClick={() => {
                                const role = roles.find(r => (r.id || r._id) === lockRolesModal.roleId);
                                saveLockRoles(lockRolesModal.roleId, lockRolesModal.selectedIds, role?.locked_roles || []);
                                setLockRolesModal(null);
                            }}
                                style={{ background: '#f59e0b', border: '2px solid #f59e0b', color: '#000', padding: '7px 20px', borderRadius: '7px', cursor: 'pointer', fontWeight: '800', fontSize: '12px' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.borderColor = '#d97706'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.borderColor = '#f59e0b'; }}>
                                🔒 Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast — supports success / error / warning */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 16, right: 20, zIndex: 9999,
                    background: toast.type === 'success' ? '#1a3300' : toast.type === 'warning' ? '#2a1800' : '#3a0000',
                    border: `1px solid ${toast.type === 'success' ? '#7fff00' : toast.type === 'warning' ? '#f59e0b' : '#f44'}`,
                    color: toast.type === 'success' ? '#7fff00' : toast.type === 'warning' ? '#fbbf24' : '#f88',
                    padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px',
                    boxShadow: '0 4px 20px #0008'
                }}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ background: '#0a0a0a', borderBottom: '1px solid #222', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
                {!embedded && (
                <button
                    onClick={() => navigate('/settings')}
                    style={{ background: 'transparent', border: '2px solid #444', color: '#fff', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '0.85rem', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#fff'; e.currentTarget.style.background = '#111'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = 'transparent'; }}
                >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '15px', height: '15px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                )}

                <div>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, lineHeight: 1.2 }}>📊 Roles &amp; Permissions</h1>
                    <p style={{ color: '#666', fontSize: '0.75rem', margin: 0 }}>{roles.length} roles · {permissionModules.length} modules{compareFilter.length > 0 ? ` · ${compareFilter.length} selected` : ''}</p>
                </div>

                <div style={{ flex: 1 }} />

                {/* Search */}
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search roles..."
                    style={{ background: '#111', border: '1px solid #333', color: '#fff', padding: '7px 12px', borderRadius: '8px', width: '180px', fontSize: '0.83rem', outline: 'none' }}
                />

                {/* Compare Selector */}
                <div ref={compareRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setCompareOpen(p => !p)}
                        style={{ background: compareFilter.length > 0 ? '#1a2600' : '#111', border: `2px solid ${compareFilter.length > 0 ? '#7fff00' : '#444'}`, color: compareFilter.length > 0 ? '#7fff00' : '#ccc', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '700', fontSize: '0.83rem', whiteSpace: 'nowrap' }}
                        title="Select roles to compare"
                    >
                        🔍 Compare Roles {compareFilter.length > 0 && `(${compareFilter.length})`}
                    </button>
                    {compareOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#111', border: '1px solid #333', borderRadius: '10px', width: '260px', maxHeight: '340px', display: 'flex', flexDirection: 'column', zIndex: 999, boxShadow: '0 8px 32px #000a' }}>
                            <div style={{ padding: '10px 12px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    value={compareSearch}
                                    onChange={e => setCompareSearch(e.target.value)}
                                    placeholder="Filter roles…"
                                    style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                                />
                                {compareFilter.length > 0 && (
                                    <button onClick={() => setCompareFilter([])} style={{ background: 'transparent', border: 'none', color: '#f66', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear all</button>
                                )}
                            </div>
                            <div style={{ overflowY: 'auto', padding: '6px 0' }}>
                                {roles
                                    .filter(r => !compareSearch || r.name.toLowerCase().includes(compareSearch.toLowerCase()))
                                    .map(r => {
                                        const rid = r.id || r._id;
                                        const selected = compareFilter.includes(rid);
                                        return (
                                            <div key={rid} onClick={() => setCompareFilter(prev => selected ? prev.filter(x => x !== rid) : [...prev, rid])}
                                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 14px', cursor: 'pointer', background: selected ? '#1a2600' : 'transparent', borderLeft: selected ? '3px solid #7fff00' : '3px solid transparent' }}
                                                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#1a1a1a'; }}
                                                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <div style={{ width: '16px', height: '16px', border: `2px solid ${selected ? '#7fff00' : '#444'}`, borderRadius: '4px', background: selected ? '#7fff00' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {selected && <span style={{ color: '#000', fontSize: '10px', fontWeight: '900' }}>✓</span>}
                                                </div>
                                                <span style={{ color: selected ? '#fff' : '#ccc', fontSize: '12px' }}>{r.name}</span>
                                                {r.permissions?.some(p => p.page === '*') && <span style={{ background: '#ffd700', color: '#000', fontSize: '8px', fontWeight: '800', padding: '1px 4px', borderRadius: '3px', marginLeft: 'auto' }}>SA</span>}
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Download Button */}
                <button
                    onClick={handleDownload}
                    style={{ background: '#111', border: '2px solid #ffd700', color: '#ffd700', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '700', fontSize: '0.83rem', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#ffd700'; e.currentTarget.style.color = '#000'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.color = '#ffd700'; }}
                    title="Download comparison as HTML"
                >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '15px', height: '15px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                </button>
            </div>


            {/* Table — flex:1 fills remaining height, overflow scrolls inside */}
            <div style={{ flex: embedded ? undefined : 1, overflow: 'auto', maxHeight: embedded ? '70vh' : undefined }}>
                <table style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: 'max-content', width: '100%' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 50 }}>
                        {/* Row 1: fixed cols (rowSpan=2) + module names (colSpan=n) */}
                        <tr>
                            <th rowSpan={2} onClick={() => handleSort('name')} style={thFixed()}>
                                Role Name <SortIcon k="name" />
                            </th>
                            <th rowSpan={2} onClick={() => handleSort('dept')} style={thSticky(1)}>
                                Department <SortIcon k="dept" />
                            </th>
                            <th rowSpan={2} onClick={() => handleSort('report')} style={thSticky(2)}>
                                Reports To <SortIcon k="report" />
                            </th>
                            <th rowSpan={2} onClick={() => handleSort('perms')} style={thSticky(3)}>
                                Perms <SortIcon k="perms" />
                            </th>
                            <th rowSpan={2} style={thSA()}>SA</th>
                            {permissionModules.map((mod, i) => (
                                <th key={i} colSpan={mod.actions.length} style={{
                                    background: '#0a0a0a',
                                    color: '#ffd700',
                                    padding: '8px 8px 4px',
                                    fontWeight: '700',
                                    fontSize: '10px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    borderLeft: i > 0 ? '3px solid #ffd700' : 'none',
                                    borderBottom: '1px solid #333',
                                    whiteSpace: 'nowrap',
                                    textAlign: 'center',
                                }}>
                                    {mod.label}
                                </th>
                            ))}
                        </tr>
                        {/* Row 2: action names only (fixed cols have rowSpan=2) */}
                        <tr>
                            {permissionModules.map((mod, mi) =>
                                mod.actions.map((action, ai) => (
                                    <th key={`${mi}-${ai}`} style={{
                                        background: '#111',
                                        color: '#aaa',
                                        padding: '4px 6px 6px',
                                        fontWeight: '600',
                                        fontSize: '10px',
                                        borderLeft: ai === 0 && mi > 0 ? '3px solid #ffd700' : '1px solid #1a1a1a',
                                        borderBottom: '2px solid #333',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'center',
                                        minWidth: '56px',
                                    }}>
                                        {ACTION_LABELS[action] || action}
                                    </th>
                                ))
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRoles.length === 0 && (
                            <tr>
                                <td colSpan={4 + permissionModules.reduce((s, m) => s + m.actions.length, 0)}
                                    style={{ textAlign: 'center', padding: '40px', color: '#555', background: '#000' }}>
                                    {search ? 'No roles match your search.' : 'No roles found.'}
                                </td>
                            </tr>
                        )}
                        {sortedRoles.map((role, ri) => {
                            const isSuperAdmin = role.permissions?.some(p => p.page === '*');
                            const permCount = getPermissionsCount(role.permissions);

                            return (
                                <tr key={role._id || role.id}
                                    style={{ borderBottom: '1px solid #1a1a1a', background: ri % 2 === 0 ? '#000' : '#050505' }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = '#0d0d0d';
                                        e.currentTarget.querySelectorAll('td[data-sticky]').forEach(td => td.style.background = '#0d0d0d');
                                    }}
                                    onMouseLeave={e => {
                                        const bg = ri % 2 === 0 ? '#000' : '#050505';
                                        e.currentTarget.style.background = bg;
                                        e.currentTarget.querySelectorAll('td[data-sticky]').forEach(td => td.style.background = ri % 2 === 0 ? '#050505' : '#060606');
                                    }}
                                >
                                    {/* Role Name */}
                                    <td data-sticky="true" style={{ ...tdFixed(), background: ri % 2 === 0 ? '#050505' : '#060606' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {saving.has(role.id || role._id) ? (
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '2px solid #ffd700', borderTop: '2px solid transparent', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                                            ) : (
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isSuperAdmin ? '#ffd700' : '#fff', flexShrink: 0 }}></div>
                                            )}
                                            <span style={{ fontWeight: '600', color: '#fff', fontSize: '12px' }}>{role.name}</span>
                                            {isSuperAdmin && (
                                                <span style={{ background: '#ffd700', color: '#000', fontSize: '8px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px' }}>SA</span>
                                            )}
                                        </div>
                                    </td>
                                    {/* Department */}
                                    <td data-sticky="true" style={tdSticky(1, ri % 2 === 0 ? '#050505' : '#060606')}>
                                        {role.department_id ? (
                                            <span style={{ background: '#111', border: '1px solid #333', color: '#ccc', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                                                {getDeptName(role.department_id)}
                                            </span>
                                        ) : <span style={{ color: '#444' }}>-</span>}
                                    </td>
                                    {/* Reports To */}
                                    <td data-sticky="true" style={tdSticky(2, ri % 2 === 0 ? '#050505' : '#060606')}>
                                        <span style={{ color: '#aaa', fontSize: '11px' }}>{getReportNames(role)}</span>
                                    </td>
                                    {/* Perm Count */}
                                    <td data-sticky="true" style={{ ...tdSticky(3, ri % 2 === 0 ? '#050505' : '#060606'), textAlign: 'center' }}>
                                        <span style={{ background: permCount > 0 ? '#1a2600' : '#111', color: permCount > 0 ? '#7fff00' : '#444', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                                            {permCount}
                                        </span>
                                    </td>
                                    {/* SA Toggle */}
                                    <td data-sticky="true" style={{ ...tdSA(ri % 2 === 0 ? '#050505' : '#060606') }}>
                                        <div
                                            onClick={() => toggleSuperAdmin(role.id || role._id, isSuperAdmin)}
                                            title={isSuperAdmin ? 'Remove Super Admin' : 'Grant Super Admin'}
                                            style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', position: 'relative', width: '40px', height: '22px', borderRadius: '11px', background: isSuperAdmin ? '#ffd700' : '#333', transition: 'background 0.25s', border: isSuperAdmin ? '1.5px solid #b8a000' : '1.5px solid #555', flexShrink: 0 }}
                                        >
                                            <div style={{ position: 'absolute', left: isSuperAdmin ? '20px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: isSuperAdmin ? '#000' : '#888', transition: 'left 0.25s', boxShadow: '0 1px 4px #0008' }} />
                                        </div>
                                    </td>
                                    {/* Permission cells */}
                                    {permissionModules.map((mod, mi) =>
                                        mod.actions.map((action, ai) => {
                                            const has = checkRolePerm(role, mod, action);
                                            // A non-show cell is "locked" when show is not yet enabled for this module
                                            const isLocked = action !== 'show' && mod.actions.includes('show') && !checkRolePerm(role, mod, 'show');
                                            return (
                                                <td key={`${mi}-${ai}`}
                                                    onClick={() => togglePermission(role.id || role._id, mod, action)}
                                                    title={
                                                        isLocked
                                                            ? `Enable "Show in Sidebar" for ${mod.label} first`
                                                            : action === 'lock_role'
                                                                ? `Lock Roles for ${role.name} — ${(role.locked_roles || []).length} locked`
                                                                : `${has ? 'Remove' : 'Add'} "${ACTION_LABELS[action] || action}" for ${mod.label}`
                                                    }
                                                    style={{
                                                        textAlign: 'center',
                                                        padding: '7px 4px',
                                                        borderLeft: ai === 0 && mi > 0 ? '3px solid #1a1400' : '1px solid #111',
                                                        background: action === 'lock_role'
                                                            ? ((role.locked_roles || []).length > 0 ? '#200d00' : 'transparent')
                                                            : has ? '#001a00' : 'transparent',
                                                        cursor: isLocked ? 'not-allowed' : 'pointer',
                                                        transition: 'background 0.15s',
                                                        opacity: isLocked ? 0.38 : 1,
                                                    }}
                                                    onMouseEnter={e => {
                                                        if (isLocked) return;
                                                        e.currentTarget.style.background = action === 'lock_role' ? '#2a1200' : (has ? '#002a00' : '#181800');
                                                        e.currentTarget.style.outline = `1px solid ${action === 'lock_role' ? '#f59e0b66' : '#ffd70066'}`;
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.background = action === 'lock_role'
                                                            ? ((role.locked_roles || []).length > 0 ? '#200d00' : 'transparent')
                                                            : (has ? '#001a00' : 'transparent');
                                                        e.currentTarget.style.outline = 'none';
                                                    }}
                                                >
                                                    {action === 'lock_role' ? (
                                                        (role.locked_roles || []).length > 0
                                                            ? <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: '700' }}>🔒 {role.locked_roles.length}</span>
                                                            : <span style={{ color: '#444', fontSize: '13px' }}>🔓</span>
                                                    ) : has ? (
                                                        /* Enabled — green filled checkbox */
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            width: '18px', height: '18px', borderRadius: '4px',
                                                            background: '#00c853', border: '1.5px solid #00e676',
                                                            color: '#000', fontSize: '11px', fontWeight: '900',
                                                            boxShadow: '0 0 6px #00c85366',
                                                        }}>✓</span>
                                                    ) : isLocked ? (
                                                        /* Locked (show not enabled) — dim padlock */
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            width: '18px', height: '18px', borderRadius: '4px',
                                                            border: '1.5px solid #333', color: '#444', fontSize: '10px',
                                                            background: '#0a0a0a',
                                                        }}>🔒</span>
                                                    ) : (
                                                        /* Disabled — hollow white checkbox (classic unchecked look) */
                                                        <span style={{
                                                            display: 'inline-block',
                                                            width: '18px', height: '18px', borderRadius: '4px',
                                                            border: '1.5px solid #aaa', background: '#fff',
                                                        }} />
                                                    )}
                                                </td>
                                            );
                                        })
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
