import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Clock, CheckCircle, XCircle, RefreshCw, X, Phone, ArrowRight, User, Calendar, Building2, AlertCircle } from 'lucide-react';
import { canApproveLeadReassignment } from '../../utils/permissions';
const LeadDetails = lazy(() => import('../LeadDetails'));

const API_BASE_URL = '/api';

const TransferRequestsPage = ({ user }) => {
  const [activeTab, setActiveTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, direct: 0 });
  const [selectedLead, setSelectedLead] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [bankLogins, setBankLogins] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [crmDupLeads, setCrmDupLeads] = useState([]);
  const [decisionRemark, setDecisionRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // 'approve' | 'reject' | null
  const [fullLeadData, setFullLeadData] = useState(null);
  const [fullLeadLoading, setFullLeadLoading] = useState(false);
  const [viewFullLead, setViewFullLead] = useState(null);
  const [viewFullLeadLoading, setViewFullLeadLoading] = useState(false);
  const [cooldownHours, setCooldownHours] = useState(24);
  // Live clock for countdown ticks (every 1s)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  const fmtAmt = (v) => { if (v === null || v === undefined || v === '') return '—'; const n = parseFloat(String(v).replace(/[₹,\s]/g, '')); return isNaN(n) ? String(v) : '₹' + Math.round(n).toLocaleString('en-IN'); };

  const handleRowViewLead = async (lead) => {
    setViewFullLeadLoading(true);
    setViewFullLead(lead);
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${lead._id}?user_id=${userId}`);
      if (res.ok) { const d = await res.json(); setViewFullLead(d); }
    } catch {}
    setViewFullLeadLoading(false);
  };

  const userId = localStorage.getItem('userId');

  // Resolve manager permission once
  const isManager = (() => {
    try {
      const raw = localStorage.getItem('userPermissions');
      return canApproveLeadReassignment(raw ? JSON.parse(raw) : null);
    } catch { return false; }
  })();

  const loadStats = useCallback(async () => {
    if (!userId) return;
    try {
      const [pendingRes, approvedRes, rejectedRes, directRes] = await Promise.all([
        fetch(`${API_BASE_URL}/reassignment/list?user_id=${userId}&page=1&page_size=1&status_filter=pending`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE_URL}/reassignment/list?user_id=${userId}&page=1&page_size=1&status_filter=approved`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE_URL}/reassignment/list?user_id=${userId}&page=1&page_size=1&status_filter=rejected`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE_URL}/reassignment/list?user_id=${userId}&page=1&page_size=1&status_filter=direct`).then(r => r.json()).catch(() => ({})),
      ]);
      setStats({
        pending: pendingRes?.pagination?.total || 0,
        approved: approvedRes?.pagination?.total || 0,
        rejected: rejectedRes?.pagination?.total || 0,
        direct: directRes?.pagination?.total || 0,
      });
    } catch {}
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
    } catch {
      setError('Failed to load transfer requests');
    } finally {
      setLoading(false);
    }
  }, [userId, page, pageSize, activeTab]);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { setPage(1); }, [activeTab]);

  const handleApprove = async () => {
    if (!currentLead || actionLoading) return;
    setActionLoading('approve');
    try {
      const res = await fetch(`${API_BASE_URL}/reassignment/approve/${currentLead._id}?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: decisionRemark.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `HTTP ${res.status}`); }
      setSelectedLead(null);
      setDecisionRemark('');
      loadRequests();
      loadStats();
    } catch (err) {
      setError(`Approve failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!currentLead || actionLoading || !decisionRemark.trim()) return;
    setActionLoading('reject');
    try {
      const res = await fetch(`${API_BASE_URL}/reassignment/reject/${currentLead._id}?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: decisionRemark.trim() }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `HTTP ${res.status}`); }
      setSelectedLead(null);
      setDecisionRemark('');
      loadRequests();
      loadStats();
    } catch (err) {
      setError(`Reject failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const openModal = async (lead) => {
    setSelectedLead(lead);
    setHistory([]);
    setBankLogins([]);
    setCrmDupLeads([]);
    setDecisionRemark('');
    setHistoryLoading(true);
    setBankLoading(false);
    setFullLeadData(null);

    // Fetch full lead data for About / Obligations view
    setFullLeadLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${lead._id}?user_id=${userId}`);
      if (res.ok) { const d = await res.json(); setFullLeadData(d); }
    } catch {}
    setFullLeadLoading(false);

    // Build combined timeline from reassignment_history + lead-level fields
    const combined = [];

    // 1) reassignment_history entries (from activity collection, attached by list API)
    if (lead.reassignment_history && lead.reassignment_history.length > 0) {
      lead.reassignment_history.forEach(entry => {
        const action = (entry.action || '').toLowerCase();
        combined.push({
          assigned_by_name: entry.by_user || '',
          assigned_date: entry.date || '',
          assignment_type: action === 'requested' ? 'reassignment_request'
            : action === 'approved_direct' ? 'direct_transfer'
            : action === 'approved' ? 'approved'
            : action,
          remark: entry.reason || entry.description || '',
          assigned_to_names: entry.to_user ? [entry.to_user] : [],
          _source: 'reassignment',
        });
      });
    }

    // 2) Synthesize rejection entry from lead fields if rejected
    if (lead.reassignment_status === 'rejected' || lead.reassignment_rejection_reason) {
      const hasRejectionEntry = combined.some(e =>
        e.assignment_type === 'rejected' || (e.assignment_type || '').includes('reject')
      );
      if (!hasRejectionEntry) {
        combined.push({
          assigned_by_name: lead.rejected_by_name || '',
          assigned_date: lead.reassignment_rejected_at || '',
          assignment_type: 'rejected',
          remark: lead.reassignment_rejection_reason || '',
          assigned_to_names: [],
          _source: 'synthesized',
        });
      }
    }

    // 3) Synthesize approval entry if approved but no history entry
    if (lead.reassignment_status === 'approved' && lead.reassignment_approved_at) {
      const hasApprovalEntry = combined.some(e =>
        e.assignment_type === 'approved' || (e.assignment_type || '').includes('approv')
      );
      if (!hasApprovalEntry) {
        combined.push({
          assigned_by_name: lead.approved_by_name || '',
          assigned_date: lead.reassignment_approved_at || '',
          assignment_type: 'approved',
          remark: '',
          assigned_to_names: lead.requestor_name ? [lead.requestor_name] : [],
          _source: 'synthesized',
        });
      }
    }

    // 4) Also fetch login-leads assignment_history (supplementary)
    try {
      const res = await fetch(
        `${API_BASE_URL}/lead-login/login-leads/${lead._id}/assignment-history?user_id=${userId}`
      );
      if (res.ok) {
        const data = await res.json();
        (data.history || []).forEach(entry => {
          // Only add if it's not a duplicate of a reassignment entry
          const isDup = combined.some(c =>
            c.assigned_by_name === entry.assigned_by_name &&
            Math.abs(new Date(c.assigned_date) - new Date(entry.assigned_date)) < 60000
          );
          if (!isDup) {
            combined.push({ ...entry, _source: 'assignment' });
          }
        });
      }
    } catch {}

    // Sort: oldest first (ascending) so timeline renders chronologically
    combined.sort((a, b) => new Date(a.assigned_date || 0) - new Date(b.assigned_date || 0));
    setHistory(combined);
    setHistoryLoading(false);

    // Fetch bank logins + CRM duplicate leads for all users
    const phone = (lead.phone || lead.mobile_number || '').trim();
    if (phone) {
      setBankLoading(true);
      const currentId = String(lead._id || lead.id || '');
      try {
        const [loginRes, crmRes] = await Promise.all([
          fetch(`${API_BASE_URL}/lead-login/check-phone/${encodeURIComponent(phone)}?user_id=${userId}`),
          fetch(`${API_BASE_URL}/leads/check-phone/${encodeURIComponent(phone)}?user_id=${userId}`),
        ]);
        if (loginRes.ok) {
          const data = await loginRes.json();
          setBankLogins(data.leads || []);
        }
        if (crmRes.ok) {
          const crmData = await crmRes.json();
          // Filter out the current lead itself
          const others = (crmData.leads || []).filter(l => String(l.id || l._id || '') !== currentId);
          setCrmDupLeads(others);
        }
      } catch {}
      setBankLoading(false);
    }
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
      });
    } catch { return '—'; }
  };

  const fmtDateTime = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
      });
    } catch { return '—'; }
  };

  const daysAgo = (d) => {
    if (!d) return null;
    const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return '1 Day Ago';
    return `${diff} Days Ago`;
  };

  const tabDefs = [
    { key: 'pending',  label: 'Pending',         Icon: Clock,       color: 'yellow' },
    { key: 'approved', label: 'Approved',         Icon: CheckCircle, color: 'green'  },
    { key: 'rejected', label: 'Rejected',         Icon: XCircle,     color: 'red'    },
    { key: 'direct',   label: 'Direct Transfer',  Icon: ArrowRight,  color: 'blue'   },
  ];

  const colorMap = {
    yellow: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', tab: 'text-yellow-400 border-yellow-400' },
    green:  { badge: 'bg-green-500/20 text-green-400 border-green-500/40',   tab: 'text-green-400 border-green-400'  },
    red:    { badge: 'bg-red-500/20 text-red-400 border-red-500/40',         tab: 'text-red-400 border-red-400'      },
    blue:   { badge: 'bg-[#03B0F5]/20 text-[#03B0F5] border-[#03B0F5]/40',  tab: 'text-[#03B0F5] border-[#03B0F5]' },
  };

  const statusBadgeClass = {
    pending:  'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
    approved: 'bg-green-500/20 text-green-400 border border-green-500/40',
    rejected: 'bg-red-500/20 text-red-400 border border-red-500/40',
    direct:   'bg-[#03B0F5]/20 text-[#03B0F5] border border-[#03B0F5]/40',
  };

  const currentLead = selectedLead;
  const customerName = currentLead
    ? ([currentLead.first_name, currentLead.last_name].filter(Boolean).join(' ') ||
       currentLead.name || currentLead.customer_name || 'Lead')
    : '';

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Page Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white">Transfer Requests</h1>
        <p className="text-neutral-400 text-sm mt-1">Track the status of your lead transfer requests.</p>
      </div>

      {/* Card */}
      <div className="mx-6 mb-6 bg-[#0c1424] rounded-xl border border-neutral-800 overflow-hidden">
        {/* Tab strip */}
        <div className="flex border-b border-neutral-800 bg-[#0c1424]">
          {tabDefs.map(t => {
            const c = colorMap[t.color];
            const cnt = stats[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all ${
                  activeTab === t.key
                    ? `${c.tab} bg-neutral-800/40`
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
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
          <button
            onClick={() => { loadRequests(); loadStats(); }}
            disabled={loading}
            className="ml-auto mr-3 my-2 flex items-center gap-1 px-2.5 py-1.5 text-neutral-500 hover:text-neutral-300 text-xs transition rounded-lg hover:bg-neutral-800"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Error bar */}
        {error && (
          <div className="px-4 py-2 bg-red-900/30 border-b border-red-800/40 text-red-400 text-sm">{error}</div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white border-b-2 border-[#03B0F5]">
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[#03B0F5] w-12">#</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[#03B0F5]">Lead Date & Age</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[#03B0F5]">Created By</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[#03B0F5]">Team Name</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[#03B0F5]">Customer Name</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[#03B0F5]">Lead Status</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[#03B0F5]">Requested By</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-[#03B0F5]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-neutral-500">
                    <RefreshCw size={20} className="inline animate-spin mr-2" />
                    Loading...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-neutral-500">
                    No {activeTab} requests
                  </td>
                </tr>
              ) : (
                requests.map((lead, idx) => {
                  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') ||
                    lead.name || lead.customer_name || 'Unknown';
                  const requestedBy = (lead.requestor_name || lead.reassignment_requested_by_name || '—').trim();
                  const createdBy = (lead.created_by_name || '—').trim();
                  const teamName = (lead.department_name || lead.team_name || '—').trim();
                  const leadStatus = lead.status || lead.lead_status || '';
                  const subStatus = lead.sub_status || '';
                  const age = daysAgo(lead.reassignment_requested_at);
                  const dateStr = fmtDate(lead.reassignment_requested_at);
                  return (
                    <tr
                      key={lead._id}
                      onClick={() => handleRowViewLead(lead)}
                      className="border-b border-neutral-800 hover:bg-neutral-800/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-neutral-400 font-bold text-xs">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white text-xs font-semibold">{dateStr}</div>
                        {age && <div className="text-neutral-500 text-[11px] mt-0.5">{age}</div>}
                        {activeTab === 'pending' && lead.reassignment_requested_at && (() => {
                          const expiresAt = new Date(lead.reassignment_requested_at).getTime() + cooldownHours * 3_600_000;
                          const remMs = expiresAt - now;
                          if (remMs <= 0) return <div className="text-orange-500/70 text-[10px] mt-0.5 font-mono">Cooldown expired</div>;
                          const h = Math.floor(remMs / 3_600_000);
                          const m = Math.floor((remMs % 3_600_000) / 60_000);
                          const s = Math.floor((remMs % 60_000) / 1_000);
                          return (
                            <div className="flex items-center gap-1 text-yellow-500/80 text-[11px] mt-1 font-mono">
                              <Clock size={10} className="flex-shrink-0" />
                              {h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`} left
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-neutral-300 text-xs">{createdBy}</td>
                      <td className="px-4 py-3 text-neutral-300 text-xs">{teamName}</td>
                      <td className="px-4 py-3">
                        <div className="text-white text-xs font-semibold">{name}</div>
                      </td>
                      <td className="px-4 py-3">
                        {lead.file_sent_to_login ? (
                          <div>
                            <span className="inline-block px-2 py-0.5 bg-green-600 text-white rounded text-[11px] font-bold">LOGIN</span>
                            {subStatus && <div className="text-neutral-500 text-[10px] mt-0.5">{subStatus}</div>}
                          </div>
                        ) : leadStatus ? (
                          <div>
                            <span className="inline-block px-2 py-0.5 bg-neutral-700 text-neutral-200 rounded text-[11px] font-medium">{leadStatus}</span>
                            {subStatus && <div className="text-neutral-500 text-[10px] mt-0.5">{subStatus}</div>}
                          </div>
                        ) : <span className="text-neutral-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-neutral-300 text-xs">{requestedBy}</div>
                        {lead.reassignment_requested_at && (
                          <div className="text-neutral-500 text-[10px] mt-0.5">{fmtDateTime(lead.reassignment_requested_at)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {lead.can_approve_request && activeTab === 'pending' ? (
                          <button
                            onClick={() => openModal(lead)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all duration-150 shadow-sm hover:shadow whitespace-nowrap"
                          >
                            Review
                          </button>
                        ) : (
                          <button
                            onClick={() => openModal(lead)}
                            className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-xs font-bold rounded-lg transition-all duration-150 whitespace-nowrap"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800">
            <span className="text-neutral-500 text-xs">{totalItems} total</span>
            <div className="flex gap-2 items-center">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs font-bold text-neutral-400 hover:text-white disabled:opacity-40 bg-neutral-800 rounded hover:bg-neutral-700 transition"
              >Prev</button>
              <span className="px-2 text-xs text-neutral-400">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs font-bold text-neutral-400 hover:text-white disabled:opacity-40 bg-neutral-800 rounded hover:bg-neutral-700 transition"
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {currentLead && (
        <div
          className="fixed inset-0 z-[900] flex items-center justify-center p-4 sm:p-6"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200"
            style={{ width: '1100px', maxWidth: '100%', maxHeight: 'calc(100vh - 3rem)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Modal Header ── */}
            <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 font-black text-base shrink-0">
                  {customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-base font-black text-gray-900 tracking-tight">{customerName.toUpperCase()}</h2>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                      activeTab === 'pending'  ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                      activeTab === 'approved' ? 'bg-green-50 text-green-600 border-green-200' :
                      activeTab === 'rejected' ? 'bg-red-50 text-red-600 border-red-200' :
                                                 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}>{activeTab.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    {(currentLead.phone || currentLead.mobile_number) && (
                      <span className="flex items-center gap-1"><Phone size={11} />{currentLead.phone || currentLead.mobile_number}</span>
                    )}
                    <span className="text-gray-200">|</span>
                    <span>Assigned: <strong className="text-gray-700">{currentLead.assigned_user_name || currentLead.created_by_name || '—'}</strong></span>
                    {currentLead.reassignment_requested_at && (
                      <>
                        <span className="text-gray-200">|</span>
                        <span>{daysAgo(currentLead.reassignment_requested_at)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Modal Body ── */}
            <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

              {/* ── LEFT: Bank Logins Sidebar ── */}
              <div className="w-64 shrink-0 border-r border-gray-200 overflow-y-auto bg-gray-50">
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                      <Building2 size={12} className="text-gray-400" /> BANK LOGINS
                    </span>
                    {bankLogins.length > 0 && (
                      <span className="text-[10px] font-bold bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-gray-500">
                        {bankLogins.length}
                      </span>
                    )}
                  </div>

                  {bankLoading ? (
                    <div className="flex items-center gap-2 text-gray-400 text-xs py-4">
                      <RefreshCw size={12} className="animate-spin" /> Loading…
                    </div>
                  ) : bankLogins.length === 0 && crmDupLeads.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl bg-white">
                      <Building2 size={20} className="mx-auto mb-1.5 text-gray-300" />
                      <p className="text-xs font-semibold text-gray-400">No logins found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Bank login leads */}
                      {bankLogins.map((bl, i) => {
                        const st = (bl.status || '').toUpperCase();
                        const isActive = st.includes('ACTIVE') || st.includes('APPROV') || st.includes('FINAL');
                        const isLost = st.includes('LOST') || st.includes('REJECT') || st.includes('CANCEL') || st.includes('BANK REJECTED');
                        const dotColor = isActive ? '#10b981' : isLost ? '#ef4444' : '#3b82f6';
                        const dateStr = (() => {
                          const d = bl.login_date || bl.login_created_at || bl.created_at;
                          if (!d) return '';
                          try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }); }
                          catch { return ''; }
                        })();
                        const blId = bl.original_lead_id || bl.id || bl._id || bl.lead_id;
                        return (
                          <div
                            key={i}
                            className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 shadow-sm"
                            style={{ borderLeft: `3px solid ${dotColor}`, cursor: blId ? 'pointer' : 'default' }}
                            onClick={() => blId && handleRowViewLead({ _id: blId })}
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-xs font-black text-gray-900 truncate">{bl.bank_name || bl.processing_bank || 'Bank'}</span>
                              {dateStr && <span className="text-[10px] text-gray-400 shrink-0">{dateStr}</span>}
                            </div>
                            <span
                              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                              style={{
                                background: isActive ? '#d1fae5' : isLost ? '#fee2e2' : '#dbeafe',
                                color: isActive ? '#065f46' : isLost ? '#991b1b' : '#1e40af',
                              }}
                            >{bl.status || '—'}</span>
                            {bl.sub_status && <p className="text-[10px] text-gray-500 mt-0.5">{bl.sub_status}</p>}
                          </div>
                        );
                      })}

                      {/* CRM dup leads below bank logins */}
                      {crmDupLeads.length > 0 && (
                        <>
                          {bankLogins.length > 0 && (
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest pt-1">CRM Leads</p>
                          )}
                          {crmDupLeads.map((dl, i) => {
                            const st = (dl.status || '').toUpperCase();
                            const isActive = st.includes('ACTIVE') || st.includes('APPROV') || st.includes('COMPLET');
                            const isLost = st.includes('LOST') || st.includes('REJECT') || st.includes('CANCEL');
                            const dotColor = isActive ? '#10b981' : isLost ? '#ef4444' : '#3b82f6';
                            const dlId = dl._id || dl.id;
                            return (
                              <div
                                key={i}
                                className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 shadow-sm"
                                style={{ borderLeft: `3px solid ${dotColor}`, cursor: dlId ? 'pointer' : 'default' }}
                                onClick={() => dlId && handleRowViewLead({ ...dl, _id: dlId })}
                              >
                                <span className="text-xs font-black text-gray-800 uppercase">{dl.status || '—'}</span>
                                {dl.sub_status && <p className="text-[10px] text-gray-500 mt-0.5">{dl.sub_status}</p>}
                                {dl.department_name && <p className="text-[10px] text-gray-400 mt-0.5">{dl.department_name}</p>}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT: Timeline ── */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white">

                {/* ── STICKY STATS HEADER ── */}
                <div className="shrink-0 px-5 py-2.5 border-b border-gray-200 bg-white z-10 flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest shrink-0">
                    TRANSFER HISTORY
                  </h3>
                  {!historyLoading && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(() => {
                        const totalHist = history.filter(h => (h.assignment_type || '').toLowerCase().includes('request')).length;
                        const approvedCount = history.filter(h => (h.assignment_type || '').toLowerCase().includes('approv')).length;
                        const rejectedCount = history.filter(h => (h.assignment_type || '').toLowerCase().includes('reject')).length;
                        const pendingCount = activeTab === 'pending' ? 1 : 0;
                        return (
                          <>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600">
                              <span className="font-black text-gray-900">{totalHist || history.length}</span> Total
                            </span>
                            {approvedCount > 0 && (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded border border-green-200 bg-green-50 text-green-700">
                                <span className="font-black">{approvedCount}</span> Approved
                              </span>
                            )}
                            {rejectedCount > 0 && (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-700">
                                <span className="font-black">{rejectedCount}</span> Rejected
                              </span>
                            )}
                            {pendingCount > 0 && (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded border border-yellow-200 bg-yellow-50 text-yellow-700">
                                <span className="font-black">{pendingCount}</span> Pending
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* ── SCROLLABLE TIMELINE ── */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-12 text-gray-400">
                      <RefreshCw size={16} className="animate-spin mr-2" /> Loading history…
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {(() => {
                        // Build grouped items: each "requested" entry + its paired decision
                        // history is already sorted ascending (oldest first) from openModal
                        const requested = history
                          .filter(h => (h.assignment_type || '').toLowerCase().includes('request'));

                        const decisions = history.filter(h => {
                          const t = (h.assignment_type || '').toLowerCase();
                          return t === 'approved' || t === 'rejected' || t === 'direct_transfer' || t.includes('approv') || t.includes('reject');
                        });

                        // Match each request to its closest subsequent decision
                        const usedDecisions = new Set();
                        const groups = requested.map(req => {
                          const reqTime = new Date(req.assigned_date || 0).getTime();
                          let best = null, bestDiff = Infinity;
                          decisions.forEach((d, i) => {
                            if (usedDecisions.has(i)) return;
                            const dTime = new Date(d.assigned_date || 0).getTime();
                            const diff = dTime - reqTime;
                            if (diff >= -60000 && diff < bestDiff) { bestDiff = diff; best = i; }
                          });
                          if (best !== null) usedDecisions.add(best);
                          return { req, decision: best !== null ? decisions[best] : null };
                        });

                        // Include any unmatched decisions as standalone
                        const unmatchedDecisions = decisions.filter((_, i) => !usedDecisions.has(i));

                        // Add current pending request at the END if pending tab
                        const items = [...groups];
                        const hasPendingCard = activeTab === 'pending' && currentLead?.can_approve_request;
                        const showOwnPendingCard = activeTab === 'pending' && currentLead?.is_own_request && !currentLead?.can_approve_request;

                        // Render
                        const renderCard = (req, decision, stepNum, isPendingDecision = false) => {
                          // Support both combined-array field names AND synthetic req field names
                          const reqName = req.assigned_by_name || req.by_user || currentLead.requestor_name || '—';
                          const toUser = (req.assigned_to_names && req.assigned_to_names[0]) || req.to_user || '';
                          const reason = req.remark || req.reason || req.description || '';
                          const reqDate = (req.assigned_date || req.date) ? new Date(req.assigned_date || req.date).toLocaleString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
                          }) : fmtDateTime(currentLead.reassignment_requested_at);

                          const decisionType = (decision?.assignment_type || decision?.action || '').toLowerCase();
                          const isApproved = decision && (decisionType.includes('approv'));
                          const isRejected = decision && (decisionType.includes('reject'));
                          const decisionBy = decision?.assigned_by_name || decision?.by_user || '';
                          const decisionNote = decision?.remark || decision?.reason || decision?.description || '';
                          const decisionDate = decision?.assigned_date || decision?.date || '';
                          const isAutoRej = isRejected && (!decisionBy || (decisionNote || '').toLowerCase().includes('auto'));

                          // Lead/login status pills from current lead
                          const leadSt = currentLead.lead_status || currentLead.status || '';
                          const subSt = currentLead.sub_status || '';
                          const hasLogin = currentLead.file_sent_to_login;

                          // Card border color
                          const cardBorderColor = isApproved ? '#bbf7d0' : isRejected ? '#fecaca' : isPendingDecision ? '#93c5fd' : '#e5e7eb';

                          return (
                            <div className="flex gap-3 pb-3" key={`card-${stepNum}`}>
                              {/* Step circle + vertical line */}
                              <div className="flex flex-col items-center shrink-0 pt-2">
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                                  style={{
                                    background: isApproved ? '#10b981' : isRejected ? '#ef4444' : isPendingDecision ? '#f59e0b' : '#3b82f6',
                                    boxShadow: isApproved ? '0 0 0 3px #d1fae5' : isRejected ? '0 0 0 3px #fee2e2' : isPendingDecision ? '0 0 0 3px #fef3c7' : '0 0 0 3px #dbeafe',
                                  }}
                                >
                                  {stepNum}
                                </div>
                                {!isPendingDecision && (
                                  <div className="w-px bg-gray-200 flex-1 mt-1.5" />
                                )}
                              </div>

                              {/* Card */}
                              <div
                                className="flex-1 rounded-xl border bg-white overflow-hidden shadow-sm mb-1"
                                style={{ borderColor: cardBorderColor, borderWidth: isPendingDecision ? '2px' : '1px' }}
                              >
                                {/* Agent row */}
                                <div className="px-4 pt-3 pb-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 border border-gray-200 flex items-center justify-center text-sm font-black shrink-0 mt-0.5">
                                        {reqName.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-sm font-black text-gray-900">{reqName}</span>
                                          <span className="text-xs text-gray-400">requested transfer</span>
                                          {toUser && (
                                            <>
                                              <span className="text-xs text-gray-400">→</span>
                                              <span className="text-sm font-bold text-blue-600">{toUser}</span>
                                            </>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                                          <Calendar size={10} /> {reqDate}
                                        </div>
                                      </div>
                                    </div>
                                    {/* Status badge — show only if decision exists or pending */}
                                    {(isApproved || isRejected) ? (
                                      <span
                                        className="text-[10px] font-black px-2.5 py-0.5 rounded border shrink-0 capitalize"
                                        style={isApproved
                                          ? { background: '#d1fae5', color: '#065f46', borderColor: '#a7f3d0' }
                                          : { background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}
                                      >
                                        {isApproved ? 'Approved' : 'Rejected'}
                                      </span>
                                    ) : isPendingDecision ? (
                                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded border shrink-0 bg-yellow-50 text-yellow-700 border-yellow-200">
                                        Pending
                                      </span>
                                    ) : null}
                                  </div>

                                  {/* Reason blockquote */}
                                  {reason && (
                                    <div className="mt-2.5 pl-3 border-l-2 border-gray-200 ml-1">
                                      <p className="text-xs text-gray-600 italic leading-relaxed">"{reason}"</p>
                                    </div>
                                  )}

                                  {/* Lead / Login status pills */}
                                  {(leadSt || hasLogin) && (
                                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                                      {leadSt && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700">
                                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
                                          Lead: {leadSt}{subSt ? ` / ${subSt}` : ''}
                                        </span>
                                      )}
                                      {hasLogin && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700">
                                          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
                                          Login: ACTIVE LOGIN
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* ── Approver/Rejecter decision section ── */}
                                {decision && (
                                  <div
                                    className="border-t px-4 py-3"
                                    style={isApproved
                                      ? { background: '#f0fdf4', borderColor: '#bbf7d0' }
                                      : { background: '#fff5f5', borderColor: '#fecaca' }}
                                  >
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <div
                                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 bg-white shrink-0"
                                          style={isApproved
                                            ? { color: '#15803d', borderColor: '#86efac' }
                                            : { color: '#b91c1c', borderColor: '#fca5a5' }}
                                        >
                                          {isAutoRej ? <Clock size={12} /> : (decisionBy || 'M').charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm font-black text-gray-900">{isAutoRej ? 'System' : (decisionBy || 'Manager')}</span>
                                        {!isAutoRej && (
                                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ background: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>APPROVER</span>
                                        )}
                                        <span className="text-[11px] font-bold" style={{ color: isApproved ? '#15803d' : '#b91c1c' }}>
                                          {isApproved ? '✓ approved' : '✕ rejected'}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                        <Calendar size={10} />
                                        {decisionDate ? new Date(decisionDate).toLocaleString('en-GB', {
                                          day: '2-digit', month: 'short', year: 'numeric',
                                          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
                                        }) : '—'}
                                      </span>
                                    </div>
                                    {/* Decision remark */}
                                    {decisionNote && (
                                      <p className="text-xs leading-relaxed font-medium mt-2" style={{ color: isApproved ? '#15803d' : '#b91c1c' }}>
                                        {decisionNote}
                                      </p>
                                    )}
                                    {/* FROM → TO bar for approved */}
                                    {isApproved && reqName && toUser && (
                                      <div className="mt-2.5 flex items-center rounded overflow-hidden border border-green-200 text-xs font-black">
                                        <div className="flex items-center gap-2 px-3 py-1.5 flex-1 min-w-0" style={{ background: '#fff1f2' }}>
                                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: '#fecdd3', color: '#be123c' }}>
                                            {reqName.charAt(0).toUpperCase()}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="text-[9px] font-black text-red-400 uppercase tracking-wider">FROM</div>
                                            <div className="text-red-800 font-black truncate text-xs">{reqName}</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center px-2 py-1.5 shrink-0 self-stretch" style={{ background: '#10b981' }}>
                                          <span className="text-white font-black text-sm">→</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1.5 flex-1 min-w-0" style={{ background: '#f0fdf4' }}>
                                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: '#bbf7d0', color: '#15803d' }}>
                                            {toUser.charAt(0).toUpperCase()}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="text-[9px] font-black text-green-500 uppercase tracking-wider">TO</div>
                                            <div className="text-green-800 font-black truncate text-xs">{toUser}</div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* ── Your Decision (manager, pending tab, last card) ── */}
                                {isPendingDecision && currentLead?.can_approve_request && (
                                  <div className="border-t border-yellow-200 px-4 py-3 bg-yellow-50">
                                    <p className="text-[10px] font-black text-yellow-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                      <Clock size={11} /> Your Decision
                                    </p>
                                    <textarea
                                      value={decisionRemark}
                                      onChange={e => setDecisionRemark(e.target.value)}
                                      placeholder="Write your decision remark here (Required)…"
                                      className="w-full bg-white border border-yellow-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 text-gray-900 rounded-lg p-2.5 resize-none outline-none text-xs placeholder-gray-400 transition min-h-[56px]"
                                      autoFocus
                                    />
                                    {!decisionRemark.trim() && (
                                      <p className="text-yellow-600 text-[10px] mt-1 flex items-center gap-1">
                                        <AlertCircle size={10} /> Remark is required to proceed
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* ── Read-only status for non-approver pending ── */}
                                {isPendingDecision && showOwnPendingCard && (
                                  <div className="border-t border-yellow-200 px-4 py-3 bg-yellow-50">
                                    <p className="text-xs font-bold text-yellow-700 flex items-center gap-1.5">
                                      <Clock size={12} className="text-yellow-500" /> Your request is awaiting approval
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        };

                        const allRendered = [];

                        // Past groups (oldest first = index 0 = oldest)
                        items.forEach((group, i) => {
                          allRendered.push(renderCard(group.req, group.decision, i + 1, false));
                        });

                        // Unmatched standalone decisions
                        unmatchedDecisions.forEach((d, i) => {
                          const name = d.assigned_by_name || d.by_user || 'Manager';
                          const dType = (d.assignment_type || d.action || '').toLowerCase();
                          const isApproved = dType.includes('approv');
                          const isRejected = dType.includes('reject');
                          const dRemark = d.remark || d.reason || d.description || '';
                          const dDate = d.assigned_date || d.date || '';
                          allRendered.push(
                            <div className="flex gap-3 pb-3" key={`d-${i}`}>
                              <div className="flex flex-col items-center shrink-0 pt-2">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                                  style={{ background: isApproved ? '#10b981' : isRejected ? '#ef4444' : '#6b7280', boxShadow: isApproved ? '0 0 0 3px #d1fae5' : isRejected ? '0 0 0 3px #fee2e2' : '0 0 0 3px #f3f4f6' }}>
                                  {items.length + i + 1}
                                </div>
                              </div>
                              <div className="flex-1 rounded-xl border bg-white overflow-hidden shadow-sm mb-1"
                                style={{ borderColor: isApproved ? '#bbf7d0' : isRejected ? '#fecaca' : '#e5e7eb' }}>
                                <div className="px-4 py-3 flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 border border-gray-200 flex items-center justify-center text-sm font-black shrink-0">
                                      {name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-sm font-black text-gray-900">{name}</span>
                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ background: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>APPROVER</span>
                                        <span className="text-[11px] font-bold" style={{ color: isApproved ? '#15803d' : '#b91c1c' }}>{isApproved ? '✓ approved' : '✕ rejected'}</span>
                                      </div>
                                      {dDate && <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><Calendar size={10} />{fmtDateTime(dDate)}</div>}
                                    </div>
                                  </div>
                                </div>
                                {dRemark && (
                                  <div className="px-4 pb-3 border-t pt-2" style={{ borderColor: isApproved ? '#bbf7d0' : '#fecaca', background: isApproved ? '#f0fdf4' : '#fff5f5' }}>
                                    <p className="text-xs font-medium leading-relaxed" style={{ color: isApproved ? '#15803d' : '#b91c1c' }}>{dRemark}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });

                        // Add current pending/own request card at the BOTTOM
                        if (hasPendingCard || showOwnPendingCard) {
                          // Build a synthetic req entry using combined-array field names
                          const syntheticReq = {
                            assigned_by_name: currentLead.requestor_name || currentLead.reassignment_requested_by_name || '—',
                            assigned_to_names: currentLead.target_user_name ? [currentLead.target_user_name] : [],
                            remark: currentLead.reassignment_reason || '',
                            assigned_date: currentLead.reassignment_requested_at || '',
                            assignment_type: 'reassignment_request',
                          };
                          allRendered.push(renderCard(syntheticReq, null, items.length + unmatchedDecisions.length + 1, true));
                        }

                        if (allRendered.length === 0) {
                          return <p className="text-sm text-gray-400 italic py-4">No transfer history available.</p>;
                        }

                        return allRendered;
                      })()}
                    </div>
                  )}
                </div>

                {/* ── FOOTER ACTIONS ── */}
                {currentLead?.can_approve_request && activeTab === 'pending' && (
                  <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 shrink-0 flex items-center justify-end gap-3">
                    <button
                      onClick={handleReject}
                      disabled={!decisionRemark.trim() || !!actionLoading}
                      className="flex items-center gap-2 px-5 py-2.5 border-2 border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 hover:border-red-300 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm bg-white"
                    >
                      {actionLoading === 'reject' ? <RefreshCw size={14} className="animate-spin" /> : <XCircle size={14} />}
                      Reject Transfer
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={!decisionRemark.trim() || !!actionLoading}
                      className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-sm"
                    >
                      {actionLoading === 'approve' ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      Approve Transfer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen LeadDetails view when a row is clicked */}
      {viewFullLead && (
        <div className="fixed inset-0 z-[9999] bg-black overflow-auto">
          {viewFullLeadLoading ? (
            <div className="flex items-center justify-center h-screen flex-col gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
              <p className="text-cyan-300">Loading lead details…</p>
            </div>
          ) : (
            <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div></div>}>
              <LeadDetails
                lead={viewFullLead}
                user={null}
                readOnly={true}
                allowedTabs={['details', 'obligations']}
                onBack={() => { setViewFullLead(null); setViewFullLeadLoading(false); }}
              />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
};

export default TransferRequestsPage;
