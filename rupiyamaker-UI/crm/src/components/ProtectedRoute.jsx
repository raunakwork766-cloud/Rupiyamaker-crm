import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { 
  hasPermission, 
  getUserPermissions, 
  isSuperAdmin 
} from '../utils/permissions';

/**
 * ProtectedRoute Component
 * 
 * Wrapper component that checks user permissions before rendering the route.
 * Redirects to unauthorized page if user lacks required permissions.
 * 
 * @param {React.Component} children - The component to render if authorized
 * @param {string} requiredPage - The page/module name (e.g., 'employees', 'leads', 'hrms')
 * @param {string} requiredAction - The action required (e.g., 'show', 'view', 'edit')
 * @param {Array<Object>} alternativeChecks - Array of alternative permission checks [{page, action}]
 */
const ProtectedRoute = ({ 
  children, 
  requiredPage, 
  requiredAction = 'show',
  alternativeChecks = []
}) => {
  const userPermissions = getUserPermissions();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const hasPermissionsKey = useMemo(() => localStorage.getItem('userPermissions') !== null, []);
  const [isPermissionHydrating, setIsPermissionHydrating] = useState(
    !hasPermissionsKey && !!(token && userId)
  );

  useEffect(() => {
    if (!(token && userId)) {
      setIsPermissionHydrating(false);
      return;
    }

    // If permission key already exists, no hydration wait needed.
    if (localStorage.getItem('userPermissions') !== null) {
      setIsPermissionHydrating(false);
      return;
    }

    setIsPermissionHydrating(true);

    const intervalId = window.setInterval(() => {
      if (localStorage.getItem('userPermissions') !== null) {
        setIsPermissionHydrating(false);
        window.clearInterval(intervalId);
      }
    }, 100);

    // Fail-safe: avoid indefinite loading if permission key was never written.
    const timeoutId = window.setTimeout(() => {
      setIsPermissionHydrating(false);
      window.clearInterval(intervalId);
    }, 1200);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [token, userId]);
  
  console.log('==========================================');
  console.log('🔐 ProtectedRoute Check Started');
  console.log('User ID:', userId);
  console.log('Token exists:', !!token);
  console.log('Required Page:', requiredPage);
  console.log('Required Action:', requiredAction);
  console.log('User Permissions:', JSON.stringify(userPermissions, null, 2));
  console.log('Type of permissions:', typeof userPermissions);
  console.log('Is empty object:', typeof userPermissions === 'object' && !Array.isArray(userPermissions) && Object.keys(userPermissions).length === 0);
  console.log('==========================================');
  
  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!(token && userId);
  };

  // Redirect to login if not authenticated
  if (!isAuthenticated()) {
    console.log('🚫 Not authenticated - redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (isPermissionHydrating) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-white text-lg">Syncing permissions...</div>
      </div>
    );
  }

  // CRITICAL: Ensure we have valid permissions object BEFORE super admin check
  if (!userPermissions || (typeof userPermissions === 'object' && !Array.isArray(userPermissions) && Object.keys(userPermissions).length === 0)) {
    console.log('🚫 CRITICAL: No valid permissions found - redirecting to /unauthorized');
    console.log('userPermissions is:', userPermissions);
    console.log('Type:', typeof userPermissions);
    console.log('Is empty object:', typeof userPermissions === 'object' && Object.keys(userPermissions).length === 0);
    console.log('Keys:', userPermissions ? Object.keys(userPermissions) : 'null');
    return <Navigate to="/unauthorized" replace />;
  }

  // Super admins always have access (but only after confirming permissions exist)
  const isSuperAdminUser = isSuperAdmin(userPermissions);
  console.log('Is Super Admin:', isSuperAdminUser);
  if (isSuperAdminUser) {
    console.log('✅ Super admin access granted');
    return children;
  }

  // Check primary permission
  const hasMainPermission = requiredPage && requiredAction 
    ? hasPermission(userPermissions, requiredPage, requiredAction)
    : false;

  console.log(`🔍 Checking permission for ${requiredPage}/${requiredAction}:`, hasMainPermission);

  // Check alternative permissions if provided
  let hasAlternativePermission = false;
  if (alternativeChecks && alternativeChecks.length > 0) {
    hasAlternativePermission = alternativeChecks.some(check => {
      const result = hasPermission(userPermissions, check.page, check.action || 'show');
      console.log(`  - Alternative check ${check.page}/${check.action || 'show'}:`, result);
      return result;
    });
  }

  // Grant access if either main or alternative permission exists
  if (hasMainPermission || hasAlternativePermission) {
    console.log(`✅ Access granted to ${requiredPage}`);
    return children;
  }

  // Log the denied access attempt with full details
  console.log(`🚫 ACCESS DENIED to ${requiredPage}/${requiredAction}`);
  console.log('User permissions:', JSON.stringify(userPermissions, null, 2));
  console.log('Required page:', requiredPage);
  console.log('Required action:', requiredAction);
  console.log('Alternative checks:', alternativeChecks);

  // Redirect to unauthorized page
  return <Navigate to="/unauthorized" replace />;
};

export default ProtectedRoute;
