/**
 * Lead API Helper - Fixes API calls in loops and improves performance
 * 
 * This file provides debouncing functions for handling API calls related to leads
 * to avoid making excessive API calls when editing lead data in the UI.
 */

// Debounce function to limit API calls
export function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// API base URL
const API_BASE_URL = '/api'; // Always use proxy

// Generic function to save any lead data with debouncing
export const saveLeadDataToAPIDebounced = debounce(async (leadId, userId, endpoint, data, token) => {
  if (!leadId) {
    console.warn('No lead ID available, cannot save to API');
    return;
  }

  try {
    const apiUrl = `${API_BASE_URL}/leads/${leadId}/${endpoint}?user_id=${userId}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Add response validation to ensure data is actually saved
    const responseData = await response.json();
    
    if (!responseData.success && !responseData.acknowledged && !responseData._id) {
      console.warn(`API returned 200 for ${endpoint} but success flag is missing:`, responseData);
      // We don't throw here to avoid breaking functionality, but we log it
    }

    console.log(`Lead data saved to ${endpoint} API successfully (debounced)`, responseData);
    return responseData;
  } catch (error) {
    console.error(`Error saving lead data to ${endpoint}:`, error);
    throw error;
  }
}, 1000); // 1000ms debounce

// Update lead data in main endpoint
export const updateLeadDataDebounced = debounce(async (leadId, userId, data, token) => {
  if (!leadId) {
    console.warn('No lead ID available, cannot update lead');
    return;
  }

  try {
    const apiUrl = `${API_BASE_URL}/leads/${leadId}?user_id=${userId}`;
    
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
      },
      body: JSON.stringify({
        ...data,
        updated_by: userId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Add response validation to ensure data is actually saved
    const responseData = await response.json();
    
    if (!responseData._id) {
      console.warn('API returned 200 but lead ID is missing in response:', responseData);
      // We don't throw here to avoid breaking functionality, but we log it
    }

    console.log('Lead data updated successfully (debounced):', responseData);
    return responseData;
  } catch (error) {
    console.error('Error updating lead data:', error);
    throw error;
  }
}, 1000); // 1000ms debounce

/**
 * Request reassignment of a lead
 * @param {string} leadId - The ID of the lead to reassign
 * @param {string} userId - Current user ID
 * @param {string} targetUserId - Target user to reassign to (optional)
 * @param {string} reason - Reason for reassignment
 * @returns {Promise} - API response
 */
export const requestLeadReassignment = async (leadId, userId, targetUserId = null, reason = '') => {
  try {
    // Construct the query parameters
    let queryParams = `?user_id=${userId}`;
    if (targetUserId) queryParams += `&target_user_id=${targetUserId}`;
    if (reason) queryParams += `&reason=${encodeURIComponent(reason)}`;
    
    const response = await fetch(`${API_BASE_URL}/leads/${leadId}/request-reassign${queryParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error requesting lead reassignment:', error);
    throw error;
  }
};

/**
 * Enhanced request reassignment of a lead with data_code and campaign_name changes
 * @param {string} leadId - The ID of the lead to reassign
 * @param {string} userId - Current user ID
 * @param {string} targetUserId - Target user to reassign to
 * @param {string} reason - Reason for reassignment
 * @param {string} dataCode - New data code (optional)
 * @param {string} campaignName - New campaign name (optional)
 * @returns {Promise} - API response
 */
export const requestEnhancedLeadReassignment = async (leadId, userId, targetUserId, reason, dataCode = null, campaignName = null) => {
  try {
    // Construct the query parameters
    const params = new URLSearchParams({
      lead_id: leadId,
      target_user_id: targetUserId,
      reason: reason,
      user_id: userId
    });
    
    // Add optional fields
    if (dataCode) {
      params.append('data_code', dataCode);
    }
    
    if (campaignName) {
      params.append('campaign_name', campaignName);
    }
    
    const response = await fetch(`${API_BASE_URL}/reassignment/request?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error requesting enhanced lead reassignment:', error);
    throw error;
  }
};

/**
 * Approve a lead reassignment request
 * @param {string} leadId - The ID of the lead
 * @param {string} userId - Current user ID (approver)
 * @returns {Promise} - API response
 */
export const approveLeadReassignment = async (leadId, userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/reassignment/approve/${leadId}?user_id=${userId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error approving lead reassignment:', error);
    throw error;
  }
};

/**
 * Fetch all leads with pending reassignment requests
 * @param {string} userId - Current user ID
 * @param {number} page - Page number
 * @param {number} pageSize - Items per page
 * @returns {Promise} - API response with paginated leads
 */
export const fetchPendingReassignmentLeads = async (userId, page = 1, pageSize = 20) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/reassignment/list?user_id=${userId}&page=${page}&page_size=${pageSize}&status_filter=pending`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the response to match the expected format
    return {
      items: data.requests || [],
      pages: data.pagination?.pages || 1,
      total: data.pagination?.total || 0,
      page: data.pagination?.page || 1,
      page_size: data.pagination?.page_size || pageSize
    };
  } catch (error) {
    console.error('Error fetching pending reassignment leads:', error);
    throw error;
  }
};
