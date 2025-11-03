import React from 'react';

class DetailedErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Detailed Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo || { componentStack: 'No component stack available' }
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-xl font-bold text-red-800 mb-4">Something went wrong!</h2>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="mb-4">
              <summary className="cursor-pointer text-red-700 font-medium mb-2">
                Error Details (Development Mode)
              </summary>
              <div className="bg-red-100 p-4 rounded border">
                <h3 className="font-medium text-red-800">Error:</h3>
                <pre className="text-sm text-red-700 mb-2">
                  {this.state.error && this.state.error.toString()}
                </pre>
                
                <h3 className="font-medium text-red-800">Stack Trace:</h3>
                <pre className="text-xs text-red-600 overflow-auto max-h-64">
                  {this.state.errorInfo && this.state.errorInfo.componentStack 
                    ? this.state.errorInfo.componentStack 
                    : 'No stack trace available'}
                </pre>
              </div>
            </details>
          )}
          
          <div className="space-y-2">
            <p className="text-red-700">
              Route: <span className="font-mono bg-red-100 px-2 py-1 rounded">{this.props.routeName || 'Unknown'}</span>
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Reload Page
            </button>
            <button 
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
              }} 
              className="ml-2 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DetailedErrorBoundary;
