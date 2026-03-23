import React, { useState, useEffect, useRef } from 'react';
import { requestLeadReassignment } from '../../utils/leadApiHelper';
import { AlertCircle, Lock, Clock } from 'lucide-react';

/**
 * Component for requesting a lead reassignment.
 * Shows a live cooldown countdown when a pending/recent request exists.
 */
const RequestReassignmentButton = ({ 
  leadId, 
  assignableUsers = [], 
  onRequestSubmitted = () => {},
  buttonClassName = "",
  pendingReassignment = false,
  reassignmentRequestedAt = null,
  reassignmentStatus = null,
  cooldownHours = 24,
  assignedTo = null,
  assignReportTo = null,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [targetUser, setTargetUser] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  // { h, m, s } when cooldown is active; null when expired or no cooldown
  const [remaining, setRemaining] = useState(null);
  // After successful submission: store the submitted-at timestamp locally so
  // cooldown shows immediately without waiting for parent to refresh leadData
  const [localSubmittedAt, setLocalSubmittedAt] = useState(null);
  const intervalRef = useRef(null);

  const userId = localStorage.getItem('userId');

  // Determine the effective requested-at: prefer local (just submitted) over prop
  const effectiveRequestedAt = localSubmittedAt || reassignmentRequestedAt;
  // After local submit, treat status as 'requested' for cooldown purposes
  const effectiveStatus = localSubmittedAt ? 'requested' : reassignmentStatus;

  useEffect(() => {
    // Countdown shows ONLY while the request is actively pending.
    // Once approved or rejected by manager, cooldown ends → button becomes active.
    // localSubmittedAt covers the immediate post-submit lock before parent refreshes.
    const isActivePending = pendingReassignment || !!localSubmittedAt;
    if (!isActivePending || !effectiveRequestedAt) {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const reqMs = new Date(effectiveRequestedAt).getTime();
      if (isNaN(reqMs)) { setRemaining(null); return; }
      const remainingMs = reqMs + cooldownHours * 3600_000 - Date.now();
      if (remainingMs <= 0) {
        setRemaining(null);
        clearInterval(intervalRef.current);
        return;
      }
      setRemaining({
        h: Math.floor(remainingMs / 3_600_000),
        m: Math.floor((remainingMs % 3_600_000) / 60_000),
        s: Math.floor((remainingMs % 60_000) / 1_000),
      });
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [effectiveRequestedAt, pendingReassignment, localSubmittedAt, cooldownHours]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestLeadReassignment(leadId, userId, targetUser, reason);
      setShowModal(false);
      // Immediately lock the UI — don't wait for parent to refresh
      setLocalSubmittedAt(new Date().toISOString());
      onRequestSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to submit reassignment request');
    } finally {
      setLoading(false);
    }
  };

  // ── Own lead / own TL — cannot transfer to yourself ──
  const isOwnLead = userId && (
    (assignedTo && (assignedTo === userId || (Array.isArray(assignedTo) && assignedTo.includes(userId)))) ||
    (assignReportTo && (assignReportTo === userId || (Array.isArray(assignReportTo) && assignReportTo.includes(userId))))
  );
  if (isOwnLead) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg cursor-not-allowed select-none">
        <Lock size={14} className="text-orange-400 flex-shrink-0" />
        <span className="text-orange-300 text-xs font-semibold">It's your own lead</span>
        <span className="ml-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
          LOCKED
        </span>
      </div>
    );
  }

  // ── Locked / Cooldown state ──
  const isPending = pendingReassignment || !!localSubmittedAt;
  if (remaining !== null) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg cursor-not-allowed select-none">
          <Lock size={14} className="text-yellow-400 flex-shrink-0" />
          <span className="text-yellow-300 text-xs font-semibold">
            {isPending ? 'Already in Pending' : effectiveStatus === 'approved' ? 'Recently Approved' : effectiveStatus === 'rejected' || effectiveStatus === 'auto_rejected' ? 'Recently Rejected' : 'Request Submitted'}
          </span>
          <span className="ml-1 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse flex-shrink-0">
            LOCKED
          </span>
        </div>
        <div className="flex items-center gap-1.5 pl-1">
          <Clock size={11} className="text-yellow-500/60 flex-shrink-0" />
          <span className="text-[11px] text-yellow-600/70">Cooldown expires in:</span>
          <span className="font-mono font-bold text-yellow-400 text-[13px] tabular-nums tracking-tight">
            {String(remaining.h).padStart(2, '0')}:{String(remaining.m).padStart(2, '0')}:{String(remaining.s).padStart(2, '0')}
          </span>
        </div>
      </div>
    );
  }

  // ── Normal state ──
  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        className={buttonClassName || "px-3 py-1.5 bg-amber-500 text-white rounded-md hover:bg-amber-600 text-xs"}
      >
        Request Reassignment
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-900">Request Lead Reassignment</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded flex items-center">
                <AlertCircle size={16} className="mr-2" />
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Target User (Optional)
                </label>
                <select
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 bg-white"
                >
                  <option value="">-- Select User --</option>
                  {assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || `${user.first_name} ${user.last_name}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  If not selected, admin will assign to appropriate user
                </p>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Reason for Reassignment
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 bg-white placeholder-gray-400"
                  placeholder="Explain why this lead needs to be reassigned..."
                ></textarea>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default RequestReassignmentButton;
