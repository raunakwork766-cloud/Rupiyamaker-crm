/**
 * Optimized routing system with lazy loading and code splitting
 * This improves initial load time by loading components only when needed
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DetailedErrorBoundary from '../components/DetailedErrorBoundary.jsx';
import NotFoundPage from '../components/NotFoundPage.jsx';
import Unauthorized from '../pages/Unauthorized.jsx';
import ProtectedRoute from '../components/ProtectedRoute';

/**
 * SmartRootRedirect — priority-based redirect from root '/'. 
 * Replaces the old ProtectedRoute-on-root which always showed /unauthorized
 * for users who don't have feeds access.
 * Priority order mirrors allPermissions in RoleCompare.jsx.
 */
const SmartRootRedirect = () => {
  const hasAuth = !!(localStorage.getItem('token') && localStorage.getItem('userId'));
  const rawPermissions = localStorage.getItem('userPermissions');

  // During auth-hydration window, permission key can be temporarily unavailable.
  // Avoid redirecting to /unauthorized in that transient state to prevent flicker.
  if (hasAuth && rawPermissions === null) {
    return <RouteLoader route="permissions" />;
  }

  let perms = {};
  try { perms = JSON.parse(rawPermissions || '{}'); } catch {}

  // Super admin — any of the three formats written by Login.jsx
  if (perms['*'] === '*' || (perms?.pages === '*' && perms?.actions === '*') || perms?.Global === '*') {
    return <Navigate to="/dashboard" replace />;
  }
  // Dashboard first — ensures users land on their primary work page, not the dark-themed Feed
  if (perms?.dashboard?.show   || perms?.dashboard   === '*') return <Navigate to="/dashboard"      replace />;
  if (perms?.feeds?.show       || perms?.feeds       === '*') return <Navigate to="/feed"           replace />;
  if (perms?.['leads.create_lead']?.show  || perms?.['leads.create_lead']  === '*') return <Navigate to="/create-lead" replace />;
  if (perms?.['leads.pl_odd_leads']?.show || perms?.['leads.pl_odd_leads'] === '*') return <Navigate to="/lead-crm"    replace />;
  if (perms?.login?.show       || perms?.login       === '*') return <Navigate to="/login-crm"      replace />;
  if (perms?.tasks?.show       || perms?.tasks       === '*') return <Navigate to="/tasks"          replace />;
  if (perms?.tickets?.show     || perms?.tickets     === '*') return <Navigate to="/tickets"        replace />;
  if (perms?.warnings?.show    || perms?.warnings    === '*') return <Navigate to="/warnings"       replace />;
  if (perms?.interview?.show   || perms?.interview   === '*') return <Navigate to="/interview-panel" replace />;
  if (perms?.employees?.show   || perms?.employees   === '*') return <Navigate to="/employees"      replace />;
  if (perms?.leaves?.show      || perms?.leaves      === '*') return <Navigate to="/leaves"         replace />;
  if (perms?.attendance?.show  || perms?.attendance  === '*') return <Navigate to="/attendance"     replace />;
  if (perms?.apps?.show        || perms?.apps        === '*') return <Navigate to="/apps"           replace />;
  if (perms?.settings?.show    || perms?.settings    === '*') return <Navigate to="/settings"       replace />;
  return <Navigate to="/unauthorized" replace />;
};

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
const LazyDialerReport = createLazyComponent(() => import('../components/Dialer.jsx'), 'Dialer');
const LazyChartPage = createLazyComponent(() => import('../components/ChartPage.jsx'), 'ChartPage');
const LazyWarningPage = createLazyComponent(() => import('../components/WarningPage.jsx'), 'WarningPage');
const LazyTransferRequestsPage = createLazyComponent(() => import('../components/sections/TransferRequestsPage.jsx'), 'TransferRequestsPage');
const LazyPermissionTest = createLazyComponent(() => import('../components/PermissionTest.jsx'), 'PermissionTest');
const LazyLeadsReport = createLazyComponent(() => import('../components/reports/ComprehensiveReportDark.jsx'), 'ComprehensiveReportDark');
const LazyNotificationsPage = createLazyComponent(() => import('../components/NotificationsPage.jsx'), 'NotificationsPage');
const LazyNotificationManagementPage = createLazyComponent(() => import('../pages/NotificationManagementPage.jsx'), 'NotificationManagementPage');
const LazyRoleCompare = createLazyComponent(() => import('../components/settings/RoleCompare.jsx'), 'RoleCompare');
const LazyKnowledgeBase = createLazyComponent(() => import('../components/KnowledgeBase.jsx'), 'KnowledgeBase');
const LazyOfferLetterGenerator = createLazyComponent(() => import('../components/OfferLetterGenerator.jsx'), 'OfferLetterGenerator');
const LazyFAQPage = createLazyComponent(() => import('../components/FAQPage.jsx'), 'FAQPage');
const LazyDashboardPage = createLazyComponent(() => import('../components/DashboardPage.jsx'), 'DashboardPage');

// Optimized loading component with better UX
const RouteLoader = ({ route }) => (
  <div className="flex items-center justify-center min-h-[400px] w-full bg-white">
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

      {/* Lead Routes - PROTECTED: requires nested leads.create_lead or leads.pl_odd_leads show,
           OR legacy flat leads.show for older roles not yet migrated to new format */}
      <Route 
        path="/lead-crm" 
        element={
          <ProtectedRoute 
            requiredPage="leads.create_lead" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'leads.pl_odd_leads', action: 'show' },
              { page: 'leads', action: 'show' }
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
            requiredPage="leads.create_lead" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'leads.pl_odd_leads', action: 'show' },
              { page: 'leads', action: 'show' }
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
            requiredPage="reports" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Reports', action: 'show' }
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
            requiredPage="reports" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Reports', action: 'show' }
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
            requiredPage="leads.create_lead" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'leads', action: 'create' }
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
              { page: 'Tasks', action: 'create' }
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
              { page: 'Tasks', action: 'edit' }
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
              { page: 'Dashboard', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyDashboardPage} 
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
        path="/role-compare"
        element={
          <ProtectedRoute 
            requiredPage="settings" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Settings', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyRoleCompare} 
              routeName="Role Compare"
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/interview-panel" 
        element={
          <ProtectedRoute 
            requiredPage="interview" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Interview', action: 'show' }
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
            requiredPage="interview" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Interview', action: 'show' }
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
            requiredPage="interview" 
            requiredAction="interview_setting"
            alternativeChecks={[
              { page: 'Interview', action: 'interview_setting' }
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
              { page: 'Attendance', action: 'show' }
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
              { page: 'Leaves', action: 'show' }
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
        path="/dialer-report" 
        element={
          <ProtectedRoute 
            requiredPage="dialer_report" 
            requiredAction="show"
          >
            <RouteWithSuspense 
              component={LazyDialerReport} 
              routeName="Dialer Report"
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
              { page: 'Warnings', action: 'show' }
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
        path="/offer-letter" 
        element={
          <ProtectedRoute 
            requiredPage="offer_letter" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Offer_Letter', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyOfferLetterGenerator} 
              routeName="Offer Letter"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/transfer-requests" 
        element={
          <ProtectedRoute 
            requiredPage="settings" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Settings', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyTransferRequestsPage} 
              routeName="Transfer Requests"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/permission-test" 
        element={
          <ProtectedRoute 
            requiredPage="settings" 
            requiredAction="show"
          >
            <RouteWithSuspense 
              component={LazyPermissionTest} 
              routeName="Permission Test"
              user={user}
            />
          </ProtectedRoute>
        } 
      />
      
      {/* Notifications Routes - PROTECTED */}
      <Route 
        path="/notifications" 
        element={
          <ProtectedRoute 
            requiredPage="notification" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Notification', action: 'show' }
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
          <ProtectedRoute 
            requiredPage="notification" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'Notification', action: 'show' }
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
        path="/all-notifications" 
        element={
          <RouteWithSuspense 
            component={LazyNotificationsPage} 
            routeName="All Notifications"
            user={user}
          />
        } 
      />

      {/* Offer Letter Generator Route - duplicate removed; primary route defined above */}

      {/* Knowledge Base Route */}
      <Route 
        path="/knowledge-base" 
        element={
          <ProtectedRoute 
            requiredPage="knowledge_base" 
            requiredAction="show"
            alternativeChecks={[
              { page: 'settings', action: 'show' }
            ]}
          >
            <RouteWithSuspense 
              component={LazyKnowledgeBase} 
              routeName="Knowledge Base"
              user={user}
            />
          </ProtectedRoute>
        } 
      />

      {/* FAQ Route - intentionally unprotected; informational content for all authenticated users */}
      <Route 
        path="/faq" 
        element={
          <RouteWithSuspense 
            component={LazyFAQPage} 
            routeName="FAQ"
            user={user}
          />
        } 
      />

      {/* Default landing route — SmartRootRedirect sends user to first accessible page.
           No ProtectedRoute here; the target route's own ProtectedRoute handles auth. */}
      <Route path="/" element={<SmartRootRedirect />} />
      {/* Also serve /feed directly for users who DO have feeds access */}
      <Route 
        path="/feed-home"
        element={
          <ProtectedRoute
            requiredPage="feeds"
            requiredAction="show"
            alternativeChecks={[{ page: 'Feeds', action: 'show' }, { page: 'feed', action: 'show' }]}
          >
            <RouteWithSuspense component={LazyFeed} routeName="Feed" user={user} />
          </ProtectedRoute>
        }
      />

      {/* Unauthorized page (shown when user lacks permission for a route) */}
      <Route 
        path="/unauthorized" 
        element={<Unauthorized />}
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
