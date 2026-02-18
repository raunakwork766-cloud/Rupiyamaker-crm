import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RouteErrorBoundary } from '../components/ErrorBoundary';
import { Loader } from 'lucide-react';
import ProtectedRoute from '../components/ProtectedRoute';

// Lazy load components for better performance with error handling
const FeedPage = lazy(() => import('../components/Feed').catch(() => ({ default: () => <div>Error loading Feed component</div> })));
const CreateLead = lazy(() => import('../components/CreateLead_new').catch(() => ({ default: () => <div>Error loading CreateLead component</div> })));
const LeadCRM = lazy(() => import('../components/LeadCRM').catch(() => ({ default: () => <div>Error loading LeadCRM component</div> })));
// const CrmDashboard = lazy(() => import('../components/CrmDashboard').catch(() => ({ default: () => <div>Error loading CrmDashboard component</div> })));
const PlAndOddLeads = lazy(() => import('../components/PlAndOddLeads').catch(() => ({ default: () => <div>Error loading PlAndOddLeads component</div> })));
const HomeLoanUpdates = lazy(() => import('../components/HomeLoanUpdates').catch(() => ({ default: () => <div>Error loading HomeLoanUpdates component</div> })));
const LoginCRM = lazy(() => import('../components/LoginCRM').catch(() => ({ default: () => <div>Error loading LoginCRM component</div> })));
const ChartPage = lazy(() => import('../components/ChartPage').catch(() => ({ default: () => <div>Error loading ChartPage component</div> })));
const TicketPage = lazy(() => import('../components/TicketPage').catch(() => ({ default: () => <div>Error loading TicketPage component</div> })));
const InterviewPanel = lazy(() => import('../components/InterviewPanel').catch(() => ({ default: () => <div>Error loading InterviewPanel component</div> })));
const InterviewSettings = lazy(() => import('../components/InterviewSettings').catch(() => ({ default: () => <div>Error loading InterviewSettings component</div> })));
// const AllPlOddLeads = lazy(() => import('../components/AllPlOddLeads').catch(() => ({ default: () => <div>Error loading AllPlOddLeads component</div> })));
// const AllHomeLoan = lazy(() => import('../components/AllHomeLoan').catch(() => ({ default: () => <div>Error loading AllHomeLoan component</div> })));
const Task = lazy(() => import('../components/Task').catch(() => ({ default: () => <div>Error loading Task component</div> })));
const AllEmployees = lazy(() => import('../components/AllEmployees').catch(() => ({ default: () => <div>Error loading AllEmployees component</div> })));
const LeavesPage = lazy(() => import('../components/LeavesPage').catch(() => ({ default: () => <div>Error loading LeavesPage component</div> })));
const AttendancePage = lazy(() => import('../components/AttendancePage').catch(() => ({ default: () => <div>Error loading AttendancePage component</div> })));
const WarningPage = lazy(() => import('../components/WarningPage').catch(() => ({ default: () => <div>Error loading WarningPage component</div> })));
const AddTask = lazy(() => import('../components/AddTask').catch(() => ({ default: () => <div>Error loading AddTask component</div> })));
const SettingsPage = lazy(() => import('../components/SettingsPage').catch(() => ({ default: () => <div>Error loading SettingsPage component</div> })));
const AppsPage = lazy(() => import('../components/AppsPage').catch(() => ({ default: () => <div>Error loading AppsPage component</div> })));
const LeadsReport = lazy(() => import('../components/reports/ComprehensiveReport').catch(() => ({ default: () => <div>Error loading Reports component</div> })));
const NotificationsPage = lazy(() => import('../components/NotificationsPage').catch(() => ({ default: () => <div>Error loading NotificationsPage component</div> })));
const UnauthorizedPage = lazy(() => import('../pages/Unauthorized').catch(() => ({ default: () => <div>Error loading Unauthorized component</div> })));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center">
      <Loader className="w-8 h-8 animate-spin text-blue-500 mb-2" />
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

// Route configuration for sidebar navigation
const routes = [
  {
    path: '/feed',
    name: 'Feed',
    exact: true
  },
  {
    path: '/lead-crm',
    name: 'Lead CRM'
  },
  {
    path: '/lead-dashboard',
    name: 'LEAD Dashboard'
  },
  {
    path: '/login-crm',
    name: 'Login CRM'
  },
  {
    path: '/create-lead',
    name: 'Create LEAD'
  },
  {
    path: '/pl-odd-leads',
    name: 'PL & ODD LEADS'
  },
  {
    path: '/home-loan-updates',
    name: 'Home Loan Updates'
  },
  {
    path: '/login-crm',
    name: 'Login CRM'
  },
  {
    path: '/charts',
    name: 'Charts'
  },
  {
    path: '/apps',
    name: 'Apps'
  },
  {
    path: '/tickets',
    name: 'Ticket'
  },
  {
    path: '/interview-panel',
    name: 'Interview Panel'
  },
  {
    path: '/pl-odd-login',
    name: 'PL & ODD LOGIN'
  },
  {
    path: '/home-loan-login',
    name: 'Home Loan LOGIN'
  },
  {
    path: '/tasks',
    name: 'Task'
  },
  {
    path: '/employees',
    name: 'Employees'
  },
  {
    path: '/leaves',
    name: 'Leaves'
  },
  {
    path: '/leaves',
    name: 'Leave'
  },
  {
    path: '/attendance',
    name: 'Attendance'
  },
  {
    path: '/warnings',
    name: 'Warning Management'
  },
  {
    path: '/add-task',
    name: 'Add Task'
  },
  {
    path: '/settings',
    name: 'Settings'
  },
  {
    path: '/reports',
    name: 'Reports'
  },
  {
    path: '/notifications',
    name: 'All Notifications'
  }
];

// Main routing component
const AppRoutes = ({ user, forceFeedOnly = false }) => {
  // If forceFeedOnly is true (mobile), only render Feed component
  if (forceFeedOnly) {
    return (
      <RouteErrorBoundary routeName="Feed">
        <Suspense fallback={<LoadingSpinner />}>
          <FeedPage />
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  return (
    <Routes>
      {/* Default route */}
      <Route path="/" element={<Navigate to="/feed" replace />} />
      
      {/* Unauthorized page - no protection needed */}
      <Route 
        path="/unauthorized" 
        element={
          <RouteErrorBoundary routeName="Unauthorized">
            <Suspense fallback={<LoadingSpinner />}>
              <UnauthorizedPage />
            </Suspense>
          </RouteErrorBoundary>
        } 
      />
      
      {/* Feed - accessible to all authenticated users */}
      <Route 
        path="/feed" 
        element={
          <RouteErrorBoundary routeName="Feed">
            <Suspense fallback={<LoadingSpinner />}>
              <FeedPage />
            </Suspense>
          </RouteErrorBoundary>
        } 
      />
      
      {/* Lead CRM - Protected route */}
      <Route 
        path="/lead-crm" 
        element={
          <ProtectedRoute 
            requiredPage="leads" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Leads', action: 'show' },
              { page: 'LEADS', action: 'show' },
              { page: 'lead', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="LEAD CRM">
              <Suspense fallback={<LoadingSpinner />}>
                <LeadCRM />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* <Route 
        path="/lead-dashboard" 
        element={
          <RouteErrorBoundary routeName="LEAD Dashboard">
            <Suspense fallback={<LoadingSpinner />}>
              <CrmDashboard />
            </Suspense>
          </RouteErrorBoundary>
        } 
      /> */}
      
      {/* Create Lead - Protected route */}
      <Route 
        path="/create-lead" 
        element={
          <ProtectedRoute 
            requiredPage="leads" 
            requiredAction="create"
            alternativeChecks={[
              { page: 'Leads', action: 'create' },
              { page: 'leads', action: 'show' },
              { page: 'Leads', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Create LEAD">
              <Suspense fallback={<LoadingSpinner />}>
                <CreateLead />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* PL & ODD Leads - Protected route */}
      <Route 
        path="/pl-odd-leads" 
        element={
          <ProtectedRoute 
            requiredPage="leads" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Leads', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="PL & ODD LEADS">
              <Suspense fallback={<LoadingSpinner />}>
                <PlAndOddLeads />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Home Loan Updates - Protected route */}
      <Route 
        path="/home-loan-updates" 
        element={
          <ProtectedRoute 
            requiredPage="leads" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Leads', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Home Loan Updates">
              <Suspense fallback={<LoadingSpinner />}>
                <HomeLoanUpdates />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Login CRM - Protected route */}
      <Route 
        path="/login-crm" 
        element={
          <ProtectedRoute 
            requiredPage="login" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Login', action: 'show' },
              { page: 'logins', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Login CRM">
              <Suspense fallback={<LoadingSpinner />}>
                <LoginCRM />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Charts - Protected route */}
      <Route 
        path="/charts" 
        element={
          <ProtectedRoute 
            requiredPage="reports" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Reports', action: 'show' },
              { page: 'charts', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Charts">
              <Suspense fallback={<LoadingSpinner />}>
                <ChartPage />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Apps - Protected route */}
      <Route 
        path="/apps" 
        element={
          <ProtectedRoute 
            requiredPage="apps" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Apps', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Apps">
              <Suspense fallback={<LoadingSpinner />}>
                <AppsPage />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Tickets - Protected route */}
      <Route 
        path="/tickets" 
        element={
          <ProtectedRoute 
            requiredPage="tickets" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Tickets', action: 'show' },
              { page: 'ticket', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Ticket">
              <Suspense fallback={<LoadingSpinner />}>
                <TicketPage />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Interview Panel - Protected route */}
      <Route 
        path="/interview-panel" 
        element={
          <ProtectedRoute 
            requiredPage="interview" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Interview', action: 'show' },
              { page: 'interviews', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Interview Panel">
              <Suspense fallback={<LoadingSpinner />}>
                <InterviewPanel />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />

      {/* Interview Settings - Protected route */}
      <Route 
        path="/interview-settings" 
        element={
          <ProtectedRoute 
            requiredPage="interview" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Interview', action: 'show' },
              { page: 'interviews', action: 'show' },
              { page: 'settings', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Interview Settings">
              <Suspense fallback={<LoadingSpinner />}>
                <InterviewSettings />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Tasks - Protected route */}
      <Route 
        path="/tasks" 
        element={
          <ProtectedRoute 
            requiredPage="tasks" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Tasks', action: 'show' },
              { page: 'task', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Task">
              <Suspense fallback={<LoadingSpinner />}>
                <Task />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Employees - PROTECTED ROUTE - Main fix for the issue */}
      <Route 
        path="/employees" 
        element={
          <ProtectedRoute 
            requiredPage="employees" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Employees', action: 'show' },
              { page: 'hrms', action: 'show' },
              { page: 'HRMS', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Employees">
              <Suspense fallback={<LoadingSpinner />}>
                <AllEmployees />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Leaves - PROTECTED ROUTE */}
      <Route 
        path="/leaves" 
        element={
          <ProtectedRoute 
            requiredPage="leaves" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Leaves', action: 'show' },
              { page: 'hrms', action: 'show' },
              { page: 'leave', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Leaves">
              <Suspense fallback={<LoadingSpinner />}>
                <LeavesPage />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Attendance - PROTECTED ROUTE */}
      <Route 
        path="/attendance" 
        element={
          <ProtectedRoute 
            requiredPage="attendance" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Attendance', action: 'show' },
              { page: 'hrms', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Attendance">
              <Suspense fallback={<LoadingSpinner />}>
                <AttendancePage />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Warnings - PROTECTED ROUTE */}
      <Route 
        path="/warnings" 
        element={
          <ProtectedRoute 
            requiredPage="warnings" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Warnings', action: 'show' },
              { page: 'warning', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Warning Management">
              <Suspense fallback={<LoadingSpinner />}>
                <WarningPage />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Add Task - Protected route */}
      <Route 
        path="/add-task" 
        element={
          <ProtectedRoute 
            requiredPage="tasks" 
            requiredAction="create"
            alternativeChecks={[
              { page: 'Tasks', action: 'create' },
              { page: 'tasks', action: 'show' },
              { page: 'task', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Add Task">
              <Suspense fallback={<LoadingSpinner />}>
                <AddTask />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Settings - PROTECTED ROUTE */}
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute 
            requiredPage="settings" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Settings', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Settings">
              <Suspense fallback={<LoadingSpinner />}>
                <SettingsPage />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Reports - Protected route */}
      <Route 
        path="/reports" 
        element={
          <ProtectedRoute 
            requiredPage="reports" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Reports', action: 'show' },
              { page: 'report', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="Reports">
              <Suspense fallback={<LoadingSpinner />}>
                <LeadsReport />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Notifications - Protected route */}
      <Route 
        path="/notifications" 
        element={
          <ProtectedRoute 
            requiredPage="notifications" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Notifications', action: 'show' },
              { page: 'notification', action: 'show' },
              { page: 'announcement', action: 'show' }
            ]}
          >
            <RouteErrorBoundary routeName="All Notifications">
              <Suspense fallback={<LoadingSpinner />}>
                <NotificationsPage />
              </Suspense>
            </RouteErrorBoundary>
          </ProtectedRoute>
        } 
      />
      
      {/* Catch-all route for 404 */}
      <Route 
        path="*" 
        element={
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Page Not Found</h2>
            <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
            <Navigate to="/feed" replace />
          </div>
        } 
      />
    </Routes>
  );
};

// Export routes configuration for sidebar navigation
export const getRouteConfig = () => routes;

// Helper to get route by name
export const getRouteByName = (name) => {
  return routes.find(route => route.name === name);
};

// Helper to get path by name
export const getPathByName = (name) => {
  const route = getRouteByName(name);
  return route ? route.path : '/feed';
};

export default AppRoutes;
