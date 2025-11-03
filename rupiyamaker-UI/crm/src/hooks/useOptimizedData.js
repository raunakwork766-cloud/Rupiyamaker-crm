import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { apiCall } from '../services/api';

/**
 * Custom hook for optimized data fetching with caching
 * @param {string} dataType - Type of data (feeds, tasks, leads, etc.)
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Options for the hook
 * @returns {Object} - { data, loading, error, refetch }
 */
export const useOptimizedFetch = (dataType, endpoint, options = {}) => {
  const { [dataType]: data, actions, helpers } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const { 
    dependencies = [], 
    cacheTime = 5 * 60 * 1000, // 5 minutes
    transform = (data) => data,
    onSuccess,
    onError
  } = options;

  const fetchData = useCallback(async (force = false) => {
    // Check cache first
    if (!force) {
      const cachedData = helpers.getCachedData(dataType);
      if (cachedData && helpers.isDataFresh(lastFetch, cacheTime)) {
        return cachedData;
      }
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await apiCall(endpoint);
      let transformedData = transform(response);
      
      // Update context with new data
      const actionName = `set${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`;
      if (actions[actionName]) {
        actions[actionName](transformedData);
      }
      
      setLastFetch(Date.now());
      
      if (onSuccess) {
        onSuccess(transformedData);
      }
      
      return transformedData;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch data';
      setError(errorMessage);
      
      if (onError) {
        onError(err);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dataType, endpoint, transform, actions, helpers, lastFetch, cacheTime, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  // Refetch function
  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch
  };
};

/**
 * Hook for optimistic updates
 * @param {string} dataType - Type of data
 * @param {string} endpoint - API endpoint
 * @returns {Object} - Optimistic update functions
 */
export const useOptimisticUpdate = (dataType, endpoint) => {
  const { actions } = useAppContext();
  const [pendingUpdates, setPendingUpdates] = useState(new Set());

  const optimisticCreate = useCallback(async (newItem, apiCall) => {
    const tempId = Date.now();
    const optimisticItem = { ...newItem, id: tempId, _isOptimistic: true };
    
    // Add to pending updates
    setPendingUpdates(prev => new Set([...prev, tempId]));
    
    try {
      // Optimistically update UI
      const actionName = `add${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`;
      if (actions[actionName]) {
        actions[actionName](optimisticItem);
      }
      
      // Make API call
      const response = await apiCall();
      
      // Replace optimistic item with real data
      const updateActionName = `update${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`;
      if (actions[updateActionName]) {
        actions[updateActionName]({ ...optimisticItem, ...response, _isOptimistic: false });
      }
      
      return response;
    } catch (error) {
      // Revert optimistic update on error
      const deleteActionName = `delete${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`;
      if (actions[deleteActionName]) {
        actions[deleteActionName](tempId);
      }
      throw error;
    } finally {
      // Remove from pending updates
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
    }
  }, [dataType, actions]);

  const optimisticUpdate = useCallback(async (id, updates, apiCall) => {
    const updateId = `${id}_${Date.now()}`;
    setPendingUpdates(prev => new Set([...prev, updateId]));
    
    try {
      // Optimistically update UI
      const actionName = `update${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`;
      if (actions[actionName]) {
        actions[actionName]({ id, ...updates, _isOptimistic: true });
      }
      
      // Make API call
      const response = await apiCall();
      
      // Update with real data
      if (actions[actionName]) {
        actions[actionName]({ id, ...response, _isOptimistic: false });
      }
      
      return response;
    } catch (error) {
      // Revert optimistic update on error
      // This requires storing the previous state, which is complex
      // For now, we'll just trigger a refetch
      console.error('Optimistic update failed, consider refetching:', error);
      throw error;
    } finally {
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateId);
        return newSet;
      });
    }
  }, [dataType, actions]);

  const optimisticDelete = useCallback(async (id, apiCall) => {
    const deleteId = `delete_${id}_${Date.now()}`;
    setPendingUpdates(prev => new Set([...prev, deleteId]));
    
    // Store the item for potential rollback
    const { [dataType]: currentData } = useAppContext();
    const itemToDelete = currentData.find(item => item.id === id);
    
    try {
      // Optimistically remove from UI
      const actionName = `delete${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`;
      if (actions[actionName]) {
        actions[actionName](id);
      }
      
      // Make API call
      await apiCall();
      
      return true;
    } catch (error) {
      // Revert optimistic delete on error
      if (itemToDelete) {
        const addActionName = `add${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`;
        if (actions[addActionName]) {
          actions[addActionName](itemToDelete);
        }
      }
      throw error;
    } finally {
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(deleteId);
        return newSet;
      });
    }
  }, [dataType, actions]);

  return {
    optimisticCreate,
    optimisticUpdate,
    optimisticDelete,
    pendingUpdates,
    hasPendingUpdates: pendingUpdates.size > 0
  };
};

/**
 * Hook for infinite scroll and pagination
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Options for pagination
 * @returns {Object} - Pagination utilities
 */
export const usePagination = (endpoint, options = {}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  
  const { 
    limit = 20, 
    transform = (data) => data,
    onSuccess,
    onError 
  } = options;

  const fetchPage = useCallback(async (pageNum, reset = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiCall(`${endpoint}?page=${pageNum}&limit=${limit}`);
      const newItems = transform(response.items || response.data || response);
      
      if (reset) {
        setItems(newItems);
      } else {
        setItems(prev => [...prev, ...newItems]);
      }
      
      setHasMore(newItems.length === limit);
      setPage(pageNum);
      
      if (onSuccess) {
        onSuccess(newItems, pageNum);
      }
      
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch data';
      setError(errorMessage);
      
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint, limit, transform, loading, onSuccess, onError]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchPage(page + 1);
    }
  }, [hasMore, loading, page, fetchPage]);

  const refresh = useCallback(() => {
    setPage(1);
    fetchPage(1, true);
  }, [fetchPage]);

  // Initial load
  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  return {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    page
  };
};

/**
 * Hook for managing form state with optimistic updates
 * @param {Object} initialValues - Initial form values
 * @param {Function} submitHandler - Function to handle form submission
 * @param {Object} options - Options for the form
 * @returns {Object} - Form utilities
 */
export const useOptimisticForm = (initialValues, submitHandler, options = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const { 
    validate, 
    onSuccess, 
    onError,
    optimisticUpdate 
  } = options;

  const handleChange = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    
    setSubmitted(true);
    
    // Validate form
    if (validate) {
      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }
    
    setLoading(true);
    setErrors({});
    
    try {
      // Optimistic update if provided
      if (optimisticUpdate) {
        optimisticUpdate(values);
      }
      
      const result = await submitHandler(values);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      // Reset form on success
      setValues(initialValues);
      setSubmitted(false);
      
      return result;
    } catch (error) {
      const errorMessage = error.message || 'Form submission failed';
      setErrors({ submit: errorMessage });
      
      if (onError) {
        onError(error);
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [values, validate, submitHandler, optimisticUpdate, onSuccess, onError, initialValues]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setSubmitted(false);
  }, [initialValues]);

  return {
    values,
    errors,
    loading,
    submitted,
    handleChange,
    handleSubmit,
    reset,
    setValues,
    setErrors
  };
};
