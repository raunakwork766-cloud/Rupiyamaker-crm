import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigationType } from 'react-router-dom';

/**
 * Custom hook that syncs tab state with URL search params for browser back/forward support.
 *
 * Navigation context awareness (KEY BEHAVIOR):
 *  - PUSH / REPLACE  (sidebar click, link navigation) →
 *      ALWAYS shows defaultValue — never restores stale saved tab
 *  - POP             (browser back / forward)         →
 *      restores from URL param (kept accurate by replaceState)
 *
 * This ensures: clicking a sidebar item ALWAYS opens the module in its default
 * state, while browser back/forward properly restores where the user was.
 *
 * @param {string}       paramName    - URL search param name (e.g. 'tab', 'status', 'filter')
 * @param {string|number} defaultValue - Value shown on fresh (sidebar) navigation
 * @param {Object}       options
 * @param {string}       options.localStorageKey - Key for POP fallback when URL param absent
 * @param {boolean}      options.isNumeric       - Parse/store value as number (default: false)
 * @returns {[string|number, function]}           - [currentTab, setTab]
 */
export default function useTabWithHistory(paramName, defaultValue, options = {}) {
  const { localStorageKey, isNumeric = false } = options;
  const isInitialMount = useRef(true);

  // 'PUSH' or 'REPLACE' = fresh sidebar / link navigation → always show default
  // 'POP'               = browser back / forward          → restore saved state
  const navigationType = useNavigationType();

  // Parse value helper
  const parseValue = useCallback((val) => {
    if (val === null || val === undefined) return null;
    if (isNumeric) {
      const p = parseInt(val, 10);
      return isNaN(p) ? null : p;
    }
    return val;
  }, [isNumeric]);

  // Initial value — computed ONCE at mount.
  // Captures `navigationType` via closure (called before useState, so it's in scope).
  const [value, setValue] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const rawUrlVal = urlParams.get(paramName);

    // 1. URL param always wins (explicit URL, bookmark, or replaceState-preserved tab)
    if (rawUrlVal !== null) {
      if (isNumeric) {
        const p = parseInt(rawUrlVal, 10);
        return isNaN(p) ? defaultValue : p;
      }
      return rawUrlVal;
    }

    // 2. No URL param — consult navigation context
    //    POP (browser back/forward): restore from localStorage as fallback
    //    PUSH/REPLACE (sidebar click, fresh nav): ALWAYS use default — no stale state
    if (navigationType === 'POP' && localStorageKey) {
      const stored = localStorage.getItem(localStorageKey);
      if (stored !== null) {
        if (isNumeric) {
          const p = parseInt(stored, 10);
          if (!isNaN(p)) return p;
        } else if (stored) {
          return stored;
        }
      }
    }

    return defaultValue;
  });

  // Change tab — replaceState keeps URL accurate without adding history entries
  const setTab = useCallback((newValue) => {
    setValue((prev) => {
      const resolved = typeof newValue === 'function' ? newValue(prev) : newValue;
      const serialized = String(resolved);
      const url = new URL(window.location.href);
      url.searchParams.set(paramName, serialized);
      window.history.replaceState({ [paramName]: resolved }, '', url.toString());
      if (localStorageKey) {
        localStorage.setItem(localStorageKey, serialized);
      }
      return resolved;
    });
  }, [paramName, localStorageKey]);

  // Sync URL on initial mount — reflects the computed initial value in the URL
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const serialized = String(value);
      const url = new URL(window.location.href);
      if (url.searchParams.get(paramName) !== serialized) {
        url.searchParams.set(paramName, serialized);
        window.history.replaceState({ [paramName]: value }, '', url.toString());
      }
      if (localStorageKey) {
        localStorage.setItem(localStorageKey, serialized);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty — runs once only on mount

  // Listen for browser back/forward — restore tab from URL
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlVal = parseValue(urlParams.get(paramName));
      const next = urlVal !== null ? urlVal : defaultValue;
      setValue(next);
      if (localStorageKey) {
        localStorage.setItem(localStorageKey, String(next));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [paramName, defaultValue, parseValue, localStorageKey]);

  return [value, setTab];
}
