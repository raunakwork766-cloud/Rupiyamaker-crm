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
 * Get a profile picture URL with cache busting.
 *
 * IMPORTANT: The cache-busting token is derived deterministically from the photo
 * PATH (not Date.now()). Using Date.now() previously produced a brand-new URL on
 * every single render, so the browser re-downloaded the image constantly — that
 * caused the avatar to flicker / not show until a manual refresh. A stable token
 * lets the browser cache the image, while still changing the URL whenever the
 * underlying photo path changes (e.g. after a new upload with a new filename).
 *
 * @param {string} profilePhoto - The profile photo path from database
 * @returns {string|null} - The full URL with cache busting or null if no photo
 */
export const getProfilePictureUrlWithCacheBusting = (profilePhoto) => {
    const baseUrl = getProfilePictureUrl(profilePhoto);
    if (!baseUrl) return null;

    // Deterministic, lightweight hash of the path → stable per photo.
    let hash = 0;
    const src = String(profilePhoto);
    for (let i = 0; i < src.length; i++) {
        hash = ((hash << 5) - hash + src.charCodeAt(i)) | 0;
    }
    const token = Math.abs(hash).toString(36);
    return `${baseUrl}?v=${token}`;
};

export default {
    getMediaUrl,
    getProfilePictureUrl,
    getProfilePictureUrlWithCacheBusting,
    API_BASE_URL
};
