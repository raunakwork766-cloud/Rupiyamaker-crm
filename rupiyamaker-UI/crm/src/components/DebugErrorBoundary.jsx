import React from 'react';

class DebugErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error details
    console.error('DebugErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    console.error('Props children:', this.props.children);
    
    // Check if it's the "Objects are not valid as a React child" error
    if (error.message && error.message.includes('Objects are not valid as a React child')) {
      console.error('REACT CHILD ERROR DETECTED!');
      console.error('Children type:', typeof this.props.children);
      console.error('Children:', this.props.children);
      
      // Try to identify the problematic child
      if (React.Children) {
        try {
          React.Children.forEach(this.props.children, (child, index) => {
            console.error(`Child ${index}:`, child);
            console.error(`Child ${index} type:`, typeof child);
            console.error(`Child ${index} has $$typeof:`, child && child.$$typeof);
          });
        } catch (e) {
          console.error('Error analyzing children:', e);
        }
      }
    }
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#ffe6e6', 
          border: '2px solid #ff4444',
          borderRadius: '8px',
          margin: '20px',
          fontFamily: 'monospace'
        }}>
          <h2 style={{ color: '#cc0000', marginBottom: '16px' }}>
            🚨 React Error Detected
          </h2>
          <div style={{ marginBottom: '16px' }}>
            <strong>Error:</strong> {this.state.error && this.state.error.toString()}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>Component Stack:</strong>
            <pre style={{ 
              backgroundColor: '#f5f5f5', 
              padding: '8px', 
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              fontSize: '12px'
            }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              backgroundColor: '#4444ff',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DebugErrorBoundary;
