/**
 * Standalone attendance entry — no CRM localStorage, no shared App auth state.
 * Opened in a new tab while CRM is logged in elsewhere: only this tab's sessionStorage counts.
 */
import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import AttendanceCheckInOut from './components/attendance/AttendanceCheckInOut';
import { clearProfilePhotoFromStorage } from './utils/profilePhotoUtils';
import {
  ATTENDANCE_LOGIN_PATH,
  clearLegacyAttendanceLoginFlags,
} from './utils/loginMode';
import {
  getAttendanceTabSession,
  clearAttendanceTabSession,
  scrubAttendanceFromLocalStorage,
} from './utils/authSession';

const AttendanceShell = ({ user, onLogout }) => {
  const userId = user?._id || user?.id;
  const displayName =
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    user?.username ||
    'Employee';

  return (
    <div style={{ minHeight: '100vh', background: '#0b1220', color: 'white' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: '#111827',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <div style={{ fontWeight: 700 }}>Attendance — {displayName}</div>
        <button
          type="button"
          onClick={onLogout}
          style={{
            background: '#ef4444',
            color: 'white',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>
      <div style={{ padding: 16 }}>
        <AttendanceCheckInOut userId={userId} userInfo={user} />
      </div>
    </div>
  );
};

export default function AttendanceApp() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const syncFromTabStorage = useCallback(() => {
    scrubAttendanceFromLocalStorage();
    const att = getAttendanceTabSession();
    setUser(att?.user ?? null);
  }, []);

  useEffect(() => {
    syncFromTabStorage();
    setReady(true);
  }, [syncFromTabStorage]);

  const handleLogin = useCallback((userData) => {
    setUser(userData);
    syncFromTabStorage();
  }, [syncFromTabStorage]);

  const handleLogout = useCallback(() => {
    clearProfilePhotoFromStorage();
    clearLegacyAttendanceLoginFlags();
    clearAttendanceTabSession();
    setUser(null);
    navigate(ATTENDANCE_LOGIN_PATH, { replace: true });
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path={ATTENDANCE_LOGIN_PATH}
        element={
          user ? (
            <AttendanceShell user={user} onLogout={handleLogout} />
          ) : (
            <Login onLogin={handleLogin} forcedMode="attendance" />
          )
        }
      />
      <Route path="*" element={<Navigate to={ATTENDANCE_LOGIN_PATH} replace />} />
    </Routes>
  );
}
