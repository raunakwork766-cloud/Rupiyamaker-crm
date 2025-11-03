/**
 * Performance monitoring and optimization utilities
 * Tracks and optimizes frontend performance without changing UI
 */

import React, { useEffect } from 'react';
import { cacheMonitor } from '../utils/cacheUtils.js';

// Performance metrics collection
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      loadTime: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      firstInputDelay: 0,
      cumulativeLayoutShift: 0,
      totalBlockingTime: 0
    };
    
    this.observers = [];
    this.init();
  }

  init() {
    // Observe performance metrics
    this.observeLoadTime();
    this.observeWebVitals();
    this.observeResourceLoading();
    this.monitorMemoryUsage();
  }

  observeLoadTime() {
    if (typeof window !== 'undefined' && window.performance) {
      window.addEventListener('load', () => {
        const navigation = window.performance.getEntriesByType('navigation')[0];
        if (navigation) {
          this.metrics.loadTime = navigation.loadEventEnd - navigation.navigationStart;
          this.reportMetric('load_time', this.metrics.loadTime);
        }
      });
    }
  }

  observeWebVitals() {
    // First Contentful Paint
    if ('PerformanceObserver' in window) {
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.firstContentfulPaint = entry.startTime;
            this.reportMetric('first_contentful_paint', entry.startTime);
          }
        }
      });
      
      try {
        fcpObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(fcpObserver);
      } catch (e) {
        console.warn('Failed to observe paint entries:', e);
      }

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.metrics.largestContentfulPaint = lastEntry.startTime;
          this.reportMetric('largest_contentful_paint', lastEntry.startTime);
        }
      });
      
      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        console.warn('Failed to observe LCP entries:', e);
      }

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        let clsScore = 0;
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsScore += entry.value;
          }
        }
        this.metrics.cumulativeLayoutShift = clsScore;
        this.reportMetric('cumulative_layout_shift', clsScore);
      });
      
      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (e) {
        console.warn('Failed to observe layout shift entries:', e);
      }

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.metrics.firstInputDelay = entry.processingStart - entry.startTime;
          this.reportMetric('first_input_delay', this.metrics.firstInputDelay);
        }
      });
      
      try {
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('Failed to observe first input entries:', e);
      }
    }
  }

  observeResourceLoading() {
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.transferSize > 1024 * 1024) { // Files larger than 1MB
            console.warn(`Large resource detected: ${entry.name} (${(entry.transferSize / 1024).toFixed(2)}KB)`);
          }
          
          if (entry.duration > 1000) { // Slow loading resources
            console.warn(`Slow resource: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
          }
        }
      });
      
      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (e) {
        console.warn('Failed to observe resource entries:', e);
      }
    }
  }

  monitorMemoryUsage() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        const memoryUsage = {
          usedJSHeapSize: memory.usedJSHeapSize / 1024 / 1024, // MB
          totalJSHeapSize: memory.totalJSHeapSize / 1024 / 1024, // MB
          jsHeapSizeLimit: memory.jsHeapSizeLimit / 1024 / 1024 // MB
        };

        // Warn if memory usage is high
        const usagePercent = (memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit) * 100;
        if (usagePercent > 70) {
          console.warn(`High memory usage: ${usagePercent.toFixed(2)}% (${memoryUsage.usedJSHeapSize.toFixed(2)}MB)`);
        }
      }, 30000); // Check every 30 seconds
    }
  }

  reportMetric(name, value) {
    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance metric - ${name}: ${value}`);
    }

    // In production, you might want to send to analytics
    // analytics.track('performance_metric', { name, value });
  }

  getMetrics() {
    return { ...this.metrics };
  }

  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Create global performance monitor instance
const performanceMonitor = new PerformanceMonitor();

/**
 * React component for performance monitoring
 */
const PerformanceMonitorComponent = () => {
  useEffect(() => {
    // Log initial performance state
    const logPerformance = () => {
      console.group('Performance Dashboard');
      console.log('Metrics:', performanceMonitor.getMetrics());
      console.log('Cache Stats:', cacheMonitor.getStats());
      
      // Log bundle analysis
      if (performance && performance.getEntriesByType) {
        const resources = performance.getEntriesByType('resource');
        const jsResources = resources.filter(r => r.name.includes('.js'));
        const cssResources = resources.filter(r => r.name.includes('.css'));
        
        console.log('Resource Count:', {
          js: jsResources.length,
          css: cssResources.length,
          total: resources.length
        });
        
        const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
        console.log('Total Transfer Size:', (totalSize / 1024).toFixed(2), 'KB');
      }
      
      console.groupEnd();
    };

    // Log performance after initial load
    const timer = setTimeout(logPerformance, 5000);

    // Periodic performance logging in development
    let interval;
    if (process.env.NODE_ENV === 'development') {
      interval = setInterval(() => {
        cacheMonitor.logPerformance();
      }, 60000); // Every minute
    }

    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, []);

  // This component doesn't render anything visible
  return null;
};

/**
 * Performance optimization utilities
 */
export const performanceOptimizer = {
  // Optimize images by lazy loading
  optimizeImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        });
      });

      images.forEach(img => imageObserver.observe(img));
    } else {
      // Fallback for browsers without IntersectionObserver
      images.forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }
  },

  // Preload critical resources
  preloadCriticalResources() {
    const criticalResources = [
      '/api/user/profile',
      '/api/departments',
      '/api/roles'
    ];

    criticalResources.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });
  },

  // Optimize CSS delivery
  optimizeCSSDelivery() {
    // Critical CSS should already be inlined
    // Load non-critical CSS asynchronously
    const nonCriticalCSS = document.querySelectorAll('link[data-critical="false"]');
    
    nonCriticalCSS.forEach(link => {
      link.media = 'print';
      link.onload = function() {
        this.media = 'all';
      };
    });
  },

  // Debounce function for performance
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle function for performance
  throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function(...args) {
      if (!lastRan) {
        func(...args);
        lastRan = Date.now();
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(() => {
          if ((Date.now() - lastRan) >= limit) {
            func(...args);
            lastRan = Date.now();
          }
        }, limit - (Date.now() - lastRan));
      }
    };
  }
};

// Auto-optimize on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    performanceOptimizer.optimizeImages();
    performanceOptimizer.optimizeCSSDelivery();
    performanceOptimizer.preloadCriticalResources();
  });
}

export { performanceMonitor, PerformanceMonitorComponent };
export default PerformanceMonitorComponent;
