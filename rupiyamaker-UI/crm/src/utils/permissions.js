/**
 * Permission utilities for frontend authorization
 * Supports both legacy permissions and new simplified 3-type system
 */

/**
 * Check if user is super admin
 * @param {Object|Array} userPermissions - The user's permissions object or array
 * @returns {boolean} - Whether the user is super admin
 */
export const isSuperAdmin = (userPermissions) => {
    if (!userPermissions) {
        userPermissions = getUserPermissions();
    }

    // CRITICAL: If permissions are empty or null, cannot be super admin
    if (!userPermissions) {
        console.log('🚫 isSuperAdmin: No permissions provided');
        return false;
    }

    // CRITICAL: If permissions is empty object, cannot be super admin
    if (typeof userPermissions === 'object' && !Array.isArray(userPermissions) && Object.keys(userPermissions).length === 0) {
        console.log('🚫 isSuperAdmin: Empty permissions object');
        return false;
    }

    // CRITICAL: If permissions is empty array, cannot be super admin
    if (Array.isArray(userPermissions) && userPermissions.length === 0) {
        console.log('🚫 isSuperAdmin: Empty permissions array');
        return false;
    }

    // Handle array format (new backend format)
    if (Array.isArray(userPermissions)) {
        const isAdmin = userPermissions === '*' || 
                       (userPermissions && userPermissions.includes && userPermissions.includes('*')) ||
                       userPermissions.some(perm => 
                         (perm.page === '*' && perm.actions === '*') ||
                         (perm.page === '*' && Array.isArray(perm.actions) && perm.actions.includes('*'))
                       );
        if (isAdmin) {
            console.log('✅ isSuperAdmin: Super admin detected (array format)');
            return true;
        }
    }

    // Legacy object format checks
    if (typeof userPermissions === 'object' && !Array.isArray(userPermissions)) {
        // Check for Super Admin with page "*" and actions "*" (normalized by backend)
        if (userPermissions?.["*"] === "*") {
            console.log('✅ isSuperAdmin: Super admin detected (wildcard)');
            return true;
        }

        // Global super admin format 1 - has access to everything (page "*" and actions "*")
        if (userPermissions?.pages === "*" && userPermissions?.actions === "*") {
            console.log('✅ isSuperAdmin: Super admin detected (pages/actions)');
            return true;
        }

        // Global super admin format 2 - backend format with Global: "*"
        if (userPermissions?.Global === "*" || userPermissions?.global === "*") {
            console.log('✅ isSuperAdmin: Super admin detected (Global)');
            return true;
        }

        // Check if user has wildcard permissions on all major modules (indicates super admin)
        const majorModules = ['Feeds', 'Leads', 'Tasks', 'Tickets', 'Settings'];
        const hasAllMajorModules = majorModules.every(module => 
            userPermissions?.[module] === "*" || 
            userPermissions?.[module.toLowerCase()] === "*"
        );
        
        if (hasAllMajorModules) {
            console.log('✅ isSuperAdmin: Super admin detected (all major modules)');
            return true;
        }
    }
    
    console.log('❌ isSuperAdmin: Not a super admin');
    return false;
};

/**
 * =============================================================================
 * NEW SIMPLIFIED 3-TYPE PERMISSION SYSTEM
 * =============================================================================
 */

/**
 * Get simplified permission level for a specific module
 * @param {string} module - Module name ('warnings', 'users', 'attendance', 'leaves')
 * @param {Object|Array} userPermissions - Optional permissions object/array
 * @returns {string} - Permission level: "own", "junior", or "all"
 */
export const getPermissionLevel = (module, userPermissions = null) => {
  if (!userPermissions) {
    userPermissions = getUserPermissions();
  }

  // Check if super admin first
  if (isSuperAdmin(userPermissions)) {
    return "all";
  }
  
  // Handle object format permissions (newer format)
  if (typeof userPermissions === 'object' && !Array.isArray(userPermissions)) {
    const modulePermissions = userPermissions[module];
    
    if (!modulePermissions) {
      return "own"; // Default if no permission found
    }
    
    // Check for "all" permission
    if (modulePermissions.all === true) {
      return "all";
    }
    
    // Check for "junior" permission
    if (modulePermissions.junior === true) {
      return "junior";
    }
    
    // Check for "own" permission
    if (modulePermissions.own === true) {
      return "own";
    }
    
    // Default to "own"
    return "own";
  }
  
  // Handle array format permissions (legacy format)
  if (Array.isArray(userPermissions)) {
    // Look for module-specific permissions
    const modulePermission = userPermissions.find(perm => perm.page === module);
    
    if (!modulePermission) {
      return "own"; // Default if no permission found
    }
    
    const actions = modulePermission.actions;
    
    // Check for "all" permission
    if (actions === "all" || 
        actions === "*" ||
        (Array.isArray(actions) && (actions.includes("all") || actions.includes("*")))) {
      return "all";
    }
    
    // Check for "junior" permission
    if (actions === "junior" ||
        (Array.isArray(actions) && actions.includes("junior"))) {
      return "junior";
    }
  }
  
  // Default to "own"
  return "own";
};

/**
 * Check if user can view all records in a module
 */
export const canViewAll = (module, userPermissions = null) => {
  return getPermissionLevel(module, userPermissions) === "all";
};

/**
 * Check if user can view subordinate records in a module
 */
export const canViewJunior = (module, userPermissions = null) => {
  const level = getPermissionLevel(module, userPermissions);
  return level === "junior" || level === "all";
};

/**
 * Check if user can only view own records in a module
 */
export const canViewOwn = (module, userPermissions = null) => {
  return getPermissionLevel(module, userPermissions) === "own";
};

/**
 * Check if user can create records in a module
 * Only users with "junior" or "all" permissions can create
 */
export const canCreate = (module, userPermissions = null) => {
  const level = getPermissionLevel(module, userPermissions);
  return level === "junior" || level === "all";
};

/**
 * Check if user can edit records in a module
 * Based on permission level and ownership
 */
export const canEdit = (module, recordOwnerId = null, userPermissions = null) => {
  const level = getPermissionLevel(module, userPermissions);
  const currentUserId = getCurrentUserId();
  
  if (level === "all") {
    return true; // Can edit all records
  }
  
  if (level === "junior") {
    // Can edit subordinate records + own records
    // This would need subordinate check from backend
    return true; // For now, allow junior users to edit
  }
  
  if (level === "own") {
    // Can only edit own records
    return recordOwnerId === currentUserId;
  }
  
  return false;
};

/**
 * Check if user can delete records in a module
 */
export const canDelete = (module, recordOwnerId = null, userPermissions = null) => {
  // Same logic as edit for now
  return canEdit(module, recordOwnerId, userPermissions);
};

/**
 * Get current user ID from localStorage
 */
export const getCurrentUserId = () => {
  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    return userData.user_id || userData._id || userData.id;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
};

/**
 * Get permission display text for UI
 */
export const getPermissionDisplayText = (module, userPermissions = null) => {
  const level = getPermissionLevel(module, userPermissions);
  
  switch (level) {
    case "all":
      return isSuperAdmin(userPermissions) ? "🔑 Super Admin Access" : "👑 Full Admin Access";
    case "junior":
      return "🔸 Manager Access (Subordinates + Own)";
    case "own":
      return "👤 Regular User Access (Own Only)";
    default:
      return "❓ Unknown Permission Level";
  }
};

/**
 * Get permission description for UI
 */
export const getPermissionDescription = (module, userPermissions = null) => {
  const level = getPermissionLevel(module, userPermissions);
  
  switch (level) {
    case "all":
      return "Can view, create, edit, and delete all records";
    case "junior":
      return "Can view subordinate records, create new records, and manage own records";
    case "own":
      return "Can only view and manage own records";
    default:
      return "No permissions assigned";
  }
};

/**
 * Debug function to log current permissions (for development)
 */
export const debugPermissions = (module, userPermissions = null) => {
  if (!userPermissions) {
    userPermissions = getUserPermissions();
  }
  
  console.log(`🔍 Permission Debug for ${module}:`, {
    isSuperAdmin: isSuperAdmin(userPermissions),
    permissionLevel: getPermissionLevel(module, userPermissions),
    canViewAll: canViewAll(module, userPermissions),
    canViewJunior: canViewJunior(module, userPermissions),
    canCreate: canCreate(module, userPermissions),
    displayText: getPermissionDisplayText(module, userPermissions),
    rawPermissions: userPermissions
  });
};

/**
 * =============================================================================
 * LEGACY PERMISSION SYSTEM (MAINTAINED FOR BACKWARD COMPATIBILITY)
 * =============================================================================
 */

/**
 * Check if a user has a specific permission
 * @param {Object} userPermissions - The user's permissions object from localStorage
 * @param {string} page - The page/module to check permission for (e.g., 'leads', 'feeds')
 * @param {string} action - The action to check (e.g., 'show', 'edit', 'delete')
 * @returns {boolean} - Whether the user has permission
 */
/**
 * Universal permission checker that handles the new backend format (array of objects)
 * This function properly handles "all" permissions as wildcards for any action
 * @param {Array|Object} userPermissions - User permissions (array format from backend)
 * @param {string} page - Page/section name (e.g., 'leads', 'tasks', 'tickets')
 * @param {string} action - Action to check (e.g., 'show', 'create', 'edit', 'delete')
 * @returns {boolean} - Whether user has the permission
 */
export const hasUniversalPermission = (userPermissions, page, action) => {
    console.log(`🔍 Universal permission check: ${page}.${action}`);
    
    // STRICT CHECK: If no permissions provided, deny access
    if (!userPermissions) {
        console.warn('🚫 hasUniversalPermission: No permissions provided');
        return false;
    }

    // Check for super admin permissions first
    if (Array.isArray(userPermissions)) {
        for (const perm of userPermissions) {
            // Skip invalid permission entries
            if (!perm || !perm.page) continue;

            // Check for global super admin permission
            if ((perm.page === '*' || perm.page === 'any' || perm.page === 'Global') &&
                (perm.actions === '*' || 
                 (Array.isArray(perm.actions) && perm.actions.includes('*')))) {
                console.log('✅ hasUniversalPermission: Super admin access');
                return true;
            }

            // Check if this is the specific page permission
            if (perm.page.toLowerCase() === page.toLowerCase()) {
                console.log(`🎯 Found permission entry for page: ${page}`);

                // Check if actions is a wildcard
                if (perm.actions === '*') {
                    console.log('✅ hasUniversalPermission: Wildcard actions');
                    return true;
                }

                // Check if actions is "all" (wildcard equivalent)
                if (perm.actions === 'all') {
                    console.log('✅ hasUniversalPermission: "All" actions (wildcard)');
                    return true;
                }

                // Check if actions is an array containing the permission
                if (Array.isArray(perm.actions)) {
                    // Check for wildcard in actions array
                    if (perm.actions.includes('*')) {
                        console.log('✅ hasUniversalPermission: Wildcard in actions array');
                        return true;
                    }

                    // Check for "all" permission - acts as wildcard for any action
                    if (perm.actions.includes('all')) {
                        console.log('✅ hasUniversalPermission: "All" in actions array (wildcard)');
                        return true;
                    }

                    // Check for specific permission
                    if (perm.actions.includes(action)) {
                        console.log(`✅ hasUniversalPermission: Specific action ${action} found`);
                        return true;
                    }
                }

                // Check if actions is a string matching the permission
                if (typeof perm.actions === 'string' && perm.actions === action) {
                    console.log(`✅ hasUniversalPermission: String action match ${action}`);
                    return true;
                }
            }
        }
    }

    // Fallback to legacy permission checking
    console.log('🔄 Falling back to legacy permission check');
    return hasPermission(userPermissions, page, action);
};

/**
 * Get permissions specifically for a page/section
 * @param {string} page - Page name (e.g., 'tasks', 'tickets', 'leads')
 * @param {string} action - Action to check
 * @returns {boolean} - Whether user has permission
 */
export const hasPagePermission = (page, action) => {
    const userPermissions = getUserPermissions();
    return hasUniversalPermission(userPermissions, page, action);
};

/**
 * Check if user has "all" permission for a specific section
 * @param {string} page - Page name (e.g., 'tasks', 'tickets', 'leads')
 * @returns {boolean} - Whether user has "all" permission for the page
 */
export const hasAllPermissionForPage = (page) => {
    return hasPagePermission(page, 'all');
};

// Convenience functions for common sections
export const hasTasksPermission = (action) => hasPagePermission('tasks', action);
export const hasTicketsPermission = (action) => hasPagePermission('tickets', action);
export const hasWarningsPermission = (action) => hasPagePermission('warnings', action);
export const hasEmployeesPermission = (action) => hasPagePermission('employees', action);
export const hasLeavesPermission = (action) => hasPagePermission('leaves', action);
export const hasAttendancePermission = (action) => hasPagePermission('attendance', action);
export const hasSettingsPermission = (action) => hasPagePermission('settings', action);
export const hasChartsPermission = (action) => hasPagePermission('charts', action);

export const hasPermission = (userPermissions, page, action) => {
    // STRICT CHECK: If no permissions provided, deny access
    if (!userPermissions) {
        console.warn('🚫 hasPermission: No permissions provided');
        return false;
    }

    // STRICT CHECK: If permissions is empty object, deny access
    if (typeof userPermissions === 'object' && !Array.isArray(userPermissions) && Object.keys(userPermissions).length === 0) {
        console.warn('🚫 hasPermission: Empty permissions object');
        return false;
    }

    // NEW FORMAT: Handle array of permission objects first
    if (Array.isArray(userPermissions)) {
        return hasUniversalPermission(userPermissions, page, action);
    }

    // LEGACY FORMAT: Handle old object-based permissions below
    
    // Super Admin check - page "*" with actions "*" (normalized by backend)
    if (userPermissions?.["*"] === "*") {
        console.log('✅ hasPermission: Super admin access (wildcard)');
        return true;
    }

    // Global super admin checks - has access to everything (page "*" and actions "*")
    if (userPermissions?.pages === "*" && userPermissions?.actions === "*") {
        console.log('✅ hasPermission: Super admin access (pages/actions)');
        return true;
    }
    
    // Global wildcard permission - super admin format
    if (userPermissions?.Global === "*" || userPermissions?.global === "*") {
        console.log('✅ hasPermission: Super admin access (Global)');
        return true;
    }

    // Normalize page name to check both capitalized and lowercase versions
    const pageLower = page.toLowerCase();
    const pageCapital = page.charAt(0).toUpperCase() + page.slice(1).toLowerCase();
    
    // Check with original case, lowercase, and capitalized first letter
    const pageVariations = [page, pageLower, pageCapital];
    
    for (const pageVar of pageVariations) {
        // Page-specific super admin check (page "leads" and actions "*" means super admin for leads)
        if (userPermissions?.[pageVar] === "*") {
            console.log(`✅ hasPermission: Page wildcard access for ${pageVar}`);
            return true;
        }
    
        // Check specific page and action
        if (userPermissions?.[pageVar]) {
            // If page permissions exist as object
            if (typeof userPermissions[pageVar] === 'object' && !Array.isArray(userPermissions[pageVar])) {
                // Check if the action is explicitly allowed
                if (userPermissions[pageVar][action] === true) {
                    console.log(`✅ hasPermission: Explicit permission ${pageVar}.${action}`);
                    return true;
                }
    
                // Check if all actions are allowed for this page (actions "*" or "all")
                if (userPermissions[pageVar]['*'] === true || userPermissions[pageVar]['all'] === true) {
                    console.log(`✅ hasPermission: Wildcard/All permission ${pageVar}.*`);
                    return true;
                }
            }
    
            // If page permissions exist as array (backwards compatibility)
            if (Array.isArray(userPermissions[pageVar])) {
                // Check if action is in the array or if '*' or 'all' is in the array
                if (userPermissions[pageVar].includes(action) || 
                    userPermissions[pageVar].includes('*') ||
                    userPermissions[pageVar].includes('all')) {
                    console.log(`✅ hasPermission: Array permission ${pageVar}.${action}`);
                    return true;
                }
            }
        }
    }

    console.warn(`🚫 hasPermission: No permission found for ${page}.${action}`);
    return false;
};

/**
 * Check if user can show the LoginCRM tab
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether the user can show LoginCRM tab
 */
export const canViewLoginCRM = (userPermissions) => {
    if (!userPermissions) {
        userPermissions = getUserPermissions();
    }

    // Case 1: Global super admin with wildcard permissions
    if (userPermissions?.pages === "*" && userPermissions?.actions === "*") {
        return true;
    }

    // Case 2: Page-specific sudo admin (page "login" and action *)
    if (userPermissions?.login === "*" ||
        (userPermissions?.login && typeof userPermissions.login === 'object' && userPermissions.login['*'] === true)) {
        return true;
    }

    // Case 3: Specific permission (page "login" action "show")
    return hasPermission(userPermissions, 'login', 'show');
};

/**
 * Get the currently logged in user's ID from localStorage
 * @returns {string|null} - The user ID or null if not found
 */
export const getUserId = () => {
    try {
        return localStorage.getItem('userId');
    } catch (error) {
        console.error('Error retrieving user ID:', error);
        return null;
    }
};

/**
 * Get the user's permissions from localStorage
 * @returns {Object} - The user's permissions object
 */
export const getUserPermissions = () => {
    try {
        const permissionsJSON = localStorage.getItem('userPermissions');
        if (!permissionsJSON) {
            console.warn('No permissions found in localStorage');
            return {};
        }
        return JSON.parse(permissionsJSON);
    } catch (error) {
        console.error('Error parsing user permissions:', error);
        return {};
    }
};

/**
 * Set the user's permissions in localStorage
 * @param {Object} permissions - The permissions to store
 */
export const setUserPermissions = (permissions) => {
    try {
        localStorage.setItem('userPermissions', JSON.stringify(permissions));
    } catch (error) {
        console.error('Error storing user permissions:', error);
    }
};

/**
 * Check if user can show a component or page
 * @param {string} page - The page/component identifier
 * @returns {boolean} - Whether the user can show the component/page
 */
export const canViewComponent = (page) => {
    const userPermissions = getUserPermissions();

    // Super admin can show anything
    if (userPermissions?.pages === "*" && userPermissions?.actions === "*") {
        return true;
    }

    // Page-specific super admin can show all components on that page
    if (userPermissions?.[page] === "*" ||
        (userPermissions?.[page] && typeof userPermissions[page] === 'object' && userPermissions[page]['*'] === true)) {
        return true;
    }

    // Check for specific show permission
    return hasPermission(userPermissions, page, 'show');
};

/**
 * Check if user can edit a post
 * @param {Object} post - The post object
 * @returns {boolean} - Whether the user can edit the post
 */
export const canEditPost = (post) => {
    if (!post) return false;

    const userPermissions = getUserPermissions();
    const userId = getUserId();

    // Super admin can edit any post
    if (userPermissions?.pages === "*" && userPermissions?.actions === "*") {
        return true;
    }

    // Feed admin can edit any post
    if (userPermissions?.feeds === "*" ||
        (userPermissions?.feeds && typeof userPermissions.feeds === 'object' && userPermissions.feeds['*'] === true)) {
        return true;
    }

    // Users can edit their own posts
    if (post.created_by === userId) {
        return true;
    }

    // Check for specific edit permission
    return hasPermission(userPermissions, 'feeds', 'edit');
};

/**
 * Check if user can delete a post
 * @param {Object} userPermissions - The user's permissions
 * @param {Object} post - The post object
 * @param {string} currentUserId - The current user ID
 * @returns {boolean} - Whether the user can delete the post
 */
export const canDeletePost = (userPermissions, post, currentUserId) => {
    if (!post || !userPermissions) return false;

    // Super admin can delete any post
    if (userPermissions?.pages === "*" && userPermissions?.actions === "*") {
        return true;
    }

    // Feed admin can delete any post
    if (userPermissions?.feeds === "*" ||
        (userPermissions?.feeds && typeof userPermissions.feeds === 'object' && userPermissions.feeds['*'] === true)) {
        return true;
    }

    // Check specific delete permission for feeds
    if (hasPermission(userPermissions, 'feeds', 'post')) {
        return true;
    }

    // Users can only delete their own posts (stricter than edit)
    // Check multiple possible field names for created_by/author ID
    if (currentUserId && (
        post.created_by === currentUserId ||
        post.authorId === currentUserId ||
        post.creator_id === currentUserId ||
        post.userId === currentUserId
    )) {
        return true;
    }

    // For deletion, only post owner, super admin or page admin can delete
    return false;
};

/**
 * Check if user can delete a comment
 * @param {Object} userPermissions - The user's permissions
 * @param {Object} comment - The comment object
 * @param {string} currentUserId - The current user ID
 * @returns {boolean} - Whether the user can delete the comment
 */
export const canDeleteComment = (userPermissions, comment, currentUserId) => {
    if (!comment || !userPermissions) return false;

    // Super admin can delete any comment
    if (userPermissions?.pages === "*" && userPermissions?.actions === "*") {
        return true;
    }

    // Feed admin can delete any comment
    if (userPermissions?.feeds === "*" ||
        (userPermissions?.feeds && typeof userPermissions.feeds === 'object' && userPermissions.feeds['*'] === true)) {
        return true;
    }

    // Check specific delete permission for feeds
    if (hasPermission(userPermissions, 'feeds', 'delete')) {
        return true;
    }

    // Users can only delete their own comments
    if (currentUserId && (
        comment.created_by === currentUserId ||
        comment.authorId === currentUserId ||
        comment.creator_id === currentUserId ||
        comment.userId === currentUserId ||
        comment.user_id === currentUserId
    )) {
        return true;
    }

    return false;
};

/**
 * Check if the current user can perform a specific action on a resource
 * @param {string} page - The page/resource name
 * @param {string} action - The action to check (show, edit, delete, etc)
 * @param {string|null} resourceOwnerId - Optional owner ID of the resource
 * @returns {boolean} - Whether the user can perform the action
 */
export const canPerformAction = (page, action, resourceOwnerId = null) => {
    const userPermissions = getUserPermissions();
    const userId = getUserId();

    // Super admin can do anything
    if (userPermissions?.pages === "*" && userPermissions?.actions === "*") {
        return true;
    }

    // Page admin can do anything on that page
    if (userPermissions?.[page] === "*" ||
        (userPermissions?.[page] && typeof userPermissions[page] === 'object' && userPermissions[page]['*'] === true)) {
        return true;
    }

    // Resource owners can always edit/delete their own resources
    if (resourceOwnerId && userId === resourceOwnerId && (action === 'edit' || action === 'delete')) {
        return true;
    }

    // For show permission, check if user has explicit show permission
    if (action === 'show') {
        return hasPermission(userPermissions, page, 'show');
    }

    // For edit permission, check explicit edit permission
    if (action === 'edit') {
        return hasPermission(userPermissions, page, 'edit');
    }

    // For delete permission, we're more restrictive
    // Only super admins, page admins or resource owners (checked above) can delete
    if (action === 'delete') {
        // Specifically check for delete permission for this additional check
        return hasPermission(userPermissions, page, 'delete');
    }

    // For any other action, check for specific permission
    return hasPermission(userPermissions, page, action);
};

/**
 * Check if user can approve lead reassignment requests
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can approve reassignments
 */
export const canApproveLeadReassignment = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always approve
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for leads wildcard permission
  if (userPermissions?.Leads === "*" || userPermissions?.leads === "*") {
    return true;
  }
  
  // Check for assign permission which grants admin-level access to the reassignment section
  if (hasPermission(userPermissions, 'leads', 'assign')) {
    return true;
  }
  
  // Check for legacy specific allow_reassign permission
  if (
    (userPermissions?.leads?.allow_reassign === true) ||
    (Array.isArray(userPermissions?.Leads) && userPermissions.Leads.includes('allow_reassign')) ||
    (Array.isArray(userPermissions?.leads) && userPermissions.leads.includes('allow_reassign'))
  ) {
    return true;
  }
  
  return false;
};

/**
 * Check if user can download obligation data
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can download obligation
 */
export const canDownloadObligation = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always download
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for leads wildcard permission
  if (userPermissions?.Leads === "*" || userPermissions?.leads === "*") {
    return true;
  }
  
  // Check for download_obligation permission
  return hasPermission(userPermissions, 'Leads', 'download_obligation') || 
         hasPermission(userPermissions, 'leads', 'download_obligation');
};

/**
 * Check if user can show employees data
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can show employees
 */
export const canViewEmployees = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for employees wildcard permission
  if (userPermissions?.Employees === "*" || userPermissions?.employees === "*") {
    return true;
  }
  
  // Check for employees_show permission
  return hasPermission(userPermissions, 'Employees', 'employees_show');
};

/**
 * Check if user can edit employee data
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can edit employees
 */
export const canEditEmployees = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for employees wildcard permission
  if (userPermissions?.Employees === "*" || userPermissions?.employees === "*") {
    return true;
  }
  
  // Check for employees_edit permission
  return hasPermission(userPermissions, 'Employees', 'employees_edit');
};

/**
 * Check if user can show leaves data
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can show leaves
 */
export const canViewLeaves = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for leaves wildcard permission
  if (userPermissions?.Leaves === "*" || userPermissions?.leaves === "*") {
    return true;
  }
  
  // Check for leaves_show permission
  return hasPermission(userPermissions, 'Leaves', 'leaves_show');
};

/**
 * Check if user has admin access to leaves
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user has admin access to leaves
 */
export const canAdminLeaves = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for leaves wildcard permission
  if (userPermissions?.Leaves === "*" || userPermissions?.leaves === "*") {
    return true;
  }
  
  // Check for leave_admin permission
  return hasPermission(userPermissions, 'Leaves', 'leave_admin');
};

/**
 * Check if user can show attendance data
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can show attendance
 */
export const canViewAttendance = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for attendance wildcard permission
  if (userPermissions?.Attendance === "*" || userPermissions?.attendance === "*") {
    return true;
  }
  
  // Check for attendance_show permission
  return hasPermission(userPermissions, 'Attendance', 'attendance_show');
};

/**
 * Check if user has admin access to attendance
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user has admin access to attendance
 */
export const canAdminAttendance = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for attendance wildcard permission
  if (userPermissions?.Attendance === "*" || userPermissions?.attendance === "*") {
    return true;
  }
  
  // Check for attendance_admin permission
  return hasPermission(userPermissions, 'Attendance', 'attendance_admin');
};

/**
 * Check if user can mark attendance
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can mark attendance
 */
export const canMarkAttendance = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for attendance wildcard permission
  if (userPermissions?.Attendance === "*" || userPermissions?.attendance === "*") {
    return true;
  }
  
  // Check for attendance_mark permission
  return hasPermission(userPermissions, 'Attendance', 'attendance_mark');
};

/**
 * Check if user can view junior leaves (hierarchical permission)
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can view subordinate leaves
 */
export const canViewJuniorLeaves = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for leaves edit permission (can see all)
  if (hasPermission(userPermissions, 'Leaves', 'edit')) {
    return true;
  }
  
  // Check for leaves wildcard permission
  if (userPermissions?.Leaves === "*" || userPermissions?.leaves === "*") {
    return true;
  }
  
  // Check for junior permission
  return hasPermission(userPermissions, 'Leaves', 'junior');
};

/**
 * Check if user can view junior attendance (hierarchical permission)
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can view subordinate attendance
 */
export const canViewJuniorAttendance = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for attendance admin permission (can see all)
  if (hasPermission(userPermissions, 'Attendance', 'admin')) {
    return true;
  }
  
  // Check for attendance wildcard permission
  if (userPermissions?.Attendance === "*" || userPermissions?.attendance === "*") {
    return true;
  }
  
  // Check for junior permission
  return hasPermission(userPermissions, 'Attendance', 'junior');
};

/**
 * Get user's visibility scope for leaves
 * @param {Object} userPermissions - The user's permissions object
 * @returns {string} - 'all', 'junior', or 'own'
 */
export const getLeavesVisibilityScope = (userPermissions) => {
  if (!userPermissions) return 'own';
  
  // Super admin or edit permission - can see all
  if (isSuperAdmin(userPermissions) || 
      hasPermission(userPermissions, 'Leaves', 'edit') ||
      hasPermission(userPermissions, 'Leaves', 'admin')) {
    return 'all';
  }
  
  // View junior permission - can see subordinates
  if (hasPermission(userPermissions, 'Leaves', 'junior')) {
    return 'junior';
  }
  
  // Default - can only see own
  return 'own';
};

/**
 * Get user's visibility scope for attendance
 * @param {Object} userPermissions - The user's permissions object
 * @returns {string} - 'all', 'junior', or 'own'
 */
export const getAttendanceVisibilityScope = (userPermissions) => {
  if (!userPermissions) return 'own';
  
  // Super admin or admin permission - can see all
  if (isSuperAdmin(userPermissions) || 
      hasPermission(userPermissions, 'Attendance', 'admin') ||
      hasPermission(userPermissions, 'Attendance', 'edit')) {
    return 'all';
  }
  
  // View junior permission - can see subordinates
  if (hasPermission(userPermissions, 'Attendance', 'junior')) {
    return 'junior';
  }
  
  // Default - can only see own
  return 'own';
};

/**
 * Check if user can show charts
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can show charts
 */
export const canViewCharts = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for charts wildcard permission
  if (userPermissions?.Charts === "*" || userPermissions?.charts === "*") {
    return true;
  }
  
  // Check for charts show permission
  return hasPermission(userPermissions, 'Charts', 'show');
};

/**
 * Check if user can create posts in feeds
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can create posts
 */
export const canCreatePosts = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always create posts
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for feeds wildcard permission
  if (userPermissions?.Feeds === "*" || userPermissions?.feeds === "*") {
    return true;
  }
  
  // Check for post permission
  return hasPermission(userPermissions, 'Feeds', 'post');
};

/**
 * Check if user can create tickets
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can create tickets
 */
export const canCreateTickets = (userPermissions) => {
  if (!userPermissions) return false;
  
  // Super admin can always create tickets
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for tickets wildcard permission
  if (userPermissions?.Tickets === "*" || userPermissions?.tickets === "*" ||
      userPermissions?.Tickets === "all" || userPermissions?.tickets === "all") {
    return true;
  }
  
  // Check for create permission
  return hasPermission(userPermissions, 'Tickets', 'create');
};

/**
 * Check if user can view Interview Panel
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can view Interview Panel
 */
export const canViewInterviewPanel = (userPermissions) => {
  if (!userPermissions) {
    userPermissions = getUserPermissions();
  }
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for Interview Panel show permission
  return hasPermission(userPermissions, 'interview', 'show');
};

/**
 * Check if user can view Reports
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can view Reports
 */
export const canViewReports = (userPermissions) => {
  if (!userPermissions) {
    userPermissions = getUserPermissions();
  }
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for Reports show permission
  return hasPermission(userPermissions, 'reports', 'show');
};

/**
 * Check if user can view Notifications management page
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can view Notifications
 */
export const canViewNotifications = (userPermissions) => {
  if (!userPermissions) {
    userPermissions = getUserPermissions();
  }
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for notification view permission
  return hasPermission(userPermissions, 'notification', 'show');
};

/**
 * Check if user can send notifications
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can send notifications
 */
export const canSendNotifications = (userPermissions) => {
  if (!userPermissions) {
    userPermissions = getUserPermissions();
  }
  
  // Super admin can always access
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for notification send permission
  return hasPermission(userPermissions, 'notification', 'send');
};

/**
 * Simple helper to check if user has delete permission for a module
 * @param {string} module - The module name (e.g., 'leads', 'tasks', 'employees')
 * @param {Object} userPermissions - Optional user permissions object
 * @returns {boolean} - Whether user can delete in this module
 */
export const hasDeletePermission = (module, userPermissions = null) => {
  if (!userPermissions) {
    userPermissions = getUserPermissions();
  }
  
  // Super admin can always delete
  if (isSuperAdmin(userPermissions)) {
    return true;
  }
  
  // Check for delete permission in the module
  return hasPermission(userPermissions, module, 'delete');
};