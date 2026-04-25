import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = '/api';

// ─── Status Message Config ────────────────────────────────────────
const STATUS_MESSAGES = {
  full_day: {
    emoji: '🎉',
    title: 'Perfect Attendance!',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    messages: [
      "Fantastic! You're here for the full day! Keep up the great work! 🌟",
      "Full day present! Your dedication is truly inspiring! 💪",
      "Amazing! A complete day of productivity ahead! 🚀",
    ]
  },
  half_day: {
    emoji: '🌤️',
    title: 'Half Day',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    messages: [
      "Half day noted. Every bit of effort counts! 💛",
      "You're here for half the day – make it count! ⚡",
      "Half day logged. Rest well and come back stronger! 🌙",
    ]
  },
  late: {
    emoji: '⏰',
    title: 'Late Arrival',
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    messages: [
      "Better late than never! Let's make the most of today! 😊",
      "A little late, but you made it! Focus and hustle now! 🏃",
      "Noted late arrival. Tomorrow's a fresh start! 🌅",
    ]
  },
  checked_out: {
    emoji: '👋',
    title: 'See You Tomorrow!',
    color: '#7c3aed',
    bg: '#faf5ff',
    border: '#ddd6fe',
    messages: [
      "Great work today! Rest well and come back refreshed! 🌙",
      "You've checked out! Enjoy your time off! 🎈",
      "Another day done! You were awesome today! ⭐",
    ]
  }
};

const getRandomMessage = (type) => {
  const cfg = STATUS_MESSAGES[type];
  if (!cfg) return null;
  const msg = cfg.messages[Math.floor(Math.random() * cfg.messages.length)];
  return { ...cfg, message: msg };
};

// ─── Success Modal ─────────────────────────────────────────────────
const SuccessModal = ({ data, onClose }) => {
  if (!data) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: data.bg, border: `2px solid ${data.border}`,
        borderRadius: 24, padding: '40px 32px', maxWidth: 400, width: '90%',
        textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        animation: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)'
      }}>
        <div style={{ fontSize: 80, marginBottom: 10, lineHeight: 1 }}>{data.emoji}</div>
        <h2 style={{ color: data.color, fontSize: 26, fontWeight: 800, margin: '0 0 12px' }}>
          {data.title}
        </h2>
        <p style={{ color: '#374151', fontSize: 16, lineHeight: 1.7, margin: '0 0 20px' }}>
          {data.message}
        </p>
        {data.time && (
          <div style={{
            background: 'white', borderRadius: 12, padding: '10px 16px',
            marginBottom: 24, fontSize: 14, color: '#6b7280', fontWeight: 600
          }}>
            🕐 Marked at {data.time}
          </div>
        )}
        <button onClick={onClose} style={{
          background: data.color, color: 'white', border: 'none',
          borderRadius: 12, padding: '14px 32px', fontSize: 16,
          fontWeight: 700, cursor: 'pointer', width: '100%',
          transition: 'opacity 0.2s'
        }}>
          Continue 👍
        </button>
      </div>
    </div>
  );
};

const AttendanceCheckInOut = ({ userId, userInfo }) => {
  // 📱 If this component is rendered inside an attendance-only session
  // (mobile employee shell), include the X-Attendance-Token header on every
  // request so the backend's session-validation middleware can authorize the
  // call against the scoped attendance token. For regular CRM users opening
  // the attendance page from the sidebar, this header simply won't exist
  // and normal CRM session validation applies.
  const getAttendanceHeaders = () => {
    if (typeof window === 'undefined') return {};
    const tok = localStorage.getItem('attendanceToken');
    if (tok) return { 'X-Attendance-Token': tok };
    // Fallback: regular CRM session — token is stored inside userData JSON
    try {
      const userData = localStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      if (user?.token) return { 'Authorization': `Bearer ${user.token}` };
    } catch (_) {}
    return {};
  };

  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceType, setAttendanceType] = useState(null);

  const [showDialog, setShowDialog] = useState(false);
  const [photoData, setPhotoData] = useState(null);
  const [comments, setComments] = useState('');
  const [successModal, setSuccessModal] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // ─── Calendar state ────────────────────────────────────────────
  const now0 = new Date();
  const [calYear, setCalYear] = useState(now0.getFullYear());
  const [calMonth, setCalMonth] = useState(now0.getMonth() + 1); // 1-based
  const [calData, setCalData] = useState({}); // date-string → record
  const [calLoading, setCalLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null); // 'YYYY-MM-DD' or null

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (userId) loadCurrentStatus();
  }, [userId]);

  const loadCurrentStatus = async () => {
    try {
      const r = await axios.get(
        `${API_BASE}/attendance/status/current/${userId}`,
        { headers: getAttendanceHeaders() }
      );
      if (r.data.success) setCurrentStatus(r.data);
    } catch (e) { console.error(e); }
  };

  // ─── Calendar fetch ──────────────────────────────────────────────
  const fetchCalendar = async (yr, mo) => {
    if (!userId) return;
    setCalLoading(true);
    try {
      // Use the same /attendance/calendar endpoint the main attendance page uses,
      // filtered to this employee only — gives full data: leaves, holidays, Sunday rule, etc.
      const r = await axios.get(
        `${API_BASE}/attendance/calendar`,
        {
          params: { user_id: userId, employee_id: userId, year: yr, month: mo },
          headers: getAttendanceHeaders()
        }
      );
      const days = r.data?.employees?.[0]?.days || [];
      console.log('[Calendar] days count:', days.length, 'sample:', days[0]);
      // Build date-keyed map
      const map = {};
      days.forEach(d => { if (d.date) map[d.date] = d; });
      setCalData(map);
    } catch (e) {
      console.error('Calendar fetch error', e?.response?.status, e?.response?.data || e.message);
      // Fallback: use my-calendar endpoint (lighter, only own records)
      try {
        const r2 = await axios.get(
          `${API_BASE}/attendance/my-calendar/${userId}`,
          { params: { year: yr, month: mo }, headers: getAttendanceHeaders() }
        );
        if (r2.data.success) setCalData(r2.data.day_map || {});
      } catch (e2) { console.error('Fallback calendar error', e2.message); }
    }
    finally { setCalLoading(false); }
  };

  useEffect(() => { if (userId) fetchCalendar(calYear, calMonth); }, [userId, calYear, calMonth]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      streamRef.current = stream;
    } catch (e) {
      setErrorMsg('Camera access denied. Please allow camera permissions and use HTTPS.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const openDialog = (type) => {
    setAttendanceType(type);
    setPhotoData(null);
    setComments('');
    setErrorMsg('');
    setShowDialog(true);
    setTimeout(() => startCamera(), 300);
  };

  const closeDialog = () => {
    stopCamera();
    setShowDialog(false);
    setAttendanceType(null);
    setPhotoData(null);
    setLoading(false);
    setErrorMsg('');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const fullBase64 = canvas.toDataURL('image/jpeg', 0.8);
    const base64Only = fullBase64.split(',')[1];
    setPhotoData(base64Only);
    stopCamera();
  };

  const markAttendance = async () => {
    if (!photoData) return;
    setLoading(true);
    setErrorMsg('');
    try {
      let location = null;
      try {
        location = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(
            p => res({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
            e => rej(e), { timeout: 8000 }
          )
        );
      } catch (_) { }

      const endpoint = attendanceType === 'check-in' ? 'check-in' : 'check-out';
      const r = await axios.post(
        `${API_BASE}/attendance/${endpoint}`,
        { photo_data: photoData, geolocation: location, comments, face_descriptor: null },
        { params: { user_id: userId }, headers: getAttendanceHeaders() }
      );

      if (r.data.success) {
        closeDialog();
        await loadCurrentStatus();
        fetchCalendar(calYear, calMonth); // refresh calendar

        let modalType = 'checked_out';
        if (attendanceType === 'check-in') {
          const st = (r.data.attendance_status || r.data.status || '').toLowerCase();
          const isLate = r.data.is_late || false;
          if (isLate || st.includes('late')) modalType = 'late';
          else if (st.includes('half')) modalType = 'half_day';
          else modalType = 'full_day';
        }
        const modalData = getRandomMessage(modalType);
        setSuccessModal({
          ...modalData,
          time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
        });
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to mark attendance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isCheckedIn = currentStatus?.checked_in;
  const isCheckedOut = currentStatus?.checked_out;

  return (
    <div style={{ width: '100%', padding: 16, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <style>{`
        @keyframes popIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .att-btn { transition: all 0.2s; cursor: pointer; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; padding: 14px 20px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .att-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
        .att-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .cal-day { border-radius: 8px; aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; font-size: 13px; font-weight: 600; position: relative; }
        .cal-day:hover { transform: scale(1.1); z-index: 1; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        .cal-day.empty { cursor: default; }
        .cal-day.empty:hover { transform: none; box-shadow: none; }
      `}</style>

      {/* Clock */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', color: 'white', borderRadius: 16, padding: '22px 20px', textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: 3 }}>
          {currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
        </div>
        <div style={{ fontSize: 14, opacity: 0.75, marginTop: 4 }}>
          {currentTime.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Status */}
      {currentStatus && (
        <div style={{ background: 'white', borderRadius: 16, padding: '16px 20px', marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>👤 Today's Attendance</span>
            <button onClick={loadCurrentStatus} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
              🔄 Refresh
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 3, textTransform: 'uppercase', fontWeight: 600 }}>Check In</div>
              <div style={{ fontWeight: 700, color: isCheckedIn ? '#16a34a' : '#9ca3af', fontSize: 14 }}>
                {isCheckedIn ? `✅ ${currentStatus.check_in_time_formatted || 'Done'}` : '⚪ Not yet'}
              </div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 3, textTransform: 'uppercase', fontWeight: 600 }}>Check Out</div>
              <div style={{ fontWeight: 700, color: isCheckedOut ? '#7c3aed' : '#9ca3af', fontSize: 14 }}>
                {isCheckedOut ? `✅ ${currentStatus.check_out_time_formatted || 'Done'}` : '⚪ Not yet'}
              </div>
            </div>
          </div>
          {currentStatus.current_status && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600 }}>
                {currentStatus.current_status}
              </span>
              {currentStatus.is_late && (
                <span style={{ background: '#fff7ed', color: '#ea580c', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600 }}>⏰ Late Arrival</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button className="att-btn" style={{ background: isCheckedIn ? '#dcfce7' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: isCheckedIn ? '#16a34a' : 'white', width: '100%' }}
          onClick={() => openDialog('check-in')} disabled={loading || isCheckedIn}>
          ✅ {isCheckedIn ? 'Checked In' : 'Check In'}
        </button>
        <button className="att-btn" style={{ background: (!isCheckedIn || isCheckedOut) ? '#f3f4f6' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: (!isCheckedIn || isCheckedOut) ? '#9ca3af' : 'white', width: '100%' }}
          onClick={() => openDialog('check-out')} disabled={loading || !isCheckedIn || isCheckedOut}>
          👋 {isCheckedOut ? 'Checked Out' : 'Check Out'}
        </button>
      </div>

      {/* ── Dialog ── */}
      {showDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 460, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>
                {attendanceType === 'check-in' ? '✅ Check In' : '👋 Check Out'} — Take Photo
              </span>
              <button onClick={closeDialog} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Camera — shown when no photo yet */}
              {!photoData && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '3px solid #e5e7eb', marginBottom: 16 }}>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', background: '#111', minHeight: 200 }} />
                  </div>
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  {errorMsg && <div style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>❌ {errorMsg}</div>}
                  <button className="att-btn" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', margin: '0 auto', maxWidth: 220 }} onClick={capturePhoto}>
                    📷 Capture Photo
                  </button>
                </div>
              )}

              {/* Captured — shown after photo taken */}
              {photoData && (
                <div style={{ textAlign: 'center' }}>
                  <img src={`data:image/jpeg;base64,${photoData}`} alt="captured" style={{ width: '100%', maxWidth: 300, borderRadius: 12, marginBottom: 12, border: '3px solid #bbf7d0' }} />
                  <textarea placeholder="Comments (optional)..." value={comments} onChange={e => setComments(e.target.value)} rows={2}
                    style={{ width: '100%', borderRadius: 10, border: '1px solid #e5e7eb', padding: '10px 12px', fontSize: 14, resize: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
                  {errorMsg && <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 14, marginBottom: 12 }}>❌ {errorMsg}</div>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="att-btn" style={{ background: '#f3f4f6', color: '#374151', flex: 1 }}
                      onClick={() => { setPhotoData(null); setErrorMsg(''); startCamera(); }}>
                      🔄 Retake
                    </button>
                    <button className="att-btn" style={{ background: loading ? '#9ca3af' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', flex: 2 }}
                      onClick={markAttendance} disabled={loading}>
                      {loading
                        ? <><div style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Processing...</>
                        : (attendanceType === 'check-in' ? '✅ Mark Check In' : '👋 Mark Check Out')
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      <SuccessModal data={successModal} onClose={() => setSuccessModal(null)} />

      {/* ─── Calendar View ─── */}
      {(() => {
        const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

        const daysInMonth = new Date(calYear, calMonth, 0).getDate();
        const firstWeekday = new Date(calYear, calMonth - 1, 1).getDay(); // 0=Sun
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD

        const prevMonth = () => {
          if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
          else setCalMonth(m => m - 1);
          setSelectedDay(null);
        };
        const nextMonth = () => {
          const nowDate = new Date();
          const nowY = nowDate.getFullYear(), nowM = nowDate.getMonth() + 1;
          if (calYear > nowY || (calYear === nowY && calMonth >= nowM)) return; // no future
          if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
          else setCalMonth(m => m + 1);
          setSelectedDay(null);
        };

        const getDayStyle = (dateStr, isToday, isFuture) => {
          const rec = calData[dateStr];
          if (isFuture) return { background: '#f9fafb', color: '#d1d5db' };
          if (!rec || rec.is_weekend) return { background: '#f3f4f6', color: '#9ca3af' };
          const st = rec.status;
          if (rec.is_holiday || st === 1.5) return { background: '#fef9c3', color: '#92400e' };
          if (st === 2 || st === 2.0) return { background: '#dbeafe', color: '#1d4ed8' }; // Working/in
          if (st === 1 || st === 1.0) return { background: '#dcfce7', color: '#15803d' };
          if (st === 0.5) return { background: '#ffedd5', color: '#c2410c' };
          if (st === 0 || st === 0.0) return { background: '#ede9fe', color: '#6d28d9' }; // Leave
          if (st === -1 || st === -1.0) return { background: '#fee2e2', color: '#b91c1c' };
          if (st === -2 || st === -2.0) return { background: '#fce7f3', color: '#9d174d' }; // Absconding
          return { background: '#f3f4f6', color: '#6b7280' };
        };

        const getDayDot = (dateStr, isFuture) => {
          const rec = calData[dateStr];
          if (isFuture || !rec || rec.is_weekend) return null;
          const st = rec.status;
          if (rec.is_holiday || st === 1.5) return '🎉';
          if (st === 2 || st === 2.0) return '▶';
          if (st === 1 || st === 1.0) return '✓';
          if (st === 0.5) return '½';
          if (st === 0 || st === 0.0) return 'L';
          if (st === -1 || st === -1.0) return '✗';
          if (st === -2 || st === -2.0) return '!!';
          return null;
        };

        const selRec = selectedDay ? calData[selectedDay] : null;
        const fmt12 = (t) => {
          if (!t) return '—';
          try {
            const [h, m] = t.split(':');
            const d = new Date(); d.setHours(+h, +m);
            return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          } catch { return t; }
        };

        // Check if next month is in future
        const nowDate2 = new Date();
        const isLastAllowed = calYear === nowDate2.getFullYear() && calMonth === (nowDate2.getMonth() + 1);

        return (
          <div style={{ marginTop: 24, background: 'white', borderRadius: 16, padding: '16px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={prevMonth} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{MONTH_NAMES[calMonth - 1]} {calYear}</div>
                {calLoading && <div style={{ fontSize: 11, color: '#9ca3af' }}>Loading…</div>}
              </div>
              <button onClick={nextMonth} disabled={isLastAllowed} style={{ background: isLastAllowed ? '#f9fafb' : '#f3f4f6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: isLastAllowed ? 'not-allowed' : 'pointer', fontSize: 18, fontWeight: 700, color: isLastAllowed ? '#d1d5db' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, fontSize: 11 }}>
              {[
                ['#dcfce7','#15803d','Present'],
                ['#ffedd5','#c2410c','Half Day'],
                ['#fee2e2','#b91c1c','Absent'],
                ['#ede9fe','#6d28d9','Leave'],
                ['#fef9c3','#92400e','Holiday'],
                ['#f3f4f6','#9ca3af','Weekend'],
              ].map(([bg, col, lbl]) => (
                <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${col}33`, display: 'inline-block' }} />
                  <span style={{ color: '#6b7280' }}>{lbl}</span>
                </span>
              ))}
            </div>

            {/* Day of week headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: d === 'Sun' || d === 'Sat' ? '#ef4444' : '#6b7280', padding: '4px 0' }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {/* Empty cells before first day */}
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`e${i}`} className="cal-day empty" />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const mm = String(calMonth).padStart(2, '0');
                const dd = String(dayNum).padStart(2, '0');
                const dateStr = `${calYear}-${mm}-${dd}`;
                const isToday = dateStr === todayStr;
                const isFuture = dateStr > todayStr;
                const dayStyle = getDayStyle(dateStr, isToday, isFuture);
                const dot = getDayDot(dateStr, isFuture);
                const isSelected = selectedDay === dateStr;
                return (
                  <div
                    key={dayNum}
                    className={`cal-day${isFuture ? ' empty' : ''}`}
                    onClick={() => !isFuture && setSelectedDay(isSelected ? null : dateStr)}
                    style={{
                      ...dayStyle,
                      border: isToday ? '2px solid #6366f1' : isSelected ? '2px solid #374151' : '1px solid transparent',
                      boxShadow: isSelected ? '0 0 0 2px #6366f133' : 'none',
                      opacity: (calData[dateStr]?.is_weekend && !calData[dateStr]) ? 0.5 : 1,
                    }}
                  >
                    <span style={{ fontSize: 12, lineHeight: 1 }}>{dayNum}</span>
                    {dot && <span style={{ fontSize: 9, marginTop: 1, lineHeight: 1 }}>{dot}</span>}
                  </div>
                );
              })}
            </div>

            {/* Selected day detail panel */}
            {selectedDay && (
              <div style={{ marginTop: 14, background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 8 }}>
                  📅 {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
                {selRec ? (
                  selRec.is_weekend ? (
                    <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
                      🏖️ Weekend — Day Off
                    </div>
                  ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: 'white', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Check In</div>
                      <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 13 }}>{fmt12(selRec.check_in_time)}</div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Check Out</div>
                      <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: 13 }}>{fmt12(selRec.check_out_time)}</div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Hours Worked</div>
                      <div style={{ fontWeight: 700, color: '#374151', fontSize: 13 }}>{selRec.total_working_hours != null ? `${selRec.total_working_hours}h` : '—'}</div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Status</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color:
                        (selRec.status === 1 || selRec.status === 1.0) ? '#16a34a' :
                        selRec.status === 0.5 ? '#d97706' :
                        (selRec.status === 0 || selRec.status === 0.0) ? '#7c3aed' :
                        (selRec.status === 1.5) ? '#92400e' :
                        '#dc2626'
                      }}>
                        {selRec.is_holiday || selRec.status === 1.5 ? '🎉 Holiday' :
                         selRec.status === 2 ? '▶ Working' :
                         selRec.status === 1 || selRec.status === 1.0 ? '✅ Full Day' :
                         selRec.status === 0.5 ? '🌤 Half Day' :
                         selRec.status === 0 || selRec.status === 0.0 ? `📋 ${selRec.leave_type ? selRec.leave_type.replace(/_/g,' ') : 'Leave'}` :
                         selRec.status === -2 ? '🚨 Absconding' :
                         '❌ Absent'}
                      </div>
                    </div>
                    {selRec.is_late && (
                      <div style={{ background: '#fff7ed', borderRadius: 8, padding: '8px 12px', gridColumn: '1/-1' }}>
                        <span style={{ color: '#ea580c', fontSize: 12, fontWeight: 600 }}>⏰ Late Arrival</span>
                      </div>
                    )}
                    {selRec.leave_reason && (
                      <div style={{ background: '#f5f3ff', borderRadius: 8, padding: '8px 12px', gridColumn: '1/-1' }}>
                        <span style={{ color: '#6d28d9', fontSize: 12, fontWeight: 600 }}>📋 {selRec.leave_reason}</span>
                      </div>
                    )}
                  </div>
                  )
                ) : (
                  <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
                    No attendance record for this date
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default AttendanceCheckInOut;
