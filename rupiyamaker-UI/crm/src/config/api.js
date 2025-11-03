// API Configuration
const getApiBaseUrl = () => {
  // ALWAYS use /api path - nginx will proxy to backend
  // This avoids SSL certificate errors and CORS issues in both dev and production
  console.log('✅ Using API proxy path: /api');
  return '/api';
  
  /* OLD CODE - No longer used
  // Check if running in development mode
  const isDevelopment = import.meta.env.DEV;
  
  console.log('🔧 API Config:', {
    isDev: isDevelopment,
    mode: import.meta.env.MODE,
    viteApiUrl: import.meta.env.VITE_API_BASE_URL
  });
  
  // In development, use the proxy path to avoid CORS and SSL issues
  if (isDevelopment) {
    console.log('✅ Using proxy path: /api');
    return '/api';
  }
  
  // Check if running in development with Vite
  if (typeof __API_BASE_URL__ !== 'undefined') {
    return __API_BASE_URL__;
  }
  
  // Fallback to environment variable or default for production
  const prodUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  console.log('📍 Using production URL:', prodUrl);
  return prodUrl;
  */
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to build API URLs
export const buildApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Media URL helper
export const buildMediaUrl = (path) => {
  if (!path) return '';
  // Handle both relative and absolute paths
  if (path.startsWith('http')) return path;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};

export default {
  API_BASE_URL,
  buildApiUrl,
  buildMediaUrl
};
