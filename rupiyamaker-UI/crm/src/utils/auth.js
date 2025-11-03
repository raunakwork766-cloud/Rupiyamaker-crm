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
 * @returns {Promise<Object>} - Object with { valid: boolean, shouldLogout: boolean, reason?: string }
 */
export const verifySession = async () => {
  try {
    const userData = getCurrentUser();
    if (!userData || !userData._id) {
      return { valid: false, shouldLogout: true, reason: 'No user data found' };
    }

    // Use GET /users endpoint which returns complete user data including login_enabled
    // Then find the specific user in the response
    const response = await fetchWithAuth(`${API_BASE_URL}/users`, {
      method: 'GET'
    });

    if (response.ok) {
      const users = await response.json();
      
      // Find the current user in the users list
      const user = users.find(u => u._id === userData._id);
      
      if (!user) {
        clearAuthData();
        return { valid: false, shouldLogout: true, reason: 'User not found in database' };
      }
      
      // Check the same conditions as verify-session would
      // Now we can get the actual login_enabled value from the API
      const isActive = user.is_active !== undefined ? user.is_active : true;
      const loginEnabled = user.login_enabled !== undefined ? user.login_enabled : false;
      
      // If user is inactive or login is disabled, session is invalid
      if (!isActive) {
        clearAuthData();
        return { valid: false, shouldLogout: true, reason: 'User account has been deactivated' };
      }
      
      if (!loginEnabled) {
        clearAuthData();
        return { valid: false, shouldLogout: true, reason: 'Your login access has been disabled by administrator' };
      }
      
      // Session is valid
      return { valid: true, shouldLogout: false };
    } else if (response.status === 404) {
      // User not found, clear auth data
      clearAuthData();
      return { valid: false, shouldLogout: true, reason: 'User not found' };
    } else if (response.status === 401 || response.status === 403) {
      // Unauthorized or forbidden, clear auth data
      clearAuthData();
      return { valid: false, shouldLogout: true, reason: 'Session expired or unauthorized' };
    } else {
      // Other HTTP errors (5xx, etc.) - don't logout, just return invalid
      return { valid: false, shouldLogout: false, reason: `Server error: ${response.status}` };
    }
  } catch (error) {
    // Network error, timeout, or other connection issues - don't logout
    console.warn('Session verification failed due to network error:', error.message);
    return { valid: false, shouldLogout: false, reason: `Network error: ${error.message}` };
  }
};

/**
 * Force logout - clears all auth data and redirects to login
 */
export const forceLogout = (reason = 'Session expired') => {
  clearAuthData();
  
  // Show a message to the user
  if (typeof window !== 'undefined') {
    // Use a more prominent alert method
    if (window.confirm) {
      window.confirm(`${reason}. Click OK to go to login page.`);
    } else if (window.alert) {
      window.alert(`${reason}. Please log in again.`);
    }
    
    // Force reload to login page to ensure complete logout
    window.location.href = '/';
    window.location.reload();
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
