/**
 * Lead Direct View Fallback - Utility functions for handling direct lead viewing
 * This file provides functionality to help ensure direct lead views work properly
 */

// Track if we've already handled a direct view
let directViewHandled = false;

/**
 * Function to be called when initializing a component
 * Checks for direct lead view parameters and handles them
 */
export function checkForDirectLeadView() {
  try {
    // Only process once per page load
    if (directViewHandled) return null;
    
    // Check URL for lead_id parameter
    const urlParams = new URLSearchParams(window.location.search);
    const leadId = urlParams.get('lead_id');
    
    // Check for stored direct view lead ID
    const storedLeadId = sessionStorage.getItem('directViewLeadId') || 
                          localStorage.getItem('lastViewedLeadId');
    
    // Use either URL parameter or stored ID
    const directViewLeadId = leadId || storedLeadId;
    
    if (directViewLeadId) {
      console.log('LeadDirectViewFallback: Found direct lead view ID:', directViewLeadId);
      
      // Store lead ID in multiple locations for redundancy
      sessionStorage.setItem('directViewLeadId', directViewLeadId);
      localStorage.setItem('lastViewedLeadId', directViewLeadId);
      
      // Set a global flag to indicate direct lead view is needed
      window.isDirectLeadView = true;
      window.directViewLeadId = directViewLeadId;
      
      // Mark as handled
      directViewHandled = true;
      
      // Remove the parameter from URL to avoid reprocessing on reload
      if (leadId && window.history && window.history.replaceState) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        console.log('LeadDirectViewFallback: Removed query parameters from URL');
      }
      
      return directViewLeadId;
    }
  } catch (error) {
    console.error('Error handling direct lead view check:', error);
  }
  
  return null;
}

/**
 * Function to be called when a component mounts
 * Attempts to trigger direct lead viewing
 * 
 * @param {Function} viewLeadFunc - Function to call to view a lead by ID
 */
export function handleDirectLeadViewOnMount(viewLeadFunc) {
  try {
    // Check if we have a pending direct lead view
    const directViewLeadId = window.directViewLeadId || 
                            sessionStorage.getItem('directViewLeadId') || 
                            localStorage.getItem('lastViewedLeadId');
    
    if (directViewLeadId && viewLeadFunc && typeof viewLeadFunc === 'function') {
      console.log('LeadDirectViewFallback: Triggering direct lead view on mount:', directViewLeadId);
      
      // Call the view lead function with the ID
      setTimeout(() => {
        viewLeadFunc(directViewLeadId);
        
        // Clean up storage
        delete window.directViewLeadId;
        sessionStorage.removeItem('directViewLeadId');
        localStorage.removeItem('lastViewedLeadId');
      }, 500); // Short delay to ensure component is fully mounted
      
      return true;
    }
  } catch (error) {
    console.error('Error handling direct lead view on mount:', error);
  }
  
  return false;
}
