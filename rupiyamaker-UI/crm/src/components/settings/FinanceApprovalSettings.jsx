/**
 * FinanceApprovalSettings.jsx
 * Finance Approval Routing — Settings Panel
 * Configure which employees approve Reimbursement / Advance Salary / Deduction
 * requests for each role.
 *
 * Pattern mirrors OtpVerificationSettings / LeaveApprovalRouting.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Users, Search, ChevronDown, ChevronRight, X,
  Trash2, Save, RefreshCw, AlertCircle, CheckCircle, Info,
  CreditCard, Wallet, Minus
} from 'lucide-react';

const API = '/api';
const getUid = () =>
  localStorage.getItem('userId') ||
  localStorage.getItem('user_id') ||
  (() => { try { return JSON.parse(localStorage.getItem('userData') || '{}')._id; } catch { return null; } })();
const tok = () => localStorage.getItem('token') || '';

const apiFetch = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${tok()}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

// Finance types config
const FINANCE_TYPES = [
  {
    key: 'reimbursement',
    label: 'Reimbursement',
    desc: 'Approver for expense reimbursement requests',
    icon: CreditCard,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: '#93c5fd',
  },
  {
    key: 'advance_salary',
    label: 'Advance Salary',
    desc: 'Approver for advance salary requests',
    icon: Wallet,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: '#6ee7b7',
  },
  {
    key: 'deduction',
    label: 'Deduction / Fine',
    desc: 'Approver for deduction and fine requests',
    icon: Minus,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: '#fcd34d',
  },
];

const FinanceApprovalSettings = () => {
  const uid = getUid();

  // All roles + employees
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);

  // routes[financeType][roleId] = { approver_ids, approver_names }
  const [routes, setRoutes] = useState({});

  // UI state
  const [activeType, setActiveType] = useState('reimbursement');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({}); // { roleId_type: bool }
  const [deleting, setDeleting] = useState({});
  const [toast, setToast] = useState(null); // { msg, type: 'success'|'error' }

  // Modal: pick approvers for a role
  const [modal, setModal] = useState(null); // { roleId, roleName, financeType }
  const [modalSearch, setModalSearch] = useState('');
  const [modalSelected, setModalSelected] = useState([]); // [{ id, name }]

  // Role search
  const [roleSearch, setRoleSearch] = useState('');

  // ── Helpers ────────────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Data loading ───────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, empRes, routesRes] = await Promise.all([
        apiFetch(`/roles/?user_id=${uid}`),
        apiFetch(`/users?user_id=${uid}&is_active=true&limit=500`),
        apiFetch(`/settings/finance-approval-routes?user_id=${uid}`),
      ]);

      const rolesList = Array.isArray(rolesRes) ? rolesRes : (rolesRes.items || []);
      const empList = Array.isArray(empRes) ? empRes : (empRes.items || empRes.users || []);
      const routesList = Array.isArray(routesRes.data) ? routesRes.data : [];

      setRoles(rolesList);
      setEmployees(empList);

      // Build routes map: routes[financeType][roleId] = { approver_ids, approver_names }
      const map = {};
      FINANCE_TYPES.forEach(ft => { map[ft.key] = {}; });
      routesList.forEach(r => {
        if (!map[r.finance_type]) map[r.finance_type] = {};
        map[r.finance_type][r.role_id] = {
          approver_ids: r.approver_ids || [],
          approver_names: r.approver_names || [],
        };
      });
      setRoutes(map);
    } catch (e) {
      showToast(`Failed to load: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Save route ─────────────────────────────────────────────────────────
  const saveRoute = async (roleId, roleName, financeType, approverIds, approverNames) => {
    const key = `${roleId}_${financeType}`;
    setSaving(p => ({ ...p, [key]: true }));
    try {
      await apiFetch(`/settings/finance-approval-routes?user_id=${uid}`, {
        method: 'POST',
        body: JSON.stringify({
          role_id: roleId,
          role_name: roleName,
          finance_type: financeType,
          approver_ids: approverIds,
          approver_names: approverNames,
        }),
      });
      // Update local state
      setRoutes(prev => ({
        ...prev,
        [financeType]: {
          ...prev[financeType],
          [roleId]: { approver_ids: approverIds, approver_names: approverNames },
        },
      }));
      showToast('Approval route saved successfully');
    } catch (e) {
      showToast(`Save failed: ${e.message}`, 'error');
    } finally {
      setSaving(p => ({ ...p, [key]: false }));
    }
  };

  // ── Delete route ────────────────────────────────────────────────────────
  const deleteRoute = async (roleId, financeType) => {
    const key = `${roleId}_${financeType}`;
    setDeleting(p => ({ ...p, [key]: true }));
    try {
      await apiFetch(
        `/settings/finance-approval-routes/${roleId}?user_id=${uid}&finance_type=${financeType}`,
        { method: 'DELETE' }
      );
      setRoutes(prev => {
        const updated = { ...prev, [financeType]: { ...(prev[financeType] || {}) } };
        delete updated[financeType][roleId];
        return updated;
      });
      showToast('Approval route removed');
    } catch (e) {
      showToast(`Delete failed: ${e.message}`, 'error');
    } finally {
      setDeleting(p => ({ ...p, [key]: false }));
    }
  };

  // ── Modal helpers ──────────────────────────────────────────────────────
  const openModal = (role, financeType) => {
    const existing = routes[financeType]?.[role._id || role.id] || {};
    const ids = existing.approver_ids || [];
    const names = existing.approver_names || [];
    const selected = ids.map((id, i) => ({ id, name: names[i] || id }));
    setModalSelected(selected);
    setModalSearch('');
    setModal({ roleId: role._id || role.id, roleName: role.name, financeType });
  };

  const closeModal = () => { setModal(null); setModalSearch(''); setModalSelected([]); };

  const toggleEmployee = (emp) => {
    const id = emp._id || emp.id;
    const first = emp.first_name || '';
    const last = emp.last_name || '';
    const name = `${first} ${last}`.trim() || emp.name || emp.username || 'Unknown';
    setModalSelected(prev => {
      if (prev.find(e => e.id === id)) return prev.filter(e => e.id !== id);
      return [...prev, { id, name }];
    });
  };

  const confirmModal = async () => {
    if (!modal) return;
    await saveRoute(
      modal.roleId,
      modal.roleName,
      modal.financeType,
      modalSelected.map(e => e.id),
      modalSelected.map(e => e.name),
    );
    closeModal();
  };

  // ── Filtered data ──────────────────────────────────────────────────────
  const filteredRoles = roles.filter(r =>
    !roleSearch || r.name?.toLowerCase().includes(roleSearch.toLowerCase())
  );

  const filteredEmployees = employees.filter(emp => {
    if (!modalSearch) return true;
    const q = modalSearch.toLowerCase();
    const name = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
    const designation = (emp.designation || emp.role_name || '').toLowerCase();
    return name.includes(q) || designation.includes(q);
  });

  const activeTypeConfig = FINANCE_TYPES.find(ft => ft.key === activeType);

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#516f90' }}>
        <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p>Loading finance approval settings...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '"Lexend Deca", -apple-system, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .fa-toast { position: fixed; top: 20px; right: 20px; z-index: 99999; padding: 12px 20px;
          border-radius: 6px; font-size: 14px; font-weight: 600; display: flex; align-items: center;
          gap: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); animation: fadeInRight 0.3s ease; }
        @keyframes fadeInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        .fa-type-tab { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer;
          font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;
          transition: all 0.15s; }
        .fa-role-row { display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px;
          margin-bottom: 8px; gap: 16px; flex-wrap: wrap; }
        .fa-role-row:hover { border-color: #94a3b8; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .fa-approver-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px;
          background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 20px; font-size: 12px;
          color: #1d4ed8; margin: 2px; font-weight: 500; }
        .fa-emp-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px;
          border-radius: 6px; cursor: pointer; transition: background 0.12s; }
        .fa-emp-row:hover { background: #f8fafc; }
        .fa-emp-row.selected { background: #eff6ff; }
        .fa-checkbox { width: 18px; height: 18px; border-radius: 4px; border: 2px solid #cbd5e1;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .fa-checkbox.checked { background: #2563eb; border-color: #2563eb; }
        .fa-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.55);
          z-index: 9000; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .fa-modal { background: #fff; border-radius: 8px; width: 100%; max-width: 560px;
          max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .fa-btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px;
          font-weight: 600; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; }
        .fa-btn-primary { background: #2563eb; color: #fff; }
        .fa-btn-primary:hover { background: #1d4ed8; }
        .fa-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .fa-btn-ghost { background: transparent; color: #64748b; border: 1px solid #e2e8f0; }
        .fa-btn-ghost:hover { background: #f8fafc; color: #334155; }
        .fa-btn-danger { background: transparent; color: #dc2626; border: 1px solid #fecaca; }
        .fa-btn-danger:hover { background: #fef2f2; }
        .fa-empty { text-align: center; padding: 32px; color: #94a3b8; font-size: 13px; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="fa-toast" style={{
          background: toast.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: toast.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${toast.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
        }}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(37,99,235,0.1)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={20} color="#2563eb" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
              Finance Approval Routing
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Configure who approves finance requests for each role
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6,
          padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16 }}>
          <Info size={16} color="#2563eb" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#1e40af', lineHeight: 1.5 }}>
            When an employee submits a <strong>Reimbursement</strong>, <strong>Advance Salary</strong>,
            or <strong>Deduction</strong> request, it will be routed to the approvers configured here
            for their role. If no approver is set, requests go to Super Admins by default.
          </p>
        </div>
      </div>

      {/* Finance Type Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FINANCE_TYPES.map(ft => {
          const Icon = ft.icon;
          const isActive = activeType === ft.key;
          // Count configured roles for this type
          const count = Object.keys(routes[ft.key] || {}).length;
          return (
            <button
              key={ft.key}
              className="fa-type-tab"
              onClick={() => setActiveType(ft.key)}
              style={{
                background: isActive ? ft.color : '#f8fafc',
                color: isActive ? '#fff' : '#64748b',
                border: isActive ? `1px solid ${ft.color}` : '1px solid #e2e8f0',
                boxShadow: isActive ? `0 2px 8px ${ft.color}40` : 'none',
              }}
            >
              <Icon size={15} />
              {ft.label}
              {count > 0 && (
                <span style={{
                  background: isActive ? 'rgba(255,255,255,0.25)' : ft.color,
                  color: isActive ? '#fff' : '#fff',
                  borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700, minWidth: 18, textAlign: 'center'
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active type description */}
      {activeTypeConfig && (
        <div style={{ background: activeTypeConfig.bg, border: `1px solid ${activeTypeConfig.border}`,
          borderRadius: 6, padding: '8px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <activeTypeConfig.icon size={15} color={activeTypeConfig.color} />
          <span style={{ fontSize: 13, color: activeTypeConfig.color, fontWeight: 500 }}>
            {activeTypeConfig.desc} — {Object.keys(routes[activeType] || {}).length} role(s) configured
          </span>
        </div>
      )}

      {/* Role search */}
      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 320 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          type="text"
          placeholder="Search roles..."
          value={roleSearch}
          onChange={e => setRoleSearch(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 34, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
            border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#334155', outline: 'none',
            background: '#fff', }}
        />
      </div>

      {/* Roles list */}
      {filteredRoles.length === 0 ? (
        <div className="fa-empty">No roles found</div>
      ) : (
        filteredRoles.map(role => {
          const roleId = role._id || role.id;
          const config = routes[activeType]?.[roleId];
          const approverNames = config?.approver_names || [];
          const approverIds = config?.approver_ids || [];
          const saveKey = `${roleId}_${activeType}`;
          const isConfigured = approverIds.length > 0;

          return (
            <div key={roleId} className="fa-role-row">
              {/* Role info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%',
                    background: isConfigured ? '#10b981' : '#e2e8f0' }} />
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{role.name}</span>
                  {role.department_name && (
                    <span style={{ fontSize: 11, color: '#94a3b8', background: '#f1f5f9',
                      padding: '1px 8px', borderRadius: 10, fontWeight: 500 }}>
                      {role.department_name}
                    </span>
                  )}
                </div>

                {/* Approver chips */}
                {isConfigured ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {approverNames.map((name, i) => (
                      <span key={approverIds[i] || i} className="fa-approver-chip">
                        <Users size={11} />
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    Not configured — defaults to Super Admins
                  </span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  className="fa-btn fa-btn-ghost"
                  onClick={() => openModal(role, activeType)}
                >
                  <Users size={14} />
                  {isConfigured ? 'Edit' : 'Set Approver'}
                </button>
                {isConfigured && (
                  <button
                    className="fa-btn fa-btn-danger"
                    disabled={!!deleting[saveKey]}
                    onClick={() => deleteRoute(roleId, activeType)}
                    title="Remove this approval route"
                  >
                    <Trash2 size={14} />
                    {deleting[saveKey] ? '...' : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* ── Approver Selection Modal ──────────────────────────────────── */}
      {modal && (
        <div className="fa-modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="fa-modal">
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                  Set {FINANCE_TYPES.find(ft => ft.key === modal.financeType)?.label} Approvers
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                  Role: <strong>{modal.roleName}</strong>
                </p>
              </div>
              <button className="fa-btn fa-btn-ghost" onClick={closeModal} style={{ padding: 6 }}>
                <X size={16} />
              </button>
            </div>

            {/* Selected approvers */}
            {modalSelected.length > 0 && (
              <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#64748b',
                  textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Selected ({modalSelected.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {modalSelected.map(e => (
                    <span key={e.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', background: '#dbeafe', border: '1px solid #93c5fd',
                      borderRadius: 20, fontSize: 12, color: '#1d4ed8', fontWeight: 500
                    }}>
                      {e.name}
                      <button onClick={() => setModalSelected(p => p.filter(x => x.id !== e.id))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          color: '#1d4ed8', display: 'flex', lineHeight: 1 }}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                  transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 34, paddingRight: 12,
                    paddingTop: 8, paddingBottom: 8, border: '1px solid #e2e8f0', borderRadius: 6,
                    fontSize: 13, color: '#334155', outline: 'none', background: '#fff' }}
                />
              </div>
            </div>

            {/* Employee list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
              {filteredEmployees.length === 0 ? (
                <div className="fa-empty">No employees found</div>
              ) : (
                filteredEmployees.map(emp => {
                  const id = emp._id || emp.id;
                  const first = emp.first_name || '';
                  const last = emp.last_name || '';
                  const name = `${first} ${last}`.trim() || emp.name || emp.username || 'Unknown';
                  const designation = emp.designation || emp.role_name || '';
                  const isSelected = !!modalSelected.find(e => e.id === id);

                  return (
                    <div
                      key={id}
                      className={`fa-emp-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleEmployee(emp)}
                    >
                      <div className={`fa-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{name}</div>
                        {designation && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{designation}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc' }}>
              <button className="fa-btn fa-btn-ghost" onClick={closeModal}>Cancel</button>
              <button
                className="fa-btn fa-btn-primary"
                disabled={modalSelected.length === 0 || !!saving[`${modal.roleId}_${modal.financeType}`]}
                onClick={confirmModal}
              >
                <Save size={14} />
                {saving[`${modal.roleId}_${modal.financeType}`] ? 'Saving...' : `Save (${modalSelected.length} approver${modalSelected.length !== 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceApprovalSettings;
