import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

/**
 * PopWarningModal
 * Blocking modal that shows when the logged-in user has an unacknowledged warning.
 * The user CANNOT dismiss it until they click "I Agree & Acknowledge".
 * Styled similar to PopNotificationModal but with a red warning theme.
 */
const PopWarningModal = ({ user }) => {
  const [warnings, setWarnings] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const pollingRef = useRef(null);

  // ── helpers ────────────────────────────────────────────────────────────
  const getUserId = () => {
    try {
      const id = localStorage.getItem('userId') || localStorage.getItem('user_id');
      if (id) return id;
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed._id || parsed.id || parsed.user_id || null;
      }
    } catch (_) {}
    return null;
  };

  const fetchPending = async () => {
    const userId = getUserId();
    if (!userId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/warnings/pending-acknowledgment?user_id=${userId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const list = data.warnings || [];
      setWarnings(list);
      if (list.length > 0 && !current) {
        setCurrent(list[0]);
        setAcknowledged(false);
      } else if (list.length === 0) {
        setCurrent(null);
      }
    } catch (_) {}
  };

  const handleAcknowledge = async () => {
    if (!current || loading) return;
    const userId = getUserId();
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/warnings/${current.id}/acknowledge?user_id=${userId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (res.ok) {
        setAcknowledged(true);
        setTimeout(() => {
          const remaining = warnings.filter(w => w.id !== current.id);
          setWarnings(remaining);
          if (remaining.length > 0) {
            setCurrent(remaining[0]);
            setAcknowledged(false);
          } else {
            setCurrent(null);
          }
          setLoading(false);
        }, 1200);
      }
    } catch (_) {
      setLoading(false);
    }
  };

  // Block Escape key
  useEffect(() => {
    if (!current) return;
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [current]);

  // Poll every 20 seconds for pending warnings
  useEffect(() => {
    fetchPending();
    pollingRef.current = setInterval(fetchPending, 20000);
    return () => clearInterval(pollingRef.current);
  }, [user]);

  if (!current) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Kolkata'
      });
    } catch (_) { return dateStr; }
  };

  return (
    /* Backdrop — blocks all interactions below */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-red-500/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="relative">
              <AlertTriangle className="w-7 h-7 text-red-400 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            </div>
            <h2 className="text-xl font-black text-red-400 tracking-widest uppercase">
              Warning Issued
            </h2>
            {warnings.length > 1 && (
              <span className="ml-auto text-xs font-bold text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">
                {warnings.indexOf(current) + 1} / {warnings.length}
              </span>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4">
          {/* Warning type badge */}
          <div className="flex justify-center">
            <span className="bg-red-500/20 border border-red-400/40 text-red-300 font-black text-sm uppercase tracking-widest px-4 py-1.5 rounded-full">
              {current.warning_type || 'GENERAL WARNING'}
            </span>
          </div>

          {/* Message */}
          <div className="bg-black/30 border border-gray-700 rounded-xl p-4">
            <p className="text-gray-200 text-sm leading-relaxed text-center">
              {current.warning_message || 'A warning has been issued against you. Please acknowledge to proceed.'}
            </p>
          </div>

          {/* Penalty */}
          {current.penalty_amount > 0 && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-gray-400 text-sm">Penalty Amount:</span>
              <span className="text-red-300 font-black text-lg">₹{current.penalty_amount.toLocaleString('en-IN')}</span>
            </div>
          )}

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            <div className="bg-gray-800/50 rounded-lg p-2">
              <div className="text-gray-400 font-bold mb-0.5 uppercase tracking-wider text-[10px]">Issued By</div>
              <div className="text-gray-200 font-medium">{current.issued_by_name || 'Admin'}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <div className="text-gray-400 font-bold mb-0.5 uppercase tracking-wider text-[10px]">Date</div>
              <div className="text-gray-200 font-medium">{formatDate(current.issued_date)}</div>
            </div>
          </div>

          {/* Acknowledge button / confirmed state */}
          {acknowledged ? (
            <div className="flex items-center justify-center gap-2 py-3 text-green-400 font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Acknowledged!</span>
            </div>
          ) : (
            <button
              onClick={handleAcknowledge}
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 uppercase tracking-wide text-sm"
            >
              {loading ? 'Processing…' : 'I Agree & Acknowledge'}
            </button>
          )}

          {/* Disclaimer */}
          <p className="text-center text-[10px] text-gray-500 leading-snug">
            You must acknowledge this warning before you can continue using the CRM.
            This action is recorded and cannot be undone.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PopWarningModal;
