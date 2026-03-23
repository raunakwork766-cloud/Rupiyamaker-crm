import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Edit, Trash2, Search, CheckCircle, Users, Shield } from 'lucide-react';

const StatusManagementTab = ({
    statuses,
    selectedDepartment,
    setSelectedDepartment,
    showStatusModal,
    setShowStatusModal,
    showSubStatusModal,
    setShowSubStatusModal,
    statusModalType,
    setStatusModalType,
    subStatusModalType,
    setSubStatusModalType,
    editingStatus,
    setEditingStatus,
    editingSubStatus,
    setEditingSubStatus,
    selectedStatus,
    setSelectedStatus,
    createStatus,
    updateStatus,
    deleteStatus,
    deleteSubStatusFromArray,
    createSubStatus,
    updateSubStatus,
    deleteSubStatus
}) => {
    // ── Active tab: 'statuses' or 'permissionRoles' ──
    const [activeInnerTab, setActiveInnerTab] = useState('statuses');

    const [isStatusFormSubmitting, setIsStatusFormSubmitting] = useState(false);
    const [isSubStatusFormSubmitting, setIsSubStatusFormSubmitting] = useState(false);
    // Track saving state per-status for inline edits
    const [savingId, setSavingId] = useState(null);
    // Local edits for reassign days (status_id -> value)
    const [reassignEdits, setReassignEdits] = useState({});

    // ── Permission Roles tab state ──
    const [allRoles, setAllRoles] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [approvalRoutes, setApprovalRoutes] = useState([]);
    const [permSelectedRole, setPermSelectedRole] = useState(null);
    const [permSelectedApprovers, setPermSelectedApprovers] = useState([]);
    const [permRoleSearch, setPermRoleSearch] = useState('');
    const [permEmpSearch, setPermEmpSearch] = useState('');
    const [permSaving, setPermSaving] = useState(false);

    const getUserData = useCallback(() => {
        try {
            const raw = localStorage.getItem('userData');
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    userId: parsed.user_id || '',
                    headers: parsed.access_token
                        ? { 'Authorization': `Bearer ${parsed.access_token}`, 'Content-Type': 'application/json' }
                        : { 'Content-Type': 'application/json' },
                };
            }
        } catch (_) {}
        const uid = localStorage.getItem('userId') || localStorage.getItem('user_id') || '';
        return { userId: uid, headers: { 'Content-Type': 'application/json' } };
    }, []);

    // Load roles, employees, and existing routes when Permission Roles tab is activated
    useEffect(() => {
        if (activeInnerTab !== 'permissionRoles') return;
        const load = async () => {
            try {
                const { userId, headers } = getUserData();
                const [rolesRes, empsRes, routesRes] = await Promise.all([
                    fetch(`/api/roles/?user_id=${userId}`, { headers }).then(r => r.json()),
                    fetch(`/api/users/?user_id=${userId}&is_active=true`, { headers }).then(r => r.json()),
                    fetch(`/api/settings/reassignment-approval-routes?user_id=${userId}`, { headers }).then(r => r.json()),
                ]);
                setAllRoles(Array.isArray(rolesRes) ? rolesRes : []);
                const users = Array.isArray(empsRes) ? empsRes : (empsRes.employees || empsRes.data || []);
                setAllEmployees(
                    users
                        .filter(u => u.employee_status !== 'inactive' && String(u.login_enabled).toLowerCase() !== 'false')
                        .map(u => ({
                        ...u,
                        id: u._id || u.id,
                        name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Unknown',
                    }))
                );
                setApprovalRoutes(Array.isArray(routesRes.data) ? routesRes.data : []);
            } catch (e) { console.error('Error loading permission roles data', e); }
        };
        load();
    }, [activeInnerTab, getUserData]);

    const handlePermRoleSelect = useCallback((roleId) => {
        setPermSelectedRole(roleId);
        setPermEmpSearch('');
        const route = approvalRoutes.find(r => r.role_id === roleId);
        setPermSelectedApprovers(route ? (route.approver_ids || []) : []);
    }, [approvalRoutes]);

    const toggleApprover = useCallback((empId) => {
        setPermSelectedApprovers(prev =>
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    }, []);

    const handlePermSave = useCallback(async () => {
        if (!permSelectedRole || permSelectedApprovers.length === 0) return;
        setPermSaving(true);
        try {
            const { userId: uid, headers } = getUserData();
            const role = allRoles.find(r => (r.id || r._id) === permSelectedRole);
            const approverNames = permSelectedApprovers.map(id => {
                const emp = allEmployees.find(e => String(e._id || e.id) === id);
                if (!emp) return 'Unknown';
                return emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown';
            });
            const res = await fetch(`/api/settings/reassignment-approval-routes?user_id=${uid}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    role_id: permSelectedRole,
                    role_name: role?.name || '',
                    approver_ids: permSelectedApprovers,
                    approver_names: approverNames,
                }),
            });
            if (res.ok) {
                const d = await res.json();
                setApprovalRoutes(prev => {
                    const idx = prev.findIndex(r => r.role_id === permSelectedRole);
                    if (idx >= 0) { const next = [...prev]; next[idx] = d.data; return next; }
                    return [...prev, d.data];
                });
            }
        } catch (e) { console.error(e); }
        setPermSaving(false);
    }, [permSelectedRole, permSelectedApprovers, allRoles, allEmployees, getUserData]);

    const handlePermDelete = useCallback(async (roleId) => {
        if (!window.confirm('Remove approval routing for this role?')) return;
        try {
            const { userId: uid, headers } = getUserData();
            const res = await fetch(`/api/settings/reassignment-approval-routes/${roleId}?user_id=${uid}`, { method: 'DELETE', headers });
            if (res.ok) {
                setApprovalRoutes(prev => prev.filter(r => r.role_id !== roleId));
                if (permSelectedRole === roleId) { setPermSelectedRole(null); setPermSelectedApprovers([]); }
            }
        } catch (e) { console.error(e); }
    }, [getUserData, permSelectedRole]);

    // ── Cooldown period state ──────────────────────────────────────────────────
    const [cooldownHours, setCooldownHours] = useState(24);
    const [cooldownInput, setCooldownInput] = useState('');
    const [cooldownSaving, setCooldownSaving] = useState(false);
    const [cooldownLoaded, setCooldownLoaded] = useState(false);

    useEffect(() => {
        const userId = localStorage.getItem('userId') || localStorage.getItem('user_id') || '';
        fetch(`/api/settings/cooldown-period?user_id=${userId}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) { setCooldownHours(d.hours); setCooldownInput(String(d.hours)); } })
            .catch(() => {})
            .finally(() => setCooldownLoaded(true));
    }, []);

    const handleCooldownSave = async () => {
        const h = parseInt(cooldownInput, 10);
        if (isNaN(h) || h < 1 || h > 168) return;
        const userId = localStorage.getItem('userId') || localStorage.getItem('user_id') || '';
        setCooldownSaving(true);
        try {
            const res = await fetch(`/api/settings/cooldown-period?user_id=${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hours: h })
            });
            if (res.ok) setCooldownHours(h);
        } catch {}
        setCooldownSaving(false);
    };

    const statusesArray = Array.isArray(statuses) ? statuses : [];

    const handleToggleManager = async (status) => {
        const id = status._id || status.id;
        setSavingId(id + '_mgr');
        await updateStatus(id, {
            is_manager_permission_required: !status.is_manager_permission_required
        });
        setSavingId(null);
    };

    const handleReassignSave = async (status) => {
        const id = status._id || status.id;
        const val = reassignEdits[id];
        if (val === undefined) return;
        const days = parseInt(val, 10);
        if (isNaN(days) || days < 0) return;
        setSavingId(id + '_days');
        await updateStatus(id, { reassignment_period: days });
        setSavingId(null);
        setReassignEdits(prev => { const n = {...prev}; delete n[id]; return n; });
    };

    return (
        <div className="p-6 bg-gray-900 text-white">
            <h2 className="text-2xl font-bold mb-4 text-white">Status Management</h2>

            {/* ── Inner Tab Bar ──────────────────────────────────────────── */}
            <div className="flex gap-1 mb-4 border-b border-gray-700 pb-1">
                <button
                    onClick={() => setActiveInnerTab('statuses')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-t text-sm font-semibold transition-colors ${
                        activeInnerTab === 'statuses'
                            ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                            : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                    <Edit className="w-4 h-4" /> Statuses
                </button>
                <button
                    onClick={() => setActiveInnerTab('permissionRoles')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-t text-sm font-semibold transition-colors ${
                        activeInnerTab === 'permissionRoles'
                            ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                            : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                    <Shield className="w-4 h-4" /> Permission Roles
                </button>
            </div>

            {/* ═══════ Statuses Tab ═══════ */}
            {activeInnerTab === 'statuses' && (<>

            {/* ── Cooldown Period Section ────────────────────────────────── */}
            <div className="mb-6 p-4 bg-gray-800 border border-gray-600 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
                    <span className="text-amber-400 font-bold text-sm uppercase tracking-wider">Cooldown Period</span>
                    <span className="text-gray-400 text-xs ml-1">(After a transfer request is submitted, no new request can be made until this time passes)</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="1"
                            max="168"
                            value={cooldownInput}
                            onChange={e => setCooldownInput(e.target.value)}
                            onBlur={handleCooldownSave}
                            onKeyDown={e => e.key === 'Enter' && handleCooldownSave()}
                            disabled={cooldownSaving || !cooldownLoaded}
                            className="w-20 text-center px-2 py-1.5 rounded border border-gray-500 bg-black text-white text-sm disabled:opacity-50 focus:border-amber-400 outline-none"
                        />
                        <span className="text-gray-300 text-sm font-medium">hours</span>
                    </div>
                    <button
                        onClick={handleCooldownSave}
                        disabled={cooldownSaving || !cooldownLoaded}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded transition-colors disabled:opacity-50"
                    >
                        {cooldownSaving ? 'Saving...' : 'Save'}
                    </button>
                    <span className="text-gray-400 text-xs">
                        {cooldownLoaded ? `Current: ${cooldownHours}h` : 'Loading...'}
                    </span>
                </div>
            </div>

            <div className="flex gap-4 mb-4">
                <select
                    value={selectedDepartment}
                    onChange={e => setSelectedDepartment(e.target.value)}
                    className="px-3 py-2 rounded border border-gray-600 bg-black text-white"
                >
                    <option value="">Select Department</option>
                    <option value="leads">Leads</option>
                    <option value="login">Login</option>
                </select>
                <button
                    className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 flex items-center gap-2"
                    onClick={() => { 
                        setStatusModalType('add'); 
                        setEditingStatus(null); 
                        setShowStatusModal(true); 
                    }}
                >
                    <Plus size={18}/> Add Status
                </button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full bg-black text-white border border-gray-700 rounded">
                    <thead>
                        <tr className="bg-gray-800">
                            <th className="px-4 py-2 text-left">Status Name</th>
                            <th className="px-4 py-2 text-left">Department</th>
                            <th className="px-4 py-2 text-center">Order</th>
                            <th className="px-4 py-2 text-left">Color</th>
                            <th className="px-4 py-2 text-center">Reassign (days)</th>
                            <th className="px-4 py-2 text-center">Manager Approval</th>
                            <th className="px-4 py-2 text-left">Sub-Options</th>
                            <th className="px-4 py-2 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {statusesArray
                            .filter(status => {
                                // Handle both old format (status.department) and new format (department_ids)
                                if (selectedDepartment === '') return true; // Show all if no department selected
                                
                                // Check if status has department field (old format)
                                if (status.department) {
                                    return status.department === selectedDepartment;
                                }
                                
                                // Check if status has department_ids field (new format)
                                if (status.department_ids) {
                                    // If department_ids is an array, check if selectedDepartment is in it
                                    if (Array.isArray(status.department_ids)) {
                                        return status.department_ids.includes(selectedDepartment);
                                    }
                                    // If department_ids is a string, compare directly
                                    return status.department_ids === selectedDepartment;
                                }
                                
                                // If department_ids is null/undefined, show the status (assume it's for all departments)
                                console.log('Showing status with null department_ids:', status.name);
                                return true;
                            })
                            .map(status => (
                            <tr key={status._id || status.id} className="border-b border-gray-700 hover:bg-gray-800">
                                <td className="px-4 py-3 font-semibold">{status.name}</td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-1 rounded text-xs bg-blue-600 text-white">
                                        {status.department || (status.department_ids ? 
                                            (Array.isArray(status.department_ids) ? status.department_ids.join(', ') : status.department_ids) 
                                            : 'All Departments')}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">{status.order || 0}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div 
                                            className="w-4 h-4 rounded" 
                                            style={{ backgroundColor: status.color || '#6B7280' }}
                                        ></div>
                                        <span className="text-xs">{status.color || '#6B7280'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {(() => {
                                        const id = status._id || status.id;
                                        const editVal = reassignEdits[id];
                                        const currentVal = editVal !== undefined ? editVal : (status.reassignment_period ?? 0);
                                        const isSaving = savingId === id + '_days';
                                        return (
                                            <div className="flex items-center justify-center gap-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={currentVal}
                                                    disabled={isSaving}
                                                    onChange={e => setReassignEdits(prev => ({...prev, [id]: e.target.value}))}
                                                    onBlur={() => handleReassignSave(status)}
                                                    onKeyDown={e => e.key === 'Enter' && handleReassignSave(status)}
                                                    className="w-16 text-center px-1 py-0.5 rounded border border-gray-600 bg-black text-white text-sm disabled:opacity-50"
                                                />
                                                {isSaving && <span className="text-xs text-gray-400">...</span>}
                                            </div>
                                        );
                                    })()}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {(() => {
                                        const id = status._id || status.id;
                                        const isSaving = savingId === id + '_mgr';
                                        const isOn = !!status.is_manager_permission_required;
                                        return (
                                            <button
                                                onClick={() => handleToggleManager(status)}
                                                disabled={isSaving}
                                                title={isOn ? 'Required — click to disable' : 'Not Required — click to enable'}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                                                    isOn ? 'bg-green-500' : 'bg-gray-600'
                                                }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                                    isOn ? 'translate-x-6' : 'translate-x-1'
                                                }`}/>
                                            </button>
                                        );
                                    })()}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="max-w-xs">
                                        {/* Sub-options Header with Add Button */}
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-300">
                                                Sub-Options ({(status.sub_statuses || []).length})
                                            </span>
                                            <button
                                                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors"
                                                onClick={() => { 
                                                    setSelectedStatus(status); 
                                                    setSubStatusModalType('add'); 
                                                    setEditingSubStatus(null); 
                                                    setShowSubStatusModal(true); 
                                                }}
                                                title="Add Sub-Option"
                                            >
                                                <Plus size={12}/> Add
                                            </button>
                                        </div>
                                        
                                        {/* Sub-options List */}
                                        {(status.sub_statuses || []).length > 0 ? (
                                            <div className="space-y-1 border border-gray-600 rounded p-2 bg-gray-800">
                                                {(status.sub_statuses || []).map((sub, index) => (
                                                    <div key={index} className="flex items-center justify-between p-1 hover:bg-gray-700 rounded">
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <span className="text-sm text-white">{typeof sub === 'string' ? sub : sub.name}</span>
                                                            <div className="flex gap-1">
                                                                {typeof sub === 'object' && sub.reassignment_period > 0 && (
                                                                    <span className="text-xs px-1 py-0.5 bg-blue-700 text-white rounded" title="Reassignment Period">{sub.reassignment_period}d</span>
                                                                )}
                                                                {typeof sub === 'object' && sub.is_manager_permission_required && (
                                                                    <span className="text-xs px-1 py-0.5 bg-green-700 text-white rounded" title="Manager Permission Required">M</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            {typeof sub === 'object' && (
                                                                <button
                                                                    className="text-blue-400 hover:text-blue-300 p-1"
                                                                    onClick={() => { 
                                                                        setSelectedStatus(status); 
                                                                        setEditingSubStatus(sub);
                                                                        setSubStatusModalType('edit'); 
                                                                        setShowSubStatusModal(true); 
                                                                    }}
                                                                    title="Edit Sub-Option"
                                                                >
                                                                    <Edit size={12}/>
                                                                </button>
                                                            )}
                                                            <button
                                                                className="text-red-400 hover:text-red-300 p-1"
                                                                onClick={async () => { 
                                                                    if (window.confirm('Are you sure you want to delete this sub-option?')) {
                                                                        if (typeof sub === 'object' && sub._id) {
                                                                            await deleteSubStatus(sub._id);
                                                                        } else {
                                                                            await deleteSubStatusFromArray(status._id || status.id, sub, index); 
                                                                        }
                                                                    }
                                                                }}
                                                                title="Delete Sub-Option"
                                                            >
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-gray-400 text-sm text-center py-2 border border-gray-600 rounded bg-gray-800">
                                                No sub-options
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2 justify-center">
                                        <button
                                            className="text-blue-400 hover:text-blue-300 p-1"
                                            onClick={() => { 
                                                setEditingStatus(status); 
                                                setStatusModalType('edit'); 
                                                setShowStatusModal(true); 
                                            }}
                                            title="Edit Status"
                                        >
                                            <Edit size={16}/>
                                        </button>
                                        <button
                                            className="text-red-400 hover:text-red-300 p-1"
                                            onClick={async () => { 
                                                if (window.confirm('Are you sure you want to delete this status? This will also delete all its sub-options.')) {
                                                    await deleteStatus(status._id || status.id); 
                                                }
                                            }}
                                            title="Delete Status"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Status Modal */}
            {showStatusModal && (
                <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1b2230] border border-gray-600 rounded-lg w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-600">
                            <h3 className="text-xl font-bold text-white">
                                {statusModalType === 'add' ? 'Add Status' : 'Edit Status'}
                            </h3>
                            <button
                                onClick={() => setShowStatusModal(false)}
                                className="text-gray-400 hover:text-white hover:bg-gray-700 rounded-full p-1 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                        <form id="statusForm" onSubmit={async e => {
                            e.preventDefault();
                            
                            // Set loading state
                            setIsStatusFormSubmitting(true);
                            
                            try {
                                const name = e.target.statusName.value.trim();
                                const color = e.target.color.value.trim();
                                const orderValue = e.target.order.value.trim();
                                const reassignmentPeriodValue = e.target.reassignmentPeriod.value.trim();
                                
                                // Handle empty values properly
                                const order = orderValue === '' ? 1 : parseInt(orderValue, 10);
                                const reassignmentPeriod = reassignmentPeriodValue === '' ? 0 : parseInt(reassignmentPeriodValue, 10);
                                const isManagerPermissionRequired = e.target.isManagerPermissionRequired?.checked || false;
                                
                                if (!name) return;
                                
                                const payload = { 
                                    name, 
                                    department_ids: selectedDepartment === 'all' ? null : [selectedDepartment], 
                                    order, 
                                    color: color || '#6B7280',
                                    is_active: true,
                                    reassignment_period: reassignmentPeriod,
                                    is_manager_permission_required: isManagerPermissionRequired,
                                    description: null // Add description field as shown in API response
                                };
                                
                                let ok = false;
                                if (statusModalType === 'add') {
                                    ok = await createStatus(payload);
                                } else if (statusModalType === 'edit' && editingStatus) {
                                    ok = await updateStatus(editingStatus._id || editingStatus.id, payload);
                                }
                                
                                if (ok) setShowStatusModal(false);
                            } finally {
                                // Always reset loading state
                                setIsStatusFormSubmitting(false);
                            }
                        }}>
                            <input
                                name="statusName"
                                defaultValue={editingStatus?.name || ''}
                                placeholder="Status Name"
                                required
                                className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                            />
                            <input
                                name="color"
                                type="color"
                                defaultValue={editingStatus?.color || '#6B7280'}
                                className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                            />
                            <input
                                name="order"
                                type="number"
                                defaultValue={editingStatus?.order || ''}
                                placeholder="Order"
                                min="1"
                                className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                            />
                            <input
                                name="reassignmentPeriod"
                                type="number"
                                defaultValue={editingStatus?.reassignment_period || ''}
                                placeholder="Reassignment Period (in days)"
                                min="0"
                                className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                            />
                            <div className="flex items-center mb-4">
                                <input
                                    name="isManagerPermissionRequired"
                                    type="checkbox"
                                    id="isManagerPermissionRequired"
                                    defaultChecked={editingStatus?.is_manager_permission_required || false}
                                    className="mr-2 h-4 w-4"
                                />
                                <label htmlFor="isManagerPermissionRequired" className="text-white">
                                    Manager approval required
                                </label>
                            </div>
                        </form>
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="flex justify-end gap-2 p-6 border-t border-gray-600">
                            <button 
                                type="button" 
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors" 
                                onClick={() => setShowStatusModal(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                form="statusForm"
                                disabled={isStatusFormSubmitting}
                                className={`px-4 py-2 text-white rounded transition-colors ${
                                    isStatusFormSubmitting 
                                        ? 'bg-gray-500 cursor-not-allowed' 
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {isStatusFormSubmitting ? 'Saving...' : (statusModalType === 'add' ? 'Add' : 'Update')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Status Modal */}
            {showSubStatusModal && (
                <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1b2230] border border-gray-600 rounded-lg w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-600">
                            <h3 className="text-xl font-bold text-white">
                                {subStatusModalType === 'add' ? 'Add Sub-Status' : 'Edit Sub-Status'}
                            </h3>
                            <button
                                onClick={() => setShowSubStatusModal(false)}
                                className="text-gray-400 hover:text-white hover:bg-gray-700 rounded-full p-1 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                        <form id="subStatusForm" onSubmit={async e => {
                            e.preventDefault();
                            
                            // Set loading state
                            setIsSubStatusFormSubmitting(true);
                            
                            try {
                                const name = e.target.subStatusName.value.trim();
                                const reassignmentPeriodValue = e.target.reassignmentPeriod.value.trim();
                                const reassignmentPeriod = reassignmentPeriodValue === '' ? 0 : parseInt(reassignmentPeriodValue, 10);
                                const isManagerPermissionRequired = e.target.isManagerPermissionRequired?.checked || false;
                                if (!name) return;
                                
                                if (subStatusModalType === 'add') {
                                    // Add sub-status to the status's sub_statuses array
                                    const currentSubStatuses = [...(selectedStatus.sub_statuses || [])];
                                    
                                    // Handle multiple sub-statuses (one per line)
                                    const subStatusNames = name.split('\n').filter(n => n.trim() !== '');
                                    
                                    // Add each sub-status
                                    subStatusNames.forEach(subName => {
                                        const trimmedName = subName.trim();
                                        if (trimmedName) {
                                            const newSubStatus = {
                                                name: trimmedName,
                                                reassignment_period: reassignmentPeriod,
                                                is_manager_permission_required: isManagerPermissionRequired
                                            };
                                            currentSubStatuses.push(newSubStatus);
                                        }
                                    });
                                    
                                    const ok = await updateStatus(selectedStatus._id || selectedStatus.id, {
                                        sub_statuses: currentSubStatuses
                                    });
                                    if (ok) setShowSubStatusModal(false);
                                } else {
                                    // Edit existing sub-status in array
                                    const currentSubStatuses = [...(selectedStatus.sub_statuses || [])];
                                    const editIndex = currentSubStatuses.findIndex(sub => 
                                        (typeof sub === 'string' ? sub : sub.name) === 
                                        (typeof editingSubStatus === 'string' ? editingSubStatus : editingSubStatus.name)
                                    );
                                    if (editIndex !== -1) {
                                        // Keep existing structure if it's an object
                                        const existingSubStatus = currentSubStatuses[editIndex];
                                        if (typeof existingSubStatus === 'object') {
                                            currentSubStatuses[editIndex] = {
                                                ...existingSubStatus,
                                                name: name,
                                                reassignment_period: reassignmentPeriod,
                                                is_manager_permission_required: isManagerPermissionRequired
                                            };
                                        } else {
                                            // Convert string to object
                                            currentSubStatuses[editIndex] = {
                                                name: name,
                                                reassignment_period: reassignmentPeriod,
                                                is_manager_permission_required: isManagerPermissionRequired
                                            };
                                        }
                                        const ok = await updateStatus(selectedStatus._id || selectedStatus.id, {
                                            sub_statuses: currentSubStatuses
                                        });
                                        if (ok) setShowSubStatusModal(false);
                                    }
                                }
                            } finally {
                                // Always reset loading state
                                setIsSubStatusFormSubmitting(false);
                            }
                        }}>
                            {subStatusModalType === 'add' ? (
                                <textarea
                                    name="subStatusName"
                                    placeholder="Enter sub-status names (one per line)"
                                    required
                                    rows="5"
                                    className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                                />
                            ) : (
                                <input
                                    name="subStatusName"
                                    defaultValue={
                                        typeof editingSubStatus === 'string' 
                                            ? editingSubStatus 
                                            : editingSubStatus?.name || ''
                                    }
                                    placeholder="Sub-Status Name"
                                    required
                                    className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                                />
                            )}
                            <input
                                name="reassignmentPeriod"
                                type="number"
                                defaultValue={
                                    typeof editingSubStatus === 'object' 
                                        ? editingSubStatus?.reassignment_period || ''
                                        : ''
                                }
                                placeholder="Reassignment Period (in days)"
                                min="0"
                                className="w-full mb-4 px-3 py-2 rounded border border-gray-600 bg-black text-white"
                            />
                            <div className="flex items-center mb-4">
                                <input
                                    name="isManagerPermissionRequired"
                                    type="checkbox"
                                    id="subStatusManagerPermissionRequired"
                                    defaultChecked={
                                        typeof editingSubStatus === 'object' 
                                            ? editingSubStatus?.is_manager_permission_required || false
                                            : false
                                    }
                                    className="mr-2 h-4 w-4"
                                />
                                <label htmlFor="subStatusManagerPermissionRequired" className="text-white">
                                    Manager approval required
                                </label>
                            </div>
                        </form>
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="flex justify-end gap-2 p-6 border-t border-gray-600">
                            <button 
                                type="button" 
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors" 
                                onClick={() => setShowSubStatusModal(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                form="subStatusForm"
                                disabled={isSubStatusFormSubmitting}
                                className={`px-4 py-2 text-white rounded transition-colors ${
                                    isSubStatusFormSubmitting 
                                        ? 'bg-gray-500 cursor-not-allowed' 
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {isSubStatusFormSubmitting ? 'Saving...' : (subStatusModalType === 'add' ? 'Add' : 'Update')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            </>)}

            {/* ═══════ Permission Roles Tab ═══════ */}
            {activeInnerTab === 'permissionRoles' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-700">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Shield className="w-5 h-5 text-blue-400" />
                            Reassignment Approval Routing
                        </h3>
                        <p className="text-gray-400 text-sm mt-1">
                            Configure which employees can approve reassignment/transfer requests for each role.
                        </p>
                    </div>

                    <div className="flex" style={{ height: 'calc(100vh - 280px)', minHeight: 350, maxHeight: 600 }}>
                        {/* ── Left: Roles list ── */}
                        <div className="w-64 border-r border-gray-700 flex flex-col" style={{ minHeight: 0 }}>
                            <div className="p-3 border-b border-gray-700">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search roles..."
                                        value={permRoleSearch}
                                        onChange={e => setPermRoleSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {allRoles
                                    .filter(r => (r.name || '').toLowerCase().includes(permRoleSearch.toLowerCase()))
                                    .map(role => {
                                        const roleId = role.id || role._id;
                                        const route = approvalRoutes.find(rt => rt.role_id === roleId);
                                        const approverCount = route ? (route.approver_ids || []).length : 0;
                                        const isSelected = permSelectedRole === roleId;
                                        return (
                                            <div
                                                key={roleId}
                                                onClick={() => handlePermRoleSelect(roleId)}
                                                className={`px-3 py-3 cursor-pointer border-b border-gray-700/50 flex items-center justify-between transition-colors ${
                                                    isSelected ? 'bg-blue-900/40 border-l-2 border-l-blue-500' : 'hover:bg-gray-700/50'
                                                }`}
                                            >
                                                <span className="text-sm font-medium truncate">{role.name}</span>
                                                {approverCount > 0 && (
                                                    <span className="flex items-center gap-1 text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">
                                                        <CheckCircle className="w-3 h-3" /> {approverCount}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })
                                }
                                {allRoles.filter(r => (r.name || '').toLowerCase().includes(permRoleSearch.toLowerCase())).length === 0 && (
                                    <div className="p-4 text-center text-gray-500 text-sm">No roles found</div>
                                )}
                            </div>
                        </div>

                        {/* ── Right: Approvers panel ── */}
                        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
                            {!permSelectedRole ? (
                                <div className="flex-1 flex items-center justify-center text-gray-500">
                                    <div className="text-center">
                                        <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">Select a role to configure approvers</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                                        <div>
                                            <span className="text-sm font-semibold text-blue-300">
                                                {allRoles.find(r => (r.id || r._id) === permSelectedRole)?.name || 'Role'}
                                            </span>
                                            <span className="text-xs text-gray-400 ml-2">
                                                ({permSelectedApprovers.length} approver{permSelectedApprovers.length !== 1 ? 's' : ''} selected)
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handlePermSave}
                                                disabled={permSaving || permSelectedApprovers.length === 0}
                                                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                                                    permSaving || permSelectedApprovers.length === 0
                                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                }`}
                                            >
                                                {permSaving ? 'Saving...' : 'Save'}
                                            </button>
                                            {approvalRoutes.find(r => r.role_id === permSelectedRole) && (
                                                <button
                                                    onClick={() => handlePermDelete(permSelectedRole)}
                                                    className="px-3 py-1.5 rounded text-xs font-semibold bg-red-900/50 hover:bg-red-800 text-red-400 hover:text-red-300 transition-colors"
                                                >
                                                    <Trash2 className="w-3 h-3 inline mr-1" /> Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Selected approvers chips */}
                                    {permSelectedApprovers.length > 0 && (
                                        <div className="p-3 border-b border-gray-700 flex flex-wrap gap-2">
                                            {permSelectedApprovers.map(id => {
                                                const emp = allEmployees.find(e => String(e._id || e.id) === id);
                                                const name = emp ? (`${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.name || 'Unknown') : 'Unknown';
                                                return (
                                                    <span key={id} className="flex items-center gap-1 px-2 py-1 bg-blue-900/40 text-blue-300 rounded-full text-xs">
                                                        {name}
                                                        <X className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={() => toggleApprover(id)} />
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Employee search */}
                                    <div className="p-3 border-b border-gray-700">
                                        <div className="relative">
                                            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search employees..."
                                                value={permEmpSearch}
                                                onChange={e => setPermEmpSearch(e.target.value)}
                                                className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Employee list */}
                                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                                        {allEmployees
                                            .filter(emp => {
                                                const name = `${emp.first_name || ''} ${emp.last_name || ''} ${emp.name || ''} ${emp.designation || ''}`.toLowerCase();
                                                return name.includes(permEmpSearch.toLowerCase());
                                            })
                                            .map(emp => {
                                                const empId = String(emp._id || emp.id);
                                                const isChecked = permSelectedApprovers.includes(empId);
                                                const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.name || 'Unknown';
                                                return (
                                                    <div
                                                        key={empId}
                                                        onClick={() => toggleApprover(empId)}
                                                        className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                                                            isChecked ? 'bg-blue-900/30 border border-blue-700/50' : 'hover:bg-gray-700/50 border border-transparent'
                                                        }`}
                                                    >
                                                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                                                            isChecked ? 'bg-blue-600 border-blue-500' : 'border-gray-600'
                                                        }`}>
                                                            {isChecked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium truncate">{fullName}</div>
                                                            {emp.designation && <div className="text-xs text-gray-400 truncate">{emp.designation}</div>}
                                                        </div>
                                                        {emp.role_name && (
                                                            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{emp.role_name}</span>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        }
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default StatusManagementTab;
