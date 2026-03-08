import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

/**
 * PopWarningModal — blocking warning acknowledgment popup.
 * Polls /warnings/pending-acknowledgment every 5 seconds.
 * The modal blocks ALL interaction until the user clicks "I Agree & Acknowledge".
 * Uses recursive setTimeout (no stale-closure issues) + stable callbacks.
 */
const PopWarningModal = () => {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const timerRef = useRef(null);
  const mountedRef = useRef(true);

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
      setQueue(list);
      setCurrent(prev => {
        if (prev) {
          const stillInList = list.find(w => w.id === prev.id);
          if (stillInList) return prev;
          return list.length > 0 ? list[0] : null;
        }
        return list.length > 0 ? list[0] : null;
      });
    } catch (_) {}
  }, [getUserId]);

  const schedulePoll = useCallback(() => {
    timerRef.current = setTimeout(async () => {
      await fetchPending();
      if (mountedRef.current) schedulePoll();
    }, 5000);
  }, [fetchPending]);

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
    if (!current) return;
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [current]);

  const handleAcknowledge = async () => {
    if (!current || loading) return;
    const userId = getUserId();
    if (!userId) return;
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
        setDone(true);
        setTimeout(() => {
          if (!mountedRef.current) return;
          setDone(false);
          setLoading(false);
          setQueue(prev => {
            const remaining = prev.filter(w => w.id !== current.id);
            setCurrent(remaining.length > 0 ? remaining[0] : null);
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

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-red-500/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <AlertTriangle className="w-7 h-7 text-red-400 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            </div>
            <h2 className="text-xl font-black text-red-400 tracking-widest uppercase flex-1">
              Warning Issued
            </h2>
            {queue.length > 1 && (
              <span className="text-xs font-bold text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full shrink-0">
                {queueIdx + 1} / {queue.length}
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex justify-center">
            <span className="bg-red-500/20 border border-red-400/40 text-red-300 font-black text-sm uppercase tracking-widest px-4 py-1.5 rounded-full">
              {current.warning_type || 'GENERAL WARNING'}
            </span>
          </div>

          <div className="bg-black/30 border border-gray-700 rounded-xl p-4">
            <p className="text-gray-200 text-sm leading-relaxed text-center">
              {current.warning_message || 'A warning has been issued against you. Please acknowledge to proceed.'}
            </p>
          </div>

          {current.penalty_amount > 0 && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-gray-400 text-sm">Penalty Amount:</span>
              <span className="text-red-300 font-black text-lg">
                &#8377;{Number(current.penalty_amount).toLocaleString('en-IN')}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/50 rounded-lg p-2">
              <div className="text-gray-400 font-bold mb-0.5 uppercase tracking-wider text-[10px]">Issued By</div>
              <div className="text-gray-200 font-medium text-sm">{current.issued_by_name || 'Admin'}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <div className="text-gray-400 font-bold mb-0.5 uppercase tracking-wider text-[10px]">Date</div>
              <div className="text-gray-200 font-medium text-sm">{formatDate(current.issued_date)}</div>
            </div>
          </div>

          {done ? (
            <div className="flex items-center justify-center gap-2 py-3 text-green-400 font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Acknowledged!</span>
            </div>
          ) : (
            <button
              onClick={handleAcknowledge}
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 uppercase tracking-wide text-sm shadow-lg shadow-red-900/40"
            >
              {loading ? 'Processing\u2026' : 'I Agree & Acknowledge'}
            </button>
          )}

          <p className="text-center text-[10px] text-gray-500 leading-snug">
            You must acknowledge this warning before continuing. This is recorded.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PopWarningModal;
