import React, { useState, useEffect, useCallback } from 'react';
import { canApproveLeadReassignment } from '../../utils/permissions';
import { Check, X, ChevronLeft, ChevronRight, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, ChevronDown, Users, ArrowRight } from 'lucide-react';

const API_BASE_URL = '/api';

const ReassignmentPanel = ({ userPermissions, onLeadAction, onViewLead }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [activeTab, setActiveTab] = useState('pending');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [expandedRows, setExpandedRows] = useState({});

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
      setError('Failed to load transfer requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [canApprove, userId, page, pageSize, activeTab]);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { setPage(1); setExpandedRows({}); }, [activeTab]);

  const toggleExpand = (leadId, e) => {
    e.stopPropagation();
    setExpandedRows(prev => ({ ...prev, [leadId]: !prev[leadId] }));
  };

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
    },
    green: {
      badge: 'bg-green-500/20 text-green-400 border-green-500/40',
      tab: 'text-green-400 border-green-400',
    },
    red: {
      badge: 'bg-red-500/20 text-red-400 border-red-500/40',
      tab: 'text-red-400 border-red-400',
    },
  };

  return (
    <div className="bg-[#0d1117] rounded-xl overflow-hidden border border-neutral-800">

      {/* Tab strip — clean top tabs */}
      <div className="flex border-b border-neutral-800 bg-[#0c1424]">
        {tabDefs.map(t => {
          const c = colorMap[t.color];
          const cnt = stats[t.key];
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold border-b-2 transition-all ${
                activeTab === t.key
                  ? `${c.tab} bg-neutral-800/40`
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}>
              <t.Icon size={15} />
              {t.label}
              {cnt > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                  activeTab === t.key ? c.badge : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                }`}>{cnt}</span>
              )}
            </button>
          );
        })}
        <button onClick={() => { loadRequests(); loadStats(); }} disabled={loading}
          className="ml-auto mr-3 my-2 flex items-center gap-1 px-2.5 py-1.5 text-neutral-500 hover:text-neutral-300 text-xs transition rounded-lg hover:bg-neutral-800" title="Refresh">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error bar */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-900/30 text-red-300 border border-red-700/50 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle size={15} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="p-14 text-center">
          <RefreshCw size={28} className="animate-spin text-cyan-400 mx-auto mb-3" />
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
                  <th className="px-2 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Lead</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Requested By</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Transfer To</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Current Owner</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Reason</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">Date</th>
                  {activeTab === 'pending' && (
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-neutral-500">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {requests.map((lead) => {
                  const customerName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.name || lead.customer_name || 'Unknown Lead';
                  const requestedBy = (lead.requestor_name || '').trim() || (lead.reassignment_requested_by_name || '').trim() || '—';
                  const targetUser = (lead.target_user_name || '').trim() || '—';
                  const currentOwner = (lead.assigned_user_name || '').trim() || (lead.created_by_name || '').trim() || '—';
                  const leadStatus = lead.lead_status || '';
                  const leadSubStatus = lead.sub_status || '';
                  const dupCount = lead.duplicate_count || 0;
                  const dupLeads = lead.duplicate_leads || [];
                  const history = lead.reassignment_history || [];
                  const isExpanded = !!expandedRows[lead._id];
                  const colCount = activeTab === 'pending' ? 9 : 8;

                  return (
                  <React.Fragment key={lead._id}>
                  <tr
                    className="hover:bg-neutral-800/40 transition-colors group cursor-pointer"
                    onClick={() => onViewLead && onViewLead(lead._id)}
                    title="Click to view lead details">
                    {/* Expand chevron */}
                    <td className="px-2 py-3.5 w-8" onClick={e => toggleExpand(lead._id, e)}>
                      {(dupCount > 1 || history.length > 0) && (
                        <ChevronDown size={15} className={`text-cyan-400 transition-transform mx-auto ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </td>
                    {/* Lead Name + Mobile + Dup Count badge */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-cyan-700/60 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 border border-cyan-600/30">
                          {customerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-semibold truncate max-w-[140px] group-hover:text-cyan-300 transition-colors">
                              {customerName}
                            </p>
                            {dupCount > 1 && (
                              <span onClick={e => toggleExpand(lead._id, e)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full text-[10px] font-bold cursor-pointer hover:bg-orange-500/30 transition flex-shrink-0">
                                <Users size={9} />
                                {dupCount}
                              </span>
                            )}
                          </div>
                          <p className="text-neutral-500 text-xs">{lead.mobile_number || lead.phone || '—'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Requested By */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-neutral-200 font-medium text-sm">{requestedBy}</p>
                    </td>

                    {/* Transfer To */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <ArrowRight size={12} className="text-cyan-500 flex-shrink-0" />
                        <p className="text-cyan-300 font-semibold text-sm">{targetUser}</p>
                      </div>
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
                        {!leadStatus && !leadSubStatus && <span className="text-neutral-600 text-xs">—</span>}
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="px-4 py-3.5 max-w-[240px]">
                      {lead.reassignment_reason ? (
                        <p className="text-neutral-200 text-xs leading-relaxed">{lead.reassignment_reason}</p>
                      ) : (
                        <span className="text-neutral-600 text-xs">No reason provided</span>
                      )}
                      {activeTab === 'approved' && lead.reassignment_approved_by_name && (
                        <p className="text-green-400 text-[11px] mt-1.5 flex items-center gap-1">
                          <CheckCircle size={11} /> Approved by: {lead.reassignment_approved_by_name}
                        </p>
                      )}
                      {activeTab === 'rejected' && (
                        <>
                          {lead.reassignment_rejection_reason && (
                            <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1">
                              <XCircle size={11} /> {lead.reassignment_rejection_reason}
                            </p>
                          )}
                          {lead.reassignment_rejected_by_name && (
                            <p className="text-red-400/60 text-[10px]">By: {lead.reassignment_rejected_by_name}</p>
                          )}
                        </>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-neutral-400 text-xs">{fmtDate(lead.reassignment_requested_at || lead.updated_at)}</p>
                      {activeTab === 'approved' && lead.reassignment_approved_at && (
                        <p className="text-green-400/50 text-[10px] mt-0.5">Approved: {fmtDate(lead.reassignment_approved_at)}</p>
                      )}
                      {activeTab === 'rejected' && lead.reassignment_rejected_at && (
                        <p className="text-red-400/50 text-[10px] mt-0.5">Rejected: {fmtDate(lead.reassignment_rejected_at)}</p>
                      )}
                    </td>

                    {/* Actions — only for Pending tab */}
                    {activeTab === 'pending' && (
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={(e) => openActionModal('approve', lead, e)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600/80 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition">
                            <Check size={13} /> Approve
                          </button>
                          <button onClick={(e) => openActionModal('reject', lead, e)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition">
                            <X size={13} /> Reject
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>

                  {/* ── Expandable detail row: Duplicate leads + Transfer history ── */}
                  {isExpanded && (
                    <tr className="bg-neutral-900/60">
                      <td colSpan={colCount} className="px-6 py-4">
                        <div className="flex gap-6 flex-wrap">

                          {/* Duplicate Leads Table */}
                          {dupLeads.length > 0 && (
                            <div className="flex-1 min-w-[340px]">
                              <h4 className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Users size={12} className="text-orange-400" />
                                Leads with same number
                                <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-1.5 py-0.5 text-[10px] font-bold ml-1">{dupLeads.length}</span>
                              </h4>
                              <div className="rounded-lg border border-neutral-800 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-neutral-800/80 border-b border-neutral-700/60">
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-neutral-500 uppercase">Name</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-neutral-500 uppercase">Assigned To</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-neutral-500 uppercase">Status</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-neutral-500 uppercase">Loan Type</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-neutral-500 uppercase">Created</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-800/50">
                                    {dupLeads.map((dl, idx) => (
                                      <tr key={dl.id || idx} className={`hover:bg-neutral-800/30 transition ${dl.is_current ? 'bg-cyan-900/15 border-l-2 border-l-cyan-500' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); if (onViewLead && dl.id) onViewLead(dl.id); }}
                                        style={{ cursor: 'pointer' }}>
                                        <td className="px-3 py-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-neutral-200 font-medium">{dl.name || '—'}</span>
                                            {dl.is_current && <span className="text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded px-1 py-0">THIS</span>}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 text-neutral-300">{dl.assigned_to_name || '—'}</td>
                                        <td className="px-3 py-2">
                                          <span className="inline-block px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded text-[10px]">{dl.status || '—'}</span>
                                          {dl.sub_status && <span className="inline-block ml-1 px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded text-[10px]">{dl.sub_status}</span>}
                                        </td>
                                        <td className="px-3 py-2 text-neutral-400">{dl.loan_type || '—'}</td>
                                        <td className="px-3 py-2 text-neutral-500">{fmtDate(dl.created_at)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Transfer / Reassignment History Timeline */}
                          {history.length > 0 && (
                            <div className="min-w-[280px] max-w-[380px]">
                              <h4 className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Clock size={12} className="text-purple-400" />
                                Transfer History
                                <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full px-1.5 py-0.5 text-[10px] font-bold ml-1">{history.length}</span>
                              </h4>
                              <div className="space-y-0 pl-3 border-l-2 border-neutral-700">
                                {history.map((h, idx) => (
                                  <div key={idx} className="relative pb-3 last:pb-0">
                                    <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full border-2 border-neutral-600 bg-neutral-900"
                                      style={{ borderColor: h.status === 'approved' ? 'rgb(74, 222, 128)' : h.status === 'rejected' ? 'rgb(248, 113, 113)' : 'rgb(163, 163, 163)' }} />
                                    <div className="ml-2">
                                      <p className="text-neutral-200 text-xs font-medium">
                                        {h.by_user || 'Unknown'} {h.to_user ? <>→ <span className="text-cyan-400">{h.to_user}</span></> : ''}
                                      </p>
                                      {h.reason && <p className="text-neutral-500 text-[11px] mt-0.5 italic">"{h.reason}"</p>}
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-neutral-600 text-[10px]">{fmtDate(h.date)}</span>
                                        {h.status && (
                                          <span className={`text-[9px] px-1.5 py-0 rounded font-bold ${
                                            h.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                            h.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                            'bg-neutral-700 text-neutral-400'
                                          }`}>{h.status}</span>
                                        )}
                                      </div>
                                      {h.description && <p className="text-neutral-600 text-[10px] mt-0.5">{h.description}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {dupLeads.length === 0 && history.length === 0 && (
                            <p className="text-neutral-600 text-xs italic">No additional data available</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
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

      {/* Approve / Reject Modal — with full context */}
      {actionModal.open && (() => {
        const ml = actionModal.lead || {};
        const mlName = [ml.first_name, ml.last_name].filter(Boolean).join(' ') || ml.name || 'Unknown Lead';
        const mlDups = ml.duplicate_leads || [];
        const mlHist = ml.reassignment_history || [];
        const mlTarget = (ml.target_user_name || '').trim();
        const mlRequestor = (ml.requestor_name || '').trim() || 'Unknown';
        const mlOwner = (ml.assigned_user_name || '').trim() || '—';
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => !actionLoading && setActionModal({ open: false, type: null, lead: null })}>
          <div className="bg-[#111827] rounded-2xl shadow-2xl border border-neutral-700 w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-4 rounded-t-2xl flex items-center gap-3 sticky top-0 z-10 ${actionModal.type === 'approve' ? 'bg-green-700/80' : 'bg-red-700/80'}`}>
              {actionModal.type === 'approve'
                ? <CheckCircle size={22} className="text-white flex-shrink-0" />
                : <XCircle size={22} className="text-white flex-shrink-0" />}
              <div>
                <h3 className="text-white font-extrabold text-base">
                  {actionModal.type === 'approve' ? 'Approve Transfer' : 'Reject Transfer'}
                </h3>
                <p className="text-white/70 text-xs mt-0.5">
                  {mlName} — requested by {mlRequestor}
                </p>
              </div>
            </div>

            {/* Transfer summary cards */}
            <div className="px-6 pt-4 grid grid-cols-3 gap-3 text-center">
              <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-700">
                <p className="text-neutral-500 text-[10px] uppercase font-bold">Requested By</p>
                <p className="text-neutral-200 text-sm font-semibold mt-0.5">{mlRequestor}</p>
              </div>
              <div className="p-2.5 bg-neutral-900 rounded-lg border border-cyan-800/40">
                <p className="text-neutral-500 text-[10px] uppercase font-bold">Transfer To</p>
                <p className="text-cyan-300 text-sm font-semibold mt-0.5">{mlTarget || '—'}</p>
              </div>
              <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-700">
                <p className="text-neutral-500 text-[10px] uppercase font-bold">Current Owner</p>
                <p className="text-neutral-200 text-sm font-semibold mt-0.5">{mlOwner}</p>
              </div>
            </div>

            {/* Reason */}
            {ml.reassignment_reason && (
              <div className="mx-6 mt-3 p-3 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-400 text-xs italic">
                "{ml.reassignment_reason}"
              </div>
            )}

            {/* Duplicate leads — compact */}
            {mlDups.length > 1 && (
              <div className="mx-6 mt-3">
                <p className="text-neutral-400 text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Users size={11} className="text-orange-400" />
                  {mlDups.length} Leads with same number
                </p>
                <div className="rounded-lg border border-neutral-800 overflow-hidden max-h-[140px] overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <tbody className="divide-y divide-neutral-800/50">
                      {mlDups.map((dl, i) => (
                        <tr key={dl.id || i} className={`${dl.is_current ? 'bg-cyan-900/15' : 'bg-neutral-900/40'}`}>
                          <td className="px-3 py-1.5 text-neutral-200 font-medium">
                            {dl.name || '—'}
                            {dl.is_current && <span className="ml-1 text-[8px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded px-1">THIS</span>}
                          </td>
                          <td className="px-2 py-1.5 text-neutral-400">{dl.assigned_to_name || '—'}</td>
                          <td className="px-2 py-1.5"><span className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded text-[10px]">{dl.status || '—'}</span></td>
                          <td className="px-2 py-1.5 text-neutral-500">{fmtDate(dl.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transfer history — compact timeline */}
            {mlHist.length > 0 && (
              <div className="mx-6 mt-3">
                <p className="text-neutral-400 text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock size={11} className="text-purple-400" /> Transfer History ({mlHist.length})
                </p>
                <div className="pl-3 border-l-2 border-neutral-700 space-y-2 max-h-[120px] overflow-y-auto">
                  {mlHist.map((h, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[13px] top-1 w-2 h-2 rounded-full bg-neutral-900 border-2"
                        style={{ borderColor: h.status === 'approved' ? '#4ade80' : h.status === 'rejected' ? '#f87171' : '#737373' }} />
                      <div className="ml-2 text-[11px]">
                        <span className="text-neutral-200">{h.by_user || '—'}</span>
                        {h.to_user && <> → <span className="text-cyan-400">{h.to_user}</span></>}
                        <span className="text-neutral-600 ml-2">{fmtDate(h.date)}</span>
                        {h.status && <span className={`ml-1.5 px-1 rounded text-[9px] font-bold ${h.status === 'approved' ? 'bg-green-500/20 text-green-400' : h.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-neutral-700 text-neutral-400'}`}>{h.status}</span>}
                      </div>
                    </div>
                  ))}
                </div>
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
      );
      })()}
    </div>
  );
};

export default ReassignmentPanel;
