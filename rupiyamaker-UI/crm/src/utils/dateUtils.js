/**
 * Format a date string or timestamp to a readable format
 * Uses Intl.DateTimeFormat with Asia/Kolkata timezone for correct IST display
 * @param {string|Date} date - Date to format  
 * @param {string} format - Output format (default: "DD-MONTH-YYYY")
 * @returns {string} Formatted date string in IST
 */
export const formatDate = (date, format = 'DD-MONTH-YYYY') => {
    if (!date) return '-';

    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';

        // Use Intl.DateTimeFormat with Asia/Kolkata timezone for correct IST
        const formatter = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'long',
            day: '2-digit'
        });

        const parts = formatter.formatToParts(d);
        const day = parts.find(p => p.type === 'day')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const year = parts.find(p => p.type === 'year')?.value || '';

        return `${day} ${month} ${year}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return '-';
    }
};

/**
 * Get relative time (e.g., "2 days ago")
 * Uses IST for current time comparison
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date) => {
    if (!date) return '-';

    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';

        // Use IST-aware current time for comparison
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const target = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

        const diffMs = now - target;
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
 * Uses Intl.DateTimeFormat with Asia/Kolkata timezone for correct IST display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date and time in IST
 */
export const formatDateTime = (date) => {
    if (!date) return '-';

    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';

        // Use Intl.DateTimeFormat with Asia/Kolkata timezone
        const formatter = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'long',
            day: '2-digit',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const parts = formatter.formatToParts(d);
        const day = parts.find(p => p.type === 'day')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const year = parts.find(p => p.type === 'year')?.value || '';
        const hour = parts.find(p => p.type === 'hour')?.value || '';
        const minute = parts.find(p => p.type === 'minute')?.value || '';
        const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || '';

        return `${day} ${month} ${year} ${hour}:${minute} ${dayPeriod.toUpperCase()}`;
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
    // Use Intl.DateTimeFormat.formatToParts for reliable IST extraction.
    // The toLocaleString→new Date() round-trip is unreliable across browser timezones.
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: IST_TIMEZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(now);
    const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
    // hour12:false can give 24 for midnight; normalise with % 24
    return new Date(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
};

/**
 * Convert any date to IST Date object
 * @param {Date|string} date - Date object or ISO string
 * @returns {Date} Date object converted to IST
 */
export const toISTDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: IST_TIMEZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(d);
    const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
    return new Date(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
};

// Export timezone constants
export const TIMEZONE_IST = IST_TIMEZONE;
export const LOCALE_IST = IST_LOCALE;

/**
 * Get current IST date as YYYY-MM-DD string
 * Drop-in replacement for new Date().toISOString().split('T')[0]
 * @returns {string} e.g. "2026-02-27"
 */
export const getISTDateYMD = () => {
    // en-CA locale outputs YYYY-MM-DD directly; timeZone ensures IST calendar date
    return new Date().toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
};

/**
 * Convert any date/string to YYYY-MM-DD in IST
 * Drop-in replacement for new Date(val).toISOString().split('T')[0]
 * @param {Date|string} date
 * @returns {string} e.g. "2026-02-27"
 */
export const toISTDateYMD = (date) => {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        // en-CA locale outputs YYYY-MM-DD; timeZone converts to IST calendar date
        return d.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
    } catch {
        return '';
    }
};

/**
 * Get current IST datetime as ISO-like string (for sending to backend)
 * Drop-in replacement for new Date().toISOString()
 * Returns format: "2026-02-27T14:30:00" (IST, no Z suffix)
 * @returns {string}
 */
export const getISTTimestamp = () => {
    const d = getCurrentISTDate();
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${day}T${h}:${mi}:${s}`;
};

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
    getISTDateYMD,
    toISTDateYMD,
    getISTTimestamp,
    TIMEZONE_IST,
    LOCALE_IST
};
