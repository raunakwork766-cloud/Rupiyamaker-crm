/**
 * Authentication utilities for API calls and user management
 */

// API base URL - Use proxy path in development to avoid CORS and SSL issues
const API_BASE_URL = '/api'; // Always use proxy

/**
 * Helper function for API calls with proper headers and authentication
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - The fetch response
 */
export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  // Check if the body is FormData to handle file uploads correctly
  const isFormData = options.body instanceof FormData;
  
  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${token}`,
      // Only set Content-Type for non-FormData requests
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      // The following headers help with CORS issues
      'Accept': 'application/json',
      'Origin': window.location.origin
    },
  };

  // Merge default options with provided options
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {})
    }
  };

  try {
    // Add retry logic with exponential backoff
    let retries = 3;
    let delay = 500; // Start with 500ms delay
    let lastError = null;

    while (retries > 0) {
      try {
        const response = await fetch(url, mergedOptions);
        
        // If successful, return the response
        if (response.ok || response.status < 500) {
          return response;
        }
        
        // If it's a server error, retry
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
      } catch (error) {
        lastError = error;
        retries--;
        
        if (retries === 0) {
          throw lastError;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
    
  } catch (error) {
    throw error;
  }
};

/**
 * Get the current user's ID from localStorage
 * @returns {string|null} - The user ID or null if not found
 */
export const getCurrentUserId = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { user_id } = JSON.parse(userData);
      return user_id;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Get the current user's data from localStorage
 * @returns {Object|null} - The user data object or null if not found
 */
export const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Check if user is authenticated
 * @returns {boolean} - Whether the user is authenticated
 */
export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('userData');
  return !!(token && userData);
};

/**
 * Clear authentication data from localStorage
 */
export const clearAuthData = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userData');
  localStorage.removeItem('isAuthenticated');
};

/**
 * Set authentication data in localStorage
 * @param {string} token - The authentication token
 * @param {Object} userData - The user data object
 */
export const setAuthData = (token, userData) => {
  localStorage.setItem('token', token);
  localStorage.setItem('userData', JSON.stringify(userData));
  localStorage.setItem('isAuthenticated', 'true');
};

/**
 * Verify if the current session is still valid
 * Uses POST /users/verify-session with session_token for single-active-session enforcement.
 * @returns {Promise<Object>} - Object with { valid: boolean, shouldLogout: boolean, reason?: string }
 */
export const verifySession = async () => {
  try {
    const userData = getCurrentUser();
    const userId = localStorage.getItem('userId') || localStorage.getItem('user_id') || userData?._id;
    if (!userId) {
      return { valid: false, shouldLogout: true, reason: 'No user data found' };
    }

    const sessionToken = localStorage.getItem('sessionToken');

    // Use POST /users/verify-session so backend can validate the session_token.
    // If another device logged in, their new token replaced ours in DB → 401 displaced.
    const response = await fetchWithAuth(`${API_BASE_URL}/users/verify-session`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, session_token: sessionToken })
    });

    if (response.ok) {
      return { valid: true, shouldLogout: false };
    } else if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.detail || '';
      const isDisplaced = detail === 'displaced' || detail.includes('displaced') || detail.includes('another device');
      clearAuthData();
      localStorage.removeItem('sessionToken');
      return {
        valid: false,
        shouldLogout: true,
        reason: isDisplaced
          ? 'Aapki ID se kisi aur device par login hua hai. Aap logout ho gaye hain.'
          : (detail || 'Session expired or unauthorized')
      };
    } else if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.detail || 'Session expired';
      clearAuthData();
      localStorage.removeItem('sessionToken');
      return { valid: false, shouldLogout: true, reason: detail };
    } else if (response.status === 404) {
      clearAuthData();
      localStorage.removeItem('sessionToken');
      return { valid: false, shouldLogout: true, reason: 'User not found' };
    } else {
      // Server errors (5xx) — don't logout, could be temporary
      return { valid: false, shouldLogout: false, reason: `Server error: ${response.status}` };
    }
  } catch (error) {
    // Network error or timeout — don't logout, could be temporary
    console.warn('Session verification failed due to network error:', error.message);
    return { valid: false, shouldLogout: false, reason: `Network error: ${error.message}` };
  }
};

/**
 * Force logout - clears all auth data and redirects to login.
 * Stores the reason in sessionStorage so Login page can display it.
 */
export const forceLogout = (reason = 'Session expired') => {
  clearAuthData();
  localStorage.removeItem('sessionToken');

  if (typeof window !== 'undefined') {
    // Pass reason to Login page without blocking confirm dialog
    sessionStorage.setItem('logoutReason', reason);
    window.location.href = '/';
  }
};

/**
 * Event emitter for real-time updates across components
 */
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(data));
  }
}

/**
 * Global event emitter for lead creation events
 * Used to notify LeadCRM component when a new lead is created
 */
export const leadEvents = new EventEmitter();
