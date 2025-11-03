/**
 * Dynamic import utilities for performance optimization
 * This file helps lazy load heavy dependencies without changing UI
 */

import React from 'react';

// Cache for loaded modules to avoid re-importing
const moduleCache = new Map();

/**
 * Lazy load heavy libraries only when needed
 */
export const loadHeavyLibraries = {
  // Excel/CSV processing
  async xlsx() {
    if (moduleCache.has('xlsx')) {
      return moduleCache.get('xlsx');
    }
    
    try {
      const module = await import('xlsx');
      moduleCache.set('xlsx', module);
      return module;
    } catch (error) {
      console.warn('Failed to load xlsx library:', error);
      return null;
    }
  },

  // File saving
  async fileSaver() {
    if (moduleCache.has('file-saver')) {
      return moduleCache.get('file-saver');
    }
    
    try {
      const module = await import('file-saver');
      moduleCache.set('file-saver', module);
      return module;
    } catch (error) {
      console.warn('Failed to load file-saver library:', error);
      return null;
    }
  },

  // ZIP processing
  async jszip() {
    if (moduleCache.has('jszip')) {
      return moduleCache.get('jszip');
    }
    
    try {
      const module = await import('jszip');
      moduleCache.set('jszip', module);
      return module;
    } catch (error) {
      console.warn('Failed to load jszip library:', error);
      return null;
    }
  },

  // Material UI (if needed)
  async muiMaterial() {
    if (moduleCache.has('mui-material')) {
      return moduleCache.get('mui-material');
    }
    
    try {
      const module = await import('@mui/material');
      moduleCache.set('mui-material', module);
      return module;
    } catch (error) {
      console.warn('Failed to load MUI Material library:', error);
      return null;
    }
  },

  // Date picker (heavy)
  async datePicker() {
    if (moduleCache.has('react-datepicker')) {
      return moduleCache.get('react-datepicker');
    }
    
    try {
      const module = await import('react-datepicker');
      moduleCache.set('react-datepicker', module);
      return module;
    } catch (error) {
      console.warn('Failed to load react-datepicker library:', error);
      return null;
    }
  },

  // Toast notifications
  async toast() {
    if (moduleCache.has('react-toastify')) {
      return moduleCache.get('react-toastify');
    }
    
    try {
      const module = await import('react-toastify');
      moduleCache.set('react-toastify', module);
      return module;
    } catch (error) {
      console.warn('Failed to load react-toastify library:', error);
      return null;
    }
  }
};

/**
 * Component lazy loading with error boundaries
 */
export const createLazyComponent = (importFn, fallback = null) => {
  const LazyComponent = React.lazy(importFn);
  
  return function LazyWrapper(props) {
    return (
      <React.Suspense fallback={fallback || <div>Loading...</div>}>
        <LazyComponent {...props} />
      </React.Suspense>
    );
  };
};

/**
 * Preload critical resources
 */
export const preloadCriticalResources = () => {
  // Preload critical components that will be needed soon
  const criticalImports = [
    () => import('../components/LoginCRM.jsx'),
    () => import('../components/AllEmployees.jsx'),
    () => import('../components/LeadCRM.jsx')
  ];

  // Use requestIdleCallback for non-blocking preloading
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      criticalImports.forEach(importFn => {
        importFn().catch(err => console.warn('Failed to preload component:', err));
      });
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      criticalImports.forEach(importFn => {
        importFn().catch(err => console.warn('Failed to preload component:', err));
      });
    }, 100);
  }
};

/**
 * Image lazy loading utility
 */
export const createLazyImage = (src, alt, className = '') => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isInView, setIsInView] = React.useState(false);
  const imgRef = React.useRef();

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={className}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}
    </div>
  );
};

/**
 * Memory cleanup utilities
 */
export const performanceUtils = {
  // Clear module cache when needed
  clearCache() {
    moduleCache.clear();
  },

  // Get cache size
  getCacheInfo() {
    return {
      size: moduleCache.size,
      keys: Array.from(moduleCache.keys())
    };
  },

  // Force garbage collection (if available)
  triggerGC() {
    if (window.gc) {
      window.gc();
    }
  },

  // Monitor bundle size
  logBundleInfo() {
    if (performance && performance.getEntriesByType) {
      const resources = performance.getEntriesByType('resource');
      const jsResources = resources.filter(r => r.name.endsWith('.js'));
      const cssResources = resources.filter(r => r.name.endsWith('.css'));
      
      console.group('Bundle Performance Info');
      console.log('JS Files:', jsResources.length);
      console.log('CSS Files:', cssResources.length);
      console.log('Total Transfer Size:', 
        jsResources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024, 'KB'
      );
      console.groupEnd();
    }
  }
};

export default {
  loadHeavyLibraries,
  createLazyComponent,
  preloadCriticalResources,
  createLazyImage,
  performanceUtils
};
