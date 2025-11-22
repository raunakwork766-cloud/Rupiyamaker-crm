import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ExternalLink, Clock } from 'lucide-react';

const API_BASE_URL = '/api';

const PublicAppViewer = () => {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    fetchPublicApp();
  }, [shareToken]);

  const fetchPublicApp = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/app-share-links/public/app/${shareToken}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to load app');
      }
      
      const data = await response.json();
      setApp(data);
    } catch (error) {
      console.error('Error fetching public app:', error);
      setError(error.message || 'Failed to load app. The link may be invalid, expired, or deactivated.');
    } finally {
      setLoading(false);
    }
  };

  // Load app content in iframe for full JavaScript support
  useEffect(() => {
    if (!app || !app.html_content || !contentRef.current) return;

    const container = contentRef.current;
    container.innerHTML = '';

    // Create an iframe to isolate and properly execute the app
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.display = 'block';
    
    container.appendChild(iframe);

    // Write the complete HTML content to the iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(app.html_content);
    iframeDoc.close();

    // Cleanup function
    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [app]);

  const getExpiryInfo = () => {
    if (!app?.expires_at) return null;
    
    const expiryDate = new Date(app.expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { text: 'Expired', color: 'text-red-400', urgent: true };
    } else if (daysUntilExpiry === 0) {
      return { text: 'Expires today', color: 'text-orange-400', urgent: true };
    } else if (daysUntilExpiry === 1) {
      return { text: 'Expires tomorrow', color: 'text-yellow-400', urgent: true };
    } else if (daysUntilExpiry <= 7) {
      return { text: `Expires in ${daysUntilExpiry} days`, color: 'text-yellow-400', urgent: false };
    } else {
      return { text: `Expires on ${expiryDate.toLocaleDateString()}`, color: 'text-gray-400', urgent: false };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#08B8EA] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading application...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-lg p-8 text-center">
          <AlertCircle size={64} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-[#08B8EA] hover:bg-[#12d8fa] text-white px-6 py-2 rounded-lg"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!app) {
    return null;
  }

  const expiryInfo = getExpiryInfo();

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-black text-white">
      {/* Compact Header with Expiry Info */}
      <div className="bg-gray-900 border-b border-gray-700 py-2 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{app.title}</h1>
            <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded px-3 py-1 flex items-center gap-2">
              <ExternalLink size={14} className="text-green-400" />
              <span className="text-green-300 text-xs">Shared App - Fully Interactive</span>
            </div>
          </div>
          {expiryInfo && (
            <div className={`flex items-center gap-2 ${expiryInfo.color} text-sm`}>
              <Clock size={16} />
              <span>{expiryInfo.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Full-Screen App Content */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-auto"
      />
    </div>
  );
};

export default PublicAppViewer;
