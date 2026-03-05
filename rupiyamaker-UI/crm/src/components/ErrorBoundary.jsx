import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

/**
 * Generic Error Boundary Component for catching React errors
 * Provides fallback UI when child components crash
 * Auto-recovers when URL changes (navigation)
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this._lastUrl = window.location.href;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error Boundary Caught:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  componentDidMount() {
    // Listen for URL changes to auto-recover from errors
    this._urlCheckInterval = setInterval(() => {
      if (this.state.hasError && window.location.href !== this._lastUrl) {
        this._lastUrl = window.location.href;
        this.setState({ hasError: false, error: null, errorInfo: null });
      }
      this._lastUrl = window.location.href;
    }, 500);
  }

  componentWillUnmount() {
    if (this._urlCheckInterval) {
      clearInterval(this._urlCheckInterval);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-red-800 mb-2">
            Oops! Something went wrong
          </h2>
          <p className="text-red-600 text-center mb-4 max-w-md">
            {this.props.fallbackMessage ||
              "This component encountered an error and couldn't render properly."}
          </p>

          {/* Show error details in development */}
          {this.state.error && (
            <details className="mb-4 p-4 bg-red-100 rounded border max-w-full overflow-auto" style={{ maxWidth: '600px' }}>
              <summary className="cursor-pointer text-red-700 font-medium">
                Error Details
              </summary>
              <pre className="mt-2 text-sm text-red-800 whitespace-pre-wrap">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              <Home className="w-4 h-4" />
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC (Higher Order Component) to wrap components with Error Boundary
 * @param {React.Component} Component - Component to wrap
 * @param {string} fallbackMessage - Custom error message
 */
export const withErrorBoundary = (Component, fallbackMessage) => {
  return function WrappedComponent(props) {
    return (
      <ErrorBoundary fallbackMessage={fallbackMessage}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};

/**
 * Route Error Boundary - Specialized for route-level errors
 */
export const RouteErrorBoundary = ({ children, routeName }) => {
  return (
    <ErrorBoundary
      fallbackMessage={`The ${routeName} page encountered an error. Please try refreshing or contact support if the problem persists.`}
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
