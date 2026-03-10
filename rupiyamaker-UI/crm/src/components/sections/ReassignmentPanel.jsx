import React, { useState, useEffect, useCallback } from 'react';
import { canApproveLeadReassignment } from '../../utils/permissions';
import { Check, X, ChevronLeft, ChevronRight, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react';

const API_BASE_URL = '/api';

const ReassignmentPanel = ({ userPermissions, onLeadAction, onViewLead }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [activeTab, setActiveTab] = useState('pending');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  const [actionModal, setActionModal] = useState({ open: false, type: null, lead: null });
  const [actionRemark, setActionRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const userId = localStorage.getItem('userId');

  const resolvedPermissions = userPermissions || (() => {
    try {
      const raw = localStorage.getItem('userPermissions');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const canApprove = canApproveLeadReassignment(resolvedPermissions);

  const loadStats = useCallback(async () => {
    if (!canApprove || !userId) return;
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        fetch(`${API_BASE_URL}/reassignment/list?user_id=${userId}&page=1&page_size=1&status_filter=pending`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE_URL}/reassignment/list?user_id=${userId}&page=1&page_size=1&status_filter=approved`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE_URL}/reassignment/list?user_id=${userId}&page=1&page_size=1&status_filter=rejected`).then(r => r.json()).catch(() => ({}))
      ]);
      setStats({
        pending: pendingRes?.pagination?.total || 0,
        approved: approvedRes?.pagination?.total || 0,
        rejected: rejectedRes?.pagination?.total || 0
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [canApprove, userId]);

  const loadRequests = useCallback(async () => {
    if (!canApprove || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/reassignment/list?user_id=${userId}&page=${page}&page_size=${pageSize}&status_filter=${activeTab}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRequests(data.requests || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalItems(data.pagination?.total || 0);
    } catch (err) {
      setError('Failed to load reassignment requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [canApprove, userId, page, pageSize, activeTab]);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { setPage(1); }, [activeTab]);

  const openActionModal = (type, lead, e) => {
    e.stopPropagation();
    setActionModal({ open: true, type, lead });
    setActionRemark('');
  };

  const handleApprove = async () => {
    if (!actionRemark.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reassignment/approve/${actionModal.lead._id}?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_reason: actionRemark.trim() })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }
      setActionModal({ open: false, type: null, lead: null });
      loadRequests();
      loadStats();
      if (onLeadAction) onLeadAction('reassign_approved', actionModal.lead._id);
    } catch (err) {
      setError(`Approve failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!actionRemark.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reassignment/reject/${actionModal.lead._id}?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: actionRemark.trim() })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }
      setActionModal({ open: false, type: null, lead: null });
      loadRequests();
      loadStats();
      if (onLeadAction) onLeadAction('reassign_rejected', actionModal.lead._id);
    } catch (err) {
      setError(`Reject failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
      });
    } catch { return '—'; }
  };

  if (!canApprove) return null;

  const tabDefs = [
    { key: 'pending',  label: 'Pending',  Icon: Clock,       color: 'yellow' },
    { key: 'approved', label: 'Approved', Icon: CheckCircle, color: 'green'  },
    { key: 'rejected', label: 'Rejected', Icon: XCircle,     color: 'red'    },
  ];

  const colorMap = {
    yellow: {
      badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
      tab: 'text-yellow-400 border-yellow-400',
      stat: 'text-yellow-400',
      statBorder: 'border-yellow-500/30',
    },
    green: {
      badge: 'bg-green-500/20 text-green-400 border-green-500/40',
      tab: 'text-green-400 border-green-400',
      stat: 'text-green-400',
      statBorder: 'border-green-500/30',
    },
    red: {
      badge: 'bg-red-500/20 text-red-400 border-red-500/40',
      tab: 'text-red-400 border-red-400',
      stat: 'text-red-400',
      statBorder: 'border-red-500/30',
    },
  };

  return (
    <div className="mt-4 bg-[#090f1a] rounded-2xl shadow-xl overflow-hidden border border-neutral-800">

      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-neutral-800 bg-[#0c1424]">
        <div>
          <h3 className="text-lg font-extrabold text-white tracking-wide flex items-center gap-2">
            <span className="w-2 h-6 rounded-full bg-cyan-400 inline-block"></span>
            Lead Reassignment Dashboard
          </h3>
          <p className="text-neutral-500 text-xs mt-0.5 ml-4">Review and act on reassignment requests from your team</p>
        </div>
        <button onClick={() => { loadRequests(); loadStats(); }} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg transition border border-neutral-700">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 px-5 pt-5 pb-4">
        {tabDefs.map(t => {
          const c = colorMap[t.color];
          const cnt = stats[t.key];
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer text-left ${
                activeTab === t.key
                  ? `${c.statBorder} bg-neutral-800/80 shadow-md`
                  : 'border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/50'
              }`}>
              <t.Icon size={24} className={activeTab === t.key ? c.stat : 'text-neutral-600'} />
              <div>
                <p className="text-neutral-400 text-[11px] uppercase font-semibold tracking-wider">{t.label}</p>
                <p className={`text-2xl font-extrabold leading-tight ${activeTab === t.key ? c.stat : 'text-neutral-300'}`}>{cnt}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab strip */}
      <div className="flex border-b border-neutral-800 px-5 gap-1">
        {tabDefs.map(t => {
          const c = colorMap[t.color];
          const cnt = stats[t.key];
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === t.key
                  ? `${c.tab} bg-neutral-800/40`
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}>
              {t.label}
              {cnt > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                  activeTab === t.key ? c.badge : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                }`}>{cnt}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error bar */}
      {error && (
        <div className="mx-5 mt-3 p-3 bg-red-900/30 text-red-300 border border-red-700/50 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle size={15} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="p-14 text-center">
          <RefreshCw size={30} className="animate-spin text-cyan-400 mx-auto mb-3" />
          <p className="text-neutral-400 text-sm">Loading requests…</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="p-14 text-center">
          <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-3">
            {activeTab === 'pending' ? <Clock size={26} className="text-neutral-600" />
            : activeTab === 'approved' ? <CheckCircle size={26} className="text-neutral-600" />
            : <XCircle size={26} className="text-neutral-600" />}
          </div>
          <p className="text-neutral-400 font-semibold">No {activeTab} requests</p>
          <p className="text-neutral-600 text-xs mt-1">Nothing to show here right now</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80">
                  <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Lead</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Requested By</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Current Owner</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Lead Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Reason</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Date</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-neutral-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {requests.map((lead) => {
                  const customerName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.name || lead.customer_name || 'Unknown Lead';
                  const requestedBy = (lead.requestor_name || '').trim() || (lead.reassignment_requested_by_name || '').trim() || '—';
                  const currentOwner = (lead.assigned_user_name || '').trim() || (lead.created_by_name || '').trim() || '—';
                  const leadStatus = lead.lead_status || '';
                  const leadSubStatus = lead.sub_status || '';
                  return (
                  <tr key={lead._id}
                    className="hover:bg-neutral-800/40 transition-colors group cursor-pointer"
                    onClick={() => onViewLead && onViewLead(lead._id)}
                    title="Click row to view lead details">
                    {/* Lead Name + Mobile */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-cyan-700/60 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 border border-cyan-600/30">
                          {customerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate max-w-[160px] group-hover:text-cyan-300 transition-colors">
                            {customerName}
                          </p>
                          <p className="text-neutral-500 text-xs">{lead.mobile_number || lead.phone || '—'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Requested By */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-neutral-200 font-medium text-sm">{requestedBy}</p>
                    </td>

                    {/* Current Owner */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-neutral-300 text-sm">
                      {currentOwner}
                    </td>

                    {/* Lead Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {leadStatus && (
                          <span className="inline-block px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded text-xs font-medium">{leadStatus}</span>
                        )}
                        {leadSubStatus && (
                          <span className="inline-block px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded text-xs">{leadSubStatus}</span>
                        )}
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="px-4 py-3.5 max-w-[220px]">
                      {lead.reassignment_reason ? (
                        <p className="text-neutral-200 text-xs leading-relaxed">{lead.reassignment_reason}</p>
                      ) : (
                        <span className="text-neutral-600 text-xs">—</span>
                      )}
                      {activeTab === 'approved' && lead.reassignment_approved_by_name && (
                        <p className="text-green-400 text-[11px] mt-1.5">✓ {lead.reassignment_approved_by_name}</p>
                      )}
                      {activeTab === 'rejected' && lead.reassignment_rejection_reason && (
                        <p className="text-red-400 text-[11px] mt-1.5">✗ {lead.reassignment_rejection_reason}</p>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-neutral-400 text-xs">{fmtDate(lead.reassignment_requested_at || lead.updated_at)}</p>
                      {activeTab === 'approved' && lead.reassignment_approved_at && (
                        <p className="text-neutral-600 text-[11px] mt-0.5">{fmtDate(lead.reassignment_approved_at)}</p>
                      )}
                      {activeTab === 'rejected' && lead.reassignment_rejected_at && (
                        <p className="text-neutral-600 text-[11px] mt-0.5">{fmtDate(lead.reassignment_rejected_at)}</p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 justify-end flex-wrap">
                        {onViewLead && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onViewLead(lead._id); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700/30 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-600/40 text-xs font-semibold rounded-lg transition">
                            <Eye size={13} /> View
                          </button>
                        )}
                        {activeTab === 'pending' && (
                          <>
                            <button onClick={(e) => openActionModal('approve', lead, e)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600/80 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition">
                              <Check size={13} /> Approve
                            </button>
                            <button onClick={(e) => openActionModal('reject', lead, e)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition">
                              <X size={13} /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3.5 flex items-center justify-between border-t border-neutral-800 bg-[#0c1424]">
            <span className="text-neutral-500 text-sm">
              Showing <span className="text-neutral-300 font-semibold">{requests.length}</span> of{' '}
              <span className="text-neutral-300 font-semibold">{totalItems}</span> requests
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border font-medium transition ${
                  page === 1 ? 'border-neutral-800 text-neutral-700 cursor-not-allowed' : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                }`}>
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-neutral-500 text-xs px-2">Page {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border font-medium transition ${
                  page >= totalPages ? 'border-neutral-800 text-neutral-700 cursor-not-allowed' : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                }`}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Approve / Reject Modal */}
      {actionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => !actionLoading && setActionModal({ open: false, type: null, lead: null })}>
          <div className="bg-[#111827] rounded-2xl shadow-2xl border border-neutral-700 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-4 rounded-t-2xl flex items-center gap-3 ${actionModal.type === 'approve' ? 'bg-green-700/80' : 'bg-red-700/80'}`}>
              {actionModal.type === 'approve'
                ? <CheckCircle size={22} className="text-white flex-shrink-0" />
                : <XCircle size={22} className="text-white flex-shrink-0" />}
              <div>
                <h3 className="text-white font-extrabold text-base">
                  {actionModal.type === 'approve' ? 'Approve Reassignment' : 'Reject Reassignment'}
                </h3>
                <p className="text-white/70 text-xs mt-0.5">
                  {[actionModal.lead?.first_name, actionModal.lead?.last_name].filter(Boolean).join(' ') || actionModal.lead?.name || 'Unknown Lead'} — requested by{' '}
                  {(actionModal.lead?.requestor_name || '').trim() || 'Unknown'}
                </p>
              </div>
            </div>

            {actionModal.lead?.reassignment_reason && (
              <div className="mx-6 mt-4 p-3 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-400 text-xs italic">
                "{actionModal.lead.reassignment_reason}"
              </div>
            )}

            <div className="px-6 py-4">
              <label className="block text-neutral-300 text-sm font-semibold mb-2">
                {actionModal.type === 'approve' ? 'Approval Remark' : 'Rejection Reason'}
                <span className="text-red-400 ml-1">*</span>
              </label>
              <textarea
                value={actionRemark}
                onChange={e => setActionRemark(e.target.value)}
                placeholder={actionModal.type === 'approve' ? 'Enter approval remark…' : 'Enter rejection reason…'}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500 resize-none text-sm"
                rows={3}
                autoFocus
              />
              {!actionRemark.trim() && (
                <p className="text-yellow-500 text-xs mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} /> This field is required
                </p>
              )}
            </div>

            <div className="px-6 pb-5 flex gap-3 justify-end">
              <button onClick={() => setActionModal({ open: false, type: null, lead: null })} disabled={actionLoading}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium rounded-lg transition border border-neutral-700">
                Cancel
              </button>
              <button
                onClick={actionModal.type === 'approve' ? handleApprove : handleReject}
                disabled={!actionRemark.trim() || actionLoading}
                className={`px-5 py-2 text-white text-sm font-bold rounded-lg transition flex items-center gap-2 ${
                  !actionRemark.trim() || actionLoading
                    ? 'bg-neutral-700 cursor-not-allowed opacity-50'
                    : actionModal.type === 'approve' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                }`}>
                {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                {actionModal.type === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReassignmentPanel;
