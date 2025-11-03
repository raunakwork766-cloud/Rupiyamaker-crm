/**
 * Date utility functions for formatting and calculations
 * Using native Date methods to avoid dependencies
 */

/**
 * Format a date string or timestamp to a readable format
 * @param {string|Date} date - Date to format
 * @param {string} format - Output format (default: "DD Month YYYY")
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'DD-MONTH-YYYY') => {
    if (!date) return '-';

    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';

        // Convert to IST (Indian Standard Time) - UTC+5:30
        const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
        const istDate = new Date(d.getTime() + istOffset);

        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const day = istDate.getUTCDate().toString().padStart(2, '0');
        const month = months[istDate.getUTCMonth()];
        const year = istDate.getUTCFullYear();

        return `${day} ${month} ${year}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return '-';
    }
};

/**
 * Get relative time (e.g., "2 days ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date) => {
    if (!date) return '-';

    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';

        const now = new Date();
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffDay / 365);

        if (diffSec < 60) return 'just now';
        if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
        if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
        if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
        return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
    } catch (error) {
        console.error('Error calculating relative time:', error);
        return '-';
    }
};

/**
 * Format a date string or timestamp with time
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (date) => {
    if (!date) return '-';

    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';

        // Convert to IST (Indian Standard Time) - UTC+5:30
        const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
        const istDate = new Date(d.getTime() + istOffset);

        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const day = istDate.getUTCDate().toString().padStart(2, '0');
        const month = months[istDate.getUTCMonth()];
        const year = istDate.getUTCFullYear();
        
        // Format time in 12-hour format with AM/PM using IST
        let hours = istDate.getUTCHours();
        const minutes = istDate.getUTCMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'

        return `${day} ${month} ${year} ${hours}:${minutes} ${ampm}`;
    } catch (error) {
        console.error('Error formatting date time:', error);
        return '-';
    }
};

/**
 * Check if a date is in the past
 * @param {string|Date} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export const isPast = (date) => {
    if (!date) return false;

    try {
        const d = new Date(date);
        return d < new Date();
    } catch (error) {
        console.error('Error checking if date is past:', error);
        return false;
    }
};

/**
 * Calculate age from a birth date
 * @param {string|Date} birthDate - Date of birth
 * @returns {number} Age in years
 */
export const calculateAge = (birthDate) => {
    if (!birthDate) return null;

    try {
        const birth = new Date(birthDate);
        if (isNaN(birth.getTime())) return null;

        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }

        return age;
    } catch (error) {
        console.error('Error calculating age:', error);
        return null;
    }
};

/**
 * Calculate duration between two dates in specified unit
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date (defaults to now if not provided)
 * @param {string} unit - Unit for duration (days, months, years)
 * @returns {number} Duration in the specified unit
 */
export const calculateDuration = (startDate, endDate = null, unit = 'days') => {
    if (!startDate) return null;

    try {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) return null;

        const end = endDate ? new Date(endDate) : new Date();
        if (isNaN(end.getTime())) return null;

        const diffMs = end - start;

        switch (unit) {
            case 'days':
                return Math.floor(diffMs / (1000 * 60 * 60 * 24));
            case 'months': {
                const months = (end.getFullYear() - start.getFullYear()) * 12;
                return months + (end.getMonth() - start.getMonth());
            }
            case 'years':
                return end.getFullYear() - start.getFullYear();
            default:
                return Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
    } catch (error) {
        console.error('Error calculating duration:', error);
        return null;
    }
};

/**
 * ============================================
 * IST (Indian Standard Time) Utility Functions
 * Timezone: Asia/Kolkata (UTC+5:30)
 * ============================================
 */

const IST_TIMEZONE = 'Asia/Kolkata';
const IST_LOCALE = 'en-IN';

/**
 * Format date to IST locale string with full date and time
 * @param {Date|string} date - Date object or ISO string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string in IST
 */
export const toISTString = (date, options = {}) => {
  if (!date) return '-';
  
  const defaultOptions = {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    ...options
  };
  
  return new Date(date).toLocaleString(IST_LOCALE, defaultOptions);
};

/**
 * Format date to IST date string (no time)
 * @param {Date|string} date - Date object or ISO string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string in IST
 */
export const toISTDateString = (date, options = {}) => {
  if (!date) return '-';
  
  const defaultOptions = {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };
  
  return new Date(date).toLocaleDateString(IST_LOCALE, defaultOptions);
};

/**
 * Format time to IST time string (no date)
 * @param {Date|string} date - Date object or ISO string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted time string in IST
 */
export const toISTTimeString = (date, options = {}) => {
  if (!date) return '-';
  
  const defaultOptions = {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  };
  
  return new Date(date).toLocaleTimeString(IST_LOCALE, defaultOptions);
};

/**
 * Get current IST date object
 * @returns {Date} Current date in IST
 */
export const getCurrentISTDate = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: IST_TIMEZONE }));
};

/**
 * Convert any date to IST Date object
 * @param {Date|string} date - Date object or ISO string
 * @returns {Date} Date object converted to IST
 */
export const toISTDate = (date) => {
  if (!date) return null;
  return new Date(new Date(date).toLocaleString('en-US', { timeZone: IST_TIMEZONE }));
};

// Export timezone constants
export const TIMEZONE_IST = IST_TIMEZONE;
export const LOCALE_IST = IST_LOCALE;

export default {
    formatDate,
    getRelativeTime,
    formatDateTime,
    isPast,
    calculateAge,
    calculateDuration,
    toISTString,
    toISTDateString,
    toISTTimeString,
    getCurrentISTDate,
    toISTDate,
    TIMEZONE_IST,
    LOCALE_IST
};
