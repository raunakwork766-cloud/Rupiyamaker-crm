/**
 * Cross-device robust Geolocation and In-App Browser detection utility.
 * Fixed for iOS Safari where:
 *   1. permission.query is unreliable
 *   2. getCurrentPosition can timeout even with permission granted (GPS cold start)
 *   3. maximumAge: 0 forces a cold GPS fix which can take 30+ seconds on iOS
 */

export const isInAppBrowser = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  return (
    (ua.indexOf("FBAN") > -1) ||
    (ua.indexOf("FBAV") > -1) ||
    (ua.indexOf("Instagram") > -1) ||
    (ua.indexOf("WhatsApp") > -1) ||
    (ua.indexOf("Telegram") > -1) ||
    (ua.indexOf("Messenger") > -1) ||
    (ua.indexOf("Snapchat") > -1) ||
    (ua.indexOf("Line") > -1) ||
    (ua.indexOf("GSA") > -1) || // Google Search App on iOS
    (ua.indexOf("Version/4.0") > -1 && ua.indexOf("Chrome") > -1) ||
    /wv|WebView/i.test(ua)
  );
};

export const getAndroidChromeIntentUrl = () => {
  if (typeof window === 'undefined') return '';
  const url = window.location.href.replace(/^https?:\/\//, '');
  return `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
};

/**
 * Detect if running on iOS (iPhone/iPad/iPod)
 */
const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
};

/**
 * Detect if running on iOS Safari (not Chrome/other browsers on iOS)
 */
const isIOSSafari = () => {
  if (!isIOS()) return false;
  const ua = navigator.userAgent || '';
  // Chrome on iOS has "CriOS", Firefox has "FxiOS"
  return !(/CriOS|FxiOS|OPiOS|mercury/i.test(ua));
};

/**
 * Check if the site is served over HTTPS (required for geolocation on most browsers)
 */
const isHTTPS = () => {
  if (typeof window === 'undefined') return true;
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
};

/**
 * Single geolocation attempt with given options
 */
const tryGetPosition = (options) => new Promise((resolve, reject) =>
  navigator.geolocation.getCurrentPosition(resolve, reject, options)
);

/**
 * Main cross-device location function.
 * 
 * iOS Safari fix strategy:
 *  - Allow maximumAge: 30000 so iOS can return a cached position quickly
 *    (avoids cold-start GPS delay which causes timeout errors on fresh fixes)
 *  - Use long timeouts (25s, 35s) for the actual GPS fix attempts
 *  - Only treat error.code === 1 (PERMISSION_DENIED) as "LOCATION_BLOCKED"
 *  - Treat code 2/3 as "GPS unavailable / timeout" with a helpful retry message
 *    (NOT as permission denied — user may have permission but GPS signal is weak)
 */
export const getLocationCrossDevice = () => new Promise(async (resolve, reject) => {
  const fail = (msg, code = 'UNKNOWN') => {
    const e = new Error(msg);
    e.userMessage = msg;
    e.code = code;
    reject(e);
  };

  // Check HTTPS first — Safari blocks geolocation on HTTP
  if (!isHTTPS()) {
    return fail('HTTPS_REQUIRED', 'HTTPS_REQUIRED');
  }

  if (typeof window === 'undefined' || !navigator.geolocation) {
    return fail(
      'Your browser/device does not support location. Please use Chrome or Safari on your phone.',
      'NOT_SUPPORTED'
    );
  }

  const ios = isIOSSafari();

  const toCoords = (pos) => ({
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  });

  if (ios) {
    // ── iOS Safari Flow ─────────────────────────────────────────────────────
    // 
    // KEY FIX: Use maximumAge: 30000 (allow 30s old cached position).
    // iOS Safari's cold GPS fix can take 20-40 seconds. With maximumAge: 0,
    // it always does a cold fix → timeout errors even with permission granted.
    // With maximumAge: 30000, it returns last known position quickly if available.
    //
    // Attempt 1: High accuracy, allow cached position up to 30s old
    try {
      const pos = await tryGetPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 30000,
      });
      return resolve(toCoords(pos));
    } catch (err1) {
      console.warn("iOS Geolocation Attempt 1 failed:", err1);
    }

    // Attempt 2: Low accuracy (network/WiFi based), allow older cached position
    try {
      const pos = await tryGetPosition({
        enableHighAccuracy: false,
        timeout: 25000,
        maximumAge: 60000,
      });
      return resolve(toCoords(pos));
    } catch (err2) {
      if (err2.code === 1) {
        return fail('LOCATION_BLOCKED', 'PERMISSION_DENIED');
      }
      // code 2/3: NOT a permission issue — GPS or WiFi signal issue
      // Show retry message (NOT the "go to Settings" blocked modal)
      if (err2.code === 3) {
        return fail(
          '📍 Location timed out. GPS is slow — please step outside or enable WiFi and tap Retry.\n(GPS धीमा है — बाहर जाएं या WiFi चालू करें और Retry करें)',
          'TIMEOUT'
        );
      }
      return fail(
        '📍 Location unavailable. Please ensure Location Services and GPS are ON, then tap Retry.\n(लोकेशन नहीं मिली — Settings में Location Services and GPS चालू करके Retry करें)',
        'POSITION_UNAVAILABLE'
      );
    }

  } else {
    // ── Android / Desktop Flow ──────────────────────────────────────────────
    // Attempt 1: High accuracy
    try {
      const pos = await tryGetPosition({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      });
      return resolve(toCoords(pos));
    } catch (err1) {
      console.warn("Android Geolocation Attempt 1 failed:", err1);
    }

    // Attempt 2: Low accuracy (network-only, faster)
    try {
      const pos = await tryGetPosition({
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 60000,
      });
      return resolve(toCoords(pos));
    } catch (err2) {
      if (err2.code === 1) {
        return fail('LOCATION_BLOCKED', 'PERMISSION_DENIED');
      }
      if (err2.code === 2) {
        return fail(
          '📍 Location signal unavailable. Please enable GPS/Wi-Fi and tap Retry.\n(GPS/WiFi चालू करें और Retry करें)',
          'POSITION_UNAVAILABLE'
        );
      }
      return fail(
        '📍 Location timed out. Please move to an open area with better GPS signal and tap Retry.\n(बेहतर GPS सिग्नल वाली जगह जाएं और Retry करें)',
        'TIMEOUT'
      );
    }
  }
});
