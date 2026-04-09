import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { ClipboardList, Ticket, CheckCircle2, X, AlertTriangle, Clock, User, Calendar } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

// Lazy-load EditTask and EditTicket so they only load when needed
const EditTaskLazy = lazy(() => import('./EditTask'));
const EditTicketLazy = lazy(() => import('./EditTicket'));

/**
 * PopTaskTicketModal — blocking task/ticket acknowledgment popup.
 * Polls /tasks/pending-acknowledgment & /tickets/pending-acknowledgment every 10 seconds.
 * Remarks are mandatory before acknowledgment.
 * If dismissed (cross) without acknowledgment, popup re-appears after 24 hours.
 */

const DISMISS_STORAGE_KEY = 'task_ticket_dismiss_times';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

const priorityColors = {
  High: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-600' },
  Medium: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-500' },
  Low: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', badge: 'bg-green-600' },
};

const PopTaskTicketModal = () => {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [remark, setRemark] = useState('');
  const [remarkError, setRemarkError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const dismissCheckRef = useRef(null);
  // Ref to cancel an in-flight full-task/ticket fetch if current changes
  const editLoadRef = useRef(null);

  // Full task data for EditTask modal (only set when current is a task)
  const [editTaskData, setEditTaskData] = useState(null);
  // Full ticket data for EditTicket modal (only set when current is a ticket)
  const [editTicketData, setEditTicketData] = useState(null);

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

  // Check if an item was recently dismissed (within last 24 hours)
  const isDismissedRecently = useCallback((itemId) => {
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (!raw) return false;
      const dismissTimes = JSON.parse(raw);
      const dismissedAt = dismissTimes[itemId];
      if (!dismissedAt) return false;
      return (Date.now() - dismissedAt) < TWENTY_FOUR_HOURS;
    } catch (_) {
      return false;
    }
  }, []);

  // Record dismiss time
  const recordDismiss = useCallback((itemId) => {
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      const dismissTimes = raw ? JSON.parse(raw) : {};
      dismissTimes[itemId] = Date.now();
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
        if (now - dismissTimes[key] >= TWENTY_FOUR_HOURS) {
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
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache',
      };

      const [tasksRes, ticketsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/tasks/pending-acknowledgment?user_id=${encodeURIComponent(userId)}`, { headers }).catch(() => null),
        fetch(`${API_BASE_URL}/tickets/pending-acknowledgment?user_id=${encodeURIComponent(userId)}`, { headers }).catch(() => null),
      ]);

      if (!mountedRef.current) return;

      let allItems = [];

      if (tasksRes && tasksRes.ok) {
        const data = await tasksRes.json();
        if (data.items) allItems = allItems.concat(data.items);
      }
      if (ticketsRes && ticketsRes.ok) {
        const data = await ticketsRes.json();
        if (data.items) allItems = allItems.concat(data.items);
      }

      // Sort by created_at ascending (oldest first)
      allItems.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      if (!mountedRef.current) return;

      cleanupDismissEntries();
      const visibleList = allItems.filter(item => !isDismissedRecently(item.id));

      setQueue(allItems);
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
    }, 3000); // Poll every 3 seconds for near-immediate notification (same as announcements)
  }, [fetchPending]);

  // Check every 5 minutes if any dismissed item's 24h has expired
  useEffect(() => {
    dismissCheckRef.current = setInterval(() => {
      cleanupDismissEntries();
      fetchPending();
    }, 5 * 60 * 1000);
    return () => clearInterval(dismissCheckRef.current);
  }, [cleanupDismissEntries, fetchPending]);

  // ── EditTask integration ──────────────────────────────────────────────────
  // When a task comes into `current`, fetch its full data and show EditTask.
  useEffect(() => {
    editLoadRef.current = null;
    if (!current || current.type !== 'task') {
      setEditTaskData(null);
      return;
    }

    // Show immediately with the partial data we already have
    setEditTaskData({
      id: current.id,
      subject: current.subject || '',
      message: current.details || '',
      task_details: current.details || '',
      typeTask: current.task_type || 'To-Do',
      status: current.status || 'Pending',
      priority: current.priority || 'Medium',
      date: current.due_date || '',
      due_date: current.due_date || '',
      created_at: current.created_at,
      createdBy: current.created_by_name || 'Admin',
      creator_name: current.created_by_name || 'Admin',
      assign: 'Loading…',
      assigned_to: [],
      attachments: [],
      comments: [],
      history: [],
      notes: '',
      lead_id: null,
      loan_type: null,
      isLoading: true,
    });

    // Fetch full task data in background and update EditTask
    const taskId = current.id;
    editLoadRef.current = taskId;
    const userId = getUserId();
    if (!userId) return;

    fetch(
      `${API_BASE_URL}/tasks/${taskId}?user_id=${encodeURIComponent(userId)}&include_attachments=true`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache',
        },
      }
    )
      .then(res => {
        if (!res.ok) {
          if (editLoadRef.current === taskId && mountedRef.current) {
            setEditTaskData(prev => (prev ? { ...prev, isLoading: false } : null));
          }
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!data || editLoadRef.current !== taskId || !mountedRef.current) return;
        setEditTaskData({ ...data, isLoading: false });
      })
      .catch(() => {
        if (editLoadRef.current === taskId && mountedRef.current) {
          setEditTaskData(prev => (prev ? { ...prev, isLoading: false } : null));
        }
      });
  }, [current, getUserId]);

  // ── EditTicket integration ────────────────────────────────────────────────
  // When a ticket comes into `current`, fetch its full data and show EditTicket.
  useEffect(() => {
    if (!current || current.type !== 'ticket') {
      setEditTicketData(null);
      return;
    }

    // Show immediately with partial data
    setEditTicketData({
      _id: current.id,
      id: current.id,
      subject: current.subject || '',
      description: current.details || '',
      status: current.status || 'open',
      priority: current.priority || 'Medium',
      created_at: current.created_at,
      created_by_name: current.created_by_name || 'Admin',
      assigned_users: [],
      assigned_users_details: [],
      attachments: [],
      comments: [],
      isLoading: true,
    });

    // Fetch full ticket data in background and update EditTicket
    const ticketId = current.id;
    editLoadRef.current = ticketId;
    const userId = getUserId();
    if (!userId) return;

    fetch(
      `${API_BASE_URL}/tickets/${ticketId}?user_id=${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache',
        },
      }
    )
      .then(res => {
        if (!res.ok) {
          if (editLoadRef.current === ticketId && mountedRef.current) {
            setEditTicketData(prev => (prev ? { ...prev, isLoading: false } : null));
          }
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!data || editLoadRef.current !== ticketId || !mountedRef.current) return;
        setEditTicketData({ ...data, isLoading: false });
      })
      .catch(() => {
        if (editLoadRef.current === ticketId && mountedRef.current) {
          setEditTicketData(prev => (prev ? { ...prev, isLoading: false } : null));
        }
      });
  }, [current, getUserId]);

  // Silently acknowledge a task and advance the queue
  const acknowledgeAndAdvance = useCallback(
    async (taskId) => {
      const userId = getUserId();
      if (userId && taskId) {
        try {
          await fetch(
            `${API_BASE_URL}/tasks/${taskId}/acknowledge?user_id=${encodeURIComponent(userId)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
              body: JSON.stringify({ employee_remark: '' }),
            }
          );
        } catch (_) {}
        // Remove any dismiss entry so the task doesn't re-show
        try {
          const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
          if (raw) {
            const dt = JSON.parse(raw);
            delete dt[taskId];
            localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(dt));
          }
        } catch (_) {}
      }
      setEditTaskData(null);
      editLoadRef.current = null;
      window.dispatchEvent(new CustomEvent('task-ticket-acknowledged', { detail: { type: 'task', id: taskId } }));
      setQueue(prev => {
        const remaining = prev.filter(w => w.id !== taskId);
        const visible = remaining.filter(w => !isDismissedRecently(w.id));
        setCurrent(visible.length > 0 ? visible[0] : null);
        return remaining;
      });
    },
    [getUserId, isDismissedRecently]
  );

  // Called when EditTask is closed (X button)
  const handleEditTaskClose = useCallback(() => {
    if (!current) return;
    acknowledgeAndAdvance(current.id);
  }, [current, acknowledgeAndAdvance]);

  // Called when EditTask auto-saves or explicitly saves — make the API call and return updated task
  const handleEditTaskSave = useCallback(
    async (updatePayload) => {
      const taskId = updatePayload._id || updatePayload.id || current?.id;
      const userId = getUserId();
      if (!taskId || !userId) return null;

      const body = {
        subject: updatePayload.subject || updatePayload.title,
        task_details: updatePayload.message || updatePayload.description,
        priority: updatePayload.priority || 'Medium',
        status: updatePayload.status,
        assigned_to: updatePayload.assigned_to || updatePayload.assigned_users || [],
        due_date: updatePayload.date || updatePayload.due_date || null,
        due_time: updatePayload.time || null,
        is_urgent: updatePayload.is_urgent || false,
        notes: updatePayload.notes || '',
        task_type: updatePayload.typeTask || updatePayload.task_type || 'To-Do',
        user_id: userId,
      };

      try {
        const res = await fetch(
          `${API_BASE_URL}/tasks/${taskId}?user_id=${encodeURIComponent(userId)}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(body),
          }
        );
        if (res.ok) {
          const updated = await res.json();
          // If keepModalOpen flag, stay in EditTask; otherwise acknowledge and close
          if (!updatePayload.keepModalOpen) {
            acknowledgeAndAdvance(taskId);
          }
          return updated;
        }
      } catch (_) {}
      return null;
    },
    [current, getUserId, acknowledgeAndAdvance]
  );

  // Silently acknowledge a ticket and advance the queue
  const acknowledgeAndAdvanceTicket = useCallback(
    async (ticketId) => {
      const userId = getUserId();
      if (userId && ticketId) {
        try {
          await fetch(
            `${API_BASE_URL}/tickets/${ticketId}/acknowledge?user_id=${encodeURIComponent(userId)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
              body: JSON.stringify({ employee_remark: '' }),
            }
          );
        } catch (_) {}
        try {
          const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
          if (raw) {
            const dt = JSON.parse(raw);
            delete dt[ticketId];
            localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(dt));
          }
        } catch (_) {}
      }
      setEditTicketData(null);
      editLoadRef.current = null;
      window.dispatchEvent(new CustomEvent('task-ticket-acknowledged', { detail: { type: 'ticket', id: ticketId } }));
      setQueue(prev => {
        const remaining = prev.filter(w => w.id !== ticketId);
        const visible = remaining.filter(w => !isDismissedRecently(w.id));
        setCurrent(visible.length > 0 ? visible[0] : null);
        return remaining;
      });
    },
    [getUserId, isDismissedRecently]
  );

  // Called when EditTicket is closed (X button)
  const handleEditTicketClose = useCallback(() => {
    if (!current) return;
    acknowledgeAndAdvanceTicket(current.id);
  }, [current, acknowledgeAndAdvanceTicket]);

  // Called when EditTicket saves
  const handleEditTicketSave = useCallback(async () => {
    if (!current) return null;
    acknowledgeAndAdvanceTicket(current.id);
    return null;
  }, [current, acknowledgeAndAdvanceTicket]);
  // When admin creates a task, Task.jsx writes globalTaskTrigger to localStorage.
  // This allows same-browser tabs to react in <1 second (cross-device still uses polling).
  useEffect(() => {
    const checkTaskTrigger = () => {
      try {
        const raw = localStorage.getItem('globalTaskTrigger');
        if (!raw) return;
        const data = JSON.parse(raw);
        const age = Date.now() - (data.timestamp || 0);
        localStorage.removeItem('globalTaskTrigger');
        if (age < 30000) {
          // Backend needs ~500ms to save — wait then poll immediately
          setTimeout(() => { if (mountedRef.current) fetchPending(); }, 600);
        }
      } catch (_) {
        localStorage.removeItem('globalTaskTrigger');
      }
    };
    checkTaskTrigger();
    const triggerInterval = setInterval(checkTaskTrigger, 1000);
    return () => clearInterval(triggerInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initial poll + event listeners ───────────────────────────────────────
  useEffect(() => {
    fetchPending();
    schedulePoll();

    const onFocus = () => { fetchPending(); };
    const onTaskCreated = () => {
      // Small delay so backend has time to save, then poll immediately
      setTimeout(() => fetchPending(), 800);
    };
    // Also poll when the tab becomes visible (user switches tabs)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchPending();
    };
    // BroadcastChannel: when another tab creates a task, poll on this tab too
    let bc = null;
    try {
      bc = new BroadcastChannel('rupiyame_task_events');
      bc.onmessage = (ev) => {
        if (ev.data === 'task-created' || ev.data === 'ticket-created') {
          setTimeout(() => fetchPending(), 800);
        }
      };
    } catch (_) {}

    window.addEventListener('focus', onFocus);
    window.addEventListener('task-created', onTaskCreated);
    window.addEventListener('ticket-created', onTaskCreated);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('task-created', onTaskCreated);
      window.removeEventListener('ticket-created', onTaskCreated);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (bc) bc.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!current) return;
    setRemark('');
    setRemarkError(false);
  }, [current]);

  const handleDismiss = () => {
    if (!current) return;
    recordDismiss(current.id);
    const remaining = queue.filter(w => w.id !== current.id && !isDismissedRecently(w.id));
    if (remaining.length > 0) {
      setCurrent(remaining[0]);
    } else {
      setCurrent(null);
    }
  };

  const handleAcknowledge = async () => {
    if (!current || loading) return;
    if (!remark.trim()) {
      setRemarkError(true);
      return;
    }
    const userId = getUserId();
    if (!userId) return;
    setLoading(true);
    setRemarkError(false);

    try {
      const endpoint = current.type === 'task'
        ? `${API_BASE_URL}/tasks/${current.id}/acknowledge?user_id=${encodeURIComponent(userId)}`
        : `${API_BASE_URL}/tickets/${current.id}/acknowledge?user_id=${encodeURIComponent(userId)}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ employee_remark: remark.trim() }),
      });

      if (res.ok) {
        // Remove dismiss entry
        try {
          const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
          if (raw) {
            const dismissTimes = JSON.parse(raw);
            delete dismissTimes[current.id];
            localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(dismissTimes));
          }
        } catch (_) {}

        window.dispatchEvent(new CustomEvent('task-ticket-acknowledged', { detail: { type: current.type, id: current.id } }));
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

  // ── For tasks: ALWAYS show EditTask immediately (never intermediate loading screen) ──
  // Use editTaskData if ready, else build minimal data from `current` inline.
  // This avoids the one-render-frame gap where editTaskData is null but current is set.
  if (current.type === 'task') {
    const taskDataForModal = editTaskData || {
      id: current.id,
      subject: current.subject || 'Loading...',
      message: current.details || '',
      task_details: current.details || '',
      typeTask: current.task_type || 'To-Do',
      status: current.status || 'Pending',
      priority: current.priority || 'Medium',
      date: current.due_date || '',
      due_date: current.due_date || '',
      created_at: current.created_at,
      createdBy: current.created_by_name || 'Admin',
      creator_name: current.created_by_name || 'Admin',
      assign: 'Loading…',
      assigned_to: [],
      attachments: [],
      comments: [],
      history: [],
      notes: '',
      lead_id: null,
      loan_type: null,
      isLoading: true,
    };

    // Show EditTask inside blocking overlay (stopPropagation prevents background clicks)
    return (
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Suspense fallback={
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Loading task...</div>
        }>
          <EditTaskLazy
            key={`pop-edit-${current.id}`}
            taskData={taskDataForModal}
            onClose={handleEditTaskClose}
            onSave={handleEditTaskSave}
            currentUserId={getUserId()}
            apiBaseUrl={API_BASE_URL}
          />
        </Suspense>
      </div>
    );
  }

  // ── For tickets: ALWAYS show EditTicket immediately (same pattern as tasks) ──
  if (current.type === 'ticket') {
    const ticketDataForModal = editTicketData || {
      _id: current.id,
      id: current.id,
      subject: current.subject || 'Loading...',
      description: current.details || '',
      status: current.status || 'open',
      priority: current.priority || 'Medium',
      created_at: current.created_at,
      created_by_name: current.created_by_name || 'Admin',
      assigned_users: [],
      assigned_users_details: [],
      attachments: [],
      comments: [],
      isLoading: true,
    };

    return (
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Suspense fallback={
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Loading ticket...</div>
        }>
          <EditTicketLazy
            key={`pop-ticket-${current.id}`}
            ticket={ticketDataForModal}
            onClose={handleEditTicketClose}
            onSave={handleEditTicketSave}
          />
        </Suspense>
      </div>
    );
  }
  // ──────────────────────────────────────────────────────────────────────────

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

  const isTask = current.type === 'task';
  const Icon = isTask ? ClipboardList : Ticket;
  const accentColor = isTask ? 'blue' : 'purple';
  const pColors = priorityColors[current.priority] || priorityColors.Medium;

  const queueIdx = queue.findIndex(w => w.id === current.id);
  const totalTasks = queue.filter(i => i.type === 'task').length;
  const totalTickets = queue.filter(i => i.type === 'ticket').length;

  return (
    <div
      className="fixed inset-0 z-[99998] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 sm:p-6"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${isTask ? 'bg-blue-50 border-blue-100' : 'bg-purple-50 border-purple-100'} border-b px-6 py-5 flex items-center gap-4`}>
          <div className={`w-10 h-10 rounded-full ${isTask ? 'bg-blue-100' : 'bg-purple-100'} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${isTask ? 'text-blue-600' : 'text-purple-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-xl font-bold ${isTask ? 'text-blue-900' : 'text-purple-900'} tracking-tight`}>
              {isTask ? 'New Task Assigned' : 'New Ticket Assigned'}
            </h2>
            <p className={`text-sm ${isTask ? 'text-blue-600' : 'text-purple-600'} font-medium mt-0.5`}>
              Action Required: Please review and acknowledge.
            </p>
            {/* Summary badge */}
            {queue.length > 0 && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {totalTasks > 0 && (
                  <span className="inline-flex items-center gap-1 bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold">
                    <ClipboardList className="w-3 h-3" />
                    {totalTasks} Task{totalTasks > 1 ? 's' : ''}
                  </span>
                )}
                {totalTickets > 0 && (
                  <span className="inline-flex items-center gap-1 bg-purple-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold">
                    <Ticket className="w-3 h-3" />
                    {totalTickets} Ticket{totalTickets > 1 ? 's' : ''}
                  </span>
                )}
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
              className={`w-8 h-8 rounded-full bg-white border border-slate-300 hover:border-${accentColor}-400 hover:bg-${accentColor}-50 flex items-center justify-center transition-all shadow-sm group`}
              title="Dismiss for now (will reappear in 24 hours)"
            >
              <X className={`w-4 h-4 text-slate-400 group-hover:text-${accentColor}-500`} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Type + Subject banner */}
          <div className={`${isTask ? 'bg-blue-600' : 'bg-purple-600'} rounded-xl p-4 flex items-center gap-3 shadow-md`}>
            <div className="bg-white/20 p-2 rounded-full shrink-0">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                {isTask ? (current.task_type || 'Task') : 'Ticket'}
              </p>
              <h3 className="text-white text-base font-black tracking-wide truncate">
                {current.subject || 'No Subject'}
              </h3>
            </div>
            <span className={`${pColors.badge} text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0`}>
              {current.priority || 'Medium'}
            </span>
          </div>

          {/* Details card */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center gap-4">
              <div className="min-w-0 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Assigned By</p>
                  <p className="font-bold text-slate-800 text-sm truncate">{current.created_by_name || 'Admin'}</p>
                </div>
              </div>
              <div className="text-right shrink-0 flex items-center gap-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                    {isTask && current.due_date ? 'Due Date' : 'Created'}
                  </p>
                  <p className="font-bold text-slate-700 text-sm">
                    {formatDate(isTask && current.due_date ? current.due_date : current.created_at)}
                  </p>
                </div>
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
            </div>
            <div className="p-5 space-y-4">
              {current.details && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Details:</p>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-lg border border-slate-100 max-h-32 overflow-y-auto">
                    {current.details}
                  </p>
                </div>
              )}
              {/* Status badge */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${pColors.bg} ${pColors.text} ${pColors.border} border`}>
                  <Clock className="w-3 h-3" />
                  Priority: {current.priority || 'Medium'}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  Status: {current.status || 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Employee remark textarea - MANDATORY */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-800">
              Your Acknowledgement & Remark{' '}
              <span className="text-red-500 font-bold text-xs">* (Required)</span>
            </label>
            <textarea
              rows={3}
              value={remark}
              onChange={e => {
                setRemark(e.target.value);
                if (e.target.value.trim()) setRemarkError(false);
              }}
              placeholder="I acknowledge this assignment. I will start working on it..."
              className={`w-full text-sm outline-none p-4 resize-none bg-white border rounded-xl focus:ring-2 transition-all shadow-sm ${
                remarkError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200 bg-red-50/30'
                  : `border-slate-300 focus:border-${accentColor}-400 focus:ring-${accentColor}-100`
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
            Dismissing will re-show this in 24 hours
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
              className={`px-6 py-2.5 text-sm font-bold text-white ${isTask ? 'bg-blue-700 hover:bg-blue-800' : 'bg-purple-700 hover:bg-purple-800'} rounded-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? 'Processing…' : 'Acknowledge & Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PopTaskTicketModal;
