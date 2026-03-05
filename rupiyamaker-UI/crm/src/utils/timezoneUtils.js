// Timezone Utilities for Indian Standard Time (IST)
// All functions use Intl.DateTimeFormat with Asia/Kolkata timezone
// for correct IST display regardless of server/browser timezone

const IST_TZ = 'Asia/Kolkata';

/**
 * Convert a date to IST Date object
 * Uses toLocaleString trick to get IST-adjusted Date object
 * @param {string|Date} dateString - Any timestamp
 * @returns {Date} - Date object representing IST time
 */
export const convertToIST = (dateString) => {
  if (!dateString) return null;

  const date = new Date(dateString);

  // Check if date is valid
  if (isNaN(date.getTime())) return null;

  // Convert to IST using Intl API
  return new Date(date.toLocaleString('en-US', { timeZone: IST_TZ }));
};

/**
 * Format date in IST
 * @param {string|Date} dateString - Any timestamp
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string in IST
 */
export const formatDateIST = (dateString, options = {}) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const defaultOptions = {
    timeZone: IST_TZ,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...options
  };

  return date.toLocaleDateString('en-IN', defaultOptions);
};

/**
 * Format time in IST
 * @param {string|Date} dateString - Any timestamp
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted time string in IST
 */
export const formatTimeIST = (dateString, options = {}) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const defaultOptions = {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  };

  return date.toLocaleTimeString('en-IN', defaultOptions);
};

/**
 * Format full date and time in IST
 * @param {string|Date} dateString - Any timestamp
 * @returns {string} - Formatted date and time string in IST
 */
export const formatDateTimeIST = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const dateStr = date.toLocaleDateString('en-IN', {
    timeZone: IST_TZ,
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const timeStr = date.toLocaleTimeString('en-IN', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return `${dateStr} at ${timeStr}`;
};

/**
 * Format short date in IST (DD/MM/YYYY)
 * @param {string|Date} dateString - Any timestamp
 * @returns {string} - Formatted short date string in IST
 */
export const formatShortDateIST = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-IN', {
    timeZone: IST_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Get current IST date/time
 * @returns {Date} - Current date in IST
 */
export const getCurrentIST = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: IST_TZ }));
};

/**
 * Check if a date is today in IST
 * @param {string|Date} dateString - Any timestamp
 * @returns {boolean}
 */
export const isToday = (dateString) => {
  const istDate = convertToIST(dateString);
  const today = getCurrentIST();

  if (!istDate) return false;

  return istDate.toDateString() === today.toDateString();
};

/**
 * Get relative time string (e.g., "2 hours ago", "Just now")
 * @param {string|Date} dateString - Any timestamp
 * @returns {string}
 */
export const getRelativeTimeIST = (dateString) => {
  const istDate = convertToIST(dateString);
  const now = getCurrentIST();

  if (!istDate) return '';

  const diffMs = now - istDate;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return formatDateIST(dateString);
};

