/**
 * CRM vs attendance auth are isolated:
 * - CRM → localStorage (shared across tabs — one desktop session)
 * - Attendance → sessionStorage (per tab — phone check-in without touching CRM tab)
 */
import { ATTENDANCE_LOGIN_PATH } from './loginMode';

export function isAttendanceRoute(pathname = '') {
  return (
    pathname === ATTENDANCE_LOGIN_PATH ||
    pathname.startsWith(`${ATTENDANCE_LOGIN_PATH}/`)
  );
}

const ATTENDANCE_ONLY_LOCAL_KEYS = [
  'attendanceToken',
  'attendanceUserId',
  'attendanceUserData',
];

/**
 * Clean legacy attendance data from localStorage without touching an active CRM session.
 * BUG FIX: previously this wiped userData/isAuthenticated on every CRM navigation → instant logout.
 */
export function scrubAttendanceFromLocalStorage() {
  try {
    const loginType = localStorage.getItem('loginType');
    if (loginType === 'attendance_only') {
      // Legacy: attendance session was incorrectly stored in localStorage
      [...ATTENDANCE_ONLY_LOCAL_KEYS, 'loginType', 'userData', 'user', 'userId', 'user_id', 'isAuthenticated'].forEach(
        (key) => localStorage.removeItem(key)
      );
      return;
    }
    // CRM session active — only remove stray attendance-specific keys
    ATTENDANCE_ONLY_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch (_) { /* ignore */ }
}

export function getAttendanceTabSession() {
  try {
    if (sessionStorage.getItem('loginType') !== 'attendance_only') {
      return null;
    }
    const raw = sessionStorage.getItem('userData') || sessionStorage.getItem('attendanceUserData');
    if (!raw || sessionStorage.getItem('isAuthenticated') !== 'true') {
      return null;
    }
    const user = JSON.parse(raw);
    return {
      user,
      loginType: 'attendance_only',
      token: sessionStorage.getItem('attendanceToken'),
    };
  } catch (_) {
    return null;
  }
}

export function getCrmSession() {
  try {
    const loginType = localStorage.getItem('loginType');
    if (loginType === 'attendance_only') {
      return null;
    }
    if (localStorage.getItem('isAuthenticated') !== 'true') {
      return null;
    }
    const raw = localStorage.getItem('userData') || localStorage.getItem('user');
    if (!raw) {
      return null;
    }
    const user = JSON.parse(raw);
    return { user, loginType: loginType || 'crm', token: localStorage.getItem('sessionToken') || localStorage.getItem('token') };
  } catch (_) {
    return null;
  }
}

/**
 * Auth for the current URL — attendance routes never read CRM localStorage.
 */
export function resolveAuthForPath(pathname = '') {
  if (isAttendanceRoute(pathname)) {
    const att = getAttendanceTabSession();
    return {
      scope: 'attendance',
      isAuthenticated: !!att,
      user: att?.user ?? null,
      loginType: att?.loginType ?? null,
    };
  }
  const crm = getCrmSession();
  return {
    scope: 'crm',
    isAuthenticated: !!crm,
    user: crm?.user ?? null,
    loginType: crm?.loginType ?? null,
  };
}

export function persistAttendanceSession({ user, sessionToken }) {
  scrubAttendanceFromLocalStorage();
  const uid = user._id || user.id;
  const minimalUser = {
    _id: uid,
    id: uid,
    user_id: uid,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    email: user.email,
    profile_photo: user.profile_photo,
    employee_id: user.employee_id,
  };
  const minimalStr = JSON.stringify(minimalUser);
  sessionStorage.setItem('loginType', 'attendance_only');
  sessionStorage.setItem('attendanceToken', sessionToken);
  sessionStorage.setItem('attendanceUserId', uid);
  sessionStorage.setItem('userId', uid);
  sessionStorage.setItem('user_id', uid);
  sessionStorage.setItem('isAuthenticated', 'true');
  sessionStorage.setItem('userData', minimalStr);
  sessionStorage.setItem('user', minimalStr);
  sessionStorage.setItem('attendanceUserData', minimalStr);
}

export function clearAttendanceTabSession() {
  try {
    ['loginType', 'attendanceToken', 'attendanceUserId', 'attendanceUserData', 'userData', 'user', 'userId', 'user_id', 'isAuthenticated'].forEach(
      (key) => sessionStorage.removeItem(key)
    );
  } catch (_) { /* ignore */ }
  scrubAttendanceFromLocalStorage();
}

export function clearCrmSession() {
  try {
    localStorage.clear();
  } catch (_) { /* ignore */ }
}

/** Headers for attendance API calls in the attendance tab. */
export function getAttendanceAuthHeaders() {
  if (typeof window === 'undefined') return {};
  if (sessionStorage.getItem('loginType') === 'attendance_only') {
    const tok = sessionStorage.getItem('attendanceToken');
    if (tok) return { 'X-Attendance-Token': tok };
  }
  return {};
}
