// Timezone Utilities for Indian Standard Time (IST)
// IST is UTC+05:30

/**
 * Convert UTC timestamp to IST by adding 5 hours 30 minutes
 * @param {string|Date} utcDateString - UTC timestamp
 * @returns {Date} - Date object in IST
 */
export const convertToIST = (utcDateString) => {
  if (!utcDateString) return null;
  
  const date = new Date(utcDateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) return null;
  
  // IST is UTC + 5:30
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  return new Date(date.getTime() + istOffset);
};

/**
 * Format date in IST
 * @param {string|Date} utcDateString - UTC timestamp
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
export const formatDateIST = (utcDateString, options = {}) => {
  const istDate = convertToIST(utcDateString);
  
  if (!istDate) return '';
  
  const defaultOptions = {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...options
  };
  
  return istDate.toLocaleDateString('en-IN', defaultOptions);
};

/**
 * Format time in IST
 * @param {string|Date} utcDateString - UTC timestamp
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted time string
 */
export const formatTimeIST = (utcDateString, options = {}) => {
  const istDate = convertToIST(utcDateString);
  
  if (!istDate) return '';
  
  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  };
  
  return istDate.toLocaleTimeString('en-IN', defaultOptions);
};

/**
 * Format full date and time in IST
 * @param {string|Date} utcDateString - UTC timestamp
 * @returns {string} - Formatted date and time string
 */
export const formatDateTimeIST = (utcDateString) => {
  const istDate = convertToIST(utcDateString);
  
  if (!istDate) return '';
  
  const date = istDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  
  const time = istDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  return `${date} at ${time}`;
};

/**
 * Format short date in IST (DD/MM/YYYY)
 * @param {string|Date} utcDateString - UTC timestamp
 * @returns {string} - Formatted short date string
 */
export const formatShortDateIST = (utcDateString) => {
  const istDate = convertToIST(utcDateString);
  
  if (!istDate) return '';
  
  return istDate.toLocaleDateString('en-IN', {
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
  return convertToIST(new Date().toISOString());
};

/**
 * Check if a date is today in IST
 * @param {string|Date} utcDateString - UTC timestamp
 * @returns {boolean}
 */
export const isToday = (utcDateString) => {
  const istDate = convertToIST(utcDateString);
  const today = getCurrentIST();
  
  if (!istDate) return false;
  
  return istDate.toDateString() === today.toDateString();
};

/**
 * Get relative time string (e.g., "2 hours ago", "Just now")
 * @param {string|Date} utcDateString - UTC timestamp
 * @returns {string}
 */
export const getRelativeTimeIST = (utcDateString) => {
  const istDate = convertToIST(utcDateString);
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
  
  return formatDateIST(utcDateString);
};
