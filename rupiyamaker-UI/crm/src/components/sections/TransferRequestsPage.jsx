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

    // Sort: non-request entries by date desc first, then request entries by date desc at the bottom
    combined.sort((a, b) => {
      const aIsRequest = (a.assignment_type || '').toLowerCase().includes('request');
      const bIsRequest = (b.assignment_type || '').toLowerCase().includes('request');
      if (aIsRequest && !bIsRequest) return 1;  // requests go to bottom
      if (!aIsRequest && bIsRequest) return -1;
      return new Date(b.assigned_date || 0) - new Date(a.assigned_date || 0);
    });
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

      {/* Detail Modal — white themed, 2-col for managers */}
      {currentLead && (
        <div
          className="fixed inset-0 z-[900] flex items-center justify-center p-4"
          onClick={() => setSelectedLead(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Modal Header ── */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-lg shrink-0">
                  {customerName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-black text-gray-900 uppercase tracking-wide">{customerName}</h2>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                      activeTab === 'pending'  ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                      activeTab === 'approved' ? 'bg-green-50 text-green-600 border-green-200' :
                      activeTab === 'rejected' ? 'bg-red-50 text-red-600 border-red-200' :
                                                 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}>{activeTab}</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase bg-gray-100 text-gray-500 border border-gray-200">
                      REQUEST
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap text-sm text-gray-500">
                    {(currentLead.phone || currentLead.mobile_number) && (
                      <span className="flex items-center gap-1"><Phone size={12} />{currentLead.phone || currentLead.mobile_number}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      Assigned to <strong className="text-gray-700 ml-1">{currentLead.assigned_user_name || currentLead.created_by_name || '—'}</strong>
                    </span>
                    {currentLead.reassignment_requested_at && (
                      <span className="text-gray-400">{daysAgo(currentLead.reassignment_requested_at)}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Modal Body ── */}
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row min-h-0">

              {/* Left: Related Leads (duplicate CRM leads + bank logins) — visible to all */}
              {(() => {
                const dupLeads = crmDupLeads;
                return (
                  <div className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-gray-100 p-4 bg-gray-50/50 overflow-y-auto">
                    <h3 className="flex items-center gap-1.5 text-xs font-black text-gray-500 uppercase tracking-wider mb-3">
                      <User size={13} /> RELATED LEADS
                    </h3>

                    {/* Duplicate CRM leads */}
                    {dupLeads.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">CRM Leads</p>
                        <div className="space-y-2">
                          {dupLeads.map((dl, i) => {
                            const dlId = dl._id || dl.id;
                            const dlDate = dl.created_at || dl.created_date || dl.login_department_sent_date || '';
                            const dlDateStr = dlDate ? (() => { try { return new Date(dlDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }); } catch { return ''; } })() : '';
                            const st = (dl.status || '').toLowerCase();
                            const dotColor = st.includes('approv') || st.includes('active') || st.includes('disburse') || st.includes('complet')
                              ? 'bg-green-500'
                              : st.includes('lost') || st.includes('reject') || st.includes('cancel')
                              ? 'bg-red-500'
                              : 'bg-blue-500';
                            return (
                              <div
                                key={i}
                                onClick={() => dlId && handleRowViewLead({ ...dl, _id: dlId })}
                                className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm transition ${dlId ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/30' : ''}`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                                    <p className="text-sm font-bold text-gray-900 truncate">{dl.status || '—'}</p>
                                  </div>
                                  {dlDateStr && <span className="text-[11px] text-gray-400 shrink-0">{dlDateStr}</span>}
                                </div>
                                <p className="text-xs font-black text-gray-800 uppercase tracking-wide ml-4">{dl.sub_status || ''}</p>
                                {dl.department_name && <p className="text-[11px] text-gray-500 ml-4 mt-0.5">{dl.department_name}</p>}
                                {(dl.loan_type_name || dl.loan_type) && <p className="text-[10px] text-gray-400 ml-4 mt-0.5">{dl.loan_type_name || dl.loan_type}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bank login leads */}
                    {bankLoading ? (
                      <div className="flex items-center gap-2 text-gray-400 text-xs py-4">
                        <RefreshCw size={13} className="animate-spin" /> Loading...
                      </div>
                    ) : bankLogins.length === 0 && dupLeads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-8 px-4 text-center">
                        <p className="text-sm font-semibold text-gray-500">No Related Leads</p>
                        <p className="text-xs text-gray-400 mt-0.5">No duplicates or logins found.</p>
                      </div>
                    ) : bankLogins.length > 0 ? (
                      <div>
                        {dupLeads.length > 0 && <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Bank Logins</p>}
                        <div className="space-y-2">
                          {bankLogins.map((bl, i) => {
                            const st = (bl.status || '').toLowerCase();
                            const dotColor = st.includes('approv') || st.includes('active') || st.includes('final')
                              ? 'bg-green-500'
                              : st.includes('lost') || st.includes('reject') || st.includes('cancel')
                              ? 'bg-red-500'
                              : 'bg-blue-500';
                            const dateStr = bl.login_date || bl.login_created_at
                              ? (() => { try { return new Date(bl.login_date || bl.login_created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }); } catch { return ''; } })()
                              : '';
                            const blId = bl.original_lead_id || bl.id || bl._id || bl.lead_id || bl.login_lead_id;
                            return (
                              <div
                                key={i}
                                onClick={() => blId && handleRowViewLead({ _id: blId })}
                                className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm transition ${blId ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/30' : ''}`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                                    <p className="text-sm font-bold text-gray-900 truncate">{bl.bank_name || bl.processing_bank || 'Unknown Bank'}</p>
                                  </div>
                                  {dateStr && <span className="text-[11px] text-gray-400 shrink-0">{dateStr}</span>}
                                </div>
                                <p className="text-xs font-black text-gray-800 uppercase tracking-wide ml-4">{bl.status || '—'}</p>
                                {bl.sub_status && <p className="text-[11px] text-gray-500 ml-4 mt-0.5">{bl.sub_status}</p>}
                                {bl.loan_type && <p className="text-[10px] text-gray-400 ml-4 mt-0.5">{bl.loan_type}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {/* Right: Reassignment + History */}
              <div className="flex-1 p-5 min-w-0 space-y-5">

                {/* Section 4: Reassignment Info */}
                {(currentLead?.reassignment_reason || currentLead?.reassignment_rejection_reason) && (
                  <div>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">Reassignment</h3>
                    {currentLead.reassignment_reason && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-2">
                        <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1 font-black">Agent Reason</p>
                        <p className="text-xs text-gray-700 leading-relaxed">"{currentLead.reassignment_reason}"</p>
                        {currentLead.requestor_name && <p className="text-[11px] text-gray-400 mt-1.5">By: <strong className="text-gray-600">{currentLead.requestor_name}</strong></p>}
                      </div>
                    )}
                    {currentLead.reassignment_rejection_reason && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-[11px] text-red-400 uppercase tracking-wider mb-1 font-black flex items-center gap-1"><XCircle size={10} /> Rejection Reason</p>
                        <p className="text-xs text-red-700 leading-relaxed">"{currentLead.reassignment_rejection_reason}"</p>
                        {currentLead.rejected_by_name && <p className="text-[11px] text-red-400 mt-1.5">By: <strong className="text-red-600">{currentLead.rejected_by_name}</strong></p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Section 5: Transfer History */}
                <div>
                  <div className="flex items-center justify-between mb-3 pb-1 border-b border-gray-100 gap-2 flex-wrap">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider">Transfer History</h3>
                    {!historyLoading && history.length > 0 && (() => {
                      const approvedCount = history.filter(h => { const t = (h.assignment_type || '').toLowerCase(); return t === 'approved' || t === 'direct_transfer' || (t.includes('approv') && !t.includes('request')); }).length;
                      const rejectedCount = history.filter(h => (h.assignment_type || '').toLowerCase().includes('reject')).length;
                      return (
                        <div className="flex gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">{history.length} Total</span>
                          {approvedCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">{approvedCount} Approved</span>}
                          {rejectedCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">{rejectedCount} Rejected</span>}
                        </div>
                      );
                    })()}
                  </div>

                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8 text-gray-400">
                      <RefreshCw size={16} className="animate-spin mr-2" />
                      Loading history...
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-2">No transfer history available.</p>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        // Group history: pair each request with its approval/rejection
                        const requestEntries = history.filter(e => (e.assignment_type || '').toLowerCase().includes('request'));
                        const responseEntries = history.filter(e => {
                          const t = (e.assignment_type || '').toLowerCase();
                          return t.includes('reject') || t === 'approved' || (t.includes('approv') && !t.includes('request'));
                        });
                        const otherEntries = history.filter(e => {
                          const t = (e.assignment_type || '').toLowerCase();
                          return !t.includes('request') && !t.includes('reject') && t !== 'approved' && !(t.includes('approv') && !t.includes('request'));
                        });

                        // Match responses to requests by closest date
                        const usedResponses = new Set();
                        const groups = requestEntries.map(req => {
                          const reqDate = new Date(req.assigned_date || 0).getTime();
                          let bestMatch = null;
                          let bestDiff = Infinity;
                          responseEntries.forEach((resp, ri) => {
                            if (usedResponses.has(ri)) return;
                            const respDate = new Date(resp.assigned_date || 0).getTime();
                            const diff = respDate - reqDate;
                            if (diff >= 0 && diff < bestDiff) { bestDiff = diff; bestMatch = ri; }
                          });
                          if (bestMatch !== null) {
                            usedResponses.add(bestMatch);
                            return { request: req, response: responseEntries[bestMatch] };
                          }
                          return { request: req, response: null };
                        });

                        // Unmatched responses + other entries as standalone
                        const unmatchedResponses = responseEntries.filter((_, i) => !usedResponses.has(i));
                        const standalone = [...unmatchedResponses, ...otherEntries].sort((a, b) =>
                          new Date(b.assigned_date || 0) - new Date(a.assigned_date || 0)
                        );

                        const allGroups = [
                          ...groups.sort((a, b) => new Date(b.request.assigned_date || 0) - new Date(a.request.assigned_date || 0)),
                          ...standalone.map(e => ({ request: null, response: null, standalone: e })),
                        ];

                        const renderEntry = (entry, forceType) => {
                          const dateStr = entry.assigned_date
                            ? new Date(entry.assigned_date).toLocaleString('en-IN', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
                              })
                            : '—';
                          const typeLC = (entry.assignment_type || '').toLowerCase();
                          const isRejected = typeLC.includes('reject');
                          const isRequested = typeLC.includes('request');
                          const isApproved = typeLC === 'approved' || typeLC === 'direct_transfer' || (typeLC.includes('approv') && !isRequested);
                          const isDirectTransfer = typeLC === 'direct_transfer';

                          const personName = entry.assigned_by_name || (isRejected ? (currentLead.rejected_by_name || 'Manager') : isApproved ? (currentLead.approved_by_name || 'Manager') : '—');
                          const actionText = isRequested ? 'requested a transfer'
                            : isRejected ? 'rejected the transfer request'
                            : isApproved && isDirectTransfer ? 'directly transferred lead'
                            : isApproved ? 'approved the transfer request'
                            : entry.assignment_type?.replace(/_/g, ' ') || 'transferred';

                          const badgeClass = isRejected ? 'bg-red-50 text-red-500 border-red-200' : isApproved ? 'bg-green-50 text-green-600 border-green-200' : isRequested ? 'bg-blue-50 text-blue-500 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200';
                          const badgeText = isRejected ? 'REJECTED' : isApproved ? (isDirectTransfer ? 'DIRECT' : 'APPROVED') : isRequested ? 'REQUEST' : (entry.assignment_type || '').toUpperCase().replace(/_/g, ' ');

                          return (
                            <div className={`p-3 ${forceType === 'response' ? 'bg-gray-50/80 border-t border-gray-100' : ''}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isRejected ? 'bg-red-100 text-red-600' : isApproved ? 'bg-green-100 text-green-600' : isRequested ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                                    {personName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-sm font-bold text-gray-800">{personName}</span>
                                    <span className="text-sm text-gray-400 ml-1.5">{actionText}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="flex items-center gap-1 text-[11px] text-gray-400 whitespace-nowrap"><Calendar size={10} />{dateStr}</span>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${badgeClass}`}>{badgeText}</span>
                                </div>
                              </div>
                              {isRequested && entry.remark && (
                                <div className="mt-3 border-t border-gray-100 pt-3">
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><User size={9} /> AGENT REASON</p>
                                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">"{entry.remark}"</p>
                                </div>
                              )}
                              {isRequested && (currentLead.lead_status || currentLead.sub_status) && (
                                <div className="mt-2.5">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    Lead: {currentLead.lead_status}{currentLead.sub_status ? ` / ${currentLead.sub_status}` : ''}
                                  </span>
                                </div>
                              )}
                              {isRejected && entry.remark && (
                                <div className="mt-3 border-t border-red-100 pt-3">
                                  <p className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><XCircle size={9} /> MANAGER REJECTION REASON</p>
                                  <p className="text-sm text-red-700 leading-relaxed bg-red-50 border border-red-100 rounded-lg px-3 py-2">"{entry.remark}"</p>
                                </div>
                              )}
                              {isApproved && !isRequested && entry.remark && (
                                <div className="mt-3 border-t border-green-100 pt-3">
                                  <p className="text-[10px] font-black text-green-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><CheckCircle size={9} /> MANAGER REMARK</p>
                                  <p className="text-sm text-green-700 leading-relaxed bg-green-50 border border-green-100 rounded-lg px-3 py-2">"{entry.remark}"</p>
                                </div>
                              )}
                              {(entry.assigned_to_names || []).length > 0 && (
                                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                                  <ArrowRight size={11} className="text-gray-400" />
                                  <span className="text-[10px] text-gray-400 font-semibold uppercase">Transferred to:</span>
                                  {entry.assigned_to_names.map((n, ni) => (
                                    <span key={ni} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-semibold">{n}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        };

                        return allGroups.map((group, gi) => {
                          if (group.standalone) {
                            const entry = group.standalone;
                            const typeLC = (entry.assignment_type || '').toLowerCase();
                            const isRejected = typeLC.includes('reject');
                            const isApproved = typeLC === 'approved' || typeLC === 'direct_transfer' || (typeLC.includes('approv'));
                            return (
                              <div key={`s-${gi}`} className={`bg-white border rounded-lg shadow-sm overflow-hidden ${isRejected ? 'border-red-200' : isApproved ? 'border-green-200' : 'border-gray-200'}`}>
                                {renderEntry(entry)}
                              </div>
                            );
                          }

                          const hasResponse = !!group.response;
                          const respType = hasResponse ? (group.response.assignment_type || '').toLowerCase() : '';
                          const isRejResp = respType.includes('reject');
                          const borderClass = isRejResp ? 'border-red-200' : hasResponse ? 'border-green-200' : 'border-orange-200';

                          return (
                            <div key={`g-${gi}`} className={`bg-white border rounded-lg shadow-sm overflow-hidden ${borderClass}`}>
                              {renderEntry(group.request)}
                              {hasResponse && renderEntry(group.response, 'response')}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>

                {/* AWAITING YOUR DECISION — only for pending + approver (not own request) */}
                {currentLead?.can_approve_request && activeTab === 'pending' && (
                  <div className="border-2 border-yellow-300 bg-yellow-50/60 rounded-xl p-4">
                    <p className="text-sm font-bold text-yellow-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Clock size={14} className="text-yellow-500" />
                      AWAITING YOUR DECISION
                    </p>
                    <textarea
                      value={decisionRemark}
                      onChange={e => setDecisionRemark(e.target.value)}
                      placeholder="Write your decision remark here (Required)..."
                      className="w-full px-4 py-3 border-2 border-yellow-300 bg-yellow-50 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-yellow-400 resize-none transition-colors"
                      rows={3}
                    />
                  </div>
                )}

                {/* Read-only status banner for own requests */}
                {currentLead?.is_own_request && !currentLead?.can_approve_request && (
                  <div className={`rounded-xl p-4 border-2 ${
                    activeTab === 'pending' ? 'border-yellow-300 bg-yellow-50/60' :
                    activeTab === 'approved' ? 'border-green-300 bg-green-50/60' :
                    activeTab === 'rejected' ? 'border-red-300 bg-red-50/60' :
                    'border-blue-300 bg-blue-50/60'
                  }`}>
                    <p className={`text-sm font-bold uppercase tracking-wide flex items-center gap-2 ${
                      activeTab === 'pending' ? 'text-yellow-700' :
                      activeTab === 'approved' ? 'text-green-700' :
                      activeTab === 'rejected' ? 'text-red-700' :
                      'text-blue-700'
                    }`}>
                      {activeTab === 'pending' && <><Clock size={14} className="text-yellow-500" /> Your request is pending approval</>}
                      {activeTab === 'approved' && <><CheckCircle size={14} className="text-green-500" /> Your request has been approved</>}
                      {activeTab === 'rejected' && <><XCircle size={14} className="text-red-500" /> Your request has been rejected</>}
                      {activeTab === 'direct' && <><ArrowRight size={14} className="text-blue-500" /> Direct transfer completed</>}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Modal Footer — Approve / Reject (approvers + pending only, not own request) ── */}
            {currentLead?.can_approve_request && activeTab === 'pending' && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !decisionRemark.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 border-2 border-red-300 text-red-500 font-bold rounded-xl hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                >
                  {actionLoading === 'reject' ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <XCircle size={14} />
                  )}
                  Reject Transfer
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading || !decisionRemark.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 border-2 border-green-300 text-green-600 font-bold rounded-xl hover:bg-green-50 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                >
                  {actionLoading === 'approve' ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle size={14} />
                  )}
                  Approve Transfer
                </button>
              </div>
            )}
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
