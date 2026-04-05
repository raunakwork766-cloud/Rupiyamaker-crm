import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook that syncs tab state with URL search params for browser back/forward support.
 * 
 * @param {string} paramName - URL search param name (e.g., 'tab', 'view', 'filter')
 * @param {string|number} defaultValue - Default tab value when no URL param exists
 * @param {Object} options
 * @param {string} options.localStorageKey - Optional localStorage key for persistence
 * @param {boolean} options.isNumeric - If true, parse/store as number (default: false)
 * @param {boolean} options.replace - If true, use replaceState instead of pushState for initial load (default: true)
 * @returns {[string|number, function]} - [currentTab, setTab]
 */
export default function useTabWithHistory(paramName, defaultValue, options = {}) {
  const { localStorageKey, isNumeric = false, replace = true } = options;
  const isInitialMount = useRef(true);

  // Parse value from string
  const parseValue = useCallback((val) => {
    if (val === null || val === undefined) return null;
    if (isNumeric) {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return val;
  }, [isNumeric]);

  // Serialize value to string
  const serializeValue = useCallback((val) => {
    return String(val);
  }, []);

  // Get initial value: URL param > localStorage > default
  const getInitialValue = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlVal = parseValue(urlParams.get(paramName));
    if (urlVal !== null) return urlVal;

    if (localStorageKey) {
      const stored = localStorage.getItem(localStorageKey);
      if (stored !== null) {
        const parsed = parseValue(stored);
        if (parsed !== null) return parsed;
      }
    }

    return defaultValue;
  }, [paramName, defaultValue, localStorageKey, parseValue]);

  const [value, setValue] = useState(getInitialValue);

  // Update URL when value changes (push new history entry)
  const setTab = useCallback((newValue) => {
    setValue((prev) => {
      const resolvedValue = typeof newValue === 'function' ? newValue(prev) : newValue;
      
      // Update URL with pushState (creates new history entry for back button)
      const url = new URL(window.location.href);
      url.searchParams.set(paramName, serializeValue(resolvedValue));
      window.history.pushState({ [paramName]: resolvedValue }, '', url.toString());

      // Also persist to localStorage if configured
      if (localStorageKey) {
        localStorage.setItem(localStorageKey, serializeValue(resolvedValue));
      }

      return resolvedValue;
    });
  }, [paramName, serializeValue, localStorageKey]);

  // On initial mount, sync URL to reflect current tab (replace, don't push)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const url = new URL(window.location.href);
      const currentUrlVal = url.searchParams.get(paramName);
      const serialized = serializeValue(value);
      
      if (currentUrlVal !== serialized) {
        url.searchParams.set(paramName, serialized);
        window.history.replaceState({ [paramName]: value }, '', url.toString());
      }

      // Also persist to localStorage
      if (localStorageKey) {
        localStorage.setItem(localStorageKey, serialized);
      }
    }
  }, [paramName, value, serializeValue, localStorageKey]);

  // Listen for browser back/forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlVal = parseValue(urlParams.get(paramName));
      
      if (urlVal !== null) {
        setValue(urlVal);
        if (localStorageKey) {
          localStorage.setItem(localStorageKey, serializeValue(urlVal));
        }
      } else {
        // Param removed from URL — go to default
        setValue(defaultValue);
        if (localStorageKey) {
          localStorage.setItem(localStorageKey, serializeValue(defaultValue));
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [paramName, defaultValue, parseValue, serializeValue, localStorageKey]);

  return [value, setTab];
}
