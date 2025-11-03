/**
 * Utility functions for handling media URLs
 */

// API base URL for media files
const API_BASE_URL = '/api'; // Always use proxy

/**
 * Get a properly formatted media URL for profile pictures
 * @param {string} profilePhoto - The profile photo path from database
 * @param {boolean} includeApiBase - Whether to include the full API base URL
 * @returns {string|null} - The properly formatted URL or null if no photo
 */
export const getMediaUrl = (profilePhoto, includeApiBase = false) => {
    if (!profilePhoto) return null;
    
    // Handle different possible path formats
    if (profilePhoto.startsWith('http')) {
        return profilePhoto; // Already a full URL
    }
    
    let path;
    if (profilePhoto.startsWith('/')) {
        path = profilePhoto; // Already has leading slash
    } else {
        // For relative paths, ensure they start with /media/
        path = profilePhoto.startsWith('media/') ? `/${profilePhoto}` : `/media/${profilePhoto}`;
    }
    
    return includeApiBase ? `${API_BASE_URL}${path}` : path;
};

/**
 * Get a profile picture URL with full API base
 * @param {string} profilePhoto - The profile photo path from database
 * @returns {string|null} - The full URL or null if no photo
 */
export const getProfilePictureUrl = (profilePhoto) => {
    return getMediaUrl(profilePhoto, true);
};

/**
 * Get a profile picture URL with cache busting timestamp
 * @param {string} profilePhoto - The profile photo path from database
 * @returns {string|null} - The full URL with cache busting or null if no photo
 */
export const getProfilePictureUrlWithCacheBusting = (profilePhoto) => {
    const baseUrl = getProfilePictureUrl(profilePhoto);
    if (!baseUrl) return null;
    
    // Add timestamp to prevent caching issues
    const timestamp = Date.now();
    return `${baseUrl}?t=${timestamp}`;
};

export default {
    getMediaUrl,
    getProfilePictureUrl,
    getProfilePictureUrlWithCacheBusting,
    API_BASE_URL
};
