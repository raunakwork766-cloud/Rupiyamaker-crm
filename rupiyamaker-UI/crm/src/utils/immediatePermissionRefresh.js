/**
 * Immediate Permission Refresh System
 * Ensures permissions are applied instantly without waiting for cache expiration
 */

import { setUserPermissions } from './permissions.js';

// API base URL - Use proxy consistently
const API_BASE_URL = '/api';

/**
 * Clear all permission-related caches
 */
export const clearPermissionCaches = () => {
    console.log('🧹 Clearing all permission caches...');
    
    // Clear localStorage caches
    localStorage.removeItem('userPermissions');
    
    // Clear cached sidebar data that includes permissions
    localStorage.removeItem('cachedSidebarMenuData_v1');
    
    // Clear any cached API responses for permissions
    const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes('user_permissions_') || 
        key.includes('permissions') ||
        key.includes('sidebar')
    );
    
    cacheKeys.forEach(key => {
        console.log(`🗑️ Removing cache key: ${key}`);
        localStorage.removeItem(key);
    });
    
    console.log('✅ Permission caches cleared');
};

/**
 * Fetch fresh permissions from API for a specific user
 */
export const fetchFreshPermissions = async (userId) => {
    console.log(`🔄 Fetching fresh permissions for user ${userId}...`);
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${API_BASE_URL}/users/${userId}/permissions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch permissions: ${response.status} ${response.statusText}`);
        }
        
        const permissionsData = await response.json();
        console.log('✅ Fresh permissions fetched:', permissionsData);
        
        return permissionsData;
    } catch (error) {
        console.error('❌ Error fetching fresh permissions:', error);
        throw error;
    }
};

/**
 * Refresh permissions immediately for the current user
 */
export const refreshCurrentUserPermissions = async () => {
    console.log('🔄 Starting immediate permission refresh...');
    
    try {
        // Get current user ID
        const userData = localStorage.getItem('userData');
        if (!userData) {
            throw new Error('No user data found in localStorage');
        }
        
        const { user_id } = JSON.parse(userData);
        if (!user_id) {
            throw new Error('No user ID found in user data');
        }
        
        // Step 1: Clear all caches
        clearPermissionCaches();
        
        // Step 2: Fetch fresh permissions
        const freshPermissions = await fetchFreshPermissions(user_id);
        
        // Step 3: Update localStorage with fresh data
        console.log('💾 Storing fresh permissions in localStorage...');
        localStorage.setItem('userPermissions', JSON.stringify(freshPermissions));
        
        // Step 4: Update permissions utility
        setUserPermissions(freshPermissions);
        
        // Step 5: Update userData in localStorage
        const currentUserData = JSON.parse(localStorage.getItem('userData'));
        const updatedUserData = {
            ...currentUserData,
            permissions: freshPermissions
        };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
        
        // Step 6: Trigger custom events to notify all components
        console.log('📡 Broadcasting permission update events...');
        
        // Event 1: permissionsUpdated (existing system)
        window.dispatchEvent(new CustomEvent('permissionsUpdated', { 
            detail: { 
                permissions: freshPermissions,
                timestamp: Date.now(),
                immediate: true
            } 
        }));
        
        // Event 2: immediatePermissionRefresh (new system)
        window.dispatchEvent(new CustomEvent('immediatePermissionRefresh', { 
            detail: { 
                permissions: freshPermissions,
                userId: user_id,
                timestamp: Date.now()
            } 
        }));
        
        // Event 3: localStorage change event (for components listening to storage)
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'userPermissions',
            newValue: JSON.stringify(freshPermissions),
            oldValue: null,
            storageArea: localStorage
        }));
        
        console.log('✅ Immediate permission refresh completed successfully');
        return freshPermissions;
        
    } catch (error) {
        console.error('❌ Failed to refresh permissions:', error);
        throw error;
    }
};

/**
 * Enhanced role update with immediate permission refresh
 */
export const updateRoleWithImmediateRefresh = async (roleData, roleId = null) => {
    console.log('🔄 Updating role with immediate permission refresh...');
    console.log('🔍 DEBUG: roleData received:', JSON.stringify(roleData, null, 2));
    console.log('🔍 DEBUG: roleId:', roleId);
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        // Get user_id from localStorage
        const userData = localStorage.getItem('userData');
        if (!userData) {
            throw new Error('No user data found in localStorage');
        }
        const { user_id } = JSON.parse(userData);
        
        const url = roleId 
            ? `${API_BASE_URL}/roles/${roleId}?user_id=${user_id}`
            : `${API_BASE_URL}/roles?user_id=${user_id}`;
        
        const method = roleId ? 'PUT' : 'POST';
        
        console.log(`🔍 DEBUG: URL: ${url}`);
        console.log(`🔍 DEBUG: Method: ${method}`);
        console.log(`🔍 DEBUG: user_id: ${user_id}`);
        console.log(`🔍 DEBUG: Request body:`, JSON.stringify(roleData, null, 2));
        
        // Step 1: Update the role
        console.log(`📤 ${method}ing role to ${url}...`);
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(roleData)
        });
        
        console.log('🔍 DEBUG: Response status:', response.status);
        console.log('🔍 DEBUG: Response ok:', response.ok);
        
        // Try to get response body even on error
        let result;
        try {
            result = await response.json();
            console.log('🔍 DEBUG: Response body:', JSON.stringify(result, null, 2));
        } catch (jsonError) {
            console.error('❌ Failed to parse response JSON:', jsonError);
            const textResponse = await response.text();
            console.log('🔍 DEBUG: Response text:', textResponse);
            throw new Error(`Backend response was not valid JSON: ${textResponse}`);
        }
        
        if (!response.ok) {
            console.error('❌ Backend returned error:', result);
            throw new Error(`Failed to update role: ${response.status} ${response.statusText} - ${JSON.stringify(result)}`);
        }
        
        console.log('✅ Role updated successfully:', result);
        
        // Step 2: Check if current user's role was affected
        // userData already retrieved earlier in the function
        const { role_id } = JSON.parse(userData);
        const updatedRoleId = roleId || result.id || result._id;
        
        console.log('🔍 DEBUG: Current user role_id:', role_id);
        console.log('🔍 DEBUG: Updated role ID:', updatedRoleId);
        
        if (role_id === updatedRoleId || role_id === roleId) {
            console.log('🎯 Current user\'s role was updated - refreshing permissions immediately');
            
            // Wait a brief moment for backend to process the role update
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Refresh permissions immediately
            await refreshCurrentUserPermissions();
        } else {
            console.log('ℹ️ Updated role does not affect current user');
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error updating role with immediate refresh:', error);
        console.error('❌ Error stack:', error.stack);
        throw error;
    }
};

/**
 * Setup permission refresh listeners for components
 */
export const setupPermissionRefreshListeners = (onPermissionUpdate) => {
    console.log('👂 Setting up permission refresh listeners...');
    
    const handlePermissionUpdate = (event) => {
        console.log('🔄 Permission update event received:', event.detail);
        if (onPermissionUpdate) {
            onPermissionUpdate(event.detail.permissions);
        }
    };
    
    // Listen to both events
    window.addEventListener('permissionsUpdated', handlePermissionUpdate);
    window.addEventListener('immediatePermissionRefresh', handlePermissionUpdate);
    
    // Return cleanup function
    return () => {
        window.removeEventListener('permissionsUpdated', handlePermissionUpdate);
        window.removeEventListener('immediatePermissionRefresh', handlePermissionUpdate);
    };
};

/**
 * Force refresh all permission-dependent components
 */
export const forceRefreshAllComponents = () => {
    console.log('🔄 Force refreshing all permission-dependent components...');
    
    // Trigger a global refresh event
    window.dispatchEvent(new CustomEvent('forceComponentRefresh', { 
        detail: { 
            timestamp: Date.now(),
            reason: 'permission_update'
        } 
    }));
    
    // Force a page refresh if needed (last resort)
    // window.location.reload();
};

export default {
    clearPermissionCaches,
    fetchFreshPermissions,
    refreshCurrentUserPermissions,
    updateRoleWithImmediateRefresh,
    setupPermissionRefreshListeners,
    forceRefreshAllComponents
};