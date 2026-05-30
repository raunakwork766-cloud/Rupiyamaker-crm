import React from "react";
import { BrowserRouter, Navigate, useLocation } from "react-router-dom";
import App from "./App";
import AttendanceApp from "./AttendanceApp";
import { NotificationProvider } from "./context/NotificationContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { ATTENDANCE_LOGIN_PATH, CRM_LOGIN_PATH } from "./utils/loginMode";
import { isAttendanceRoute } from "./utils/authSession";

/**
 * RootRouter — pick CRM vs attendance *before* mounting App.
 * App must not early-return alternate trees: that kept every CRM hook alive on
 * attendance URLs and could trigger React hook-order errors (#310).
 */
function RootRouter() {
  const location = useLocation();

  if (
    location.pathname === CRM_LOGIN_PATH &&
    new URLSearchParams(location.search).get("mode") === "attendance"
  ) {
    return <Navigate to={ATTENDANCE_LOGIN_PATH} replace />;
  }

  if (isAttendanceRoute(location.pathname)) {
    return <AttendanceApp />;
  }

  return (
    <NotificationProvider>
      <App />
    </NotificationProvider>
  );
}

/**
 * AppWithProviders - Wraps the entire app with required providers
 */
const AppWithProviders = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary fallbackMessage="There was a problem with the notification system. The application will still function.">
        <RootRouter />
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default AppWithProviders;
