import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BellRing, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

/**
 * PopWarningModal — blocking warning acknowledgment popup.
 * Polls /warnings/pending-acknowledgment every 5 seconds.
 * Shows warning ordinal (1st, 2nd, 3rd…) as a red alert.
 * Remarks are mandatory before acknowledgment.
 * If dismissed without acknowledgment, popup re-appears every 1 hour.
 */

const DISMISS_STORAGE_KEY = 'warning_dismiss_times';

const getOrdinalSuffix = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const PopWarningModal = () => {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [remark, setRemark] = useState('');
  const [remarkError, setRemarkError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const dismissCheckRef = useRef(null);

  const getUserId = useCallback(() => {
    try {
      const id = localStorage.getItem('userId') || localStorage.getItem('user_id');
      if (id) return id;
      const raw = localStorage.getItem('user') || localStorage.getItem('userData');
      if (raw) {
        const p = JSON.parse(raw);
        return p._id || p.id || p.user_id || null;
      }
    } catch (_) {}
    return null;
  }, []);

  // Check if a warning was recently dismissed (within the last hour)
  const isDismissedRecently = useCallback((warningId) => {
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (!raw) return false;
      const dismissTimes = JSON.parse(raw);
      const dismissedAt = dismissTimes[warningId];
      if (!dismissedAt) return false;
      const elapsed = Date.now() - dismissedAt;
      return elapsed < 60 * 60 * 1000; // 1 hour
    } catch (_) {
      return false;
    }
  }, []);

  // Record dismiss time for a warning
  const recordDismiss = useCallback((warningId) => {
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      const dismissTimes = raw ? JSON.parse(raw) : {};
      dismissTimes[warningId] = Date.now();
      localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(dismissTimes));
    } catch (_) {}
  }, []);

  // Clean up expired dismiss entries
  const cleanupDismissEntries = useCallback(() => {
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (!raw) return;
      const dismissTimes = JSON.parse(raw);
      const now = Date.now();
      let changed = false;
      for (const key of Object.keys(dismissTimes)) {
        if (now - dismissTimes[key] >= 60 * 60 * 1000) {
          delete dismissTimes[key];
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(dismissTimes));
      }
    } catch (_) {}
  }, []);

  const fetchPending = useCallback(async () => {
    const userId = getUserId();
    if (!userId || !mountedRef.current) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/warnings/pending-acknowledgment?user_id=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Cache-Control': 'no-cache',
          },
        }
      );
      if (!res.ok || !mountedRef.current) return;
      const data = await res.json();
      const list = data.warnings || [];
      if (!mountedRef.current) return;

      // Filter out recently dismissed warnings
      cleanupDismissEntries();
      const visibleList = list.filter(w => !isDismissedRecently(w.id));

      setQueue(list); // Keep full queue for reference
      setCurrent(prev => {
        if (prev) {
          const stillVisible = visibleList.find(w => w.id === prev.id);
          if (stillVisible) return prev;
          return visibleList.length > 0 ? visibleList[0] : null;
        }
        return visibleList.length > 0 ? visibleList[0] : null;
      });
    } catch (_) {}
  }, [getUserId, isDismissedRecently, cleanupDismissEntries]);

  const schedulePoll = useCallback(() => {
    timerRef.current = setTimeout(async () => {
      await fetchPending();
      if (mountedRef.current) schedulePoll();
    }, 5000);
  }, [fetchPending]);

  // Check every minute if any dismissed warning's hour has expired
  useEffect(() => {
    dismissCheckRef.current = setInterval(() => {
      cleanupDismissEntries();
      // Force re-check by re-fetching
      fetchPending();
    }, 60 * 1000); // Check every minute
    return () => clearInterval(dismissCheckRef.current);
  }, [cleanupDismissEntries, fetchPending]);

  useEffect(() => {
    mountedRef.current = true;
    fetchPending();
    schedulePoll();
    const onFocus = () => fetchPending();
    window.addEventListener('focus', onFocus);
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    if (!current) {
      setDismissed(false);
      return;
    }
    setRemark('');
    setRemarkError(false);
    setDismissed(false);
  }, [current]);

  const handleDismiss = () => {
    if (!current) return;
    recordDismiss(current.id);
    setDismissed(true);
    // Move to next visible warning or hide
    const remaining = queue.filter(w => w.id !== current.id && !isDismissedRecently(w.id));
    if (remaining.length > 0) {
      setCurrent(remaining[0]);
      setDismissed(false);
    } else {
      setCurrent(null);
    }
  };

  const handleAcknowledge = async () => {
    if (!current || loading) return;
    // Validate remark is mandatory
    if (!remark.trim()) {
      setRemarkError(true);
      return;
    }
    const userId = getUserId();
    if (!userId) return;
    setLoading(true);
    setRemarkError(false);
    try {
      const res = await fetch(
        `${API_BASE_URL}/warnings/${current.id}/acknowledge?user_id=${userId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ employee_remark: remark.trim() }),
        }
      );
      if (res.ok) {
        // Remove dismiss entry if it exists
        try {
          const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
          if (raw) {
            const dismissTimes = JSON.parse(raw);
            delete dismissTimes[current.id];
            localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(dismissTimes));
          }
        } catch (_) {}

        window.dispatchEvent(new CustomEvent('warning-acknowledged'));
        setDone(true);
        setTimeout(() => {
          if (!mountedRef.current) return;
          setDone(false);
          setLoading(false);
          setRemark('');
          setRemarkError(false);
          setQueue(prev => {
            const remaining = prev.filter(w => w.id !== current.id);
            const visible = remaining.filter(w => !isDismissedRecently(w.id));
            setCurrent(visible.length > 0 ? visible[0] : null);
            return remaining;
          });
        }, 1200);
      } else {
        setLoading(false);
      }
    } catch (_) {
      setLoading(false);
    }
  };

  if (!current) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Kolkata',
      });
    } catch (_) { return dateStr; }
  };

  const queueIdx = queue.findIndex(w => w.id === current.id);
  const warningNumber = current.warning_number || 0;
  const totalWarnings = current.total_warnings || 0;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 sm:p-6"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-red-50 border-b border-red-100 px-6 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-red-900 tracking-tight">Official Warning Notice</h2>
            <p className="text-sm text-red-600 font-medium mt-0.5">Action Required: Please review and acknowledge.</p>
            {/* Warning count alert */}
            {warningNumber > 0 && (
              <div className="mt-2 flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold animate-pulse shadow-md w-fit">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  ⚠️ This is your {getOrdinalSuffix(warningNumber)} warning!
                  {totalWarnings > 1 && ` (${totalWarnings} total warnings issued)`}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {queue.length > 1 && (
              <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-sm">
                {queueIdx + 1} / {queue.length}
              </span>
            )}
            {/* Close/Dismiss button */}
            <button
              onClick={handleDismiss}
              disabled={loading || done}
              className="w-8 h-8 rounded-full bg-white border border-slate-300 hover:border-red-400 hover:bg-red-50 flex items-center justify-center transition-all shadow-sm group"
              title="Dismiss for now (will reappear in 1 hour)"
            >
              <X className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Warning type banner */}
          <div className="bg-red-600 rounded-xl p-4 flex items-center gap-3 shadow-md">
            <div className="bg-white/20 p-2 rounded-full shrink-0">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-white text-base font-black uppercase tracking-wide flex-1">
              {current.warning_type || 'GENERAL WARNING'}
            </h3>
            {queue.length > 1 && (
              <span className="bg-white text-red-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                {queue.length} Pending
              </span>
            )}
          </div>

          {/* Details card */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Issued By</p>
                <p className="font-bold text-slate-800 text-sm truncate">{current.issued_by_name || 'Admin'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Issue Date</p>
                <p className="font-bold text-slate-700 text-sm">{formatDate(current.issued_date)}</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Message from {current.issued_by_name || 'Manager'}:
                </p>
                <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-lg border border-slate-100">
                  {current.warning_message || 'A warning has been issued against you. Please acknowledge to proceed.'}
                </p>
              </div>
              {current.penalty_amount > 0 && (
                <div className="flex items-center justify-between p-4 bg-red-50/60 rounded-lg border border-red-100">
                  <span className="text-sm font-bold text-red-800">Financial Penalty Imposed:</span>
                  <span className="text-xl font-black text-red-600">
                    ₹{Number(current.penalty_amount).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Employee remark textarea - MANDATORY */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-800">
              Your Acknowledgement &amp; Remark{' '}
              <span className="text-red-500 font-bold text-xs">* (Required)</span>
            </label>
            <textarea
              rows={3}
              value={remark}
              onChange={e => {
                setRemark(e.target.value);
                if (e.target.value.trim()) setRemarkError(false);
              }}
              placeholder="I understand the concern. Moving forward, I will ensure..."
              className={`w-full text-sm outline-none p-4 resize-none bg-white border rounded-xl focus:ring-2 transition-all shadow-sm ${
                remarkError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200 bg-red-50/30'
                  : 'border-slate-300 focus:border-red-400 focus:ring-red-100'
              }`}
              disabled={loading || done}
            />
            {remarkError && (
              <p className="text-red-500 text-xs font-semibold flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3" />
                Please enter your remark before submitting. This field is mandatory.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-3">
          <p className="text-[10px] text-slate-400 italic">
            Dismissing will re-show this warning in 1 hour
          </p>
          {done ? (
            <div className="flex items-center gap-2 text-green-700 font-bold text-sm px-4 py-2.5">
              <CheckCircle2 className="w-5 h-5" />
              <span>Acknowledged!</span>
            </div>
          ) : (
            <button
              onClick={handleAcknowledge}
              disabled={loading}
              className="px-6 py-2.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? 'Processing…' : 'Accept & Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PopWarningModal;
