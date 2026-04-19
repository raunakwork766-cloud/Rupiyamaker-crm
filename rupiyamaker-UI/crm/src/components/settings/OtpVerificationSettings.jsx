// ──────────────────────────────────────────────────────────────────────────
// OTP Verification Settings
//
// Admin tool: configure which employees ("approvers") receive the login OTP
// for any user of a given role. The OTP is delivered to the approver's
// HRMS personal email. The requesting user types the OTP back into the
// CRM login screen to finish authenticating.
//
// Backend contract:
//   GET    /api/settings/otp-approval-routes?user_id=<uid>
//   POST   /api/settings/otp-approval-routes?user_id=<uid>
//          body: { role_id, role_name, approver_ids: [], approver_names: [] }
//   DELETE /api/settings/otp-approval-routes/<role_id>?user_id=<uid>
// ──────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Shield,
    Search,
    Users,
    CheckCircle,
    Trash2,
    X,
    AlertTriangle,
    Mail,
    RefreshCw,
    Settings,
    Eye,
    EyeOff,
    TestTube,
    Save,
} from 'lucide-react';

const API_BASE = '/api';

const OtpVerificationSettings = () => {
    const [allRoles, setAllRoles] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [otpRoutes, setOtpRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // ── SMTP config state ─────────────────────────────────────────────────
    const [smtpConfig, setSmtpConfig] = useState(null);
    const [smtpForm, setSmtpForm] = useState({
        sender_email: '',
        app_password: '',
        smtp_server: 'smtp.gmail.com',
        smtp_port: 587,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [smtpSaving, setSmtpSaving] = useState(false);
    const [smtpTesting, setSmtpTesting] = useState(false);
    const [smtpMsg, setSmtpMsg] = useState({ text: '', ok: null });

    const [selectedRole, setSelectedRole] = useState(null);
    const [selectedApprovers, setSelectedApprovers] = useState([]);
    const [roleSearch, setRoleSearch] = useState('');
    const [empSearch, setEmpSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    const getAuth = useCallback(() => {
        const userId =
            localStorage.getItem('userId') ||
            localStorage.getItem('user_id') ||
            '';
        return {
            userId,
            headers: { 'Content-Type': 'application/json' },
        };
    }, []);

    // ── Load roles, employees, OTP routes, and SMTP config ──────────────
    const load = useCallback(async () => {
            setLoading(true);
            setLoadError('');
            try {
                const { userId, headers } = getAuth();
                const [rolesRes, empsRes, routesRes, smtpRes] = await Promise.all([
                    fetch(`${API_BASE}/roles/?user_id=${userId}`, { headers }).then((r) => r.json()),
                    fetch(`${API_BASE}/users/?user_id=${userId}&is_active=true`, { headers }).then((r) => r.json()),
                    fetch(`${API_BASE}/settings/otp-approval-routes?user_id=${userId}`, { headers }).then((r) => r.json()),
                    fetch(`${API_BASE}/settings/smtp-config?user_id=${userId}`, { headers })
                        .then((r) => r.ok ? r.json() : null)
                        .catch(() => null),
                ]);

                setAllRoles(Array.isArray(rolesRes) ? rolesRes : []);

                if (smtpRes) {
                    setSmtpConfig(smtpRes);
                    setSmtpForm((prev) => ({
                        ...prev,
                        sender_email: smtpRes.sender_email || '',
                        smtp_server: smtpRes.smtp_server || 'smtp.gmail.com',
                        smtp_port: smtpRes.smtp_port || 587,
                    }));
                }

                const usersRaw = Array.isArray(empsRes)
                    ? empsRes
                    : empsRes?.employees || empsRes?.data || [];

                const cleaned = usersRaw
                    .filter(
                        (u) =>
                            u.employee_status !== 'inactive' &&
                            String(u.login_enabled).toLowerCase() !== 'false',
                    )
                    .map((u) => ({
                        ...u,
                        id: u._id || u.id,
                        full_name:
                            [u.first_name, u.last_name].filter(Boolean).join(' ').trim() ||
                            u.name ||
                            u.username ||
                            'Unknown',
                        personal_email: (u.personal_email || '').trim(),
                    }));

                setAllEmployees(cleaned);
                setOtpRoutes(Array.isArray(routesRes?.data) ? routesRes.data : []);
            } catch (err) {
                console.error('OtpVerificationSettings load error:', err);
                setLoadError('Failed to load OTP verification settings.');
            } finally {
                setLoading(false);
            }
    }, [getAuth]);

    useEffect(() => {
        load();
    }, [load]);

    // ── Helpers ───────────────────────────────────────────────────────────
    const handleRoleSelect = useCallback(
        (roleId) => {
            setSelectedRole(roleId);
            setSelectedApprovers(
                (otpRoutes.find((r) => r.role_id === roleId)?.approver_ids) || [],
            );
            setEmpSearch('');
            setSaveMsg('');
        },
        [otpRoutes],
    );

    const toggleApprover = useCallback((empId) => {
        setSelectedApprovers((prev) =>
            prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
        );
    }, []);

    const handleSave = useCallback(async () => {
        if (!selectedRole || selectedApprovers.length === 0) return;
        setSaving(true);
        setSaveMsg('');
        try {
            const { userId, headers } = getAuth();
            const role = allRoles.find((r) => (r.id || r._id) === selectedRole);
            const approverNames = selectedApprovers.map((id) => {
                const e = allEmployees.find((emp) => String(emp.id) === id);
                return e ? e.full_name : 'Unknown';
            });

            const res = await fetch(
                `${API_BASE}/settings/otp-approval-routes?user_id=${userId}`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        role_id: selectedRole,
                        role_name: role?.name || '',
                        approver_ids: selectedApprovers,
                        approver_names: approverNames,
                    }),
                },
            );

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.detail || 'Save failed');
            }
            const data = await res.json();
            setOtpRoutes((prev) => {
                const idx = prev.findIndex((r) => r.role_id === selectedRole);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = data.data;
                    return next;
                }
                return [...prev, data.data];
            });
            setSaveMsg('Saved successfully.');
        } catch (err) {
            console.error(err);
            setSaveMsg(`Error: ${err.message}`);
        } finally {
            setSaving(false);
        }
    }, [selectedRole, selectedApprovers, allRoles, allEmployees, getAuth]);

    const handleDelete = useCallback(async () => {
        if (!selectedRole) return;
        if (!window.confirm('Remove OTP routing for this role? Users of this role will not be able to log in until you reconfigure.')) return;
        try {
            const { userId, headers } = getAuth();
            const res = await fetch(
                `${API_BASE}/settings/otp-approval-routes/${selectedRole}?user_id=${userId}`,
                { method: 'DELETE', headers },
            );
            if (res.ok) {
                setOtpRoutes((prev) => prev.filter((r) => r.role_id !== selectedRole));
                setSelectedApprovers([]);
                setSaveMsg('Routing removed.');
            }
        } catch (err) {
            console.error(err);
        }
    }, [selectedRole, getAuth]);

    // ── Filtered lists ────────────────────────────────────────────────────
    const filteredRoles = useMemo(
        () =>
            allRoles.filter((r) =>
                (r.name || '').toLowerCase().includes(roleSearch.toLowerCase()),
            ),
        [allRoles, roleSearch],
    );

    const filteredEmps = useMemo(() => {
        const q = empSearch.toLowerCase();
        return allEmployees.filter((e) => {
            const hay = `${e.full_name} ${e.username || ''} ${e.personal_email || ''} ${e.email || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [allEmployees, empSearch]);

    const selectedRoleName =
        allRoles.find((r) => (r.id || r._id) === selectedRole)?.name || '';

    const approversWithoutPersonalEmail = useMemo(
        () =>
            selectedApprovers
                .map((id) => allEmployees.find((e) => String(e.id) === id))
                .filter((e) => e && !e.personal_email),
        [selectedApprovers, allEmployees],
    );

    // ── SMTP handlers ─────────────────────────────────────────────────────
    const handleSmtpTest = useCallback(async () => {
        setSmtpTesting(true);
        setSmtpMsg({ text: '', ok: null });
        try {
            const { userId, headers } = getAuth();
            const res = await fetch(`${API_BASE}/settings/smtp-config/test?user_id=${userId}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(smtpForm),
            });
            const data = await res.json();
            setSmtpMsg({ text: data.message, ok: data.success });
        } catch (err) {
            setSmtpMsg({ text: `Error: ${err.message}`, ok: false });
        } finally {
            setSmtpTesting(false);
        }
    }, [smtpForm, getAuth]);

    const handleSmtpSave = useCallback(async () => {
        setSmtpSaving(true);
        setSmtpMsg({ text: '', ok: null });
        try {
            const { userId, headers } = getAuth();
            const res = await fetch(`${API_BASE}/settings/smtp-config?user_id=${userId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(smtpForm),
            });
            const data = await res.json();
            if (data.success) {
                setSmtpMsg({ text: '✅ Saved successfully!', ok: true });
                setSmtpConfig((prev) => ({ ...prev, configured: true, sender_email: smtpForm.sender_email, password_set: true }));
                setSmtpForm((prev) => ({ ...prev, app_password: '' })); // clear password field after save
            } else {
                setSmtpMsg({ text: data.detail || 'Save failed', ok: false });
            }
        } catch (err) {
            setSmtpMsg({ text: `Error: ${err.message}`, ok: false });
        } finally {
            setSmtpSaving(false);
        }
    }, [smtpForm, getAuth]);

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="bg-black rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-700">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    OTP Verification
                    <button
                        onClick={load}
                        disabled={loading}
                        title="Refresh employee list"
                        className="ml-2 p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </h3>
                <p className="text-sm text-gray-300 mt-1">
                    Choose which employee(s) will receive the login OTP for users of each role.
                    The OTP will be sent to each approver's <strong>HRMS Personal Email</strong>.
                    A user of that role can only log in after entering the OTP shared by an approver.
                </p>
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded p-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Roles without an OTP routing rule will be <strong>blocked from logging in</strong>.</span>
                </div>
            </div>

            {/* ── SMTP Email Sender Configuration ── */}
            <div className="p-5 border-b border-gray-700">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                    <Settings className="w-4 h-4 text-purple-400" />
                    Email Sender (SMTP) Configuration
                    {smtpConfig?.configured ? (
                        <span className="ml-2 text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Active: {smtpConfig.sender_email}
                        </span>
                    ) : (
                        <span className="ml-2 text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">Not configured</span>
                    )}
                </h4>
                <p className="text-xs text-gray-400 mb-4">
                    OTP emails are sent <strong>FROM this account</strong> to the approver's personal email.
                    Use a dedicated Gmail account + Gmail App Password (Google Account → Security → 2-Step Verification → App Passwords).
                    Regular Gmail password will NOT work — App Password required.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Sender Gmail Address *</label>
                        <input
                            type="email"
                            placeholder="e.g. rupiyamaker.crm@gmail.com"
                            value={smtpForm.sender_email}
                            onChange={(e) => setSmtpForm((p) => ({ ...p, sender_email: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">
                            Gmail App Password {smtpConfig?.password_set && !smtpForm.app_password && <span className="text-green-400">(already set — leave blank to keep)</span>}
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder={smtpConfig?.password_set ? '••••••••••••••••' : '16-char App Password (no spaces)'}
                                value={smtpForm.app_password}
                                onChange={(e) => setSmtpForm((p) => ({ ...p, app_password: e.target.value.replace(/\s/g, '') }))}
                                className="w-full px-3 py-2 pr-9 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((p) => !p)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                {smtpMsg.text && (
                    <div className={`mt-3 text-xs px-3 py-2 rounded ${
                        smtpMsg.ok ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                    }`}>
                        {smtpMsg.text}
                    </div>
                )}

                <div className="mt-3 flex gap-2">
                    <button
                        onClick={handleSmtpTest}
                        disabled={smtpTesting || !smtpForm.sender_email || !smtpForm.app_password}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <TestTube className="w-3.5 h-3.5" />
                        {smtpTesting ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button
                        onClick={handleSmtpSave}
                        disabled={smtpSaving || !smtpForm.sender_email}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <Save className="w-3.5 h-3.5" />
                        {smtpSaving ? 'Saving...' : 'Save SMTP Config'}
                    </button>
                </div>
            </div>

            {loading && (
                <div className="p-10 text-center text-gray-400">Loading...</div>
            )}
            {loadError && (
                <div className="p-6 text-center text-red-400">{loadError}</div>
            )}

            {!loading && !loadError && (
                <div
                    className="flex"
                    style={{
                        height: 'calc(100vh - 320px)',
                        minHeight: 400,
                        maxHeight: 700,
                    }}
                >
                    {/* ── Left: Roles list ── */}
                    <div className="w-72 border-r border-gray-700 flex flex-col" style={{ minHeight: 0 }}>
                        <div className="p-3 border-b border-gray-700">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search roles..."
                                    value={roleSearch}
                                    onChange={(e) => setRoleSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {filteredRoles.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 text-sm">No roles found</div>
                            ) : (
                                filteredRoles.map((role) => {
                                    const roleId = role.id || role._id;
                                    const route = otpRoutes.find((r) => r.role_id === roleId);
                                    const count = route ? (route.approver_ids || []).length : 0;
                                    const isSel = selectedRole === roleId;
                                    return (
                                        <div
                                            key={roleId}
                                            onClick={() => handleRoleSelect(roleId)}
                                            className={`px-3 py-3 cursor-pointer border-b border-gray-700/50 flex items-center justify-between transition-colors ${
                                                isSel
                                                    ? 'bg-blue-900/40 border-l-2 border-l-blue-500'
                                                    : 'hover:bg-gray-700/50'
                                            }`}
                                        >
                                            <span className="text-sm font-medium text-white truncate">{role.name}</span>
                                            {count > 0 ? (
                                                <span className="flex items-center gap-1 text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">
                                                    <CheckCircle className="w-3 h-3" /> {count}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-amber-400/80">unset</span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* ── Right: Approvers panel ── */}
                    <div className="flex-1 flex flex-col bg-gray-950" style={{ minHeight: 0 }}>
                        {!selectedRole ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">Select a role to configure OTP approvers</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Header bar */}
                                <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                                    <div>
                                        <span className="text-sm font-semibold text-blue-300">{selectedRoleName}</span>
                                        <span className="text-xs text-gray-400 ml-2">
                                            ({selectedApprovers.length} approver
                                            {selectedApprovers.length !== 1 ? 's' : ''} selected)
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving || selectedApprovers.length === 0}
                                            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                                                saving || selectedApprovers.length === 0
                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                            }`}
                                        >
                                            {saving ? 'Saving...' : 'Save'}
                                        </button>
                                        {otpRoutes.find((r) => r.role_id === selectedRole) && (
                                            <button
                                                onClick={handleDelete}
                                                className="px-3 py-1.5 rounded text-xs font-semibold bg-red-900/50 hover:bg-red-800 text-red-400 hover:text-red-300 transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3 inline mr-1" /> Remove
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {saveMsg && (
                                    <div
                                        className={`px-3 py-2 text-xs ${
                                            saveMsg.startsWith('Error')
                                                ? 'bg-red-900/30 text-red-300'
                                                : 'bg-green-900/30 text-green-300'
                                        }`}
                                    >
                                        {saveMsg}
                                    </div>
                                )}

                                {approversWithoutPersonalEmail.length > 0 && (
                                    <div className="px-3 py-2 text-xs bg-amber-900/30 text-amber-300 border-b border-amber-800/40 flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span>
                                            <strong>Personal email missing for:</strong>{' '}
                                            {approversWithoutPersonalEmail
                                                .map((e) => e.full_name)
                                                .join(', ')}
                                            . Set their HRMS personal email or they will not receive OTPs.
                                        </span>
                                    </div>
                                )}

                                {/* Selected approvers chips */}
                                {selectedApprovers.length > 0 && (
                                    <div className="p-3 border-b border-gray-700 flex flex-wrap gap-2">
                                        {selectedApprovers.map((id) => {
                                            const emp = allEmployees.find((e) => String(e.id) === id);
                                            const name = emp?.full_name || 'Unknown';
                                            const hasMail = !!emp?.personal_email;
                                            return (
                                                <span
                                                    key={id}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                                        hasMail
                                                            ? 'bg-blue-900/40 text-blue-300'
                                                            : 'bg-amber-900/40 text-amber-300'
                                                    }`}
                                                    title={emp?.personal_email || 'No personal email set'}
                                                >
                                                    {!hasMail && <AlertTriangle className="w-3 h-3" />}
                                                    {name}
                                                    <X
                                                        className="w-3 h-3 cursor-pointer hover:text-red-400"
                                                        onClick={() => toggleApprover(id)}
                                                    />
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
                                            placeholder="Search employees by name, username, or personal email..."
                                            value={empSearch}
                                            onChange={(e) => setEmpSearch(e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* Employee list */}
                                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                                    {filteredEmps.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 text-sm">No employees found</div>
                                    ) : (
                                        filteredEmps.map((emp) => {
                                            const empId = String(emp.id);
                                            const isChecked = selectedApprovers.includes(empId);
                                            const hasMail = !!emp.personal_email;
                                            return (
                                                <div
                                                    key={empId}
                                                    onClick={() => toggleApprover(empId)}
                                                    className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                                                        isChecked
                                                            ? 'bg-blue-900/30 border border-blue-700/50'
                                                            : 'hover:bg-gray-800/60 border border-transparent'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        readOnly
                                                        className="h-4 w-4 accent-blue-500"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-white truncate">
                                                            {emp.full_name}
                                                        </div>
                                                        <div
                                                            className={`text-xs flex items-center gap-1 truncate ${
                                                                hasMail ? 'text-gray-400' : 'text-amber-400'
                                                            }`}
                                                        >
                                                            <Mail className="w-3 h-3 flex-shrink-0" />
                                                            {hasMail
                                                                ? emp.personal_email
                                                                : 'No personal email set in HRMS'}
                                                        </div>
                                                    </div>
                                                    {emp.username && (
                                                        <span className="text-[10px] text-gray-500 hidden md:inline">
                                                            @{emp.username}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OtpVerificationSettings;
