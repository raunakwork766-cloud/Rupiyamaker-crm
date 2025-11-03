/**
 * Permission utilities for frontend authorization
 */

/**
 * Check if user is super admin
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether the user is super admin
 */
export const isSuperAdmin = (userPermissions) => {
    if (!userPermissions) return false;

    // Check for Super Admin with page "*" and actions "*" (the exact format from your role)
    if (userPermissions?.["*"] === "*") {
        return true;
    }

    // Global super admin format 1 - has access to everything (page "*" and actions "*")
    if (userPermissions?.pages === "*" && userPermissions?.actions === "*") {
        return true;
    }

    // Global super admin format 2 - backend format with Global: "*"
    if (userPermissions?.Global === "*" || userPermissions?.global === "*") {
        return true;
    }

    // Check if user has wildcard permissions on all major modules (indicates super admin)
    const majorModules = ['Feeds', 'Leads', 'Tasks', 'Tickets', 'Settings'];
    const hasAllMajorModules = majorModules.every(module => 
        userPermissions?.[module] === "*" || 
        userPermissions?.[module.toLowerCase()] === "*"
    );
    
    if (hasAllMajorModules) {
        return true;
    }
    
    return false;
};

/**
 * Check if a user has a specific permission
 * @param {Object} userPermissions - The user's permissions object from localStorage
 * @param {string} page - The page/module to check permission for (e.g., 'leads', 'feeds')
 * @param {string} action - The action to check (e.g., 'view', 'edit', 'delete')
 * @returns {boolean} - Whether the user has permission
 */
export const hasPermission = (userPermissions, page, action) => {
    if (!userPermissions) {
        console.warn('No permissions provided to hasPermission check');
        return false;
    }

    // Super Admin check - page "*" with actions "*" (exact format from your role)
    if (userPermissions?.["*"] === "*") {
        return true;
    }

    // Global super admin checks - has access to everything (page "*" and actions "*")
    if (userPermissions?.pages === "*" && userPermissions?.actions === "*") {
        return true;
    }
    
    // Global wildcard permission - super admin format
    if (userPermissions?.Global === "*" || userPermissions?.global === "*") {
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
            return true;
        }
    
        // Check specific page and action
        if (userPermissions?.[pageVar]) {
            // If page permissions exist as object
            if (typeof userPermissions[pageVar] === 'object' && !Array.isArray(userPermissions[pageVar])) {
                // Check if the action is explicitly allowed
                if (userPermissions[pageVar][action] === true) {
                    return true;
                }
    
                // Check if all actions are allowed for this page (actions "*")
                if (userPermissions[pageVar]['*'] === true) {
                    return true;
                }
            }
    
            // If page permissions exist as array (backwards compatibility)
            if (Array.isArray(userPermissions[pageVar])) {
                // Check if action is in the array or if '*' is in the array
                if (userPermissions[pageVar].includes(action) || userPermissions[pageVar].includes('*')) {
                    return true;
                }
            }
        }
    }

    return false;
};

/**
 * Check if user can view the LoginCRM tab
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether the user can view LoginCRM tab
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
    return hasPermission(userPermissions, 'login', 'view');
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
 * Check if user can view a component or page
 * @param {string} page - The page/component identifier
 * @returns {boolean} - Whether the user can view the component/page
 */
export const canViewComponent = (page) => {
    const userPermissions = getUserPermissions();

    // Super admin can view anything
    if (userPermissions?.pages === "*" && userPermissions?.actions === "*") {
        return true;
    }

    // Page-specific super admin can view all components on that page
    if (userPermissions?.[page] === "*" ||
        (userPermissions?.[page] && typeof userPermissions[page] === 'object' && userPermissions[page]['*'] === true)) {
        return true;
    }

    // Check for specific view permission
    return hasPermission(userPermissions, page, 'view');
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
    if (hasPermission(userPermissions, 'feeds', 'delete')) {
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
 * @param {string} action - The action to check (view, edit, delete, etc)
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

    // For view permission, check if user has explicit view permission
    if (action === 'view') {
        return hasPermission(userPermissions, page, 'view');
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
 * Check if user can view employees data
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can view employees
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
 * Check if user can view leaves data
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can view leaves
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
 * Check if user can view attendance data
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can view attendance
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
 * Check if user can view charts
 * @param {Object} userPermissions - The user's permissions object
 * @returns {boolean} - Whether user can view charts
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