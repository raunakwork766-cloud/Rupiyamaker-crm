import React, { useState, useEffect, useCallback } from 'react';
import { canApproveLeadReassignment } from '../../utils/permissions';
import { Check, X, ChevronLeft, ChevronRight, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, ChevronDown, Users, ArrowRight, Eye } from 'lucide-react';

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
                        {lead.is_self_transfer ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-lg text-xs font-semibold">
                            <AlertTriangle size={12} /> It's your own lead
                          </span>
                        ) : lead.is_own_lead ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-lg text-xs font-semibold">
                            <AlertTriangle size={12} /> It's your own lead
                          </span>
                        ) : lead.can_approve_request ? (
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
                        ) : lead.is_own_request ? (
                          <span className="text-neutral-500 text-xs italic">Your request</span>
                        ) : (
                          <span className="text-neutral-600 text-xs italic">—</span>
                        )}
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

      {/* ── Transfer History / Ownership Modal ── */}
      {historyModal.open && (() => {
        const hl = historyModal.lead || {};
        const hd = historyModal.detail || {};
        const customerName = [hl.first_name, hl.last_name].filter(Boolean).join(' ') || hl.name || 'Unknown Lead';
        const fmtD = (d) => {
          if (!d) return '—';
          try { return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }); } catch { return '—'; }
        };

        // Build the 4-step ownership chain
        const steps = [
          {
            icon: '👤',
            color: 'gray',
            label: 'پُرانی لیڈ کسکی تھی',
            subLabel: 'Original Owner',
            name: hd.original_owner_name || '—',
            date: null,
            dateLabel: null,
            extra: null,
          },
          {
            icon: '📤',
            color: 'blue',
            label: 'کس نے Transfer Request کی',
            subLabel: 'Requested By',
            name: hd.reassignment_requested_by_name || (hl.requestor_name || '').trim() || (hl.reassignment_requested_by_name || '').trim() || '—',
            date: hl.reassignment_requested_at || hd.reassignment_requested_at,
            dateLabel: 'Request Date',
            extra: (hl.reassignment_reason || hd.reassignment_reason) ? `Reason: ${hl.reassignment_reason || hd.reassignment_reason}` : null,
          },
          {
            icon: '✅',
            color: 'green',
            label: 'کس نے Approve کیا',
            subLabel: 'Approved By',
            name: hd.reassignment_approved_by_name || '—',
            date: hl.reassignment_approved_at || hd.reassignment_approved_at,
            dateLabel: 'Approval Date',
            extra: null,
          },
          {
            icon: '🎯',
            color: 'cyan',
            label: 'ابھی کس کے پاس ہے',
            subLabel: 'Current Owner (Assigned To)',
            name: hd.created_by_name || (hl.created_by_name || '').trim() || (hl.target_user_name || '').trim() || '—',
            date: hl.reassignment_approved_at || hd.reassignment_approved_at,
            dateLabel: 'Transfer Date',
            extra: hd.department_name || hl.department_name ? `Dept: ${hd.department_name || hl.department_name}` : null,
          },
        ];

        const colorStyles = {
          gray:  { dot: 'bg-neutral-500',  bg: 'bg-neutral-800/60',  border: 'border-neutral-600/50', label: 'text-neutral-300', name: 'text-white' },
          blue:  { dot: 'bg-blue-500',     bg: 'bg-blue-900/20',     border: 'border-blue-600/40',    label: 'text-blue-300',    name: 'text-white' },
          green: { dot: 'bg-green-500',    bg: 'bg-green-900/20',    border: 'border-green-600/40',   label: 'text-green-300',   name: 'text-white' },
          cyan:  { dot: 'bg-cyan-500',     bg: 'bg-cyan-900/20',     border: 'border-cyan-600/40',    label: 'text-cyan-300',    name: 'text-white' },
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setHistoryModal({ open: false, lead: null, detail: null, loading: false })}>
            <div className="bg-[#111827] rounded-2xl shadow-2xl border border-neutral-700 w-full max-w-md mx-4"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-cyan-700/80 to-blue-700/80 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ArrowRight size={20} className="text-white flex-shrink-0" />
                  <div>
                    <h3 className="text-white font-extrabold text-base">Transfer History</h3>
                    <p className="text-white/70 text-xs mt-0.5">{customerName} — {hl.mobile_number || hl.phone || ''}</p>
                  </div>
                </div>
                <button onClick={() => setHistoryModal({ open: false, lead: null, detail: null, loading: false })}
                  className="text-white/60 hover:text-white text-xl font-bold transition">✕</button>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                {historyModal.loading ? (
                  <div className="flex items-center justify-center py-10 gap-3">
                    <RefreshCw size={20} className="animate-spin text-cyan-400" />
                    <span className="text-neutral-400 text-sm">Loading details…</span>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Vertical connecting line */}
                    <div className="absolute left-4 top-5 bottom-5 w-0.5 bg-neutral-700 z-0" />

                    <div className="space-y-4 relative z-10">
                      {steps.map((step, idx) => {
                        const cs = colorStyles[step.color];
                        return (
                          <div key={idx} className="flex gap-4 items-start">
                            {/* Dot */}
                            <div className={`flex-shrink-0 w-9 h-9 rounded-full ${cs.dot} flex items-center justify-center text-base border-2 border-neutral-900 shadow`}>
                              {step.icon}
                            </div>
                            {/* Content */}
                            <div className={`flex-1 p-3 rounded-xl border ${cs.bg} ${cs.border}`}>
                              <p className={`text-[10px] font-bold uppercase tracking-wider ${cs.label}`}>{step.label}</p>
                              <p className="text-neutral-400 text-[10px] mb-1">{step.subLabel}</p>
                              <p className={`font-bold text-sm ${cs.name}`}>{step.name}</p>
                              {step.date && (
                                <p className="text-neutral-500 text-[11px] mt-1">
                                  {step.dateLabel}: {fmtD(step.date)}
                                </p>
                              )}
                              {step.extra && (
                                <p className="text-neutral-500 text-[11px] italic mt-0.5">{step.extra}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex justify-end">
                <button
                  onClick={() => setHistoryModal({ open: false, lead: null, detail: null, loading: false })}
                  className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-bold rounded-lg border border-neutral-700 transition">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
