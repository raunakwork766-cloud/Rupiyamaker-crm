/**
 * Immediate Permission Refresh System
 * Ensures permissions are applied instantly without waiting for cache expiration
 */

import { setUserPermissions } from './permissions.js';

// API base URL - Use proxy consistently
const API_BASE_URL = '/api';

/**
 * Clear permission-related derived caches.
 * Keeps the current `userPermissions` key intact until fresh permissions are ready
 * so route guards never see a temporary null state.
 */
export const clearPermissionCaches = () => {
    console.log('🧹 Clearing derived permission caches...');

    // Clear cached sidebar data that includes permissions
    localStorage.removeItem('cachedSidebarMenuData_v1');

    // Clear derived permission/sidebar caches but keep canonical userPermissions
    const cacheKeys = Object.keys(localStorage).filter((key) =>
        key !== 'userPermissions' && (
            key.includes('user_permissions_') ||
            key.includes('cached_permissions') ||
            key.includes('sidebar')
        )
    );

    cacheKeys.forEach((key) => {
        console.log(`🗑️ Removing cache key: ${key}`);
        localStorage.removeItem(key);
    });

    console.log('✅ Derived permission caches cleared');
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
        
        const response = await fetch(`${API_BASE_URL}/users/permissions/${userId}`, {
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
        
        // Convert array format to object format (same as Login.jsx does at login time)
        // so that Sidebar and ProtectedRoute object-format checks work correctly.
        let normalized = permissionsData;
        if (Array.isArray(permissionsData)) {
            normalized = {};
            permissionsData.forEach(perm => {
                if (!perm.page || !perm.actions) return;
                if (!normalized[perm.page]) normalized[perm.page] = {};
                const actions = Array.isArray(perm.actions) ? perm.actions : [perm.actions];
                if (actions.includes('*')) {
                    normalized[perm.page] = '*';
                } else {
                    actions.forEach(action => {
                        if (typeof normalized[perm.page] !== 'object') return;
                        normalized[perm.page][action] = true;
                    });
                }
            });
        }
        
        return normalized;
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
        
        // Step 1: Fetch fresh permissions first (no temporary key deletion)
        const freshPermissions = await fetchFreshPermissions(user_id);

        // Step 2: Clear derived caches, then atomically replace canonical permissions
        clearPermissionCaches();
        console.log('💾 Storing fresh permissions in localStorage...');
        localStorage.setItem('userPermissions', JSON.stringify(freshPermissions));

        // Step 3: Update permissions utility
        setUserPermissions(freshPermissions);

        // Step 4: Update userData in localStorage
        const currentUserDataRaw = localStorage.getItem('userData');
        const currentUserData = currentUserDataRaw ? JSON.parse(currentUserDataRaw) : {};
        const updatedUserData = {
            ...currentUserData,
            permissions: freshPermissions
        };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));

        // Step 5: Trigger custom events to notify all components
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
        
        console.log(` ${method}ing role to ${url}...`);
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(roleData)
        });
        
        // Try to get response body even on error
        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            console.error('❌ Failed to parse response JSON:', jsonError);
            const textResponse = await response.text();
            throw new Error(`Backend response was not valid JSON: ${textResponse}`);
        }
        
        if (!response.ok) {
            console.error('❌ Backend returned error:', result);
            throw new Error(`Failed to update role: ${response.status} ${response.statusText} - ${JSON.stringify(result)}`);
        }
        
        console.log('✅ Role updated successfully:', result);
        
        // Step 2: Check if current user's role was affected
        // userData already retrieved earlier in the function
        const parsedUserData = JSON.parse(userData);
        // Support both flat role_id and nested role._id (Login.jsx stores as role: {_id: ...})
        const currentRoleId = parsedUserData.role_id || parsedUserData.role?._id || parsedUserData.role?.id;
        const updatedRoleId = roleId || result.id || result._id;
        
        if (currentRoleId && (currentRoleId === updatedRoleId || currentRoleId === roleId)) {
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