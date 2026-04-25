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
    const tok = (typeof window !== 'undefined') && localStorage.getItem('attendanceToken');
    return tok ? { 'X-Attendance-Token': tok } : {};
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
    </div>
  );
};

export default AttendanceCheckInOut;
