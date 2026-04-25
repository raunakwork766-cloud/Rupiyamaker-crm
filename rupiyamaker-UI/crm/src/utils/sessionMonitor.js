/**
 * Session monitoring utility for handling login_enabled toggle.
 * Uses conservative checks to avoid request storms and UI churn during auth hydration.
 */

import { verifySession, forceLogout, isAuthenticated } from './auth';

class SessionMonitor {
  constructor() {
    this.intervalId = null;
    this.checkInterval = 10000; // Check every 10 seconds
    this.isRunning = false;
    this.logoutCallback = null; // Callback to notify app of logout
    this.lastCheckTime = 0; // Track last check to prevent duplicate checks
    this.minTimeBetweenChecks = 5000; // Debounce event-triggered checks
  }

  /**
   * Set callback function to be called when user is logged out
   * @param {Function} callback - Function to call on logout
   */
  setLogoutCallback(callback) {
    this.logoutCallback = callback;
  }

  /**
   * Start monitoring session validity
   */
  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Check immediately
    this.checkSession();

    // Set up periodic checks (primary method)
    this.intervalId = setInterval(() => {
      this.checkSession();
    }, this.checkInterval);

    // Check when page regains focus (user returns to tab)
    window.addEventListener('focus', this.handleFocus);

    // Check when page becomes visible (tab switching)
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    console.log('🔒 Session monitoring started (conservative mode)');
  }


  /**
   * Handle window focus event
   */
  handleFocus = () => {
    console.log('🔍 Window focused - checking session');
    this.checkSession();
  }

  /**
   * Handle visibility change (tab switching)
   */
  handleVisibilityChange = () => {
    if (!document.hidden) {
      console.log('🔍 Page visible - checking session');
      this.checkSession();
    }
  }


  /**
   * Stop monitoring session validity
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Remove event listeners
    window.removeEventListener('focus', this.handleFocus);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    this.isRunning = false;
    console.log('🔒 Session monitoring stopped');
  }

  /**
   * Check if session is still valid
   */
  async checkSession() {
    // Only check if user is authenticated
    if (!isAuthenticated()) {
      return;
    }

    // 📱 Skip CRM session checks for attendance-only sessions.
    // Attendance sessions use a separate token (attendance_session_token) and
    // are not tracked in active_session_token, so verify-session would always
    // think they're "displaced". The backend middleware enforces scope instead.
    if (typeof window !== 'undefined' && localStorage.getItem('loginType') === 'attendance_only') {
      return;
    }

    // Prevent duplicate checks within debounce window
    const now = Date.now();
    if (now - this.lastCheckTime < this.minTimeBetweenChecks) {
      return;
    }
    this.lastCheckTime = now;

    try {
      const sessionResult = await verifySession();
      
      // Only logout if the API was successfully hit and indicates we should logout
      if (!sessionResult.valid && sessionResult.shouldLogout) {
        console.log('⚠️ Session invalidated, reason:', sessionResult.reason);
        this.stop();
        
        // Call the logout callback if set (to update app state)
        if (this.logoutCallback) {
          this.logoutCallback();
        }
        
        // Force logout with the specific reason
        forceLogout(sessionResult.reason || 'Your session is no longer valid');
      } else if (!sessionResult.valid) {
        // Session check failed but we shouldn't logout (network error, timeout, etc.)
        console.warn('Session check failed but not logging out, reason:', sessionResult.reason);
      } else {
        // Session is valid, continue monitoring
        console.log('✅ Session is valid, continuing monitoring');
      }
    } catch (error) {
      // This shouldn't happen with the new verifySession implementation,
      // but if it does, don't force logout - just log the error
      console.warn('Unexpected error during session check:', error.message);
    }
  }

  /**
   * Set the check interval
   * @param {number} interval - Interval in milliseconds
   */
  setInterval(interval) {
    this.checkInterval = interval;
    
    // Restart with new interval if running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

// Create singleton instance
const sessionMonitor = new SessionMonitor();

export default sessionMonitor;

// Export functions for convenience
export const startSessionMonitoring = () => sessionMonitor.start();
export const stopSessionMonitoring = () => sessionMonitor.stop();
export const setSessionCheckInterval = (interval) => sessionMonitor.setInterval(interval);
export const setSessionLogoutCallback = (callback) => sessionMonitor.setLogoutCallback(callback);
