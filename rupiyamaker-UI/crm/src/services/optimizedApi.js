/**
 * Optimized API service with caching and performance enhancements
 * This replaces direct API calls with cached, optimized versions
 */

import axios from 'axios';
import { cacheApiCall, invalidateCache } from './cacheUtils.js';

// Create optimized axios instance
const api = axios.create({
  baseURL: window.location.origin,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor for performance optimization
api.interceptors.request.use(
  (config) => {
    // Add request timestamp for performance monitoring
    config.metadata = { startTime: Date.now() };
    
    // Add compression header
    config.headers['Accept-Encoding'] = 'gzip, deflate, br';
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for caching and error handling
api.interceptors.response.use(
  (response) => {
    // Log performance metrics
    const duration = Date.now() - response.config.metadata.startTime;
    if (duration > 1000) {
      console.warn(`Slow API call: ${response.config.url} took ${duration}ms`);
    }
    
    return response;
  },
  (error) => {
    // Enhanced error handling
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout:', error.config.url);
    }
    
    return Promise.reject(error);
  }
);

/**
 * Optimized API service with intelligent caching
 */
export const optimizedApi = {
  // Employees API with caching
  employees: {
    async getAll(filters = {}, useCache = true) {
      const cacheKey = `employees_${JSON.stringify(filters)}`;
      
      if (!useCache) {
        invalidateCache.pattern('employees_');
      }
      
      return cacheApiCall(
        cacheKey,
        async () => {
          const params = new URLSearchParams();
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
              params.append(key, value);
            }
          });
          
          const response = await api.get(`/hrms/employees?${params}`);
          return response.data;
        },
        300000, // 5 minutes cache
        true    // Use persistent cache
      );
    },

    async getById(id, useCache = true) {
      const cacheKey = `employee_${id}`;
      
      return cacheApiCall(
        cacheKey,
        async () => {
          const response = await api.get(`/hrms/employees/${id}`);
          return response.data;
        },
        600000, // 10 minutes cache
        true
      );
    },

    async create(data) {
      try {
        const response = await api.post('/hrms/employees', data);
        // Invalidate employees cache
        invalidateCache.pattern('employees_');
        return response.data;
      } catch (error) {
        throw this._handleError(error);
      }
    },

    async update(id, data) {
      try {
        const response = await api.put(`/hrms/employees/${id}`, data);
        // Invalidate specific employee and list cache
        invalidateCache.key(`employee_${id}`);
        invalidateCache.pattern('employees_');
        return response.data;
      } catch (error) {
        throw this._handleError(error);
      }
    }
  },

  // Leads API with caching
  leads: {
    async getAll(filters = {}, useCache = true) {
      const cacheKey = `leads_${JSON.stringify(filters)}`;
      
      if (!useCache) {
        invalidateCache.pattern('leads_');
      }
      
      return cacheApiCall(
        cacheKey,
        async () => {
          const params = new URLSearchParams();
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
              params.append(key, value);
            }
          });
          
          const response = await api.get(`/leads?${params}`);
          return response.data;
        },
        180000, // 3 minutes cache (leads change frequently)
        false   // Don't use persistent cache for frequently changing data
      );
    },

    async getById(id, useCache = true) {
      const cacheKey = `lead_${id}`;
      
      return cacheApiCall(
        cacheKey,
        async () => {
          const response = await api.get(`/leads/${id}`);
          return response.data;
        },
        300000, // 5 minutes cache
        false
      );
    },

    async create(data) {
      try {
        const response = await api.post('/leads', data);
        // Invalidate leads cache
        invalidateCache.pattern('leads_');
        return response.data;
      } catch (error) {
        throw this._handleError(error);
      }
    },

    async update(id, data) {
      try {
        const response = await api.put(`/leads/${id}`, data);
        // Invalidate specific lead and list cache
        invalidateCache.key(`lead_${id}`);
        invalidateCache.pattern('leads_');
        return response.data;
      } catch (error) {
        throw this._handleError(error);
      }
    },

    // Optimized bulk operations
    async getBulk(ids, useCache = true) {
      const cacheKey = `leads_bulk_${ids.sort().join(',')}`;
      
      return cacheApiCall(
        cacheKey,
        async () => {
          const response = await api.post('/leads/bulk', { ids });
          return response.data;
        },
        300000,
        false
      );
    }
  },

  // Tasks API with caching
  tasks: {
    async getAll(filters = {}, useCache = true) {
      const cacheKey = `tasks_${JSON.stringify(filters)}`;
      
      return cacheApiCall(
        cacheKey,
        async () => {
          const params = new URLSearchParams();
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
              params.append(key, value);
            }
          });
          
          const response = await api.get(`/tasks?${params}`);
          return response.data;
        },
        120000, // 2 minutes cache (tasks change very frequently)
        false
      );
    },

    async create(data) {
      try {
        const response = await api.post('/tasks', data);
        invalidateCache.pattern('tasks_');
        return response.data;
      } catch (error) {
        throw this._handleError(error);
      }
    },

    async update(id, data) {
      try {
        const response = await api.put(`/tasks/${id}`, data);
        invalidateCache.key(`task_${id}`);
        invalidateCache.pattern('tasks_');
        return response.data;
      } catch (error) {
        throw this._handleError(error);
      }
    }
  },

  // Reference data with long cache times
  reference: {
    async getDepartments() {
      return cacheApiCall(
        'departments',
        async () => {
          const response = await api.get('/departments');
          return response.data;
        },
        3600000, // 1 hour cache
        true     // Use persistent cache
      );
    },

    async getRoles() {
      return cacheApiCall(
        'roles',
        async () => {
          const response = await api.get('/roles');
          return response.data;
        },
        3600000, // 1 hour cache
        true
      );
    },

    async getStatuses() {
      return cacheApiCall(
        'statuses',
        async () => {
          const response = await api.get('/leads/statuses');
          return response.data;
        },
        1800000, // 30 minutes cache
        true
      );
    }
  },

  // User-specific data
  user: {
    async getProfile(userId) {
      return cacheApiCall(
        `user_profile_${userId}`,
        async () => {
          const response = await api.get(`/users/${userId}`);
          return response.data;
        },
        600000, // 10 minutes cache
        true
      );
    },

    async getPermissions(userId, bypassCache = false) {
      // If bypassing cache, make direct API call
      if (bypassCache) {
        console.log('🔄 Bypassing cache for permissions refresh...');
        const response = await api.get(`/users/${userId}/permissions`);
        
        // Clear the cache for future requests
        const cacheKey = `user_permissions_${userId}`;
        if (cache.has(cacheKey)) {
          cache.delete(cacheKey);
          console.log('🗑️ Cleared permission cache for user:', userId);
        }
        
        return response.data;
      }
      
      // Normal cached request
      return cacheApiCall(
        `user_permissions_${userId}`,
        async () => {
          const response = await api.get(`/users/${userId}/permissions`);
          return response.data;
        },
        1800000, // 30 minutes cache
        true
      );
    }
  },

  // File operations with progress tracking
  files: {
    async upload(file, onProgress = null) {
      const formData = new FormData();
      formData.append('file', file);

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 minutes for file uploads
      };

      if (onProgress) {
        config.onUploadProgress = (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        };
      }

      try {
        const response = await api.post('/files/upload', formData, config);
        return response.data;
      } catch (error) {
        throw this._handleError(error);
      }
    },

    async download(fileId, filename) {
      try {
        const response = await api.get(`/files/${fileId}`, {
          responseType: 'blob',
          timeout: 300000, // 5 minutes for downloads
        });

        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        return true;
      } catch (error) {
        throw this._handleError(error);
      }
    }
  },

  // Batch operations for better performance
  batch: {
    async executeRequests(requests) {
      try {
        const promises = requests.map(request => {
          const { method, url, data, config } = request;
          return api.request({ method, url, data, ...config });
        });

        const responses = await Promise.allSettled(promises);
        
        return responses.map((result, index) => ({
          success: result.status === 'fulfilled',
          data: result.status === 'fulfilled' ? result.value.data : null,
          error: result.status === 'rejected' ? result.reason : null,
          request: requests[index]
        }));
      } catch (error) {
        throw this._handleError(error);
      }
    }
  },

  // Error handling utility
  _handleError(error) {
    if (error.response) {
      // Server responded with error status
      return {
        message: error.response.data?.message || 'Server error',
        status: error.response.status,
        data: error.response.data
      };
    } else if (error.request) {
      // Request made but no response
      return {
        message: 'Network error - please check your connection',
        status: 0,
        data: null
      };
    } else {
      // Something else happened
      return {
        message: error.message || 'An unexpected error occurred',
        status: -1,
        data: null
      };
    }
  },

  // Cache management
  cache: {
    clear: () => invalidateCache.all(),
    clearPattern: (pattern) => invalidateCache.pattern(pattern),
    clearUser: (userId) => invalidateCache.user(userId)
  }
};

// Export for backwards compatibility
export default optimizedApi;
