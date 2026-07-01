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
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Failed to load module script') ||
    // Browser served HTML (e.g. index.html) where a JS module was expected —
    // happens when a stale chunk 404s and the server falls back to index.html.
    msg.includes('Expected a JavaScript module script') ||
    msg.includes('Unable to preload CSS') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    // Generic catch-all for the dynamic-import error family.
    msg.includes('dynamically imported module') ||
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

let _globalHandlerInstalled = false;

/**
 * Install global listeners that recover from stale-chunk failures which happen
 * OUTSIDE React error boundaries — e.g. a `<link rel="modulepreload">` chunk,
 * a route chunk preloaded eagerly, or the entry `<script type="module">` of a
 * stale tab. Without this, those failures produce a blank screen with no React
 * mounted (so no boundary can render a fallback). Each path funnels into the
 * same guarded single-reload, so there is never an infinite reload loop.
 *
 * Call once at app startup (main.jsx).
 */
export const installChunkErrorAutoReload = () => {
  if (_globalHandlerInstalled || typeof window === 'undefined') return;
  _globalHandlerInstalled = true;

  // Vite fires this when a modulepreload (rel="modulepreload") chunk fails.
  window.addEventListener('vite:preloadError', (event) => {
    try { event.preventDefault(); } catch (_) { /* noop */ }
    reloadForFreshChunks();
  });

  // Unhandled rejections from failed dynamic import()s not caught by a boundary.
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event && event.reason)) {
      reloadForFreshChunks();
    }
  });

  // Failed <script>/<link> element loads. Resource errors don't bubble, so we
  // listen in the capture phase and confirm the failing URL is one of our
  // hashed build assets before reloading.
  window.addEventListener('error', (event) => {
    const target = event && event.target;
    if (!target || !target.tagName) return; // runtime JS errors target window
    const tag = target.tagName.toLowerCase();
    const url = target.src || target.href || '';
    const rel = (target.rel || '').toLowerCase();
    const isAssetTag =
      tag === 'script' ||
      (tag === 'link' && /stylesheet|modulepreload|preload/.test(rel));
    if (isAssetTag && /\/(chunks|assets|styles)\/[^/]+\.(m?js|css)(\?|$)/.test(url)) {
      reloadForFreshChunks();
    }
  }, true);
};
