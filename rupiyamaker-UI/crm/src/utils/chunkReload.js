/**
 * Robust handling for Vite/Rollup lazy-chunk (dynamic import) load failures.
 *
 * Why this exists:
 *  - Production/dev builds use hashed chunk file names and `emptyOutDir`, so a
 *    new build DELETES the old chunk files. Any browser tab that loaded the old
 *    index.html keeps referencing old chunk hashes. When the user navigates to a
 *    lazily-loaded route/section, that chunk 404s → "Failed to fetch dynamically
 *    imported module" → the old "component not found / Failed to load / Retry" UI.
 *  - The previous approach called window.location.reload() guarded only by a
 *    module-level Set, which RESETS on every reload. If index.html was stale
 *    (proxy/CDN cache), that produced an infinite reload loop = the flickering /
 *    "nothing opens" behaviour, especially with the app open in two tabs.
 *
 * Strategy:
 *  1. Retry the failing import once after a short delay (covers transient
 *     network hiccups without a full reload).
 *  2. If it still fails, reload the page ONCE to pick up the new build's chunks.
 *  3. Guard the reload with sessionStorage + a time window so we never loop.
 */

const RELOAD_TS_KEY = 'rm_chunkReloadAt';
// Don't trigger more than one chunk-recovery reload within this window.
const RELOAD_WINDOW_MS = 30000;

/**
 * Detect whether an error is a dynamic-import / chunk loading failure.
 */
export const isChunkLoadError = (error) => {
  if (!error) return false;
  const msg = (error && (error.message || error.toString())) || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Unable to preload CSS') ||
    error.name === 'ChunkLoadError'
  );
};

/**
 * Reload the page once to fetch fresh chunks after a new deploy.
 * Returns true if a reload was triggered, false if we already reloaded recently
 * (so callers can show a manual "Reload" fallback instead of looping forever).
 */
export const reloadForFreshChunks = () => {
  try {
    const last = parseInt(sessionStorage.getItem(RELOAD_TS_KEY) || '0', 10);
    const now = Date.now();
    if (now - last < RELOAD_WINDOW_MS) {
      // We already reloaded very recently — a second reload would loop.
      return false;
    }
    sessionStorage.setItem(RELOAD_TS_KEY, String(now));
  } catch (_) {
    // sessionStorage unavailable — fall through and reload anyway.
  }
  window.location.reload();
  return true;
};

/**
 * Wrap a dynamic import function so chunk failures retry once and then trigger a
 * single page reload to recover from a stale build. Non-chunk errors are
 * rethrown unchanged so the caller's error boundary can render its own UI.
 *
 * @param {() => Promise<any>} importFn  e.g. () => import('./Foo.jsx')
 * @returns {() => Promise<any>}  a function suitable for React.lazy()
 */
export const lazyWithReload = (importFn) => {
  return () =>
    importFn().catch((error) => {
      if (!isChunkLoadError(error)) {
        // Real runtime error — let the error boundary handle it.
        throw error;
      }
      // Transient? Retry the import once after a short delay.
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          importFn()
            .then(resolve)
            .catch(() => {
              // Still failing → almost certainly a new build replaced the chunks.
              const reloaded = reloadForFreshChunks();
              if (reloaded) {
                // Render nothing while the page reloads.
                resolve({ default: () => null });
              } else {
                // Already reloaded recently — surface the error so the boundary
                // can show a manual reload button instead of looping.
                reject(error);
              }
            });
        }, 600);
      });
    });
};
