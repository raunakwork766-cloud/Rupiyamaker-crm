/**
 * QRCheckInPage — QR scan attendance flow
 *
 * Steps:
 *  1. Verify QR token
 *  2. If not logged in → redirect to /attendance-login?qr_token=...
 *  3. Show location confirm popup
 *  4. Get GPS + geofence check
 *  5. Open camera → take selfie
 *  6. Mark check-in with photo + location
 *  7. Show success popup → auto logout after 3s
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getAttendanceTabSession } from '../utils/authSession';
import { getLocationCrossDevice, isInAppBrowser, getAndroidChromeIntentUrl } from '../utils/locationUtils';

const API = '/api';

// ── Haversine distance (meters) ───────────────────────────────────────────────
const calcDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const r = d => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1);
  const dLon = r(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = ({ size = 48, color = '#60a5fa' }) => (
  <div style={{
    width: size, height: size,
    border: `${size / 12}px solid rgba(255,255,255,.2)`,
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'spin .8s linear infinite',
    margin: '0 auto',
  }} />
);

// ── Location Confirm Popup ────────────────────────────────────────────────────
const LocationPopup = ({ onAllow, onCancel }) => (
  <div style={overlay}>
    <div style={{ ...card, animation: 'popIn .35s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div style={{ fontSize: 68, lineHeight: 1, marginBottom: 14 }}>📍</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: '0 0 10px' }}>
        Location Required
      </h2>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, margin: '0 0 6px' }}>
        We need to verify you are at the office before marking attendance.
      </p>
      <div style={infoBadge('#f0fdf4','#bbf7d0','#166534')}>
        🔒 Location is only used for attendance verification.
      </div>
      <button onClick={onAllow} style={btn('#16a34a','#15803d')}>
        📍 Allow Location & Continue
      </button>
      <button onClick={onCancel} style={btnGhost}>Cancel</button>
    </div>
  </div>
);

// ── Outside Office Popup ──────────────────────────────────────────────────────
const OutsidePopup = ({ distance, radius, onRetry, onClose }) => (
  <div style={overlay}>
    <div style={{ ...card, animation: 'popIn .35s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div style={{ fontSize: 68, lineHeight: 1, marginBottom: 14 }}>📍</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', margin: '0 0 10px' }}>
        Outside Office Area
      </h2>
      <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: '0 0 6px' }}>
        You are approximately <strong>{Math.round(distance)} meters</strong> away.
      </p>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
        Allowed range: <strong>{radius} meters</strong> from office.
      </p>
      <div style={infoBadge('#fef2f2','#fecaca','#991b1b')}>
        🏢 Please come to the office and try again. Do not mark attendance from outside.
      </div>
      <button onClick={onRetry} style={btn('#2563eb','#1d4ed8')}>🔄 Try Again</button>
      <button onClick={onClose} style={btnGhost}>Close</button>
    </div>
  </div>
);

// ── Already Checked-In Popup ──────────────────────────────────────────────────
const AlreadyPopup = ({ name, checkInTime, isOut, onClose }) => (
  <div style={overlay}>
    <div style={{ ...card, background: '#eff6ff', border: '2px solid #bfdbfe', animation: 'popIn .35s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div style={{ fontSize: 68, lineHeight: 1, marginBottom: 12 }}>{isOut ? '👋' : '✅'}</div>
      <h2 style={{ fontSize: 21, fontWeight: 800, color: '#2563eb', margin: '0 0 8px' }}>
        {isOut ? 'Already Checked Out' : 'Already Checked In'}
      </h2>
      <p style={{ fontSize: 15, color: '#374151', margin: '0 0 6px' }}>
        Hi <strong>{name}</strong>!
      </p>
      <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 22px' }}>
        {isOut
          ? 'You have already checked in and out today.'
          : `You checked in today${checkInTime ? ` at ${checkInTime}` : ''}. Check out when you leave.`}
      </p>
      <button onClick={onClose} style={btn('#2563eb','#1d4ed8')}>OK</button>
    </div>
  </div>
);

// ── Success Popup ─────────────────────────────────────────────────────────────
const SuccessPopup = ({ name, time, isLate, type, countdown }) => (
  <div style={overlay}>
    <div style={{ ...card, background: type === 'checkout' ? '#faf5ff' : '#f0fdf4', border: `2px solid ${type === 'checkout' ? '#ddd6fe' : '#bbf7d0'}`, animation: 'popIn .4s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 10 }}>
        {type === 'checkout' ? '👋' : '🎉'}
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: type === 'checkout' ? '#7c3aed' : '#16a34a', margin: '0 0 6px' }}>
        {type === 'checkout' ? 'Checked Out!' : 'Attendance Marked!'}
      </h2>
      <p style={{ fontSize: 16, color: '#374151', margin: '0 0 4px' }}>
        {type === 'checkout' ? 'See you tomorrow,' : 'Welcome,'} <strong>{name}</strong>
      </p>
      <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 16px' }}>
        {type === 'checkout'
          ? '✅ Check-out recorded successfully'
          : isLate ? '⏰ Marked as Late Arrival' : '✅ Present — Full Day'}
      </p>
      <div style={{ background: 'white', borderRadius: 12, padding: '10px 16px', marginBottom: 18, fontSize: 14, color: '#6b7280', fontWeight: 600 }}>
        🕐 {type === 'checkout' ? 'Checked out' : 'Checked in'} at {time}
      </div>
      <div style={{ fontSize: 13, color: type === 'checkout' ? '#7c3aed' : '#16a34a', fontWeight: 700 }}>
        Redirecting to attendance portal in {countdown}s…
      </div>
    </div>
  </div>
);

// ── Location Blocked Modal ───────────────────────────────────────────────────
const LocationBlockedModal = ({ onRetry, onCancel }) => {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  return (
    <div style={overlay}>
      <div style={{ ...card, animation: 'popIn .35s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>📍</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', margin: '0 0 8px' }}>
          Location Access Blocked
        </h2>
        <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, marginBottom: 12, lineHeight: 1.4 }}>
          Location Permission Denied<br />(लोकेशन की अनुमति नहीं मिली)
        </div>
        <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6, margin: '0 0 16px' }}>
          Please follow these steps to allow location access, then tap <strong>"Retry"</strong>.<br />
          (कृपया नीचे दिए गए स्टेप्स से लोकेशन चालू करें और <strong>"Retry"</strong> पर टैप करें)
        </p>

        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 14, padding: '14px 16px', marginBottom: 20,
          fontSize: 12, color: '#78350f', textAlign: 'left', lineHeight: 1.8,
        }}>
          {isIOS ? (
            <>
              <strong>📱 iPhone / iPad (Safari):</strong><br />
              1. Go to <strong>Settings</strong> → <strong>Privacy & Security</strong> → <strong>Location Services</strong> → make sure it is <strong>ON</strong>.<br />
              <span style={{color: '#92400e'}}>(Settings → Privacy & Security → Location Services → चालू करें)</span><br />
              2. Scroll down, find <strong>Safari Websites</strong> → tap it → set to <strong>"While Using"</strong> or <strong>"Ask"</strong>.<br />
              <span style={{color: '#92400e'}}>(Safari Websites → "While Using" या "Ask" चुनें)</span><br />
              3. Also go to <strong>Settings</strong> → <strong>Safari</strong> → <strong>Location</strong> → set to <strong>"Allow"</strong>.<br />
              <span style={{color: '#92400e'}}>(Settings → Safari → Location → Allow चुनें)</span><br />
              4. Come back here and tap <strong>Retry</strong>.
            </>
          ) : isAndroid ? (
            <>
              <strong>🤖 Android (Chrome):</strong><br />
              1. Tap the 🔒 lock icon on the left of browser address bar.<br />
              <span style={{color: '#92400e'}}>(क्रोम में ऊपर 🔒 लॉक आइकॉन पर टैप करें)</span><br />
              2. Tap <strong>Permissions</strong> → <strong>Location</strong> → set to <strong>"Allow"</strong>.<br />
              <span style={{color: '#92400e'}}>(Permissions → Location → Allow चुनें)</span><br />
              3. Ensure your phone's main <strong>GPS / Location</strong> is ON.<br />
              <span style={{color: '#92400e'}}>(अपने फोन का मुख्य GPS भी चालू करें)</span><br />
              4. Come back and tap <strong>Retry</strong>
            </>
          ) : (
            <>
              <strong>💻 Desktop / PC:</strong><br />
              1. Click the 🔒 lock icon in address bar.<br />
              2. Set <strong>Location</strong> to <strong>Allow</strong>.<br />
              3. Refresh the page and try again.
            </>
          )}
        </div>

        <button onClick={onRetry} style={btn('#16a34a', '#15803d')}>
          📍 Retry Location
        </button>
        <button onClick={onCancel} style={btnGhost}>Cancel</button>
      </div>
    </div>
  );
};

// ── Camera Screen ─────────────────────────────────────────────────────────────
const CameraScreen = ({ onCapture, onCancel, userName, type = 'checkin' }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [captured, setCaptured] = useState(null); // base64 string

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setCameraError('Camera access denied. Please allow camera and try again.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];
    stopCamera();
    setCaptured(base64);
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  return (
    <div style={{
      width: '100%', maxWidth: 420, margin: '0 auto',
      background: 'white', borderRadius: 24,
      boxShadow: '0 16px 48px rgba(0,0,0,.4)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#1e1b4b,#312e81)',
        padding: '18px 20px', textAlign: 'center', color: 'white',
      }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>📸</div>
        <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
          {type === 'checkout' ? 'Check-Out Selfie' : 'Check-In Selfie'}
        </h2>
        <p style={{ fontSize: 12, opacity: .7, margin: '4px 0 0' }}>
          Hi {userName} — {type === 'checkout' ? 'photo required for check-out' : 'photo required for attendance'}
        </p>
      </div>

      <div style={{ padding: '16px 20px 20px' }}>
        {cameraError ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
            <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 16 }}>{cameraError}</p>
            <button onClick={startCamera} style={btn('#2563eb','#1d4ed8')}>Retry Camera</button>
          </div>
        ) : !captured ? (
          <>
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '3px solid #e5e7eb', marginBottom: 14, background: '#111', minHeight: 220 }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }} />
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {!cameraReady && (
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>
                Starting camera…
              </p>
            )}
            <button
              onClick={capture}
              disabled={!cameraReady}
              style={{
                ...btn('#7c3aed','#6d28d9'),
                opacity: cameraReady ? 1 : .45,
                cursor: cameraReady ? 'pointer' : 'not-allowed',
              }}
            >
              📷 Capture Photo
            </button>
            <button onClick={onCancel} style={{ ...btnGhost, marginTop: 8 }}>Cancel</button>
          </>
        ) : (
          <>
            <img
              src={`data:image/jpeg;base64,${captured}`}
              alt="captured"
              style={{ width: '100%', borderRadius: 14, border: '3px solid #bbf7d0', marginBottom: 14, display: 'block' }}
            />
            <p style={{ textAlign: 'center', fontSize: 13, color: '#16a34a', fontWeight: 700, marginBottom: 14 }}>
              ✅ Photo captured!
            </p>
            <button onClick={() => onCapture(captured)} style={btn('#16a34a','#15803d')}>
              {type === 'checkout' ? '👋 Submit Check-Out' : '✅ Submit Check-In'}
            </button>
            <button onClick={retake} style={{ ...btnGhost, marginTop: 8 }}>🔄 Retake</button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Style helpers ─────────────────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: 20,
};
const card = {
  background: '#fff', borderRadius: 24, padding: '36px 28px',
  maxWidth: 380, width: '100%', textAlign: 'center',
  boxShadow: '0 24px 60px rgba(0,0,0,.35)',
};
const btn = (from, to) => ({
  background: `linear-gradient(135deg,${from},${to})`,
  color: 'white', border: 'none', borderRadius: 12,
  padding: '13px 24px', fontSize: 15, fontWeight: 700,
  cursor: 'pointer', width: '100%', display: 'block',
  marginTop: 10,
});
const btnGhost = {
  background: '#f1f5f9', color: '#64748b', border: 'none',
  borderRadius: 12, padding: '10px 24px', fontSize: 14,
  fontWeight: 600, cursor: 'pointer', width: '100%',
  display: 'block', marginTop: 8,
};
const infoBadge = (bg, border, color) => ({
  background: bg, border: `1px solid ${border}`,
  borderRadius: 12, padding: '10px 14px', margin: '0 0 20px',
  fontSize: 12, color, lineHeight: 1.5,
});

// ── Main Page ─────────────────────────────────────────────────────────────────
const QRCheckInPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  /*
   * phase:
   *  verifying         → checking QR token
   *  invalid           → bad token
   *  redirecting_login → sending to /attendance-login
   *  ask_location      → custom location popup
   *  locating          → getting GPS
   *  camera            → taking selfie
   *  submitting        → calling check-in API
   *  done              → success / already-in popup
   *  error             → general error
   */
  const [phase, setPhase] = useState('verifying');
  const [geofenceInfo, setGeofenceInfo] = useState(null);
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [attendanceType, setAttendanceType] = useState('checkin'); // 'checkin' | 'checkout'

  // popup data
  const [outsideData, setOutsideData] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [alreadyData, setAlreadyData] = useState(null);
  const [countdown, setCountdown] = useState(4);

  // ── Step 1: Verify token ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setPhase('invalid'); return; }
    (async () => {
      try {
        const res = await axios.get(`${API}/attendance/qr-token/verify`, { params: { token } });
        if (!res.data.valid) { setPhase('invalid'); return; }
        setGeofenceInfo({
          geofence_enabled: res.data.geofence_enabled,
          office_latitude:  res.data.office_latitude,
          office_longitude: res.data.office_longitude,
          geofence_radius:  res.data.geofence_radius ?? 100,
        });
        const session = getAttendanceTabSession();
        if (session?.user) {
          setUser(session.user);
          setPhase('ask_location');
        } else {
          setPhase('redirecting_login');
          navigate(`/attendance-login?qr_token=${encodeURIComponent(token)}`, { replace: true });
        }
      } catch {
        setPhase('invalid');
      }
    })();
  }, [token, navigate]);

  // ── Step 3: GPS + geofence ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'locating' || !user || !geofenceInfo) return;
    setStatusMsg('Getting your location…');

    getLocationCrossDevice()
      .then((coords) => {
        const { latitude, longitude, accuracy } = coords;

        if (geofenceInfo.geofence_enabled && geofenceInfo.office_latitude && geofenceInfo.office_longitude) {
          const dist = calcDistance(latitude, longitude, geofenceInfo.office_latitude, geofenceInfo.office_longitude);
          const radius = geofenceInfo.geofence_radius ?? 100;
          const buffer = Math.min(accuracy || 0, 30);
          const effective = radius + buffer;

          console.log(`📍 dist=${dist.toFixed(1)}m accuracy=±${accuracy?.toFixed(0)}m radius=${radius}m effective=${effective}m`);

          if (dist > effective) {
            setOutsideData({ distance: dist, radius });
            setPhase('error'); return;
          }
        }

        // Geofence passed → check current status to know check-in or check-out
        setLocation({ latitude, longitude, accuracy });

        // Quick status check to show correct camera title
        const userId = user?._id || user?.id;
        if (userId) {
          axios.get(`${API}/attendance/status/current/${userId}`, {
            headers: { 'X-Attendance-Token': sessionStorage.getItem('attendanceSessionToken') || '' },
          }).then(st => {
            const isIn  = st.data?.checked_in  || false;
            const isOut = st.data?.checked_out || false;
            setAttendanceType(isIn && !isOut ? 'checkout' : 'checkin');
          }).catch(() => {}).finally(() => setPhase('camera'));
        } else {
          setPhase('camera');
        }
      })
      .catch((err) => {
        const errMsg = err.message || '';
        const errCode = err.code || '';

        if (errMsg === 'HTTPS_REQUIRED') {
          // Site is not on HTTPS — can't fix by retrying
          setStatusMsg('🔒 Location requires a secure HTTPS connection. Please contact support.');
          setPhase('error');
        } else if (
          errMsg === 'LOCATION_BLOCKED' ||
          errCode === 'PERMISSION_DENIED'
        ) {
          // User has actually denied permission → show Settings guide modal
          setStatusMsg('Location access is blocked');
          setPhase('error');
        } else {
          // GPS timeout, POSITION_UNAVAILABLE, or other signal issue
          // Show friendly retry message — NOT the settings guide (permission is fine)
          setStatusMsg(errMsg || '📍 Could not get location. Please ensure GPS is ON and tap Retry.');
          setPhase('error');
        }
      });
  }, [phase, user, geofenceInfo]);

  // ── Step 5: Submit check-in OR check-out with photo ───────────────────────
  const handleCapture = useCallback(async (photoBase64) => {
    if (!user) return;
    setPhase('submitting');
    const userId = user._id || user.id;
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Employee';

    try {
      // Check current status first
      const statusRes = await axios.get(`${API}/attendance/status/current/${userId}`, {
        headers: { 'X-Attendance-Token': sessionStorage.getItem('attendanceSessionToken') || '' },
      });

      const alreadyIn  = statusRes.data?.checked_in  || false;
      const alreadyOut = statusRes.data?.checked_out || false;

      // Already fully done today
      if (alreadyIn && alreadyOut) {
        setAlreadyData({ name: displayName, checkInTime: statusRes.data?.check_in_time_formatted || '', isOut: true });
        setPhase('done'); return;
      }

      const nowTime = () => new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true,
      });

      if (!alreadyIn) {
        // ── CHECK-IN ────────────────────────────────────────────────────────
        const r = await axios.post(
          `${API}/attendance/check-in`,
          { photo_data: photoBase64, geolocation: location, comments: 'QR Code Check-in', face_descriptor: null },
          {
            params: { user_id: userId },
            headers: { 'X-Attendance-Token': sessionStorage.getItem('attendanceSessionToken') || '' },
            timeout: 30000,
          }
        );
        if (r.data?.success) {
          setSuccessData({ name: displayName, time: nowTime(), isLate: r.data.is_late || false, type: 'checkin' });
          setPhase('done');
        } else {
          setStatusMsg(r.data?.message || r.data?.detail || 'Could not mark check-in.');
          setPhase('error');
        }
      } else {
        // ── CHECK-OUT ───────────────────────────────────────────────────────
        const r = await axios.post(
          `${API}/attendance/check-out`,
          { photo_data: photoBase64, geolocation: location, comments: 'QR Code Check-out', face_descriptor: null },
          {
            params: { user_id: userId },
            headers: { 'X-Attendance-Token': sessionStorage.getItem('attendanceSessionToken') || '' },
            timeout: 30000,
          }
        );
        if (r.data?.success) {
          setSuccessData({ name: displayName, time: nowTime(), isLate: false, type: 'checkout' });
          setPhase('done');
        } else {
          setStatusMsg(r.data?.message || r.data?.detail || 'Could not mark check-out.');
          setPhase('error');
        }
      }
    } catch (err) {
      const detail = (err.response?.data?.detail || '').toLowerCase();
      if (detail.includes('already') && detail.includes('out')) {
        setAlreadyData({ name: displayName, checkInTime: '', isOut: true });
        setPhase('done');
      } else if (detail.includes('already') || detail.includes('checked in')) {
        setAlreadyData({ name: displayName, checkInTime: '', isOut: false });
        setPhase('done');
      } else {
        setStatusMsg(err.response?.data?.detail || 'Something went wrong. Please try again.');
        setPhase('error');
      }
    }
  }, [user, location]);

  // ── Auto redirect to attendance portal after success ────────────────────────
  useEffect(() => {
    if (phase !== 'done' || !successData) return;
    setCountdown(4);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Redirect to attendance portal (keep session alive)
          navigate('/attendance-login', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, successData, navigate]);

  const retryFromError = () => {
    setOutsideData(null);
    setStatusMsg('');
    setLocation(null);
    setPhase('ask_location');
  };

  const displayName = user
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Employee'
    : '';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#0f172a 0%,#1e1b4b 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 20,
      fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif',
    }}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes popIn { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
      `}</style>

      {/* In-App Browser Warning */}
      {isInAppBrowser() && (
        <div style={{
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: 'white', borderRadius: 16, padding: '16px 20px',
          marginBottom: 20, maxWidth: 360, width: '100%',
          boxShadow: '0 4px 20px rgba(217,119,6,0.25)',
          animation: 'popIn 0.3s ease-out', boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                In-App Browser Detected
              </div>
              <div style={{ fontSize: 12, opacity: 0.95, lineHeight: 1.5 }}>
                QR Check-in requires location permissions, which often fail inside WhatsApp/Instagram. Please open in Chrome or Safari.
                <br />
                (WhatsApp/Instagram के अंदर लोकेशन काम नहीं करती है। कृपया इसे Chrome या Safari में खोलें।)
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Link copied! Open Chrome or Safari and paste the link.");
                  }}
                  style={{
                    background: 'white', color: '#d97706', border: 'none',
                    borderRadius: 8, padding: '6px 12px', fontSize: 11,
                    fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  📋 Copy Link
                </button>
                {/Android/i.test(navigator.userAgent) && (
                  <a
                    href={getAndroidChromeIntentUrl()}
                    style={{
                      background: '#1e1b4b', color: 'white', textDecoration: 'none',
                      borderRadius: 8, padding: '6px 12px', fontSize: 11,
                      fontWeight: 700, display: 'inline-block'
                    }}
                  >
                    🌐 Open Chrome
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verifying */}
      {phase === 'verifying' && (
        <div style={{ textAlign: 'center', color: 'white' }}>
          <Spinner />
          <p style={{ fontSize: 16, opacity: .8, marginTop: 20 }}>Verifying QR Code…</p>
        </div>
      )}

      {/* Redirecting to login */}
      {phase === 'redirecting_login' && (
        <div style={{ textAlign: 'center', color: 'white' }}>
          <Spinner color="#4ade80" />
          <p style={{ fontSize: 16, opacity: .8, marginTop: 20 }}>Redirecting to login…</p>
        </div>
      )}

      {/* Invalid QR */}
      {phase === 'invalid' && (
        <div style={{ background: 'white', borderRadius: 20, padding: '40px 28px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 16px 48px rgba(0,0,0,.4)' }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🚫</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', margin: '0 0 12px' }}>Invalid QR Code</h2>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, margin: 0 }}>
            This QR code is not valid. Please scan the correct attendance QR code from your office.
          </p>
        </div>
      )}

      {/* Locating */}
      {phase === 'locating' && (
        <div style={{ textAlign: 'center', color: 'white', maxWidth: 300 }}>
          <div style={{ fontSize: 64, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }}>📍</div>
          <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{statusMsg || 'Getting your location…'}</p>
          <p style={{ fontSize: 13, opacity: .6 }}>Please allow location access when prompted</p>
        </div>
      )}

      {/* Submitting */}
      {phase === 'submitting' && (
        <div style={{ textAlign: 'center', color: 'white' }}>
          <Spinner />
          <p style={{ fontSize: 16, opacity: .8, marginTop: 20 }}>Marking your attendance…</p>
        </div>
      )}

      {phase === 'camera' && (
        <CameraScreen
          userName={displayName}
          type={attendanceType}
          onCapture={handleCapture}
          onCancel={() => setPhase('ask_location')}
        />
      )}

      {/* General Error */}
      {phase === 'error' && !outsideData && !statusMsg.includes('Location access is blocked') && (
        <div style={{ background: 'white', borderRadius: 20, padding: '36px 28px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 16px 48px rgba(0,0,0,.4)' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', margin: '0 0 12px' }}>
            Could Not Mark Attendance
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, margin: '0 0 24px', whiteSpace: 'pre-line' }}>{statusMsg}</p>
          <button onClick={retryFromError} style={btn('#2563eb','#1d4ed8')}>🔄 Try Again</button>
        </div>
      )}

      {/* Location Blocked Modal — shown for both exact match and partial match */}
      {phase === 'error' && !outsideData && statusMsg.toLowerCase().includes('location access is blocked') && (
        <LocationBlockedModal
          onRetry={retryFromError}
          onCancel={() => navigate('/')}
        />
      )}

      {/* Popups */}
      {phase === 'ask_location' && (
        <LocationPopup
          onAllow={() => setPhase('locating')}
          onCancel={() => navigate('/')}
        />
      )}
      {phase === 'error' && outsideData && (
        <OutsidePopup
          distance={outsideData.distance}
          radius={outsideData.radius}
          onRetry={retryFromError}
          onClose={() => { setOutsideData(null); setPhase('ask_location'); }}
        />
      )}
      {phase === 'done' && successData && (
        <SuccessPopup
          name={successData.name}
          time={successData.time}
          isLate={successData.isLate}
          type={successData.type}
          countdown={countdown}
        />
      )}
      {phase === 'done' && alreadyData && (
        <AlreadyPopup
          name={alreadyData.name}
          checkInTime={alreadyData.checkInTime}
          isOut={alreadyData.isOut}
          onClose={() => navigate('/attendance-login', { replace: true })}
        />
      )}
    </div>
  );
};

export default QRCheckInPage;
