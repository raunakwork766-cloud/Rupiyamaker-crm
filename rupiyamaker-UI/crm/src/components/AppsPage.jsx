import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Settings as SettingsIcon, 
  Code, 
  Save, 
  X, 
  Users,
  Shield,
  Search,
  Image,
  Upload,
  MoreVertical,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { fetchWithAuth, getCurrentUserId } from '../utils/auth';
import { hasPermission, getUserPermissions, isSuperAdmin } from '../utils/permissions';

const API_BASE_URL = '/api'; // Always use API proxy

// Helper function to get proper image URL
const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  
  console.log('getImageUrl input:', imageUrl);
  
  // If it's already a full URL with rupiyamaker.com:8049, convert to use /api proxy
  if (imageUrl.startsWith('https://rupiyamaker.com:8049/')) {
    const path = imageUrl.replace('https://rupiyamaker.com:8049/', '');
    const proxyUrl = `/api/${path}`;
    console.log('getImageUrl output (proxied full URL):', proxyUrl);
    return proxyUrl;
  }
  
  // If it's already a different full URL (starts with http:// or https://), use it as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    console.log('getImageUrl output (external full URL):', imageUrl);
    return imageUrl;
  }
  
  // If it's a relative path starting with /media/, use /api proxy
  if (imageUrl.startsWith('/media/')) {
    const proxyUrl = `/api${imageUrl}`;
    console.log('getImageUrl output (proxied relative path):', proxyUrl);
    return proxyUrl;
  }
  
  // If it's just a filename, construct path with /api proxy
  if (!imageUrl.startsWith('/')) {
    const proxyUrl = `/api/media/app-images/${imageUrl}`;
    console.log('getImageUrl output (proxied filename):', proxyUrl);
    return proxyUrl;
  }
  
  // Default: return as is
  console.log('getImageUrl output (default):', imageUrl);
  return imageUrl;
};

const AppsPage = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showFullPageView, setShowFullPageView] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [roles, setRoles] = useState([]);
  
  // Share link states
  const [shareLinks, setShareLinks] = useState([]);
  const [loadingShareLinks, setLoadingShareLinks] = useState(false);
  const [newShareLink, setNewShareLink] = useState({
    expires_in_days: 7,
    max_access_count: 999,
    notes: ''
  });
  const [copiedToken, setCopiedToken] = useState(null);
  
  // Image upload states
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Three-dot menu state
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showImageChangeModal, setShowImageChangeModal] = useState(false);
  const menuRef = useRef(null);
  
  // Track opened app tabs
  const [openedTabs, setOpenedTabs] = useState(new Map());
  
  // Periodically check and clean up closed tabs
  useEffect(() => {
    const cleanupClosedTabs = () => {
      setOpenedTabs(prev => {
        const updated = new Map();
        prev.forEach((tabWindow, appId) => {
          if (tabWindow && !tabWindow.closed) {
            updated.set(appId, tabWindow);
          }
        });
        return updated;
      });
    };

    const cleanupInterval = setInterval(cleanupClosedTabs, 3000);
    return () => clearInterval(cleanupInterval);
  }, []);
  
  // Role filter states
  const [selectedRole, setSelectedRole] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  
  // Permission modal search states
  const [permissionSearchTerm, setPermissionSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    html_content: '',
    is_active: true
  });

  const [permissionsData, setPermissionsData] = useState({
    allowed_roles: []
  });

  // Check if current user is admin or has apps admin permissions
  const isAdmin =
    isSuperAdmin(getUserPermissions()) ||
    hasPermission(getUserPermissions(), 'apps', '*') ||
    hasPermission(getUserPermissions(), 'apps', 'manage');

  useEffect(() => {
    fetchApps();
    fetchRoles();
  }, []);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  // Monitor authentication state and close tabs on logout
  useEffect(() => {
    const checkAuthState = () => {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
      // Only close tabs if BOTH token and userId are missing (complete logout)
      if (!token && !userId) {
        console.log('Complete logout detected, closing all app tabs...');
        openedTabs.forEach((tabWindow, appId) => {
          if (tabWindow && !tabWindow.closed) {
            try {
              tabWindow.close();
              console.log(`Closed app tab for app ID: ${appId}`);
            } catch (error) {
              console.warn(`Could not close tab for app ID ${appId}:`, error);
            }
          }
        });
        setOpenedTabs(new Map());
      }
    };

    // Check auth state every 3 seconds
    const authCheckInterval = setInterval(checkAuthState, 3000);

    // Listen for storage changes (when user logs out in another tab)
    const handleStorageChange = (e) => {
      // React to removal of authentication data
      if ((e.key === 'token' || e.key === 'userId') && !e.newValue) {
        setTimeout(checkAuthState, 500); // Small delay to ensure both are cleared
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Clean up on component unmount
    return () => {
      clearInterval(authCheckInterval);
      window.removeEventListener('storage', handleStorageChange);
      
      // Close tabs on component unmount
      console.log('AppsPage component unmounting, closing tabs...');
      openedTabs.forEach((tabWindow, appId) => {
        if (tabWindow && !tabWindow.closed) {
          try {
            tabWindow.close();
            console.log(`Cleanup: Closed app tab for app ID: ${appId}`);
          } catch (error) {
            console.warn(`Cleanup: Could not close tab for app ID ${appId}:`, error);
          }
        }
      });
    };
  }, [openedTabs]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showRoleDropdown && !event.target.closest('.role-dropdown')) {
        setShowRoleDropdown(false);
        setRoleSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRoleDropdown]);

  const fetchApps = async () => {
    try {
      setLoading(true);
      const currentUserId = getCurrentUserId();
      const response = await fetchWithAuth(`${API_BASE_URL}/apps?user_id=${currentUserId}`);
      const data = await response.json();
      console.log('Fetched apps:', data.apps);
      // Log image URLs for debugging
      if (data.apps && data.apps.length > 0) {
        data.apps.forEach(app => {
          if (app.image_url) {
            console.log(`App "${app.title}" image_url:`, app.image_url, '→ Constructed:', getImageUrl(app.image_url));
          }
        });
      }
      setApps(data.apps || []);
    } catch (error) {
      console.error('Error fetching apps:', error);
      setError('Failed to load apps');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const currentUserId = getCurrentUserId();
      console.log('Fetching roles for user:', currentUserId);
      const response = await fetchWithAuth(`${API_BASE_URL}/app-roles?user_id=${currentUserId}`);
      const data = await response.json();
      console.log('Roles fetched:', data.roles);
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      setRoles([]); // Set empty array on error
    }
  };

  // Filter apps based on selected role
  const filteredApps = selectedRole 
    ? apps.filter(app => {
        const hasRole = app.allowed_roles && app.allowed_roles.includes(selectedRole);
        console.log(`App "${app.title}": allowed_roles =`, app.allowed_roles, 'includes', selectedRole, '?', hasRole);
        return hasRole;
      })
    : apps;

  console.log('Current state:', { selectedRole, totalApps: apps.length, filteredApps: filteredApps.length });

  // Filter roles based on search term
  const filteredRoles = roles.filter(role => 
    role.name && role.name.toLowerCase().includes(roleSearchTerm.toLowerCase())
  );

  // Handle role selection
  const handleRoleSelect = (roleId, roleName) => {
    console.log('Selecting role:', { roleId, roleName, roles }); // Debug log
    setSelectedRole(roleId);
    setShowRoleDropdown(false);
    setRoleSearchTerm('');
  };

  // Clear role filter
  const clearRoleFilter = () => {
    console.log('Clearing role filter'); // Debug log
    setSelectedRole('');
    setShowRoleDropdown(false);
    setRoleSearchTerm('');
  };

  // Get selected role name for display
  const getSelectedRoleName = () => {
    if (!selectedRole) return 'All Roles';
    const role = roles.find(role => role._id === selectedRole || role.id === selectedRole);
    console.log('Finding role for display:', { selectedRole, role, roles }); // Debug log
    return role?.name || 'Unknown Role';
  };

  const handleCreateApp = async () => {
    try {
      let imageUrl = formData.image_url;
      
      // Upload image if a file is selected
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const currentUserId = getCurrentUserId();
      const response = await fetchWithAuth(`${API_BASE_URL}/apps?user_id=${currentUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          image_url: imageUrl
        })
      });

      if (response.ok) {
        await fetchApps();
        setShowCreateModal(false);
        resetForm();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to create app');
      }
    } catch (error) {
      console.error('Error creating app:', error);
      setError('Failed to create app');
    }
  };

  const handleUpdateApp = async () => {
    try {
      let imageUrl = formData.image_url;
      
      // Upload new image if a file is selected
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const currentUserId = getCurrentUserId();
      const response = await fetchWithAuth(`${API_BASE_URL}/apps/${selectedApp.id}?user_id=${currentUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          image_url: imageUrl
        })
      });

      if (response.ok) {
        await fetchApps();
        setShowEditModal(false);
        resetForm();
        setSelectedApp(null);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update app');
      }
    } catch (error) {
      console.error('Error updating app:', error);
      setError('Failed to update app');
    }
  };

  const handleDeleteApp = async (appId) => {
    if (!confirm('Are you sure you want to delete this app?')) return;

    try {
      const currentUserId = getCurrentUserId();
      const response = await fetchWithAuth(`${API_BASE_URL}/apps/${appId}?user_id=${currentUserId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchApps();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete app');
      }
    } catch (error) {
      console.error('Error deleting app:', error);
      setError('Failed to delete app');
    }
  };

  const handleUpdatePermissions = async () => {
    try {
      const currentUserId = getCurrentUserId();
      const response = await fetchWithAuth(`${API_BASE_URL}/apps/${selectedApp.id}/permissions?user_id=${currentUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(permissionsData)
      });

      if (response.ok) {
        await fetchApps();
        setShowPermissionsModal(false);
        setSelectedApp(null);
        setPermissionsData({ allowed_roles: [] });
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update permissions');
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      setError('Failed to update permissions');
    }
  };

  // Handle image file selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload image to server
  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      setUploadingImage(true);
      const currentUserId = getCurrentUserId();
      const response = await fetchWithAuth(`${API_BASE_URL}/upload-image?user_id=${currentUserId}`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        return data.image_url;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      html_content: '',
      is_active: true
    });
    setImageFile(null);
    setImagePreview(null);
  };

  const openEditModal = (app) => {
    setSelectedApp(app);
    setFormData({
      title: app.title,
      description: app.description || '',
      image_url: app.image_url || '',
      html_content: app.html_content,
      is_active: app.is_active
    });
    setImagePreview(getImageUrl(app.image_url) || null);
    setImageFile(null);
    setShowEditModal(true);
  };

  const openPermissionsModal = (app) => {
    setSelectedApp(app);
    setPermissionsData({
      allowed_roles: app.allowed_roles || []
    });
    setShowPermissionsModal(true);
  };



  const handleRoleToggle = (roleId) => {
    setPermissionsData(prev => ({
      ...prev,
      allowed_roles: prev.allowed_roles.includes(roleId)
        ? prev.allowed_roles.filter(id => id !== roleId)
        : [...prev.allowed_roles, roleId]
    }));
  };

  // Share link functions
  const openShareModal = async (app) => {
    setSelectedApp(app);
    setShowShareModal(true);
    await fetchShareLinks(app.id);
  };

  const fetchShareLinks = async (appId) => {
    try {
      setLoadingShareLinks(true);
      const currentUserId = getCurrentUserId();
      const response = await fetchWithAuth(`${API_BASE_URL}/app-share-links/app/${appId}?user_id=${currentUserId}`);
      if (response.ok) {
        const data = await response.json();
        setShareLinks(data || []);
      }
    } catch (error) {
      console.error('Error fetching share links:', error);
      setShareLinks([]);
    } finally {
      setLoadingShareLinks(false);
    }
  };

  const createShareLink = async () => {
    try {
      const currentUserId = getCurrentUserId();
      const baseUrl = window.location.origin;
      
      const response = await fetchWithAuth(`${API_BASE_URL}/app-share-links/create?user_id=${currentUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: selectedApp.id,
          expires_in_days: parseInt(newShareLink.expires_in_days),
          max_access_count: parseInt(newShareLink.max_access_count),
          base_url: baseUrl,
          notes: newShareLink.notes || null
        })
      });

      if (response.ok) {
        await fetchShareLinks(selectedApp.id);
        setNewShareLink({
          expires_in_days: 7,
          max_access_count: 999,
          notes: ''
        });
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to create share link');
      }
    } catch (error) {
      console.error('Error creating share link:', error);
      setError('Failed to create share link');
    }
  };

  const toggleShareLink = async (shareToken, currentStatus) => {
    try {
      const currentUserId = getCurrentUserId();
      const response = await fetchWithAuth(`${API_BASE_URL}/app-share-links/${shareToken}/toggle?user_id=${currentUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !currentStatus
        })
      });

      if (response.ok) {
        await fetchShareLinks(selectedApp.id);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to toggle share link');
      }
    } catch (error) {
      console.error('Error toggling share link:', error);
      setError('Failed to toggle share link');
    }
  };

  const deleteShareLink = async (shareToken) => {
    if (!confirm('Are you sure you want to delete this share link?')) return;

    try {
      const currentUserId = getCurrentUserId();
      const response = await fetchWithAuth(`${API_BASE_URL}/app-share-links/${shareToken}?user_id=${currentUserId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchShareLinks(selectedApp.id);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to delete share link');
      }
    } catch (error) {
      console.error('Error deleting share link:', error);
      setError('Failed to delete share link');
    }
  };

  const copyToClipboard = (text, token) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  const getShareUrl = (shareToken) => {
    return `${window.location.origin}/public/app/${shareToken}`;
  };

  // Test basic tab opening functionality
  const testBasicTab = () => {
    console.log('=== Testing basic tab opening ===');
    
    // Test 1: Just open about:blank
    const basicTab = window.open('about:blank', '_blank');
    if (basicTab) {
      console.log('✓ Basic tab opened');
      setTimeout(() => {
        if (basicTab.closed) {
          console.log('✗ Basic tab closed after 3 seconds');
        } else {
          console.log('✓ Basic tab still open after 3 seconds');
        }
      }, 3000);
    } else {
      console.log('✗ Basic tab blocked');
    }
    
    // Test 2: Open external URL
    setTimeout(() => {
      const externalTab = window.open('https://www.google.com', '_blank');
      if (externalTab) {
        console.log('✓ External URL tab opened');
        setTimeout(() => {
          try {
            if (externalTab.closed) {
              console.log('✗ External tab closed after 3 seconds');
            } else {
              console.log('✓ External tab still open after 3 seconds');
            }
          } catch (e) {
            console.log('? Cannot check external tab status (cross-origin)');
          }
        }, 3000);
      } else {
        console.log('✗ External URL tab blocked');
      }
    }, 1000);
  };

  // Simple tab opening function with extensive debugging
  const openAppInNewTab = (app) => {
    console.log('=== Opening app in new tab ===');
    console.log('App:', app.title);
    console.log('Current time:', new Date().toISOString());
    
    // First test if any tab can stay open
    console.log('Running basic tab tests first...');
    testBasicTab();
    
    try {
      // Method 1: Completely empty tab first
      console.log('Method 1: Opening empty tab...');
      const emptyTab = window.open('about:blank', '_blank');
      
      if (!emptyTab) {
        alert('Pop-up blocked! Please enable pop-ups for this site.');
        return;
      }
      
      console.log('Empty tab opened, checking if it stays...');
      
      // Check if empty tab stays open
      setTimeout(() => {
        if (emptyTab.closed) {
          console.log('✗ Even empty tab closed! This indicates browser/system issue');
          alert('Empty tabs are closing immediately. This suggests browser security settings or extensions are blocking tabs.');
        } else {
          console.log('✓ Empty tab stays open, now adding content...');
          
          // Only add content if empty tab survived
          try {
            emptyTab.document.write(`
              <html>
              <head>
                <title>${app.title}</title>
                <style>
                  body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    background: #f0f0f0; 
                  }
                  .container { 
                    background: white; 
                    padding: 20px; 
                    border-radius: 8px; 
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>${app.title}</h1>
                  <p><strong>Description:</strong> ${app.description || 'No description'}</p>
                  <p><strong>Status:</strong> ${app.is_active ? 'Active' : 'Inactive'}</p>
                  <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 4px;">
                    <h3>Content:</h3>
                    ${app.html_content || '<p>No content available</p>'}
                  </div>
                  <div style="margin-top: 20px; padding: 10px; background: #e8f4f8; border-radius: 4px; font-size: 12px;">
                    <p><strong>Debug Info:</strong></p>
                    <p>Tab opened at: ${new Date().toISOString()}</p>
                    <p>App ID: ${app.id}</p>
                    <p>This tab should remain open until manually closed or logout.</p>
                  </div>
                </div>
              </body>
              </html>
            `);
            
            emptyTab.document.close();
            console.log('Content added to tab successfully');
            
            // Track it
            setOpenedTabs(prev => {
              const updated = new Map(prev);
              updated.set(app.id, emptyTab);
              return updated;
            });
            
          } catch (contentError) {
            console.error('Error adding content to tab:', contentError);
          }
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error in openAppInNewTab:', error);
      alert('Failed to open tab: ' + error.message);
    }
  };

  const openCodeModal = (app) => {
    try {
      // Check if content is a complete HTML document or just HTML fragment
      const hasHtmlTag = app.html_content && app.html_content.trim().toLowerCase().includes('<html');
      const hasDoctype = app.html_content && app.html_content.trim().toLowerCase().includes('<!doctype');
      
      let htmlContent;
      
      if (hasHtmlTag || hasDoctype) {
        // If it's already a complete HTML document, use it as-is but add our monitoring script
        const closingBodyTag = app.html_content.lastIndexOf('</body>');
        if (closingBodyTag !== -1) {
          // Insert our monitoring script before closing body tag
          htmlContent = app.html_content.substring(0, closingBodyTag) + `
  <script>
    // Update title
    document.title = '${app.title}';
    
    // Monitor authentication state and auto-close on logout
    function checkParentAuth() {
      try {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');
        if (!token && !userId) {
          console.log('Logout detected in app tab, closing window...');
          window.close();
        }
      } catch (error) {
        console.log('Cannot access parent authentication, closing tab...');
        window.close();
      }
    }
    
    // Check authentication every 2 seconds
    setInterval(checkParentAuth, 2000);
    
    // Listen for storage changes (logout events)
    window.addEventListener('storage', function(e) {
      if ((e.key === 'token' || e.key === 'userId') && !e.newValue) {
        setTimeout(() => {
          console.log('Storage change detected - authentication removed, closing tab...');
          window.close();
        }, 1000);
      }
    });
  </script>
          ` + app.html_content.substring(closingBodyTag);
        } else {
          // No body tag, append script to the end
          htmlContent = app.html_content + `
  <script>
    document.title = '${app.title}';
    function checkParentAuth() {
      try {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');
        if (!token && !userId) {
          window.close();
        }
      } catch (error) {
        window.close();
      }
    }
    setInterval(checkParentAuth, 2000);
    window.addEventListener('storage', function(e) {
      if ((e.key === 'token' || e.key === 'userId') && !e.newValue) {
        setTimeout(() => window.close(), 1000);
      }
    });
  </script>`;
        }
      } else {
        // It's just HTML fragment, create minimal wrapper
        htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${app.title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', sans-serif;
    }
    .no-content {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
      color: #666;
      font-size: 1.1rem;
      flex-direction: column;
    }
  </style>
</head>
<body>
  ${app.html_content || '<div class="no-content"><h2>No content available</h2><p>This app does not have any content to display.</p></div>'}
  
  <script>
    // Monitor authentication state and auto-close on logout
    function checkParentAuth() {
      try {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');
        if (!token && !userId) {
          console.log('Logout detected in app tab, closing window...');
          window.close();
        }
      } catch (error) {
        console.log('Cannot access parent authentication, closing tab...');
        window.close();
      }
    }
    
    // Check authentication every 2 seconds
    setInterval(checkParentAuth, 2000);
    
    // Listen for storage changes (logout events)  
    window.addEventListener('storage', function(e) {
      if ((e.key === 'token' || e.key === 'userId') && !e.newValue) {
        setTimeout(() => {
          console.log('Storage change detected - authentication removed, closing tab...');
          window.close();
        }, 1000);
      }
    });
  </script>
</body>
</html>`;
      }

      // Open in new tab using blob URL
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const newTab = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      
      if (newTab) {
        // Clean up blob URL
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
        }, 2000);
        
        // Track the tab
        setOpenedTabs(prev => {
          const updated = new Map(prev);
          updated.set(app.id, newTab);
          return updated;
        });
        
        // Simple cleanup when tab is closed
        const checkClosed = setInterval(() => {
          if (newTab.closed) {
            clearInterval(checkClosed);
            setOpenedTabs(prev => {
              const updated = new Map(prev);
              updated.delete(app.id);
              return updated;
            });
          }
        }, 5000);
        
      } else {
        // Fallback to data URL
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
        const dataTab = window.open(dataUrl, '_blank');
        
        if (dataTab) {
          setOpenedTabs(prev => {
            const updated = new Map(prev);
            updated.set(app.id, dataTab);
            return updated;
          });
        } else {
          alert('Please enable pop-ups for this site to open apps in new tabs.');
        }
      }
      
    } catch (error) {
      alert('Error opening app: ' + error.message);
    }
  };
  
  // Alternative approach: Modal with iframe
  const createIframeModal = (app) => {
    console.log('🖼️ Creating iframe modal as alternative...');
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      width: 90%;
      height: 90%;
      border-radius: 10px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;
    
    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      background: linear-gradient(135deg, #08B8EA 0%, #12d8fa 100%);
      color: white;
      padding: 15px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <h3 style="margin: 0;">${app.title}</h3>
      <button onclick="this.closest('[style*=position]').remove()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px;">×</button>
    `;
    
    // Create content area
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
      padding: 20px;
      height: calc(100% - 70px);
      overflow: auto;
    `;
    contentArea.innerHTML = `
      <p><strong>Description:</strong> ${app.description || 'No description'}</p>
      <p><strong>Status:</strong> <span style="color: ${app.is_active ? 'green' : 'red'}; font-weight: bold;">${app.is_active ? 'Active' : 'Inactive'}</span></p>
      <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #08B8EA;">
        <h4 style="margin-top: 0;">App Content:</h4>
        ${app.html_content || '<em>No content available for this app.</em>'}
      </div>
      <div style="margin-top: 20px; padding: 10px; background: #e8f5e8; border-radius: 5px; font-size: 14px;">
        ✅ <strong>Modal Alternative:</strong> This modal stays open until you close it manually. It's not affected by browser tab restrictions.
      </div>
    `;
    
    modalContent.appendChild(header);
    modalContent.appendChild(contentArea);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    console.log('✅ Iframe modal created successfully');
  };

  // Filter roles for permissions modal based on search term
  const getFilteredPermissionRoles = () => {
    if (!permissionSearchTerm.trim()) {
      return roles;
    }
    return roles.filter(role => 
      role.name && role.name.toLowerCase().includes(permissionSearchTerm.toLowerCase())
    );
  };

  // Handle select all / deselect all
  const handleSelectAllRoles = () => {
    const filteredRoles = getFilteredPermissionRoles();
    const allFilteredRoleIds = filteredRoles.map(role => role.id);
    const areAllSelected = allFilteredRoleIds.every(roleId => 
      permissionsData.allowed_roles.includes(roleId)
    );

    if (areAllSelected) {
      // Deselect all filtered roles
      setPermissionsData(prev => ({
        ...prev,
        allowed_roles: prev.allowed_roles.filter(roleId => 
          !allFilteredRoleIds.includes(roleId)
        )
      }));
    } else {
      // Select all filtered roles
      setPermissionsData(prev => ({
        ...prev,
        allowed_roles: [...new Set([...prev.allowed_roles, ...allFilteredRoleIds])]
      }));
    }
  };

  // Check if all filtered roles are selected
  const areAllFilteredRolesSelected = () => {
    const filteredRoles = getFilteredPermissionRoles();
    if (filteredRoles.length === 0) return false;
    return filteredRoles.every(role => 
      permissionsData.allowed_roles.includes(role.id)
    );
  };

  if (showFullPageView && selectedApp) {
    return (
      <div className="min-h-screen bg-transparent">
        {/* Header with back button */}
        <div className="bg-gray-900 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowFullPageView(false);
                  setSelectedApp(null);
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <X size={16} />
                Back to Apps
              </button>
              <h1 className="text-xl font-bold text-white">{selectedApp.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  selectedApp.is_active ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-400">
                {selectedApp.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Full page iframe */}
        <div className="h-[calc(100vh-80px)]">
          <iframe
            srcDoc={selectedApp.html_content}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            title={`App: ${selectedApp.title}`}
            style={{ 
              backgroundColor: 'white'
            }}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08B8EA] mx-auto mb-4"></div>
              <p className="text-lg text-[#08B8EA]">Loading apps...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white py-10 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl text-[#08B8EA]">
            </span>
            <div>
              
              
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Role Filter Dropdown */}
            <div className="relative role-dropdown">
              <button
                className={`${
                  selectedRole 
                    ? 'bg-[#08B8EA] hover:bg-[#12d8fa] border-[#08B8EA]' 
                    : 'bg-gray-700 hover:bg-gray-600 border-gray-600'
                } text-white px-4 py-2 rounded-lg flex items-center gap-2 min-w-[200px] justify-between border transition-colors`}
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              >
                <div className="flex items-center gap-2">
                  <Shield size={16} />
                  <span className="text-sm">
                    {getSelectedRoleName()}
                  </span>
                  {selectedRole && (
                    <span className="text-xs bg-white bg-opacity-20 px-1.5 py-0.5 rounded">
                      {filteredApps.length}
                    </span>
                  )}
                </div>
                <svg 
                  className={`w-4 h-4 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showRoleDropdown && (
                <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-hidden">
                  {/* Search Box */}
                  <div className="p-3 border-b border-gray-600">
                    <input
                      type="text"
                      placeholder="Search roles..."
                      value={roleSearchTerm}
                      onChange={(e) => setRoleSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowRoleDropdown(false);
                          setRoleSearchTerm('');
                        }
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 text-sm focus:outline-none focus:border-[#08B8EA]"
                      autoFocus
                    />
                  </div>

                  {/* Options */}
                  <div className="max-h-40 overflow-y-auto">
                    {/* All Roles Option */}
                    <button
                      className={`w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors text-sm ${
                        !selectedRole ? 'bg-gray-700 text-[#08B8EA]' : 'text-white'
                      }`}
                      onClick={clearRoleFilter}
                    >
                      <div className="flex justify-between items-center">
                        <span>All Roles</span>
                        <span className="text-xs text-gray-400">
                          {apps.length} app{apps.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>

                    {/* Role Options */}
                    {filteredRoles.length > 0 ? (
                      filteredRoles.map((role) => {
                        const roleId = role._id || role.id;
                        const roleAppCount = apps.filter(app => 
                          app.allowed_roles && app.allowed_roles.includes(roleId)
                        ).length;
                        
                        return (
                          <button
                            key={role._id || role.id}
                            className={`w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors text-sm ${
                              selectedRole === (role._id || role.id) ? 'bg-gray-700 text-[#08B8EA]' : 'text-white'
                            }`}
                            onClick={() => {
                              console.log('Role clicked:', role); // Debug log
                              handleRoleSelect(role._id || role.id, role.name);
                            }}
                          >
                            <div className="flex justify-between items-center">
                              <span>{role.name}</span>
                              <span className="text-xs text-gray-400">
                                {roleAppCount} app{roleAppCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-4 py-2 text-gray-400 text-sm">
                        {roleSearchTerm ? 'No roles found' : 'No roles available'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Create App Button */}
            {isAdmin && (
              <button
                className="bg-[#08B8EA] hover:bg-[#12d8fa] text-white text-xl font-bold px-7 py-2 rounded-2xl shadow-lg transition transform hover:scale-105 flex items-center gap-2"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={24} />
                Create App
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-900 border border-red-600 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-red-200">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-300 hover:text-red-100 text-xl font-bold"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Apps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApps.length > 0 ? (
            filteredApps.map((app) => (
              <div
                key={app.id}
                className="bg-gray-900 border border-gray-700 rounded-lg overflow-visible hover:border-[#08B8EA] transition-colors relative"
              >
                {/* Three-dot menu button - Absolute positioned in top right */}
                {isAdmin && (
                  <div className="absolute top-4 right-4 z-30">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === app.id ? null : app.id);
                      }}
                      className="bg-gray-800 bg-opacity-90 hover:bg-opacity-100 text-white p-2 rounded-full shadow-lg transition"
                    >
                      <MoreVertical size={20} />
                    </button>

                    {/* Dropdown Menu - Floating inside card */}
                    {openMenuId === app.id && (
                      <div 
                        ref={menuRef}
                        className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-40 overflow-hidden"
                        style={{
                          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(8, 184, 234, 0.2)'
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(app);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-700 text-white flex items-center gap-3 transition-colors duration-150 first:rounded-t-lg"
                        >
                          <Edit size={16} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedApp(app);
                            setFormData({
                              ...formData,
                              image_url: app.image_url || ''
                            });
                            setShowImageChangeModal(true);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-700 text-white flex items-center gap-3 transition-colors duration-150 border-t border-gray-700"
                        >
                          <Image size={16} />
                          <span>Change Image</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPermissionsModal(app);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-700 text-white flex items-center gap-3 transition-colors duration-150 border-t border-gray-700"
                        >
                          <Shield size={16} />
                          <span>Permissions</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openShareModal(app);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-700 text-white flex items-center gap-3 transition-colors duration-150 border-t border-gray-700"
                        >
                          <LinkIcon size={16} />
                          <span>Share Links</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteApp(app.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-red-600 text-red-400 hover:text-white flex items-center gap-3 transition-colors duration-150 border-t border-gray-700 rounded-b-lg"
                        >
                          <Trash2 size={16} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Clickable Card Area */}
                <div 
                  onClick={() => openCodeModal(app)}
                  className="cursor-pointer"
                >
                  {/* App Image or Placeholder */}
                  <div className="w-full h-48 bg-gray-800 overflow-hidden flex items-center justify-center">
                    {app.image_url ? (
                      <img 
                        src={getImageUrl(app.image_url)} 
                        alt={app.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Image failed to load:', app.image_url, 'Constructed URL:', getImageUrl(app.image_url));
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-gray-500"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><span class="mt-2 text-sm">Image Not Available</span></div>';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <Image size={48} strokeWidth={1.5} />
                        <span className="mt-2 text-sm">No Image</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6 pb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 pr-8">
                        <h3 className="text-xl font-bold text-white mb-1">{app.title}</h3>
                        {app.description && (
                          <p className="text-gray-400 text-sm">{app.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            app.is_active ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="text-xs text-gray-400">
                          {app.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Tab open indicator */}
                    {openedTabs.has(app.id) && openedTabs.get(app.id) && !openedTabs.get(app.id).closed && (
                      <div className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs w-fit">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        Tab Open
                      </div>
                    )}
                  </div>
                </div>

              {/* Show allowed roles only to admins or users with manage permissions */}
              {isAdmin && app.allowed_roles && app.allowed_roles.length > 0 && (
                <div className="px-6 pb-4 pt-2 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">Allowed Roles:</p>
                  <div className="flex flex-wrap gap-1">
                    {app.allowed_roles.map((roleId) => {
                      const role = roles.find(r => r.id === roleId);
                      return (
                        <span
                          key={roleId}
                          className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs"
                        >
                          {role?.name || `Role ${roleId}`}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-20">
              <Code size={64} className="mx-auto text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">
                {selectedRole ? 'No Apps Found for Selected Role' : 'No Apps Yet'}
              </h3>
              <p className="text-gray-500 mb-4">
                {selectedRole 
                  ? `No apps are assigned to the selected role "${getSelectedRoleName()}"`
                  : 'Create your first app to get started'
                }
              </p>
              {!selectedRole && isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-[#08B8EA] hover:bg-[#12d8fa] text-white px-6 py-3 rounded-lg"
                >
                  Create First App
                </button>
              )}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent bg-opacity-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {showCreateModal ? 'Create New App' : 'Edit App'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    resetForm();
                    setSelectedApp(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    App Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#08B8EA]"
                    placeholder="Enter app title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#08B8EA]"
                    placeholder="Enter app description"
                  />
                </div>

                {/* Image Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    App Image
                  </label>
                  
                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="relative w-full h-48 bg-gray-800 rounded-lg border border-gray-600 overflow-hidden mb-3">
                      <img 
                        src={imagePreview} 
                        alt="App preview" 
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setImageFile(null);
                          setFormData({ ...formData, image_url: '' });
                        }}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* Upload Button */}
                  <div className="flex gap-2">
                    <label className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 cursor-pointer transition-colors flex items-center justify-center gap-2">
                      <Upload size={16} />
                      <span>{imageFile ? 'Change Image' : 'Upload Image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-2">
                    Supported formats: JPG, PNG, GIF (Max 5MB)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    HTML Content
                  </label>
                  <textarea
                    value={formData.html_content}
                    onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#08B8EA] font-mono text-sm"
                    rows={15}
                    placeholder="Enter HTML content here..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-300">
                    Active
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    resetForm();
                    setSelectedApp(null);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                  disabled={uploadingImage}
                >
                  Cancel
                </button>
                <button
                  onClick={showCreateModal ? handleCreateApp : handleUpdateApp}
                  disabled={uploadingImage}
                  className="bg-[#08B8EA] hover:bg-[#12d8fa] text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingImage ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {showCreateModal ? 'Create' : 'Update'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Change Modal */}
        {showImageChangeModal && selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent bg-opacity-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Change App Image</h2>
                <button
                  onClick={() => {
                    setShowImageChangeModal(false);
                    setSelectedApp(null);
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Current Image Preview */}
                {selectedApp.image_url && !imagePreview && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Current Image
                    </label>
                    <div className="relative w-full h-48 bg-gray-800 rounded-lg border border-gray-600 overflow-hidden">
                      <img 
                        src={getImageUrl(selectedApp.image_url)} 
                        alt={selectedApp.title}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          console.error('Image preview failed to load:', selectedApp.image_url);
                          e.target.onerror = null;
                          e.target.src = '';
                          e.target.alt = 'Failed to load image';
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* New Image Preview */}
                {imagePreview && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      New Image Preview
                    </label>
                    <div className="relative w-full h-48 bg-gray-800 rounded-lg border border-gray-600 overflow-hidden">
                      <img 
                        src={imagePreview} 
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setImageFile(null);
                        }}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                <label className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 cursor-pointer transition-colors flex items-center justify-center gap-2">
                  <Upload size={20} />
                  <span>{imageFile ? 'Change Image' : 'Upload New Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
                
                <p className="text-xs text-gray-400 text-center">
                  Supported formats: JPG, PNG, GIF (Max 5MB)
                </p>
              </div>

              <div className="flex items-center justify-end gap-4 mt-6">
                <button
                  onClick={() => {
                    setShowImageChangeModal(false);
                    setSelectedApp(null);
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg"
                  disabled={uploadingImage}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      let imageUrl = selectedApp.image_url;
                      
                      // Upload new image if selected
                      if (imageFile) {
                        imageUrl = await uploadImage(imageFile);
                      }

                      const currentUserId = getCurrentUserId();
                      const response = await fetchWithAuth(`${API_BASE_URL}/apps/${selectedApp.id}?user_id=${currentUserId}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          title: selectedApp.title,
                          description: selectedApp.description,
                          image_url: imageUrl,
                          html_content: selectedApp.html_content,
                          is_active: selectedApp.is_active
                        })
                      });

                      if (response.ok) {
                        await fetchApps();
                        setShowImageChangeModal(false);
                        setSelectedApp(null);
                        setImageFile(null);
                        setImagePreview(null);
                      } else {
                        const errorData = await response.json();
                        setError(errorData.message || 'Failed to update image');
                      }
                    } catch (error) {
                      console.error('Error updating image:', error);
                      setError('Failed to update image');
                    }
                  }}
                  disabled={uploadingImage || !imageFile}
                  className="bg-[#08B8EA] hover:bg-[#12d8fa] text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingImage ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Image
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Permissions Modal */}
        {showPermissionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent bg-opacity-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">App Permissions</h2>
                <button
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setSelectedApp(null);
                    setPermissionsData({ allowed_roles: [] });
                    setPermissionSearchTerm('');
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-300 mb-4">
                  Select which roles can access this app:
                </p>
                
                {/* Search Bar */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search roles..."
                      value={permissionSearchTerm}
                      onChange={(e) => setPermissionSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#08B8EA]"
                    />
                  </div>
                </div>

                {/* Select All Option */}
                {getFilteredPermissionRoles().length > 0 && (
                  <div className="mb-3 pb-3 border-b border-gray-600">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={areAllFilteredRolesSelected()}
                        onChange={handleSelectAllRoles}
                        className="mr-3"
                      />
                      <span className="text-white font-medium">
                        {areAllFilteredRolesSelected() ? 'Deselect All' : 'Select All'}
                        {permissionSearchTerm && ` (${getFilteredPermissionRoles().length} filtered)`}
                      </span>
                    </label>
                  </div>
                )}

                {/* Roles List */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {getFilteredPermissionRoles().length > 0 ? (
                    getFilteredPermissionRoles().map((role) => (
                      <label key={role.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={permissionsData.allowed_roles.includes(role.id)}
                          onChange={() => handleRoleToggle(role.id)}
                          className="mr-3"
                        />
                        <span className="text-white">{role.name}</span>
                      </label>
                    ))
                  ) : (
                    <div className="text-gray-400 text-center py-4">
                      {permissionSearchTerm ? 'No roles found matching your search' : 'No roles available'}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-4">
                <button
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setSelectedApp(null);
                    setPermissionsData({ allowed_roles: [] });
                    setPermissionSearchTerm('');
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePermissions}
                  className="bg-[#08B8EA] hover:bg-[#12d8fa] text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Save size={16} />
                  Save Permissions
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share Links Modal */}
        {showShareModal && selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <LinkIcon size={24} className="text-[#08B8EA]" />
                  Share Links for "{selectedApp.title}"
                </h2>
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setSelectedApp(null);
                    setShareLinks([]);
                    setNewShareLink({
                      expires_in_days: 7,
                      max_access_count: 999,
                      notes: ''
                    });
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Create New Share Link Section */}
              <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Create New Share Link</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      Expires in (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={newShareLink.expires_in_days}
                      onChange={(e) => setNewShareLink({...newShareLink, expires_in_days: e.target.value})}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#08B8EA]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      Max Access Count
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newShareLink.max_access_count}
                      onChange={(e) => setNewShareLink({...newShareLink, max_access_count: e.target.value})}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#08B8EA]"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm text-gray-300 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={newShareLink.notes}
                    onChange={(e) => setNewShareLink({...newShareLink, notes: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#08B8EA]"
                    rows="2"
                    placeholder="Add notes about this share link..."
                  />
                </div>
                <button
                  onClick={createShareLink}
                  className="bg-[#08B8EA] hover:bg-[#12d8fa] text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Plus size={16} />
                  Generate Share Link
                </button>
              </div>

              {/* Existing Share Links */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Existing Share Links</h3>
                {loadingShareLinks ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#08B8EA] mx-auto"></div>
                    <p className="text-gray-400 mt-2">Loading share links...</p>
                  </div>
                ) : shareLinks.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <LinkIcon size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No share links created yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shareLinks.map((link) => {
                      const shareUrl = getShareUrl(link.share_token);
                      const isExpired = new Date(link.expires_at) < new Date();
                      const isMaxedOut = link.access_count >= link.max_access_count;
                      
                      return (
                        <div
                          key={link.id}
                          className={`p-4 rounded-lg border ${
                            link.is_active && !isExpired && !isMaxedOut
                              ? 'bg-gray-800 border-gray-700'
                              : 'bg-gray-800 bg-opacity-50 border-gray-700 opacity-60'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 text-xs rounded ${
                                  link.is_active && !isExpired && !isMaxedOut
                                    ? 'bg-green-500 bg-opacity-20 text-green-400'
                                    : 'bg-red-500 bg-opacity-20 text-red-400'
                                }`}>
                                  {!link.is_active ? 'Deactivated' : isExpired ? 'Expired' : isMaxedOut ? 'Max Reached' : 'Active'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  Created: {new Date(link.created_at).toLocaleDateString()}
                                </span>
                                <span className="text-xs text-gray-400">
                                  Expires: {new Date(link.expires_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 bg-gray-900 p-2 rounded border border-gray-600">
                                <input
                                  type="text"
                                  value={shareUrl}
                                  readOnly
                                  className="flex-1 bg-transparent text-sm text-gray-300 outline-none"
                                />
                                <button
                                  onClick={() => copyToClipboard(shareUrl, link.share_token)}
                                  className="text-[#08B8EA] hover:text-[#12d8fa] p-1"
                                  title="Copy link"
                                >
                                  {copiedToken === link.share_token ? (
                                    <span className="text-green-400 text-xs">Copied!</span>
                                  ) : (
                                    <Copy size={16} />
                                  )}
                                </button>
                                <a
                                  href={shareUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#08B8EA] hover:text-[#12d8fa] p-1"
                                  title="Open in new tab"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              </div>
                              {link.notes && (
                                <p className="text-xs text-gray-400 mt-2">
                                  Note: {link.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span>Accesses: {link.access_count} / {link.max_access_count}</span>
                              {link.last_accessed_at && (
                                <span>Last accessed: {new Date(link.last_accessed_at).toLocaleString()}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleShareLink(link.share_token, link.is_active)}
                                className={`flex items-center gap-1 px-3 py-1 rounded text-xs ${
                                  link.is_active
                                    ? 'bg-yellow-500 bg-opacity-20 text-yellow-400 hover:bg-opacity-30'
                                    : 'bg-green-500 bg-opacity-20 text-green-400 hover:bg-opacity-30'
                                }`}
                                title={link.is_active ? 'Deactivate link' : 'Reactivate link'}
                              >
                                {link.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                {link.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => deleteShareLink(link.share_token)}
                                className="bg-red-500 bg-opacity-20 text-red-400 hover:bg-opacity-30 px-3 py-1 rounded text-xs flex items-center gap-1"
                                title="Delete link"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setSelectedApp(null);
                    setShareLinks([]);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppsPage;
