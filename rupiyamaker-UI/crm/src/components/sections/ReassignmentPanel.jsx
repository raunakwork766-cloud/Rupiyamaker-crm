import React, { useState, useEffect, useCallback } from 'react';
import { fetchPendingReassignmentLeads, approveLeadReassignment } from '../../utils/leadApiHelper';
import { canApproveLeadReassignment } from '../../utils/permissions';
import { Check, X, ChevronLeft, ChevronRight, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, User, Phone, FileText } from 'lucide-react';

const API_BASE_URL = '/api';

const ReassignmentPanel = ({ userPermissions, onLeadAction }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [activeTab, setActiveTab] = useState('pending');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  
  // Action modal state
  const [actionModal, setActionModal] = useState({ open: false, type: null, lead: null });
  const [actionRemark, setActionRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const userId = localStorage.getItem('userId');
  const canApprove = canApproveLeadReassignment(userPermissions);

  // Fetch stats for all statuses
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

  // Fetch requests based on active tab
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

  // Open approve/reject modal
  const openActionModal = (type, lead) => {
    setActionModal({ open: true, type, lead });
    setActionRemark('');
  };

  // Handle approve
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

  // Handle reject - calls actual backend API
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
      });
    } catch { return '—'; }
  };

  if (!canApprove) return null;

  const tabs = [
    { key: 'pending', label: 'Pending', count: stats.pending, icon: Clock, color: 'yellow' },
    { key: 'approved', label: 'Approved', count: stats.approved, icon: CheckCircle, color: 'green' },
    { key: 'rejected', label: 'Rejected', count: stats.rejected, icon: XCircle, color: 'red' }
  ];

  return (
    <div className="mt-4 bg-neutral-900 rounded-xl shadow-lg overflow-hidden border border-neutral-700">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Lead Reassignment Dashboard</h3>
          <p className="text-cyan-100 text-xs mt-1">Manage reassignment requests from your team</p>
        </div>
        <button onClick={() => { loadRequests(); loadStats(); }} disabled={loading}
          className="p-2 hover:bg-white/20 rounded-full transition">
          <RefreshCw size={18} className={`text-white ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 p-4">
        {tabs.map(t => (
          <div key={t.key} className={`bg-neutral-800 rounded-xl p-4 border ${
            t.key === 'pending' ? 'border-yellow-500/30' : 
            t.key === 'approved' ? 'border-green-500/30' : 'border-red-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-400 text-xs font-medium uppercase">{t.label}</p>
                <p className={`text-2xl font-bold mt-1 ${
                  t.key === 'pending' ? 'text-yellow-400' : 
                  t.key === 'approved' ? 'text-green-400' : 'text-red-400'
                }`}>{t.count}</p>
              </div>
              <t.icon size={28} className={
                t.key === 'pending' ? 'text-yellow-500/50' : 
                t.key === 'approved' ? 'text-green-500/50' : 'text-red-500/50'
              } />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-700 px-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === t.key 
                ? `border-cyan-400 text-cyan-400` 
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === t.key ? 'bg-cyan-400/20 text-cyan-300' : 'bg-neutral-700 text-neutral-400'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-900/30 text-red-300 border border-red-700 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center">
          <RefreshCw size={32} className="animate-spin text-cyan-400 mx-auto mb-3" />
          <p className="text-neutral-400">Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center">
          <FileText size={40} className="text-neutral-600 mx-auto mb-3" />
          <p className="text-neutral-400 font-medium">No {activeTab} requests found</p>
        </div>
      ) : (
        <>
          {/* Request Cards */}
          <div className="p-4 space-y-3">
            {requests.map((lead) => (
              <div key={lead._id} className="bg-neutral-800 rounded-xl border border-neutral-700 hover:border-neutral-500 transition-all overflow-hidden">
                {/* Card Header */}
                <div className="px-5 py-3 flex items-center justify-between bg-neutral-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-sm">
                      {(lead.name || lead.customer_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-sm">
                        {lead.name || lead.customer_name || 'Unnamed Lead'}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Phone size={11} className="text-neutral-500" />
                        <span className="text-neutral-400 text-xs">{lead.mobile_number || lead.phone || '—'}</span>
                        <span className="text-neutral-600">|</span>
                        <span className="text-neutral-500 text-xs">ID: {lead._id?.slice(-8)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {lead.file_sent_to_login && (
                      <span className="px-2 py-1 bg-green-900/40 text-green-400 text-xs rounded-md font-medium">Login Sent</span>
                    )}
                    <span className={`px-2 py-1 text-xs rounded-md font-medium ${
                      lead.reassignment_status === 'pending' ? 'bg-yellow-900/40 text-yellow-400' :
                      lead.reassignment_status === 'approved' ? 'bg-green-900/40 text-green-400' :
                      lead.reassignment_status === 'rejected' ? 'bg-red-900/40 text-red-400' : 'bg-neutral-700 text-neutral-400'
                    }`}>
                      {(lead.reassignment_status || 'unknown').toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-5 py-3 border-t border-neutral-700/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-neutral-500 text-xs mb-1">Requested By</p>
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-cyan-500" />
                        <p className="text-white text-sm font-medium">{lead.requestor_name || lead.reassignment_requested_by_name || 'Unknown'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-neutral-500 text-xs mb-1">Current Owner</p>
                      <p className="text-neutral-200 text-sm">{lead.assigned_user_name || lead.created_by_name || 'Unassigned'}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500 text-xs mb-1">Status / Sub-Status</p>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-neutral-700 text-neutral-200 text-xs rounded">{lead.status || '—'}</span>
                        {lead.sub_status && <span className="px-2 py-0.5 bg-blue-900/40 text-blue-300 text-xs rounded">{lead.sub_status}</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-neutral-500 text-xs mb-1">Request Date</p>
                      <p className="text-neutral-300 text-xs">{formatDate(lead.reassignment_requested_at || lead.updated_at)}</p>
                    </div>
                  </div>

                  {/* Data Code & Campaign changes */}
                  {(lead.reassignment_new_data_code || lead.reassignment_new_campaign_name) && (
                    <div className="mt-3 flex gap-4">
                      {lead.reassignment_new_data_code && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-neutral-500">Data Code:</span>
                          <span className="text-neutral-400 line-through">{lead.data_code || '—'}</span>
                          <span className="text-cyan-400">→</span>
                          <span className="text-green-400 font-medium">{lead.reassignment_new_data_code}</span>
                        </div>
                      )}
                      {lead.reassignment_new_campaign_name && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-neutral-500">Campaign:</span>
                          <span className="text-neutral-400 line-through">{lead.campaign_name || '—'}</span>
                          <span className="text-cyan-400">→</span>
                          <span className="text-green-400 font-medium">{lead.reassignment_new_campaign_name}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reason */}
                  <div className="mt-3 p-3 bg-neutral-900/50 rounded-lg border border-neutral-700/50">
                    <p className="text-neutral-500 text-xs mb-1">Reason for Reassignment</p>
                    <p className="text-neutral-200 text-sm">{lead.reassignment_reason || 'No reason provided'}</p>
                  </div>

                  {/* Approval/Rejection info for non-pending */}
                  {lead.reassignment_status === 'approved' && lead.reassignment_approved_by_name && (
                    <div className="mt-2 p-2 bg-green-900/20 border border-green-800/30 rounded-lg">
                      <p className="text-green-400 text-xs">Approved by {lead.reassignment_approved_by_name} on {formatDate(lead.reassignment_approved_at)}</p>
                    </div>
                  )}
                  {lead.reassignment_status === 'rejected' && (
                    <div className="mt-2 p-2 bg-red-900/20 border border-red-800/30 rounded-lg">
                      <p className="text-red-400 text-xs">
                        Rejected{lead.reassignment_rejected_by_name ? ` by ${lead.reassignment_rejected_by_name}` : ''} 
                        {lead.reassignment_rejected_at ? ` on ${formatDate(lead.reassignment_rejected_at)}` : ''}
                      </p>
                      {lead.reassignment_rejection_reason && (
                        <p className="text-red-300 text-xs mt-1">Reason: {lead.reassignment_rejection_reason}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions - only for pending */}
                {activeTab === 'pending' && (
                  <div className="px-5 py-3 border-t border-neutral-700/50 flex gap-2 justify-end">
                    <button onClick={() => openActionModal('approve', lead)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition">
                      <Check size={15} /> Approve
                    </button>
                    <button onClick={() => openActionModal('reject', lead)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition">
                      <X size={15} /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 flex items-center justify-between border-t border-neutral-700">
            <span className="text-neutral-400 text-sm">
              Showing {requests.length} of {totalItems} requests
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}
                className={`px-3 py-1.5 text-sm rounded-md border ${page === 1 ? 'border-neutral-700 text-neutral-600 cursor-not-allowed' : 'border-neutral-600 text-neutral-300 hover:bg-neutral-800'}`}>
                <ChevronLeft size={14} className="inline mr-1" />Prev
              </button>
              <span className="text-neutral-400 text-sm px-2">Page {page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}
                className={`px-3 py-1.5 text-sm rounded-md border ${page >= totalPages ? 'border-neutral-700 text-neutral-600 cursor-not-allowed' : 'border-neutral-600 text-neutral-300 hover:bg-neutral-800'}`}>
                Next<ChevronRight size={14} className="inline ml-1" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Action Modal (Approve/Reject) */}
      {actionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !actionLoading && setActionModal({ open: false, type: null, lead: null })}>
          <div className="bg-neutral-800 rounded-2xl shadow-2xl border border-neutral-600 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={`px-6 py-4 rounded-t-2xl ${actionModal.type === 'approve' ? 'bg-green-600' : 'bg-red-600'}`}>
              <h3 className="text-white font-bold text-lg">
                {actionModal.type === 'approve' ? 'Approve Reassignment' : 'Reject Reassignment'}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                {actionModal.lead?.name || 'Unknown Lead'} — requested by {actionModal.lead?.requestor_name || actionModal.lead?.reassignment_requested_by_name || 'Unknown'}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <label className="block text-neutral-300 text-sm font-semibold mb-2">
                {actionModal.type === 'approve' ? 'Approval Remark' : 'Rejection Reason'} <span className="text-red-400">*</span>
              </label>
              <textarea
                value={actionRemark}
                onChange={e => setActionRemark(e.target.value)}
                placeholder={actionModal.type === 'approve' 
                  ? 'Enter your approval remark...' 
                  : 'Enter reason for rejection...'}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-600 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400 resize-none"
                rows={3}
                autoFocus
              />
              {!actionRemark.trim() && (
                <p className="text-yellow-400 text-xs mt-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> Remark is required
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 pb-5 flex gap-3 justify-end">
              <button onClick={() => setActionModal({ open: false, type: null, lead: null })}
                disabled={actionLoading}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-sm font-medium rounded-lg transition">
                Cancel
              </button>
              <button 
                onClick={actionModal.type === 'approve' ? handleApprove : handleReject}
                disabled={!actionRemark.trim() || actionLoading}
                className={`px-5 py-2 text-white text-sm font-bold rounded-lg transition flex items-center gap-2 ${
                  !actionRemark.trim() || actionLoading 
                    ? 'bg-neutral-600 cursor-not-allowed opacity-50' 
                    : actionModal.type === 'approve' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                }`}>
                {actionLoading && <RefreshCw size={14} className="animate-spin" />}
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
