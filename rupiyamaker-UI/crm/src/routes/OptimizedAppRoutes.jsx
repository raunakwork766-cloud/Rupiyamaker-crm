/**
 * Optimized routing system with lazy loading and code splitting
 * This improves initial load time by loading components only when needed
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import DetailedErrorBoundary from '../components/DetailedErrorBoundary.jsx';
import NotFoundPage from '../components/NotFoundPage.jsx';
import ProtectedRoute from '../components/ProtectedRoute';

// Lazy load components for better performance - using direct import functions
const createLazyComponent = (importFunc, componentName) => {
  return lazy(() => 
    importFunc().catch(error => {
      console.error(`Failed to load component ${componentName}:`, error);
      // Return a fallback component
      return {
        default: () => (
          <div className="p-6 text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Component Not Found</h2>
            <p className="text-gray-600">Failed to load {componentName}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        )
      };
    })
  );
};

const LazyAllEmployees = createLazyComponent(() => import('../components/AllEmployees.jsx'), 'AllEmployees');
const LazyLeadCRM = createLazyComponent(() => import('../components/LeadCRM.jsx'), 'LeadCRM');
const LazyCreateLead = createLazyComponent(() => import('../components/CreateLead_new.jsx'), 'CreateLead');
const LazyTask = createLazyComponent(() => import('../components/Task.jsx'), 'Task');
const LazyCreateTask = createLazyComponent(() => import('../components/CreateTask.jsx'), 'CreateTask');
const LazyEditTask = createLazyComponent(() => import('../components/EditTask.jsx'), 'EditTask');
const LazyTicketPage = createLazyComponent(() => import('../components/TicketPage.jsx'), 'TicketPage');
const LazyFeed = createLazyComponent(() => import('../components/Feed.jsx'), 'Feed');
const LazySettingsPage = createLazyComponent(() => import('../components/SettingsPage.jsx'), 'SettingsPage');
const LazyInterviewPanel = createLazyComponent(() => import('../components/InterviewPanel.jsx'), 'InterviewPanel');
const LazyInterviewSettings = createLazyComponent(() => import('../components/InterviewSettings.jsx'), 'InterviewSettings');
const LazyEmployeeDetails = createLazyComponent(() => import('../components/EmployeeDetails.jsx'), 'EmployeeDetails');
const LazyLoginCRM = createLazyComponent(() => import('../components/LoginCRM.jsx'), 'LoginCRM');
const LazyAppsPage = createLazyComponent(() => import('../components/AppsPage.jsx'), 'AppsPage');
const LazyAttendancePage = createLazyComponent(() => import('../components/AttendancePage.jsx'), 'AttendancePage');
const LazyLeavesPage = createLazyComponent(() => import('../components/LeavesPage.jsx'), 'LeavesPage');
const LazyChartPage = createLazyComponent(() => import('../components/ChartPage.jsx'), 'ChartPage');
const LazyWarningPage = createLazyComponent(() => import('../components/WarningPage.jsx'), 'WarningPage');
const LazyPermissionTest = createLazyComponent(() => import('../components/PermissionTest.jsx'), 'PermissionTest');
const LazyLeadsReport = createLazyComponent(() => import('../components/reports/ComprehensiveReportDark.jsx'), 'ComprehensiveReportDark');
const LazyNotificationsPage = createLazyComponent(() => import('../components/NotificationsPage.jsx'), 'NotificationsPage');
const LazyNotificationManagementPage = createLazyComponent(() => import('../pages/NotificationManagementPage.jsx'), 'NotificationManagementPage');

// Optimized loading component with better UX
const RouteLoader = ({ route }) => (
  <div className="flex items-center justify-center min-h-[400px] w-full">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <div className="text-sm text-gray-600">
        Loading {route}...
      </div>
    </div>
  </div>
);

// Route component with detailed error boundary
const RouteWithSuspense = ({ component: Component, routeName, ...props }) => {
  try {
    return (
      <DetailedErrorBoundary routeName={routeName}>
        <Suspense fallback={<RouteLoader route={routeName} />}>
          <Component {...props} />
        </Suspense>
      </DetailedErrorBoundary>
    );
  } catch (error) {
    console.error('RouteWithSuspense error:', error);
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-red-600 mb-2">Route Error</h2>
        <p className="text-gray-600">Failed to load {routeName}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Reload Page
        </button>
      </div>
    );
  }
};

/**
 * Optimized App Routes with lazy loading
 */
const OptimizedAppRoutes = ({ selectedLabel, user }) => {
  return (
    <Routes>
      {/* Employee Routes - PROTECTED - STRICT: Only employees.show permission */}
      <Route 
        path="/employees" 
        element={
          <ProtectedRoute 
            requiredPage="employees" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Employees', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyAllEmployees} 
              routeName="Employees"
              selectedLabel={selectedLabel}
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/employee/:id" 
        element={
          <ProtectedRoute 
            requiredPage="employees" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Employees', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyEmployeeDetails} 
              routeName="Employee Details"
            />
          </ProtectedRoute>
        } 
      />

      {/* Lead Routes - PROTECTED */}
      <Route 
        path="/lead-crm" 
        element={
          <ProtectedRoute 
            requiredPage="leads" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Leads', action: 'show' },
              { page: 'LEADS', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyLeadCRM} 
              routeName="Lead CRM"
              selectedLabel={selectedLabel}
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/leads" 
        element={
          <ProtectedRoute 
            requiredPage="leads" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Leads', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyLeadCRM} 
              routeName="Leads"
              selectedLabel={selectedLabel}
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/leads-report" 
        element={
          <ProtectedRoute 
            requiredPage="leads" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Leads', action: 'show' },
              { page: 'reports', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyChartPage} 
              routeName="Reports"
              selectedLabel={selectedLabel}
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/reports" 
        element={
          <ProtectedRoute 
            requiredPage="leads" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Leads', action: 'show' },
              { page: 'reports', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyLeadsReport} 
              routeName="Reports"
              selectedLabel={selectedLabel}
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/create-lead" 
        element={
          <ProtectedRoute 
            requiredPage="leads" 
            requiredAction="create"
            alternativeChecks={[
              { page: 'Leads', action: 'create' },
              { page: 'leads', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyCreateLead} 
              routeName="Create Lead"
              selectedLabel={selectedLabel}
            />
          </ProtectedRoute>
        } 
      />
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
            <RouteWithSuspense 
              component={LazyLoginCRM} 
              routeName="Login CRM"
              selectedLabel={selectedLabel}
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/login" 
        element={
          <ProtectedRoute 
            requiredPage="login" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Login', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyLoginCRM} 
              routeName="Login"
              selectedLabel={selectedLabel}
              user={user}
            />
          </ProtectedRoute>
        } 
      />

      {/* Task Routes - PROTECTED */}
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
            <RouteWithSuspense 
              component={LazyTask} 
              routeName="Tasks"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/create-task" 
        element={
          <ProtectedRoute 
            requiredPage="tasks" 
            requiredAction="create"
            alternativeChecks={[
              { page: 'Tasks', action: 'create' },
              { page: 'tasks', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyCreateTask} 
              routeName="Create Task"
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/edit-task/:taskId" 
        element={
          <ProtectedRoute 
            requiredPage="tasks" 
            requiredAction="edit"
            alternativeChecks={[
              { page: 'Tasks', action: 'edit' },
              { page: 'tasks', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyEditTask} 
              routeName="Edit Task"
            />
          </ProtectedRoute>
        } 
      />

      {/* Other Routes - PROTECTED */}
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
            <RouteWithSuspense 
              component={LazyTicketPage} 
              routeName="Tickets"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/feed" 
        element={
          <ProtectedRoute 
            requiredPage="feeds" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Feeds', action: 'show' },
              { page: 'feed', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyFeed} 
              routeName="Feed"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute 
            requiredPage="dashboard" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Dashboard', action: 'show' },
              { page: 'feeds', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyChartPage} 
              routeName="Dashboard"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
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
            <RouteWithSuspense 
              component={LazySettingsPage} 
              routeName="Settings"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/interview-panel" 
        element={
          <ProtectedRoute 
            requiredPage="interviews" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Interviews', action: 'show' },
              { page: 'interview', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyInterviewPanel} 
              routeName="Interview Panel"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      {/* Backward compatibility redirect */}
      <Route 
        path="/interviews" 
        element={
          <ProtectedRoute 
            requiredPage="interviews" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Interviews', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyInterviewPanel} 
              routeName="Interview Panel"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/interview-settings" 
        element={
          <ProtectedRoute 
            requiredPage="interviews" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Interviews', action: 'show' },
              { page: 'settings', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyInterviewSettings} 
              routeName="Interview Settings"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
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
            <RouteWithSuspense 
              component={LazyAppsPage} 
              routeName="Apps"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/attendance" 
        element={
          <ProtectedRoute 
            requiredPage="attendance" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Attendance', action: 'show' },
              { page: 'hrms', action: 'show' },
              { page: 'HRMS', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyAttendancePage} 
              routeName="Attendance"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/leaves" 
        element={
          <ProtectedRoute 
            requiredPage="leaves" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Leaves', action: 'show' },
              { page: 'hrms', action: 'show' },
              { page: 'HRMS', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyLeavesPage} 
              routeName="Leaves"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/warnings" 
        element={
          <ProtectedRoute 
            requiredPage="warnings" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Warnings', action: 'show' },
              { page: 'hrms', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyWarningPage} 
              routeName="Warnings"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/permission-test" 
        element={
          <RouteWithSuspense 
            component={LazyPermissionTest} 
            routeName="Permission Test"
            user={user}
          />
        } 
      />
      
      {/* Notifications Routes - PROTECTED */}
      <Route 
        path="/notifications" 
        element={
          <ProtectedRoute 
            requiredPage="notifications" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Notifications', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyNotificationManagementPage} 
              routeName="Announcement"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/notification" 
        element={
          <RouteWithSuspense 
            component={LazyNotificationManagementPage} 
            routeName="Announcement"
            user={user}
          />
        } 
      />
      <Route 
        path="/all-notifications" 
        element={
          <RouteWithSuspense 
            component={LazyNotificationsPage} 
            routeName="All Notifications"
            user={user}
          />
        } 
      />

      {/* Default redirect to feed */}
      <Route 
        path="/" 
        element={
          <RouteWithSuspense 
            component={LazyFeed} 
            routeName="Feed"
            user={user}
          />
        } 
      />

      {/* Catch all route for 404 */}
      <Route 
        path="*" 
        element={<NotFoundPage />}
      />
    </Routes>
  );
};

export default OptimizedAppRoutes;
