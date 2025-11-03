import React from "react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { NotificationProvider } from "./context/NotificationContext";
import ErrorBoundary from "./components/ErrorBoundary";

/**
 * AppWithProviders - Wraps the entire app with required providers
 * This structure ensures context is properly available throughout the app
 */
const AppWithProviders = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary fallbackMessage="There was a problem with the notification system. The application will still function.">
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default AppWithProviders;
