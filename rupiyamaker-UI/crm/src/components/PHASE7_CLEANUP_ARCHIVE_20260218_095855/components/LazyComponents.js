/**
 * Optimized Lazy Loading Component Definitions
 * Reduces initial bundle size by loading components only when needed
 */

import React from 'react';

// Minimal loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    <span className="ml-3 text-gray-600">Loading...</span>
  </div>
);

// Error boundary for lazy loaded components
class LazyErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lazy component failed to load:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center p-8">
          <h3 className="text-lg font-medium text-red-600">Failed to load component</h3>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Optimized lazy loading wrapper
const createLazyComponent = (importFn, displayName = 'LazyComponent') => {
  const LazyComponent = React.lazy(importFn);
  LazyComponent.displayName = displayName;
  
  return React.forwardRef((props, ref) => (
    <LazyErrorBoundary>
      <React.Suspense fallback={<LoadingSpinner />}>
        <LazyComponent {...props} ref={ref} />
      </React.Suspense>
    </LazyErrorBoundary>
  ));
};

// Core app components (loaded immediately)
export const Dashboard = createLazyComponent(
  () => import('../components/Dashboard'),
  'Dashboard'
);

// Employee management (heavy component - lazy load)
export const AllEmployees = createLazyComponent(
  () => import('../components/AllEmployees'),
  'AllEmployees'
);

export const EmployeeDetails = createLazyComponent(
  () => import('../components/EmployeeDetails'),
  'EmployeeDetails'
);

export const EmployeeForm = createLazyComponent(
  () => import('../components/EmployeeForm'),
  'EmployeeForm'
);

// Lead management (heavy components - lazy load)
export const LeadCRM = createLazyComponent(
  () => import('../components/LeadCRM'),
  'LeadCRM'
);

export const CreateLead = createLazyComponent(
  () => import('../components/CreateLead_new'),
  'CreateLead'
);

export const LeadsReport = createLazyComponent(
  () => import('../components/LeadsReport'),
  'LeadsReport'
);

// Task management
export const TaskPage = createLazyComponent(
  () => import('../components/Task'),
  'TaskPage'
);

export const CreateTask = createLazyComponent(
  () => import('../components/CreateTask'),
  'CreateTask'
);

export const EditTask = createLazyComponent(
  () => import('../components/EditTask'),
  'EditTask'
);

// Settings and admin (rarely used - lazy load)
export const SettingsPage = createLazyComponent(
  () => import('../components/SettingsPage'),
  'SettingsPage'
);

export const ChartPage = createLazyComponent(
  () => import('../components/ChartPage'),
  'ChartPage'
);

export const InterviewPanel = createLazyComponent(
  () => import('../components/InterviewPanel'),
  'InterviewPanel'
);

// Attendance and leaves
export const AttendancePage = createLazyComponent(
  () => import('../components/AttendancePage'),
  'AttendancePage'
);

export const LeavesPage = createLazyComponent(
  () => import('../components/LeavesPage'),
  'LeavesPage'
);

// Tickets and support
export const TicketPage = createLazyComponent(
  () => import('../components/TicketPage'),
  'TicketPage'
);

export const CreateTicket = createLazyComponent(
  () => import('../components/CreateTicket'),
  'CreateTicket'
);

// Notifications and feeds
export const NotificationsPage = createLazyComponent(
  () => import('../components/NotificationsPage'),
  'NotificationsPage'
);

export const Feed = createLazyComponent(
  () => import('../components/Feed'),
  'Feed'
);

// Authentication (critical - may not need lazy loading)
export const LoginCRM = createLazyComponent(
  () => import('../components/LoginCRM'),
  'LoginCRM'
);

// Utility function to preload critical components
export const preloadCriticalComponents = () => {
  // Preload components likely to be used immediately after login
  const criticalComponents = [
    () => import('../components/Dashboard'),
    () => import('../components/AllEmployees'),
    () => import('../components/LeadCRM')
  ];
  
  criticalComponents.forEach(importFn => {
    importFn().catch(console.error);
  });
};

// Dynamic component loader based on route
export const getComponentForRoute = (route) => {
  const routeComponentMap = {
    '/dashboard': Dashboard,
    '/employees': AllEmployees,
    '/leads': LeadCRM,
    '/leads/create': CreateLead,
    '/leads/report': LeadsReport,
    '/tasks': TaskPage,
    '/tasks/create': CreateTask,
    '/settings': SettingsPage,
    '/charts': ChartPage,
    '/attendance': AttendancePage,
    '/leaves': LeavesPage,
    '/tickets': TicketPage,
    '/notifications': NotificationsPage,
    '/feed': Feed,
    '/login': LoginCRM
  };
  
  return routeComponentMap[route] || Dashboard;
};

export default {
  AllEmployees,
  EmployeeDetails,
  EmployeeForm,
  LeadCRM,
  CreateLead,
  LeadsReport,
  TaskPage,
  CreateTask,
  EditTask,
  SettingsPage,
  ChartPage,
  InterviewPanel,
  AttendancePage,
  LeavesPage,
  TicketPage,
  CreateTicket,
  NotificationsPage,
  Feed,
  LoginCRM,
  Dashboard,
  preloadCriticalComponents,
  getComponentForRoute
};
