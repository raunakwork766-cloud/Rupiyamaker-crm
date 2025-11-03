/**
 * Login form helper utility to avoid excessive API calls
 * For fixing issues with login-form API not updating the database properly
 */

import { debounce } from './obligationDataHelper';

// API base URL
const API_BASE_URL = '/api'; // Always use proxy

// Save login form data to API with debouncing
export const saveLoginFormDataToAPIDebounced = debounce(async (leadId, userId, formData, token, refreshCallback = null) => {
  if (!leadId) {
    console.warn('No lead ID available, cannot save to API');
    return;
  }

  try {
    const apiUrl = `${API_BASE_URL}/leads/${leadId}/login-form?user_id=${userId}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Validate that the response indicates success
    const responseData = await response.json();
    
    if (!responseData.success && !responseData.acknowledged) {
      console.warn('API returned 200 but success flag is false:', responseData);
      throw new Error('API reported success but did not confirm data was saved');
    }

    // If we have a refreshCallback function, call it
    if (refreshCallback && typeof refreshCallback === 'function') {
      try {
        await refreshCallback(leadId, userId, token);
      } catch (refreshError) {
        console.error('Error in refresh callback after saving login form:', refreshError);
      }
    } else {
      // Fetch updated data as a fallback refresh mechanism
      await refreshLeadData(leadId, userId, token);
    }
    
    return response;
  } catch (error) {
    console.error('Error saving login form data to API:', error);
    throw error;
  }
}, 1000); // 1000ms debounce

// Function to refresh lead data after API updates
export const refreshLeadData = async (leadId, userId, token) => {
  if (!leadId || !userId || !token) {
    console.warn('Missing required parameters to refresh lead data');
    return null;
  }
  
  try {
    const apiUrl = `${API_BASE_URL}/leads/${leadId}?user_id=${userId}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const updatedLead = await response.json();
      return updatedLead;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error refreshing lead data:', error);
    return null;
  }
};
