/** Canonical login entry points — keep CRM and attendance strictly separated. */
export const CRM_LOGIN_PATH = '/login';
export const ATTENDANCE_LOGIN_PATH = '/attendance-login';

/**
 * Resolve which login flow to use. URL is the source of truth (never sessionStorage).
 * @param {{ pathname?: string, search?: string, forcedMode?: 'crm'|'attendance'|null }} ctx
 * @returns {'crm'|'attendance'}
 */
export function resolveLoginMode({ pathname = '', search = '', forcedMode = null } = {}) {
  if (forcedMode === 'crm' || forcedMode === 'attendance') {
    return forcedMode;
  }
  if (
    pathname === ATTENDANCE_LOGIN_PATH ||
    pathname.startsWith(`${ATTENDANCE_LOGIN_PATH}/`)
  ) {
    return 'attendance';
  }
  if (new URLSearchParams(search).get('mode') === 'attendance') {
    return 'attendance';
  }
  return 'crm';
}

export function isAttendanceLoginMode(ctx) {
  return resolveLoginMode(ctx) === 'attendance';
}

export function clearLegacyAttendanceLoginFlags() {
  try {
    sessionStorage.removeItem('attendanceLoginPending');
  } catch (_) { /* ignore */ }
}
