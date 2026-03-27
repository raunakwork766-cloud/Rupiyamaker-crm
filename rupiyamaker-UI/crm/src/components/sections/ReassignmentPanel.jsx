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
  const [cooldownHours, setCooldownHours] = useState(24);
  // Live clock for countdown ticks (every 1s for hh:mm:ss display)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  const [actionModal, setActionModal] = useState({ open: false, type: null, lead: null });
  const [actionRemark, setActionRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Transfer history view modal
  const [historyModal, setHistoryModal] = useState({ open: false, lead: null, detail: null, loading: false });

  const openHistoryModal = async (lead, e) => {
    e.stopPropagation();
    setHistoryModal({ open: true, lead, detail: null, loading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${lead._id}?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryModal(prev => ({ ...prev, detail: data, loading: false }));
      } else {
        setHistoryModal(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setHistoryModal(prev => ({ ...prev, loading: false }));
    }
  };

  const userId = localStorage.getItem('userId');

  const resolvedPermissions = userPermissions || (() => {
    try {
      const raw = localStorage.getItem('userPermissions');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const canApprove = canApproveLeadReassignment(resolvedPermissions);

  const loadStats = useCallback(async () => {
    if (!userId) return;
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
  }, [userId]);

  const loadRequests = useCallback(async () => {
    if (!userId) return;
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
      if (data.cooldown_hours) setCooldownHours(data.cooldown_hours);
    } catch (err) {
      setError('Failed to load transfer requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId, page, pageSize, activeTab]);

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

  // Panel is visible to all users — backend returns only permitted requests

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
                  {activeTab === 'approved' && (
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-neutral-500">Details</th>
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
                        {lead.file_sent_to_login ? (
                          <span className="inline-block px-2.5 py-1 bg-green-600 text-white rounded text-xs font-bold tracking-wide">LOGIN</span>
                        ) : (
                          <>
                            {leadStatus && (
                              <span className="inline-block px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded text-xs font-medium">{leadStatus}</span>
                            )}
                            {leadSubStatus && (
                              <span className="inline-block px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded text-xs">{leadSubStatus}</span>
                            )}
                            {!leadStatus && !leadSubStatus && <span className="text-neutral-600 text-xs">—</span>}
                          </>
                        )}
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
                      {activeTab === 'pending' && lead.reassignment_requested_at && (() => {
                        const expiresAt = new Date(lead.reassignment_requested_at).getTime() + cooldownHours * 3_600_000;
                        const remMs = expiresAt - now;
                        if (remMs <= 0) return <p className="text-orange-500/60 text-[10px] mt-0.5">Cooldown expired</p>;
                        const h = Math.floor(remMs / 3_600_000);
                        const m = Math.floor((remMs % 3_600_000) / 60_000);
                        const s = Math.floor((remMs % 60_000) / 1_000);
                        return (
                          <p className="flex items-center gap-1 text-yellow-500/80 text-[11px] mt-1 font-mono">
                            <Clock size={10} className="flex-shrink-0" />
                            {h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`} left
                          </p>
                        );
                      })()}
                      {activeTab === 'approved' && lead.reassignment_approved_at && (
                        <p className="text-green-400/50 text-[10px] mt-0.5">Approved: {fmtDate(lead.reassignment_approved_at)}</p>
                      )}
                      {activeTab === 'rejected' && lead.reassignment_rejected_at && (
                        <p className="text-red-400/50 text-[10px] mt-0.5">Rejected: {fmtDate(lead.reassignment_rejected_at)}</p>
                      )}
                    </td>

                    {/* View Transfer History — only for Approved tab */}
                    {activeTab === 'approved' && (
                      <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => openHistoryModal(lead, e)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold rounded-lg border border-cyan-500/30 transition">
                          <Eye size={13} /> View
                        </button>
                      </td>
                    )}

                    {/* Actions — only for Pending tab, only if user can approve this request */}
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
                                          {dl.file_sent_to_login ? (
                                            <span className="inline-block px-1.5 py-0.5 bg-green-600 text-white rounded text-[10px] font-bold">LOGIN</span>
                                          ) : (
                                            <>
                                              <span className="inline-block px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded text-[10px]">{dl.status || '—'}</span>
                                              {dl.sub_status && <span className="inline-block ml-1 px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded text-[10px]">{dl.sub_status}</span>}
                                            </>
                                          )}
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

      {/* ===== REVIEW MODAL — Dark Theme (matches attendance_ui.html) ===== */}
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
          approved: mlHist.filter(h => h.status === 'approved' || h.action === 'approved' || h.action === 'approved_direct').length,
          rejected: mlHist.filter(h => h.status === 'rejected' || h.action === 'rejected').length,
          pending: 1,
        };

        return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => !actionLoading && setActionModal({ open: false, type: null, lead: null })}>
          <div
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{ width: '1100px', maxWidth: '100%', maxHeight: 'calc(100vh - 3rem)', background: '#09090b', border: '1px solid #27272a', boxShadow: '0 25px 60px rgba(0,0,0,0.9)' }}
            onClick={e => e.stopPropagation()}>

            {/* ── HEADER ── */}
            <div className="px-6 py-4 shrink-0 flex items-center justify-between" style={{ background: '#000000', borderBottom: '1px solid #27272a' }}>
              <div className="flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-black text-black shrink-0"
                  style={{ background: '#0ea5e9', boxShadow: '0 0 16px rgba(14,165,233,0.45)' }}>
                  {mlName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                    <h2 className="text-base font-black text-white tracking-tight leading-tight">{mlName}</h2>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{ background: 'rgba(255,221,0,0.12)', color: '#ffdd00', border: '1px solid rgba(255,221,0,0.3)' }}>
                      PENDING
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs flex-wrap" style={{ color: '#a1a1aa' }}>
                    <span className="flex items-center gap-1"><Phone size={11} />{mlPhone}</span>
                    <span style={{ color: '#3f3f46' }}>|</span>
                    <span>Assigned: <span className="font-semibold text-white">{mlOwner}</span></span>
                    <span style={{ color: '#3f3f46' }}>|</span>
                    <span style={{ color: '#0ea5e9' }}>{mlAgeDays === 0 ? 'Today' : `${mlAgeDays}d ago`}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => !actionLoading && setActionModal({ open: false, type: null, lead: null })}
                className="p-2 rounded-lg transition-colors"
                style={{ color: '#a1a1aa', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = '#1f1f22'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'transparent'; }}>
                <X size={20} />
              </button>
            </div>

            {/* ── BODY ── */}
            <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

              {/* ── LEFT: Duplicate Leads Sidebar ── */}
              <div className="w-[240px] shrink-0 overflow-y-auto" style={{ background: '#0a0a0d', borderRight: '1px solid #27272a' }}>
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#a1a1aa' }}>
                      <Users size={12} style={{ color: '#0ea5e9' }} /> Same Number
                    </span>
                    {mlDups.length > 0 && (
                      <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ color: '#a1a1aa', background: '#1f1f22', border: '1px solid #27272a' }}>
                        {mlDups.length}
                      </span>
                    )}
                  </div>

                  {mlDups.length === 0 ? (
                    <div className="text-center py-8 rounded-lg" style={{ border: '1px dashed #27272a', background: '#09090b' }}>
                      <Users size={20} className="mx-auto mb-1.5" style={{ color: '#3f3f46' }} />
                      <p className="text-xs font-semibold" style={{ color: '#52525b' }}>No duplicates</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {mlDups.map((dl, i) => {
                        const isCurrent = dl.is_current;
                        return (
                          <div
                            key={dl.id || i}
                            className="rounded-lg px-2.5 py-2 transition-all"
                            style={{
                              background: isCurrent ? 'rgba(14,165,233,0.08)' : '#09090b',
                              border: `1px solid ${isCurrent ? 'rgba(14,165,233,0.35)' : '#27272a'}`,
                              borderLeft: `3px solid ${isCurrent ? '#0ea5e9' : '#3f3f46'}`,
                              cursor: dl.id ? 'pointer' : 'default',
                            }}
                            onClick={(e) => { e.stopPropagation(); if (onViewLead && dl.id) onViewLead(dl.id); }}>
                            <div className="flex items-start justify-between gap-1.5 mb-0.5">
                              <span className="text-xs font-bold leading-tight text-white">{dl.name || '—'}</span>
                              {isCurrent && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide"
                                  style={{ color: '#0ea5e9', background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)' }}>
                                  THIS
                                </span>
                              )}
                            </div>
                            {dl.file_sent_to_login ? (
                              <p className="text-[10px] font-bold leading-tight" style={{ color: '#22c55e' }}>LOGIN</p>
                            ) : dl.status && (
                              <p className="text-[10px] font-medium leading-tight" style={{ color: '#a1a1aa' }}>
                                {dl.status}{dl.sub_status ? ` — ${dl.sub_status}` : ''}
                              </p>
                            )}
                            {dl.assigned_to_name && (
                              <p className="text-[9px] mt-1" style={{ color: '#71717a' }}>Owner: {dl.assigned_to_name}</p>
                            )}
                            {dl.loan_type && (
                              <p className="text-[9px] mt-0.5" style={{ color: '#71717a' }}>Type: {dl.loan_type}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT: Timeline ── */}
              <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#000000' }}>

                {/* ── STATS STRIP — same pattern as stat-strip in attendance_ui.html ── */}
                <div className="shrink-0 flex items-stretch z-10" style={{ background: '#09090b', borderBottom: '1px solid #27272a' }}>
                  <div className="px-5 py-2.5 flex items-center shrink-0" style={{ borderRight: '1px solid #27272a' }}>
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#a1a1aa' }}>Transfer History</span>
                  </div>
                  <div className="flex flex-1 items-stretch">
                    {[
                      { label: 'TOTAL',    val: histStats.total,    color: '#ffffff',  show: true },
                      { label: 'APPROVED', val: histStats.approved, color: '#10b981',  show: histStats.approved > 0 },
                      { label: 'REJECTED', val: histStats.rejected, color: '#ff2a2a',  show: histStats.rejected > 0 },
                      { label: 'PENDING',  val: histStats.pending,  color: '#ffdd00',  show: true },
                    ].map((s, i) => s.show ? (
                      <div key={i} className="px-4 py-2 flex items-center gap-2" style={{ borderRight: '1px solid #27272a' }}>
                        <span className="text-lg font-black" style={{ color: s.color, lineHeight: 1 }}>{s.val}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>{s.label}</span>
                      </div>
                    ) : null)}
                  </div>
                </div>

                {/* ── SCROLLABLE TIMELINE ── */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-0">
                    {/* Past history entries */}
                    {mlHist.map((h, index) => {
                      const isApproved = h.status === 'approved' || h.action === 'approved' || h.action === 'approved_direct';
                      const isRejected = h.status === 'rejected' || h.action === 'rejected';
                      const isAutoRej = (h.description || '').toLowerCase().includes('auto') || (h.reason || '').toLowerCase().includes('auto');
                      const stepColor = isApproved ? '#10b981' : isRejected ? '#ff2a2a' : '#a1a1aa';
                      const cardBorderColor = isApproved ? 'rgba(16,185,129,0.3)' : isRejected ? 'rgba(255,42,42,0.3)' : '#27272a';
                      const decisionBg = isApproved ? 'rgba(16,185,129,0.07)' : 'rgba(255,42,42,0.07)';
                      const decisionBorderColor = isApproved ? 'rgba(16,185,129,0.2)' : 'rgba(255,42,42,0.2)';

                      return (
                        <div key={index} className="flex gap-3 pb-3">
                          {/* Step indicator */}
                          <div className="flex flex-col items-center shrink-0 pt-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 text-black"
                              style={{ background: stepColor, boxShadow: `0 0 0 3px rgba(${isApproved ? '16,185,129' : isRejected ? '255,42,42' : '161,161,170'},0.18)` }}>
                              {index + 1}
                            </div>
                            <div className="w-px flex-1 mt-2" style={{ background: '#27272a' }} />
                          </div>

                          {/* Content card */}
                          <div className="flex-1 rounded-xl overflow-hidden" style={{ border: `1px solid ${cardBorderColor}`, background: '#09090b' }}>
                            <div className="px-4 pt-3 pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                                    style={{ background: '#1f1f22', color: '#a1a1aa', border: '1px solid #27272a' }}>
                                    {(h.by_user || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-sm font-bold text-white leading-tight">{h.by_user || 'Unknown'}</span>
                                      <span className="text-[11px] font-medium" style={{ color: '#71717a' }}>requested transfer</span>
                                      {h.to_user && (
                                        <>
                                          <span className="text-[11px]" style={{ color: '#71717a' }}>→</span>
                                          <span className="text-sm font-bold leading-tight" style={{ color: '#0ea5e9' }}>{h.to_user}</span>
                                        </>
                                      )}
                                    </div>
                                    <div className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: '#71717a' }}>
                                      <Calendar size={10} />
                                      {fmtDate(h.date)}
                                    </div>
                                  </div>
                                </div>
                                <span
                                  className="text-[10px] font-bold px-2.5 py-0.5 rounded shrink-0 mt-0.5 capitalize"
                                  style={{
                                    background: isApproved ? 'rgba(16,185,129,0.15)' : isRejected ? 'rgba(255,42,42,0.15)' : 'rgba(161,161,170,0.15)',
                                    color: isApproved ? '#10b981' : isRejected ? '#ff2a2a' : '#a1a1aa',
                                    border: `1px solid ${isApproved ? 'rgba(16,185,129,0.3)' : isRejected ? 'rgba(255,42,42,0.3)' : 'rgba(161,161,170,0.3)'}`,
                                  }}>
                                  {h.status || 'unknown'}
                                </span>
                              </div>
                              {h.reason && (
                                <div className="mt-2.5 pl-3 ml-1" style={{ borderLeft: '2px solid #27272a' }}>
                                  <p className="text-xs italic leading-relaxed" style={{ color: '#a1a1aa' }}>"{h.reason}"</p>
                                </div>
                              )}
                            </div>

                            {/* Decision section */}
                            {h.description && (
                              <div className="border-t px-4 py-3" style={{ borderColor: decisionBorderColor, background: decisionBg }}>
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                                    style={{ background: '#1f1f22', color: isAutoRej ? '#ff2a2a' : isApproved ? '#10b981' : '#ff2a2a', border: `2px solid ${isApproved ? 'rgba(16,185,129,0.4)' : 'rgba(255,42,42,0.4)'}` }}>
                                    {isAutoRej ? <Clock size={10} /> : (h.by_user || 'M').charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs font-bold text-white">{isAutoRej ? 'System' : 'Manager'}</span>
                                  {!isAutoRej && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                      style={{ color: '#0ea5e9', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)' }}>
                                      APPROVER
                                    </span>
                                  )}
                                  <span className="text-[10px] font-semibold" style={{ color: isApproved ? '#10b981' : '#ff2a2a' }}>
                                    {isApproved ? '✓ approved' : '✕ rejected'}
                                  </span>
                                </div>
                                <p className="text-xs leading-relaxed font-medium" style={{ color: isAutoRej ? '#ff2a2a' : isApproved ? '#10b981' : '#a1a1aa' }}>
                                  {h.description}
                                </p>
                                {/* From → To indicator for approved */}
                                {isApproved && h.by_user && h.to_user && (
                                  <div className="mt-2.5 flex items-center gap-0 rounded overflow-hidden text-xs font-bold" style={{ border: '1px solid rgba(16,185,129,0.3)' }}>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 flex-1 min-w-0" style={{ background: 'rgba(255,42,42,0.08)' }}>
                                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: 'rgba(255,42,42,0.2)', color: '#ff6b6b' }}>
                                        {h.by_user.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5" style={{ color: '#ff6b6b' }}>From</div>
                                        <div className="font-black truncate text-white text-xs">{h.by_user}</div>
                                      </div>
                                    </div>
                                    <div className="px-2 py-1.5 flex items-center shrink-0 self-stretch" style={{ background: '#10b981' }}>
                                      <span className="text-black text-sm font-black">→</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 flex-1 min-w-0" style={{ background: 'rgba(16,185,129,0.08)' }}>
                                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
                                        {h.to_user.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5" style={{ color: '#10b981' }}>To</div>
                                        <div className="font-black truncate text-white text-xs">{h.to_user}</div>
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

                    {/* ── Current pending request (being reviewed) ── */}
                    <div className="flex gap-3 pb-3">
                      <div className="flex flex-col items-center shrink-0 pt-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 text-black"
                          style={{ background: '#ffdd00', boxShadow: '0 0 0 3px rgba(255,221,0,0.2)' }}>
                          {mlHist.length + 1}
                        </div>
                      </div>

                      <div className="flex-1 rounded-xl overflow-hidden"
                        style={{ border: '1px solid rgba(14,165,233,0.4)', background: '#09090b', boxShadow: '0 0 0 2px rgba(14,165,233,0.08)' }}>
                        <div className="px-4 pt-3 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                                style={{ background: '#1f1f22', color: '#a1a1aa', border: '1px solid #27272a' }}>
                                {mlRequestor.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-bold text-white leading-tight">{mlRequestor}</span>
                                  <span className="text-[11px] font-medium" style={{ color: '#71717a' }}>requested transfer</span>
                                  {mlTarget && (
                                    <>
                                      <span className="text-[11px]" style={{ color: '#71717a' }}>→</span>
                                      <span className="text-sm font-bold leading-tight" style={{ color: '#0ea5e9' }}>{mlTarget}</span>
                                    </>
                                  )}
                                </div>
                                <div className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: '#71717a' }}>
                                  <Calendar size={10} />
                                  {fmtDate(ml.reassignment_requested_at || ml.updated_at)}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded shrink-0 mt-0.5"
                              style={{ background: 'rgba(255,221,0,0.12)', color: '#ffdd00', border: '1px solid rgba(255,221,0,0.3)' }}>
                              PENDING
                            </span>
                          </div>

                          {mlReason && (
                            <div className="mt-2.5 pl-3 ml-1" style={{ borderLeft: '2px solid #27272a' }}>
                              <p className="text-xs italic leading-relaxed" style={{ color: '#a1a1aa' }}>"{mlReason}"</p>
                            </div>
                          )}

                          {(mlLeadStatus || mlSubStatus) && (
                            <div className="flex gap-1.5 mt-2.5 flex-wrap">
                              {mlLeadStatus && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded"
                                  style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)', color: '#0ea5e9' }}>
                                  <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: '#0ea5e9' }} />
                                  Lead: {mlLeadStatus}
                                </span>
                              )}
                              {mlSubStatus && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded"
                                  style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6' }}>
                                  <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: '#8b5cf6' }} />
                                  Sub: {mlSubStatus}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Your Decision textarea */}
                        <div className="border-t px-4 py-3" style={{ borderColor: 'rgba(255,221,0,0.2)', background: 'rgba(255,221,0,0.04)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: '#ffdd00' }}>
                            <Clock size={12} /> Your Decision
                          </p>
                          <textarea
                            value={actionRemark}
                            onChange={e => setActionRemark(e.target.value)}
                            placeholder="Write your decision remark here (Required)…"
                            className="w-full resize-none outline-none text-white text-xs p-2.5 rounded-lg min-h-[56px] transition-all placeholder-[#52525b]"
                            style={{ background: '#000000', border: '1px solid #27272a' }}
                            onFocus={e => { e.currentTarget.style.borderColor = '#ffdd00'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#27272a'; }}
                            autoFocus
                          />
                          {!actionRemark.trim() && (
                            <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: '#ffdd00' }}>
                              <AlertTriangle size={10} /> Remark is required to proceed
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── FOOTER ACTIONS ── */}
                <div className="p-5 shrink-0" style={{ background: '#09090b', borderTop: '1px solid #27272a' }}>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={handleReject}
                      disabled={!actionRemark.trim() || actionLoading}
                      className="px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'rgba(255,42,42,0.08)', color: '#ff2a2a', border: '2px solid rgba(255,42,42,0.3)' }}
                      onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(255,42,42,0.16)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,42,42,0.08)'; }}>
                      {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                      <XCircle size={16} /> Reject Transfer
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={!actionRemark.trim() || actionLoading}
                      className="px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-black"
                      style={{ background: '#10b981', boxShadow: '0 0 16px rgba(16,185,129,0.3)' }}
                      onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#059669'; }}
                      onMouseLeave={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#10b981'; }}>
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
