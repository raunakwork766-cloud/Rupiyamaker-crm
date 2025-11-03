/**
 * Utility functions for managing profile photos in localStorage
 * and triggering navbar updates
 */

/**
 * Updates the profile photo in localStorage and triggers navbar update
 * @param {string} profilePhotoPath - The profile photo path or URL
 */
export const updateProfilePhotoInStorage = (profilePhotoPath) => {
  try {
    // Update the direct profile_photo key
    localStorage.setItem('profile_photo', profilePhotoPath);
    
    // Also update the user object if it exists
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        parsedUser.profile_photo = profilePhotoPath;
        localStorage.setItem('user', JSON.stringify(parsedUser));
      }
    } catch (parseError) {
      console.error('Could not update user object:', parseError);
    }
    
    // Trigger custom event for same-tab localStorage changes
    const event = new CustomEvent('localStorageChange', {
      detail: { key: 'profile_photo', newValue: profilePhotoPath }
    });
    window.dispatchEvent(event);
    
    // Also trigger navbar refresh if available
    if (window.refreshNavbarProfilePhoto) {
      window.refreshNavbarProfilePhoto();
    }
    
    return true;
  } catch (error) {
    console.error('Error updating profile photo:', error);
    return false;
  }
};

/**
 * Gets the current profile photo from localStorage
 * @returns {string|null} The profile photo path/URL or null if not found
 */
export const getProfilePhotoFromStorage = () => {
  try {
    // First check the direct key
    const directPhoto = localStorage.getItem('profile_photo');
    if (directPhoto && directPhoto !== 'null' && directPhoto !== 'undefined') {
      return directPhoto;
    }
    
    // Then check the user object
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.profile_photo && parsedUser.profile_photo !== 'null' && parsedUser.profile_photo !== 'undefined') {
        return parsedUser.profile_photo;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting profile photo from storage:', error);
    return null;
  }
};

/**
 * Clears the profile photo from localStorage
 */
export const clearProfilePhotoFromStorage = () => {
  try {
    // Remove the direct key
    localStorage.removeItem('profile_photo');
    
    // Also remove from user object if it exists
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        delete parsedUser.profile_photo;
        localStorage.setItem('user', JSON.stringify(parsedUser));
      }
    } catch (parseError) {
      console.error('Could not update user object:', parseError);
    }
    
    // Trigger custom event for same-tab localStorage changes
    const event = new CustomEvent('localStorageChange', {
      detail: { key: 'profile_photo', newValue: null }
    });
    window.dispatchEvent(event);
    
    // Also trigger navbar refresh if available
    if (window.refreshNavbarProfilePhoto) {
      window.refreshNavbarProfilePhoto();
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing profile photo:', error);
    return false;
  }
};

/**
 * Force refresh the navbar profile photo
 */
export const refreshNavbarProfilePhoto = () => {
  if (window.refreshNavbarProfilePhoto) {
    window.refreshNavbarProfilePhoto();
    return true;
  } else {
    return false;
  }
};
