import React, { useState, useEffect, useCallback } from 'react';
import { canApproveLeadReassignment } from '../../utils/permissions';
import { Check, X, ChevronLeft, ChevronRight, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, ChevronDown, Users, ArrowRight, Calendar, Phone, UserCheck } from 'lucide-react';

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
                        <button onClick={(e) => openActionModal('review', lead, e)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm font-semibold rounded-lg transition-all border border-cyan-500/20 hover:border-cyan-500/40 mx-auto whitespace-nowrap">
                          <UserCheck size={14} /> Review
                        </button>
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

      {/* ===== REVIEW MODAL — Premium Light Theme with Timeline ===== */}
      {actionModal.open && (() => {
        const ml = actionModal.lead || {};
        const mlName = [ml.first_name, ml.last_name].filter(Boolean).join(' ') || ml.name || ml.customer_name || 'Unknown Lead';
        const mlDups = ml.duplicate_leads || [];
        const mlHist = ml.reassignment_history || [];
        const mlTarget = (ml.target_user_name || '').trim();
        const mlRequestor = (ml.requestor_name || ml.reassignment_requested_by_name || '').trim() || 'Unknown';
        const mlOwner = (ml.assigned_user_name || ml.created_by_name || '').trim() || '—';
        const mlPhone = ml.mobile_number || ml.phone || '—';
        const mlLeadStatus = ml.lead_status || '';
        const mlSubStatus = ml.sub_status || '';
        const mlReason = ml.reassignment_reason || '';
        const mlCreatedAt = ml.created_at || ml.reassignment_requested_at;
        const mlAgeDays = mlCreatedAt ? Math.floor((Date.now() - new Date(mlCreatedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;

        const histStats = {
          total: mlHist.length + 1,
          approved: mlHist.filter(h => h.status === 'approved').length,
          rejected: mlHist.filter(h => h.status === 'rejected').length,
          pending: 1,
        };

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6"
          onClick={() => !actionLoading && setActionModal({ open: false, type: null, lead: null })}>
          <div
            className="bg-white border border-gray-200 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col font-sans"
            style={{ width: '1100px', maxWidth: '100%', maxHeight: 'calc(100vh - 3rem)' }}
            onClick={e => e.stopPropagation()}>

            {/* ── HEADER ── */}
            <div className="px-6 py-3.5 border-b border-gray-200 shrink-0 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base font-black text-slate-700 shrink-0">
                  {mlName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <h2 className="text-base font-black text-gray-900 tracking-tight leading-tight">{mlName}</h2>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border text-amber-700 bg-amber-50 border-amber-200">
                      Pending
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><Phone size={12} />{mlPhone}</span>
                    <span className="text-gray-200">|</span>
                    <span>Assigned: <span className="text-gray-700 font-semibold">{mlOwner}</span></span>
                    <span className="text-gray-200">|</span>
                    <span className="text-gray-500">{mlAgeDays === 0 ? 'Created Today' : `${mlAgeDays}d ago`}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => !actionLoading && setActionModal({ open: false, type: null, lead: null })}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <XCircle size={20} />
              </button>
            </div>

            {/* ── BODY ── */}
            <div className="flex flex-1 overflow-hidden bg-white" style={{ minHeight: 0 }}>

              {/* ── LEFT: Duplicate Leads Sidebar ── */}
              <div className="w-[240px] border-r border-gray-100 shrink-0 overflow-y-auto bg-gray-50">
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Users size={12} /> Leads
                    </span>
                    {mlDups.length > 0 && (
                      <span className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">{mlDups.length}</span>
                    )}
                  </div>

                  {mlDups.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-gray-200 bg-white rounded-lg">
                      <Users size={20} className="text-gray-300 mx-auto mb-1.5" />
                      <p className="text-xs font-semibold text-gray-400">No duplicates</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {mlDups.map((dl, i) => {
                        const isCurrent = dl.is_current;
                        const accentBorder = isCurrent ? 'border-l-cyan-500' : 'border-l-gray-300';
                        const cardBg = isCurrent ? 'bg-cyan-50/60' : 'bg-white';
                        return (
                          <div key={dl.id || i}
                            className={`rounded-lg border border-gray-200 border-l-[3px] ${accentBorder} ${cardBg} px-2.5 py-2 ${dl.id ? 'cursor-pointer hover:shadow-sm' : ''}`}
                            onClick={(e) => { e.stopPropagation(); if (onViewLead && dl.id) onViewLead(dl.id); }}>
                            <div className="flex items-start justify-between gap-1.5 mb-0.5">
                              <span className="text-xs font-bold text-gray-900 leading-tight">{dl.name || '—'}</span>
                              {isCurrent && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 leading-tight uppercase tracking-wide text-cyan-700 bg-cyan-100 border-cyan-200">
                                  Current
                                </span>
                              )}
                            </div>
                            {dl.status && (
                              <p className="text-[10px] text-gray-500 font-medium leading-tight">{dl.status}{dl.sub_status ? ` — ${dl.sub_status}` : ''}</p>
                            )}
                            {dl.assigned_to_name && (
                              <p className="text-[9px] text-gray-400 mt-1">Assigned: {dl.assigned_to_name}</p>
                            )}
                            {dl.loan_type && (
                              <p className="text-[9px] text-gray-400 mt-0.5">Type: {dl.loan_type}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT: Timeline ── */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white">

                {/* ── STICKY STATS HEADER ── */}
                <div className="shrink-0 px-5 py-2.5 border-b border-gray-200 bg-white z-10 flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest shrink-0">
                    Transfer History
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="px-2.5 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-600 flex items-center gap-1">
                      <span className="text-gray-900 text-xs font-black">{histStats.total}</span> Total
                    </div>
                    {histStats.approved > 0 && (
                      <div className="px-2.5 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <span className="text-emerald-900 text-xs font-black">{histStats.approved}</span> Approved
                      </div>
                    )}
                    {histStats.rejected > 0 && (
                      <div className="px-2.5 py-0.5 rounded-md border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700 flex items-center gap-1">
                        <span className="text-rose-900 text-xs font-black">{histStats.rejected}</span> Rejected
                      </div>
                    )}
                    {histStats.pending > 0 && (
                      <div className="px-2.5 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-700 flex items-center gap-1">
                        <span className="text-amber-900 text-xs font-black">{histStats.pending}</span> Pending
                      </div>
                    )}
                  </div>
                </div>

                {/* ── SCROLLABLE TIMELINE ── */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-0">
                    {/* Past history entries */}
                    {mlHist.map((h, index) => {
                      const isApproved = h.status === 'approved';
                      const isRejected = h.status === 'rejected';
                      const isAutoRej = (h.description || '').toLowerCase().includes('auto') || (h.reason || '').toLowerCase().includes('auto');

                      const stepCls = isApproved
                        ? 'bg-emerald-500 text-white ring-4 ring-emerald-100'
                        : isRejected
                        ? 'bg-rose-500 text-white ring-4 ring-rose-100'
                        : 'bg-gray-400 text-white ring-4 ring-gray-100';

                      const cardBorder = isApproved ? 'border-emerald-200' : isRejected ? 'border-rose-200' : 'border-gray-200';

                      const decisionBg = isApproved
                        ? 'bg-emerald-50 border-emerald-100'
                        : isAutoRej
                        ? 'bg-red-50 border-red-100'
                        : 'bg-rose-50 border-rose-100';

                      const statusPill = isApproved
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : isRejected
                        ? 'bg-rose-100 text-rose-700 border-rose-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200';

                      return (
                        <div key={index} className="flex gap-3 pb-3">
                          {/* Step indicator */}
                          <div className="flex flex-col items-center shrink-0 pt-2.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${stepCls}`}>
                              {index + 1}
                            </div>
                            <div className="w-px bg-gray-200 flex-1 mt-2" />
                          </div>

                          {/* Content card */}
                          <div className={`flex-1 rounded-xl border bg-white overflow-hidden shadow-sm transition-shadow hover:shadow-md ${cardBorder}`}>
                            {/* Agent section */}
                            <div className="px-4 pt-3 pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold border border-slate-200 shrink-0 mt-0.5">
                                    {(h.by_user || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-sm font-bold text-gray-900 leading-tight">{h.by_user || 'Unknown'}</span>
                                      <span className="text-[11px] text-gray-400 font-medium">requested transfer</span>
                                      {h.to_user && (
                                        <>
                                          <span className="text-[11px] text-gray-400">→</span>
                                          <span className="text-sm font-bold text-cyan-600 leading-tight">{h.to_user}</span>
                                        </>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                      <Calendar size={10} />
                                      {fmtDate(h.date)}
                                    </div>
                                  </div>
                                </div>
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 mt-0.5 capitalize ${statusPill}`}>
                                  {h.status || 'unknown'}
                                </span>
                              </div>

                              {/* Reason blockquote */}
                              {h.reason && (
                                <div className="mt-2.5 pl-3 border-l-2 border-gray-200 ml-1">
                                  <p className="text-xs text-gray-600 leading-relaxed italic">"{h.reason}"</p>
                                </div>
                              )}
                            </div>

                            {/* Decision section */}
                            {h.description && (
                              <div className={`border-t px-4 py-3 ${decisionBg}`}>
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 bg-white shrink-0 ${isAutoRej ? 'text-rose-500 border-rose-300' : isApproved ? 'text-emerald-600 border-emerald-300' : 'text-rose-600 border-rose-300'}`}>
                                    {isAutoRej ? <Clock size={10} /> : (h.by_user || 'M').charAt(0).toUpperCase()}
                                  </div>
                                  <span className={`text-xs font-bold ${isAutoRej ? 'text-rose-700' : 'text-gray-800'}`}>
                                    {isAutoRej ? 'System' : 'Manager'}
                                  </span>
                                  {!isAutoRej && (
                                    <span className="text-[9px] font-bold text-indigo-600 bg-white border border-indigo-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Approver</span>
                                  )}
                                  <span className={`text-[10px] font-semibold ${isApproved ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {isApproved ? '✓ approved' : '✕ rejected'}
                                  </span>
                                </div>
                                <p className={`text-xs leading-relaxed font-medium ${isAutoRej ? 'text-rose-700' : isApproved ? 'text-emerald-800' : 'text-gray-700'}`}>
                                  {h.description}
                                </p>
                                {/* From → To transfer indicator for approved */}
                                {isApproved && h.by_user && h.to_user && (
                                  <div className="mt-2.5 flex items-center gap-0 rounded-lg overflow-hidden border border-emerald-200 text-xs font-bold">
                                    <div className="flex items-center gap-1.5 bg-rose-50 px-3 py-1.5 flex-1 min-w-0">
                                      <div className="w-5 h-5 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center text-[10px] font-black shrink-0">
                                        {h.by_user.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-[9px] font-bold text-rose-400 uppercase tracking-wider leading-none mb-0.5">From</div>
                                        <div className="text-rose-800 font-black truncate leading-tight text-xs">{h.by_user}</div>
                                      </div>
                                    </div>
                                    <div className="bg-emerald-500 px-2 py-1.5 flex items-center shrink-0 self-stretch">
                                      <span className="text-white text-sm font-black">→</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 flex-1 min-w-0">
                                      <div className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center text-[10px] font-black shrink-0">
                                        {h.to_user.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider leading-none mb-0.5">To</div>
                                        <div className="text-emerald-800 font-black truncate leading-tight text-xs">{h.to_user}</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* ── Current pending request (the one being reviewed) ── */}
                    <div className="flex gap-3 pb-3">
                      <div className="flex flex-col items-center shrink-0 pt-2.5">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 bg-amber-400 text-white ring-4 ring-amber-100">
                          {mlHist.length + 1}
                        </div>
                      </div>

                      <div className="flex-1 rounded-xl border bg-white overflow-hidden shadow-sm border-blue-300 ring-2 ring-blue-100">
                        {/* Agent section */}
                        <div className="px-4 pt-3 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold border border-slate-200 shrink-0 mt-0.5">
                                {mlRequestor.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-bold text-gray-900 leading-tight">{mlRequestor}</span>
                                  <span className="text-[11px] text-gray-400 font-medium">requested transfer</span>
                                  {mlTarget && (
                                    <>
                                      <span className="text-[11px] text-gray-400">→</span>
                                      <span className="text-sm font-bold text-cyan-600 leading-tight">{mlTarget}</span>
                                    </>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                  <Calendar size={10} />
                                  {fmtDate(ml.reassignment_requested_at || ml.updated_at)}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 mt-0.5 bg-amber-100 text-amber-700 border-amber-200">
                              Pending
                            </span>
                          </div>

                          {/* Reason blockquote */}
                          {mlReason && (
                            <div className="mt-2.5 pl-3 border-l-2 border-gray-200 ml-1">
                              <p className="text-xs text-gray-600 leading-relaxed italic">"{mlReason}"</p>
                            </div>
                          )}

                          {/* Status context pills */}
                          {(mlLeadStatus || mlSubStatus) && (
                            <div className="flex gap-1.5 mt-2.5 flex-wrap">
                              {mlLeadStatus && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 inline-block" />
                                  Lead: {mlLeadStatus}
                                </span>
                              )}
                              {mlSubStatus && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 inline-block" />
                                  Sub: {mlSubStatus}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Manager decision input area */}
                        <div className="border-t px-4 py-3 bg-amber-50 border-amber-100">
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Clock size={12} /> Your Decision
                          </p>
                          <textarea
                            value={actionRemark}
                            onChange={e => setActionRemark(e.target.value)}
                            placeholder="Write your decision remark here (Required)…"
                            className="w-full bg-white border border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-gray-900 rounded-lg p-2.5 resize-none outline-none transition-all min-h-[56px] text-xs placeholder:text-gray-400"
                            autoFocus
                          />
                          {!actionRemark.trim() && (
                            <p className="text-amber-600 text-[10px] mt-1 flex items-center gap-1">
                              <AlertTriangle size={10} /> Remark is required to proceed
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── FOOTER ACTIONS ── */}
                <div className="p-5 bg-gray-50 shrink-0 border-t border-gray-200">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={handleReject} disabled={!actionRemark.trim() || actionLoading}
                      className="px-6 py-2.5 rounded-xl text-sm font-bold border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 bg-white">
                      {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                      <XCircle size={16} /> Reject Transfer
                    </button>
                    <button onClick={handleApprove} disabled={!actionRemark.trim() || actionLoading}
                      className="px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm disabled:shadow-none">
                      {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                      <CheckCircle size={16} /> Approve Transfer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
      })()}
    </div>
  );
};

export default ReassignmentPanel;
