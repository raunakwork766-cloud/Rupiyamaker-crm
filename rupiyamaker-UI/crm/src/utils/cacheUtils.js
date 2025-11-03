/**
 * Advanced caching utilities for improved performance
 * Implements multiple caching strategies without changing UI
 */

// In-memory cache with TTL
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  set(key, value, ttl = 300000) { // Default 5 minutes
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set value
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.timers.set(key, timer);
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  clear() {
    this.cache.clear();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  size() {
    return this.cache.size;
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    this.cache.forEach((item) => {
      if (now - item.timestamp > item.ttl) {
        expired++;
      } else {
        active++;
      }
    });

    return {
      total: this.cache.size,
      active,
      expired
    };
  }
}

// Create global cache instances
const apiCache = new MemoryCache();
const dataCache = new MemoryCache();
const userCache = new MemoryCache();

/**
 * localStorage cache with compression
 */
class PersistentCache {
  constructor(prefix = 'crm_cache_') {
    this.prefix = prefix;
    this.maxSize = 5 * 1024 * 1024; // 5MB limit
  }

  _getKey(key) {
    return `${this.prefix}${key}`;
  }

  _compress(data) {
    try {
      return btoa(JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to compress data:', error);
      return JSON.stringify(data);
    }
  }

  _decompress(data) {
    try {
      return JSON.parse(atob(data));
    } catch (error) {
      // Fallback to direct parsing
      try {
        return JSON.parse(data);
      } catch (fallbackError) {
        console.warn('Failed to decompress data:', fallbackError);
        return null;
      }
    }
  }

  set(key, value, ttl = 86400000) { // Default 24 hours
    try {
      const item = {
        value,
        timestamp: Date.now(),
        ttl
      };

      const compressed = this._compress(item);
      
      // Check size limit
      if (compressed.length > this.maxSize) {
        console.warn('Data too large for persistent cache');
        return false;
      }

      localStorage.setItem(this._getKey(key), compressed);
      return true;
    } catch (error) {
      console.warn('Failed to set persistent cache:', error);
      return false;
    }
  }

  get(key) {
    try {
      const stored = localStorage.getItem(this._getKey(key));
      if (!stored) return null;

      const item = this._decompress(stored);
      if (!item) return null;

      // Check if expired
      if (Date.now() - item.timestamp > item.ttl) {
        this.delete(key);
        return null;
      }

      return item.value;
    } catch (error) {
      console.warn('Failed to get from persistent cache:', error);
      return null;
    }
  }

  delete(key) {
    try {
      localStorage.removeItem(this._getKey(key));
    } catch (error) {
      console.warn('Failed to delete from persistent cache:', error);
    }
  }

  clear() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear persistent cache:', error);
    }
  }

  // Get usage statistics
  getUsage() {
    try {
      let totalSize = 0;
      let itemCount = 0;

      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += value.length;
            itemCount++;
          }
        }
      });

      return {
        totalSize,
        itemCount,
        maxSize: this.maxSize,
        usage: (totalSize / this.maxSize * 100).toFixed(2)
      };
    } catch (error) {
      console.warn('Failed to get cache usage:', error);
      return null;
    }
  }
}

const persistentCache = new PersistentCache();

/**
 * API response caching wrapper
 */
export const cacheApiCall = async (key, apiCall, ttl = 300000, usePeristent = false) => {
  try {
    // Try memory cache first
    let cached = apiCache.get(key);
    if (cached) {
      return cached;
    }

    // Try persistent cache if enabled
    if (usePeristent) {
      cached = persistentCache.get(key);
      if (cached) {
        // Also set in memory cache for faster access
        apiCache.set(key, cached, ttl);
        return cached;
      }
    }

    // Make API call
    const result = await apiCall();

    // Cache the result
    apiCache.set(key, result, ttl);
    if (usePeristent) {
      persistentCache.set(key, result, ttl * 2); // Longer TTL for persistent
    }

    return result;
  } catch (error) {
    console.error('Cached API call failed:', error);
    throw error;
  }
};

/**
 * Data processing cache
 */
export const cacheProcessedData = (key, data, processor, ttl = 600000) => {
  const cached = dataCache.get(key);
  if (cached) {
    return cached;
  }

  const processed = processor(data);
  dataCache.set(key, processed, ttl);
  return processed;
};

/**
 * User-specific cache
 */
export const cacheUserData = (userId, key, data, ttl = 1800000) => { // 30 minutes
  const userKey = `user_${userId}_${key}`;
  userCache.set(userKey, data, ttl);
};

export const getUserCachedData = (userId, key) => {
  const userKey = `user_${userId}_${key}`;
  return userCache.get(userKey);
};

/**
 * Cache invalidation utilities
 */
export const invalidateCache = {
  // Invalidate specific key
  key(key) {
    apiCache.delete(key);
    persistentCache.delete(key);
  },

  // Invalidate by pattern
  pattern(pattern) {
    // For API cache
    apiCache.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        apiCache.delete(key);
      }
    });

    // For persistent cache
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes(pattern)) {
          persistentCache.delete(key.replace(persistentCache.prefix, ''));
        }
      });
    } catch (error) {
      console.warn('Failed to invalidate persistent cache pattern:', error);
    }
  },

  // Invalidate user data
  user(userId) {
    userCache.cache.forEach((_, key) => {
      if (key.startsWith(`user_${userId}_`)) {
        userCache.delete(key);
      }
    });
  },

  // Clear all caches
  all() {
    apiCache.clear();
    dataCache.clear();
    userCache.clear();
    persistentCache.clear();
  }
};

/**
 * Cache warming utilities
 */
export const warmCache = {
  // Preload frequently accessed data
  async criticalData() {
    const criticalCalls = [
      { key: 'user_profile', call: () => fetch('/api/user/profile').then(r => r.json()) },
      { key: 'departments', call: () => fetch('/api/departments').then(r => r.json()) },
      { key: 'roles', call: () => fetch('/api/roles').then(r => r.json()) }
    ];

    const promises = criticalCalls.map(({ key, call }) => 
      cacheApiCall(key, call, 600000, true).catch(error => 
        console.warn(`Failed to warm cache for ${key}:`, error)
      )
    );

    await Promise.allSettled(promises);
  },

  // Preload user-specific data
  async userData(userId) {
    const userCalls = [
      { key: 'permissions', call: () => fetch(`/api/users/${userId}/permissions`).then(r => r.json()) },
      { key: 'preferences', call: () => fetch(`/api/users/${userId}/preferences`).then(r => r.json()) }
    ];

    const promises = userCalls.map(({ key, call }) => 
      cacheApiCall(`user_${userId}_${key}`, call, 1800000, true).catch(error =>
        console.warn(`Failed to warm user cache for ${key}:`, error)
      )
    );

    await Promise.allSettled(promises);
  }
};

/**
 * Cache monitoring and cleanup
 */
export const cacheMonitor = {
  // Get comprehensive cache stats
  getStats() {
    return {
      api: apiCache.getStats(),
      data: dataCache.getStats(),
      user: userCache.getStats(),
      persistent: persistentCache.getUsage()
    };
  },

  // Cleanup expired entries
  cleanup() {
    // Memory caches automatically clean up with timers
    // Clean up persistent cache manually
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(persistentCache.prefix)) {
          const data = persistentCache.get(key.replace(persistentCache.prefix, ''));
          if (!data) {
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('Failed to cleanup persistent cache:', error);
    }
  },

  // Log cache performance
  logPerformance() {
    const stats = this.getStats();
    console.group('Cache Performance');
    console.log('API Cache:', stats.api);
    console.log('Data Cache:', stats.data);
    console.log('User Cache:', stats.user);
    console.log('Persistent Cache:', stats.persistent);
    console.groupEnd();
  }
};

// Initialize cache warming on load
if (typeof window !== 'undefined') {
  // Warm critical cache after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      warmCache.criticalData().catch(error => 
        console.warn('Failed to warm critical cache:', error)
      );
    }, 2000); // Delay to not interfere with initial page load
  });

  // Cleanup cache periodically
  setInterval(() => {
    cacheMonitor.cleanup();
  }, 600000); // Every 10 minutes
}

export default {
  cacheApiCall,
  cacheProcessedData,
  cacheUserData,
  getUserCachedData,
  invalidateCache,
  warmCache,
  cacheMonitor
};
