/**
 * Navigation utilities for sidebar and menus
 */

import { hasPermission, getUserPermissions, canViewLoginCRM, canViewNotifications } from './permissions';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Checks if a navigation item should be visible based on user permissions
 * @param {Object} navItem - The navigation item with page and optionally action
 * @returns {boolean} - Whether the item should be visible
 */
export const shouldShowNavItem = (navItem) => {
    const userPermissions = getUserPermissions();

    // If custom permission check function exists, use it
    if (navItem.checkPermission) {
        return navItem.checkPermission(userPermissions);
    }

    // If no permissions required
    if (!navItem.requiredPermission) return true;

    // Check for the required permission
    const { page, action } = navItem.requiredPermission;
    if (!page) return true; // No specific page permission required

    return hasPermission(userPermissions, page, action || 'view');
};

/**
 * Filter navigation items based on user permissions
 * @param {Array} navItems - Array of navigation items 
 * @returns {Array} - Filtered array with only visible items
 */
export const filterNavItems = (navItems) => {
    return navItems.filter(item => shouldShowNavItem(item));
};

// Navigation utility hook
export const useAppNavigation = () => {
  const navigate = useNavigate();

  // Navigate to route and update selected label
  const navigateToRoute = useCallback((path, selectedLabel) => {
    // Check for unsaved changes in LoginCRM before navigating
    if (window.checkLoginCrmUnsavedChanges && window.checkLoginCrmUnsavedChanges()) {
      console.log('🚫 Navigation: Blocking navigation due to unsaved changes in LoginCRM');
      
      // Dispatch a custom event to let LoginCRM handle the unsaved changes modal
      const event = new CustomEvent('sidebarNavigation', {
        detail: { 
          targetPath: path, 
          selectedLabel: selectedLabel,
          blocked: true 
        }
      });
      window.dispatchEvent(event);
      
      // Listen for confirmation from LoginCRM
      const handleNavigationConfirmed = () => {
        console.log('✅ Navigation: LoginCRM confirmed navigation, proceeding...');
        window.removeEventListener('loginCrmNavigationConfirmed', handleNavigationConfirmed);
        
        // Proceed with navigation after confirmation
        if (selectedLabel) {
          localStorage.setItem('selectedLabel', selectedLabel);
          const selectionEvent = new CustomEvent('sidebarSelectionChange', {
            detail: { selection: selectedLabel }
          });
          window.dispatchEvent(selectionEvent);
        }
        
        navigate(path, { replace: false });
      };
      
      window.addEventListener('loginCrmNavigationConfirmed', handleNavigationConfirmed);
      return; // Block navigation for now
    }
    
    // Normal navigation when no unsaved changes
    // Update selected label in localStorage for compatibility
    if (selectedLabel) {
      localStorage.setItem('selectedLabel', selectedLabel);
      // Dispatch event for components that listen to it
      const event = new CustomEvent('sidebarSelectionChange', {
        detail: { selection: selectedLabel }
      });
      window.dispatchEvent(event);
    }
    
    // Navigate without page reload
    navigate(path, { replace: false });
  }, [navigate]);

  // Navigate and replace current history entry
  const navigateAndReplace = useCallback((path, selectedLabel) => {
    if (selectedLabel) {
      localStorage.setItem('selectedLabel', selectedLabel);
      const event = new CustomEvent('sidebarSelectionChange', {
        detail: { selection: selectedLabel }
      });
      window.dispatchEvent(event);
    }
    
    navigate(path, { replace: true });
  }, [navigate]);

  // Go back in history
  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Go forward in history
  const goForward = useCallback(() => {
    navigate(1);
  }, [navigate]);

  return {
    navigateToRoute,
    navigateAndReplace,
    goBack,
    goForward
  };
};

// Route name to path mapping
export const ROUTES = {
  FEED: '/feed',
  LEAD_CRM: '/lead-crm',
  LEAD_DASHBOARD: '/lead-dashboard',
  CREATE_LEAD: '/create-lead',
  PL_ODD_LEADS: '/pl-odd-leads',
  HOME_LOAN_UPDATES: '/home-loan-updates',
  LOGIN_CRM: '/login-crm',
  CHARTS: '/charts',
  APPS: '/apps',
  TICKETS: '/tickets',
  NOTIFICATIONS: '/notifications',
  INTERVIEW_PANEL: '/interview-panel',
  PL_ODD_LOGIN: '/pl-odd-login',
  HOME_LOAN_LOGIN: '/home-loan-login',
  TASKS: '/tasks',
  EMPLOYEES: '/employees',
  LEAVES: '/leaves',
  ATTENDANCE: '/attendance',
  WARNINGS: '/warnings',
  ADD_TASK: '/add-task',
  SETTINGS: '/settings',
  REPORTS: '/reports'
};

// Label to route mapping for sidebar
export const LABEL_TO_ROUTE = {
  'Feed': ROUTES.FEED,
  'Lead CRM': ROUTES.LEAD_CRM,
  'LEAD CRM': ROUTES.LEAD_CRM,  // Adding uppercase variant
  'LEAD Dashboard': ROUTES.LEAD_DASHBOARD,
  'Create LEAD': ROUTES.CREATE_LEAD,
  'PL & ODD LEADS': ROUTES.PL_ODD_LEADS,
  'Home Loan Updates': ROUTES.HOME_LOAN_UPDATES,
  'LOGIN Dashboard': ROUTES.LOGIN_CRM,
  'Login CRM': ROUTES.LOGIN_CRM,
  'Charts': ROUTES.CHARTS,
  'Apps': ROUTES.APPS,
  'Ticket': ROUTES.TICKETS,
  'Notifications': ROUTES.NOTIFICATIONS,
  'Announcement': ROUTES.NOTIFICATIONS,  // Add mapping for Announcement to notifications route
  'Interview Panel': ROUTES.INTERVIEW_PANEL,
  'PL & ODD LOGIN': ROUTES.PL_ODD_LOGIN,
  'Home Loan LOGIN': ROUTES.HOME_LOAN_LOGIN,
  'Task': ROUTES.TASKS,
  'Employees': ROUTES.EMPLOYEES,
  'Leave': ROUTES.LEAVES,
  'Leaves': ROUTES.LEAVES,
  'Attendance': ROUTES.ATTENDANCE,
  'Warning Management': ROUTES.WARNINGS,
  'Warning': ROUTES.WARNINGS,
  'Warning Dashboard': ROUTES.WARNINGS,
  'All Warnings': ROUTES.WARNINGS,
  'My Warnings': ROUTES.WARNINGS,
  'Add Task': ROUTES.ADD_TASK,
  'Settings': ROUTES.SETTINGS,
  'Reports': ROUTES.REPORTS
};

// Get route path by label with dynamic loan type support
export const getRouteByLabel = (label) => {
  // Check static routes first
  if (LABEL_TO_ROUTE[label]) {
    return LABEL_TO_ROUTE[label];
  }
  
  // Handle dynamic loan type items
  if (label && typeof label === 'string') {
    // For Login CRM loan types (ending with " Login")
    if (label.endsWith(' Login')) {
      return ROUTES.LOGIN_CRM;
    }
    
    // For Lead CRM loan types - check against cached loan types
    try {
      const cachedLoanTypes = localStorage.getItem('cachedLoanTypes');
      if (cachedLoanTypes) {
        const loanTypes = JSON.parse(cachedLoanTypes);
        const isLoanType = loanTypes.some(lt => lt.name === label);
        if (isLoanType) {
          return ROUTES.LEAD_CRM;
        }
      }
    } catch (error) {
      console.error('Error checking cached loan types:', error);
    }
  }
  
  // Default fallback
  return ROUTES.FEED;
};

/**
 * Get navigation items for the sidebar
 * This centralized list makes it easier to manage navigation across the app
 * @returns {Array} - Array of navigation configurations
 */
export const getNavigationItems = () => {
    return [
        {
            key: 'lead-crm',
            label: 'Lead CRM',
            path: '/lead-crm',
            requiredPermission: { page: 'leads', action: 'show' }
        },
        {
            key: 'login-crm',
            label: 'Login CRM',
            path: '/login-crm',
            // Special permission check - will check for login page permissions
            // with proper sudo admin or specific view permission
            checkPermission: (userPermissions) => canViewLoginCRM(userPermissions)
        },
        {
            key: 'feed',
            label: 'Feed',
            path: '/feed',
            requiredPermission: { page: 'feeds', action: 'view' }
        },
        // Add HRMS section
        {
            key: 'hrms',
            label: 'HRMS',
            children: [
                {
                    key: 'employees',
                    label: 'Employees',
                    path: '/hrms/employees',
                    requiredPermission: { page: 'hrms', action: 'view' }
                }
            ],
            requiredPermission: { page: 'hrms', action: 'view' }
        },
        // Other navigation items...
    ];
};

// Legacy support for existing components
export const dispatchSidebarChange = (selection) => {
  const event = new CustomEvent('sidebarSelectionChange', {
    detail: { selection }
  });
  window.dispatchEvent(event);
};

export const navigateTo = (selection) => {
  dispatchSidebarChange(selection);
  localStorage.setItem('selectedLabel', selection);
};