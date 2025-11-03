import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, Bell, AlertTriangle, Info, AlertCircle, User } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const PopNotificationModal = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [currentNotification, setCurrentNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(1);
  const [isAccepted, setIsAccepted] = useState(false);

  // Get user ID
  const getUserId = () => {
    try {
      const userId = localStorage.getItem('userId') || localStorage.getItem('user_id');
      if (userId) return userId;
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        return parsedUser._id || parsedUser.id || parsedUser.user_id;
      }
      return null;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  };

  // Fetch active notifications
  const fetchActiveNotifications = async () => {
    const userId = getUserId();
    if (!userId) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/pop-notifications/my-notifications?user_id=${userId}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔔 PopModal: Received notifications:', data);
        
        // Normalize notifications: ensure `id` exists (fallback to _id)
        const normalizedNotifications = data.map(n => ({ ...n, id: n.id || n._id }));
        
        setNotifications(normalizedNotifications);
        
        // Show first notification if available
        if (normalizedNotifications.length > 0) {
          const firstNotification = normalizedNotifications[0];
          setCurrentNotification(firstNotification);
          
          // Reset accepted state for new notification
          setIsAccepted(false);
          
          // Update progress info
          const stats = firstNotification.acceptance_stats || {};
          setAcceptedCount(stats.accepted_count || 0);
          setTotalCount(stats.total_users || 1);
        }
      } else {
        console.error('Failed to fetch notifications:', response.status);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  // Accept notification
  const acceptNotification = async (notificationId) => {
    const userId = getUserId();
    if (!userId || !notificationId) return;

    console.log('🔔 PopModal: Accepting notification:', notificationId);
    
    try {
      const response = await fetch(`${API_BASE_URL}/pop-notifications/accept?user_id=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ 
          notification_id: notificationId
        }),
      });

      console.log('🔔 PopModal: Accept response status:', response.status);

      if (response.ok) {
        console.log('✅ PopModal: Notification accepted successfully');
        
        // Update progress immediately
        setAcceptedCount(prev => prev + 1);
        setIsAccepted(true);
        
        // Show "Already Acknowledged" briefly before closing
        setTimeout(() => {
          // Remove accepted notification from list
          const remainingNotifications = notifications.filter(n => 
            (n.id || n._id) !== notificationId
          );
          setNotifications(remainingNotifications);
          
          // Show next notification or close modal
          if (remainingNotifications.length > 0) {
            const nextNotification = remainingNotifications[0];
            setCurrentNotification(nextNotification);
            
            // Reset accepted state for next notification
            setIsAccepted(false);
            
            // Update progress for next notification
            const stats = nextNotification.acceptance_stats || {};
            setAcceptedCount(stats.accepted_count || 0);
            setTotalCount(stats.total_users || 1);
          } else {
            setCurrentNotification(null);
          }
        }, 1500); // Wait 1.5 seconds to show progress update
      } else {
        const errorData = await response.json();
        console.error('❌ PopModal: Failed to accept notification:', errorData);
        setError('Failed to accept notification');
      }
    } catch (error) {
      console.error('❌ PopModal: Error accepting notification:', error);
      setError('Failed to accept notification');
    }
  };

  // Get priority config
  const getPriorityConfig = (priority) => {
    const configs = {
      urgent: { 
        icon: AlertTriangle, 
        gradient: 'from-red-600 to-red-800',
        glowColor: 'shadow-red-500/50',
        pulseColor: 'animate-pulse',
        buttonColor: 'bg-red-600 hover:bg-red-700'
      },
      high: { 
        icon: AlertCircle, 
        gradient: 'from-orange-600 to-orange-800',
        glowColor: 'shadow-orange-500/50',
        pulseColor: '',
        buttonColor: 'bg-orange-600 hover:bg-orange-700'
      },
      normal: { 
        icon: Info, 
        gradient: 'from-blue-600 to-blue-800',
        glowColor: 'shadow-blue-500/50',
        pulseColor: '',
        buttonColor: 'bg-blue-600 hover:bg-blue-700'
      },
      low: { 
        icon: Bell, 
        gradient: 'from-gray-600 to-gray-800',
        glowColor: 'shadow-gray-500/50',
        pulseColor: '',
        buttonColor: 'bg-gray-600 hover:bg-gray-700'
      }
    };
    return configs[priority] || configs.normal;
  };

  // Check for notifications on mount and periodically
  useEffect(() => {
    fetchActiveNotifications();
    
    // Check for new notifications every 30 seconds
    const interval = setInterval(fetchActiveNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [user]);

  // Prevent Escape key from closing modal
  useEffect(() => {
    if (currentNotification) {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          // Do nothing - prevent closing
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [currentNotification]);

  // Don't render if no current notification
  if (!currentNotification) {
    return null;
  }

  const config = getPriorityConfig(currentNotification.priority);
  const IconComponent = config.icon;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={(e) => e.stopPropagation()} // Prevent closing on backdrop click
    >
      <div 
        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-600"
        onClick={(e) => e.stopPropagation()} // Prevent event bubbling
      >
        {/* Header */}
        <div className="relative p-6 pb-4">
          {/* Title with bell icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <Bell className="w-6 h-6 text-red-400 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
            </div>
            <h2 className="text-xl font-bold text-cyan-300 tracking-wide">ANNOUNCEMENT</h2>
          </div>

          {/* Main Message */}
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold text-white mb-2">
              {currentNotification.title || "NOTIFICATION"}
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              {currentNotification.message}
            </p>
          </div>

          {/* Sender Info */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-600/20 border border-green-500/30 rounded-full">
              <User className="w-4 h-4 text-green-400" />
              <span className="text-green-300 font-medium text-sm">
                {currentNotification.sender_name} - ADMIN
              </span>
            </div>
          </div>

          {/* Progress Info */}
          <div className="text-center mb-6">
            <div className="text-white font-bold text-lg mb-1">
              {acceptedCount} out of {totalCount} have accepted
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
              <div 
                className="bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((acceptedCount / totalCount) * 100)}%` }}
              ></div>
            </div>
            <div className="text-gray-400 text-xs">
              Acceptance Rate: {Math.round((acceptedCount / totalCount) * 100)}%
            </div>
          </div>

          {/* Acknowledgment Status */}
          {isAccepted ? (
            <div className="flex items-center justify-center gap-2 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Already Acknowledged</span>
            </div>
          ) : (
            <button
              onClick={() => acceptNotification(currentNotification.id || currentNotification._id)}
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
              type="button"
            >
              {loading ? 'Processing...' : 'I Accept'}
            </button>
          )}

          {/* Progress Indicator */}
          {notifications.length > 1 && (
            <div className="mt-6">
              <div className="flex gap-2 justify-center">
                {notifications.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      index === 0 ? 'bg-blue-500' : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default PopNotificationModal;