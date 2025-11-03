/**
 * Performance optimization utilities
 * Helps achieve sub-100ms load times
 */

// Lazy loading utility for heavy components
export const lazy = (importFn, fallback = null) => {
  const LazyComponent = React.lazy(importFn);
  
  return (props) => (
    <React.Suspense fallback={fallback || <div className="loading-spinner">Loading...</div>}>
      <LazyComponent {...props} />
    </React.Suspense>
  );
};

// Dynamic import with retry logic
export const dynamicImport = async (importFn, retries = 3) => {
  try {
    return await importFn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Import failed, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return dynamicImport(importFn, retries - 1);
    }
    throw error;
  }
};

// Preload critical resources
export const preloadResource = (href, type = 'script') => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = type;
  document.head.appendChild(link);
};

// Critical CSS injection
export const injectCriticalCSS = (css) => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
};

// Defer non-critical scripts
export const deferScript = (src, onLoad) => {
  const script = document.createElement('script');
  script.src = src;
  script.defer = true;
  if (onLoad) script.onload = onLoad;
  document.head.appendChild(script);
};

// Performance monitoring
export const measurePerformance = (name, fn) => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`${name} took ${end - start} milliseconds`);
  return result;
};

// Component performance optimization hooks
export const useOptimizedCallback = (callback, deps) => {
  return React.useCallback(callback, deps);
};

export const useOptimizedMemo = (factory, deps) => {
  return React.useMemo(factory, deps);
};

// Virtual scrolling utility for large lists
export const useVirtualScrolling = (items, itemHeight, containerHeight) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  
  const visibleItems = React.useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    
    return items.slice(startIndex, endIndex).map((item, index) => ({
      ...item,
      index: startIndex + index
    }));
  }, [items, scrollTop, itemHeight, containerHeight]);
  
  return { visibleItems, setScrollTop };
};

// Image optimization utilities
export const optimizeImage = (src, options = {}) => {
  const { width, height, quality = 85, format = 'webp' } = options;
  
  // For future implementation with image service
  return src;
};

// Bundle size utilities
export const checkBundleSize = () => {
  if (typeof window !== 'undefined' && window.performance) {
    const navigation = performance.getEntriesByType('navigation')[0];
    const loadTime = navigation.loadEventEnd - navigation.fetchStart;
    console.log(`Page load time: ${loadTime}ms`);
    
    if (loadTime > 3000) {
      console.warn('Page load time is slow. Consider optimizing bundles.');
    }
  }
};

// Initialize performance monitoring
export const initPerformanceMonitoring = () => {
  if (typeof window !== 'undefined') {
    // Monitor Core Web Vitals
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        switch (entry.entryType) {
          case 'largest-contentful-paint':
            console.log('LCP:', entry.startTime);
            break;
          case 'first-input':
            console.log('FID:', entry.processingStart - entry.startTime);
            break;
          case 'layout-shift':
            console.log('CLS:', entry.value);
            break;
        }
      }
    });
    
    observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    
    // Monitor bundle loading
    checkBundleSize();
  }
};

export default {
  lazy,
  dynamicImport,
  preloadResource,
  injectCriticalCSS,
  deferScript,
  measurePerformance,
  useOptimizedCallback,
  useOptimizedMemo,
  useVirtualScrolling,
  optimizeImage,
  checkBundleSize,
  initPerformanceMonitoring
};
