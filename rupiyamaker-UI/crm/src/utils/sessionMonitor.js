/**
 * Session monitoring utility for handling login_enabled toggle
 * This checks periodically if the user's login status has been disabled
 * 
 * ULTRA-AGGRESSIVE: Now checks session in multiple scenarios:
 * 1. Every 1 SECOND (timer-based) - AGGRESSIVE!
 * 2. When page regains focus (user comes back to tab)
 * 3. When page becomes visible (tab switching)
 * 4. When user interacts with page (click, keypress)
 * 5. RequestAnimationFrame loop (prevents browser throttling)
 */

import { verifySession, forceLogout, isAuthenticated } from './auth';

class SessionMonitor {
  constructor() {
    this.intervalId = null;
    this.animationFrameId = null; // For requestAnimationFrame loop
    this.checkInterval = 30000; // Check every 30 seconds (reasonable for session monitoring)
    this.isRunning = false;
    this.logoutCallback = null; // Callback to notify app of logout
    this.lastCheckTime = 0; // Track last check to prevent duplicate checks
    this.minTimeBetweenChecks = 500; // Minimum 500ms between event-triggered checks
    this.lastAnimationCheck = 0; // Track animation frame checks
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

    // 🔥 NEW: Animation frame loop to prevent browser throttling
    // This ensures checks continue even when tab is "inactive" but visible
    this.startAnimationLoop();

    // 🔥 Check when page regains focus (user returns to tab)
    window.addEventListener('focus', this.handleFocus);
    
    // 🔥 Check when page becomes visible (tab switching)
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // 🔥 Check on user interaction (click anywhere)
    document.addEventListener('click', this.handleUserInteraction);
    
    // 🔥 Check on keypress (user typing)
    document.addEventListener('keydown', this.handleUserInteraction);

    console.log('🔒 Session monitoring started (30-second interval checks)');
  }

  /**
   * Animation frame loop - prevents browser throttling
   */
  startAnimationLoop = () => {
    const loop = () => {
      if (!this.isRunning) return;

      const now = Date.now();
      // Check every 1 second via animation frame (backup to setInterval)
      if (now - this.lastAnimationCheck >= this.checkInterval) {
        this.lastAnimationCheck = now;
        this.checkSession();
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };
    
    loop();
  }

  /**
   * Stop animation loop
   */
  stopAnimationLoop = () => {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
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
   * Handle user interaction (click, keypress)
   */
  handleUserInteraction = () => {
    // Only check if enough time has passed since last check
    const now = Date.now();
    if (now - this.lastCheckTime >= this.minTimeBetweenChecks) {
      console.log('🔍 User interaction detected - checking session');
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
    
    // Stop animation loop
    this.stopAnimationLoop();
    
    // Remove event listeners
    window.removeEventListener('focus', this.handleFocus);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    document.removeEventListener('click', this.handleUserInteraction);
    document.removeEventListener('keydown', this.handleUserInteraction);
    
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

    // Prevent duplicate checks within 1 second
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
