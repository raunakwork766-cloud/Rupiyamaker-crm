import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

/**
 * Unauthorized Access Page (403)
 * 
 * Displayed when a user tries to access a page they don't have permission for
 */
const UnauthorizedPage = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate('/feed');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full animate-pulse"></div>
            <ShieldAlert className="w-24 h-24 text-red-500 relative z-10" strokeWidth={1.5} />
          </div>
        </div>

        {/* Error Code */}
        <h1 className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-4">
          403
        </h1>

        {/* Error Message */}
        <h2 className="text-3xl font-bold text-white mb-4">
          Access Denied
        </h2>
        
        <p className="text-gray-400 mb-8 leading-relaxed">
          You don't have permission to access this page. 
          <br />
          Please contact your administrator if you believe this is a mistake.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleGoBack}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 border border-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
          
          <button
            onClick={handleGoHome}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg shadow-blue-500/50"
          >
            <Home className="w-5 h-5" />
            Go to Home
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-12 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-400">
            <strong className="text-gray-300">Need help?</strong>
            <br />
            Contact your system administrator to request access to this feature.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
