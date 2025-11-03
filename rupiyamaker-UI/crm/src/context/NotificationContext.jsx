import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import OverdueTaskPopup from '../components/OverdueTaskPopup';
import DailyTasksSummary from '../components/DailyTasksSummary';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// Create context
const NotificationContext = createContext();

/**
 * NotificationProvider - Provider component for managing global notifications
 */
export const NotificationProvider = ({ children }) => {
  // Simple navigation function that works without router context
  const navigate = useCallback((path) => {
    if (path) {
      window.location.href = path;
    }
  }, []);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showOverdueTask, setShowOverdueTask] = useState(null);
  const [showDailySummary, setShowDailySummary] = useState(null);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  
  // Function to get user ID from localStorage (consistent with other components)
  const getUserId = useCallback(() => {
    try {
      // First try direct userId
      const userId = localStorage.getItem('userId');
      if (userId) return userId;
      
      // Try to get from userData (which is what App.jsx actually stores)
      const userDataStr = localStorage.getItem('userData');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        return userData.id || userData._id || userData.user_id;
      }
      
      // Try to get from user object
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.id || user._id || user.user_id;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }, []);
  
  // Function to mark a notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read/${notificationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // Update local state to reflect the change
        setNotifications(prevNotifications => 
          prevNotifications.map(notif => 
            notif._id === notificationId ? {...notif, read: true} : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
    }
  }, []);

  // Function to check for special notification types that need popups
  const checkForSpecialNotifications = useCallback((notifications) => {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return;
    }
    
    
    // Find overdue task notifications
    const overdueTaskNotification = notifications.find(n => 
      n.type === 'task_overdue' && !n.read && n.details
    );
    
    // Find daily summary notifications
    const dailySummaryNotification = notifications.find(n => 
      n.type === 'daily_summary' && !n.read && n.details?.tasks?.length > 0
    );
    
    
    // Show overdue task popup (highest priority)
    if (overdueTaskNotification) {
      setShowOverdueTask(overdueTaskNotification);
      // Mark notification as read
      markAsRead(overdueTaskNotification._id);
    }
    // Show daily summary if no overdue tasks
    else if (dailySummaryNotification) {
      setShowDailySummary(dailySummaryNotification);
      // Mark notification as read
      markAsRead(dailySummaryNotification._id);
    }
  }, [markAsRead]);
  
  // Function to fetch notifications - returns a promise that can be awaited
  const fetchNotifications = useCallback(async () => {
    try {
      const userId = getUserId();
      if (!userId) {
        return false;
      }
      
      // Set loading state
      setIsLoadingNotifications(true);
      
      // Track the request time to prevent multiple close requests
      const requestTime = Date.now();
      
      // Fetch unread count first
      const countResponse = await fetch(`${API_BASE_URL}/notifications/count?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (countResponse.ok) {
        const countData = await countResponse.json();
        setUnreadCount(countData.unread_count);
      }
      
      // Fetch notifications list (limit to 20 most recent)
      const notificationsResponse = await fetch(`${API_BASE_URL}/notifications?user_id=${userId}&limit=20&skip=0`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json();
        
        // Only update state if we actually got data
        if (Array.isArray(notificationsData)) {
          setNotifications(notificationsData);
          
          // Check for special notification types
          checkForSpecialNotifications(notificationsData);
          
          return true; // Success
        }
      } else {
      }
      
      return false; // Failure
    } catch (error) {
      return false; // Error case
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [getUserId, checkForSpecialNotifications]);
  
  // Function to mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const userId = getUserId();
      if (!userId) return;
      
      const response = await fetch(`${API_BASE_URL}/notifications/read-all?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // Update local state to reflect all notifications as read
        setNotifications(prevNotifications => 
          prevNotifications.map(notif => ({...notif, read: true}))
        );
        setUnreadCount(0);
        
        // Hide any popups
        setShowOverdueTask(null);
        setShowDailySummary(null);
      }
    } catch (error) {
    }
  }, [getUserId]);
  
  // Handle viewing a task
  const handleViewTask = (taskId) => {
    if (taskId) {
      navigate(`/tasks?id=${taskId}`);
      setShowOverdueTask(null);
      setShowDailySummary(null);
    }
  };
  
  // Handle viewing all of today's tasks
  const handleViewAllTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    navigate(`/tasks?date=${today}`);
    setShowDailySummary(null);
  };
  
  // Track if we're already fetching to prevent multiple simultaneous requests
  const [isFetching, setIsFetching] = useState(false);
  // Track if we've already done the initial fetch
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  
  // Safe fetch function that prevents multiple simultaneous fetches
  const safeFetch = useCallback(async () => {
    if (isFetching) return;
    
    setIsFetching(true);
    try {
      await fetchNotifications();
    } finally {
      setIsFetching(false);
    }
  }, [isFetching, fetchNotifications]);
  
  // Check for new notifications periodically
  useEffect(() => {
    // Get user from localStorage
    const userData = localStorage.getItem('userData');
    
    // Only fetch notifications if user is logged in
    if (userData && !initialFetchDone) {
      
      // Mark that we've done the initial fetch setup
      setInitialFetchDone(true);
      
      // Initial fetch after a delay to let everything load
      const initialDelayedFetch = setTimeout(() => {
        safeFetch();
      }, 5000);
      
      // Regular interval for subsequent fetches
      const notificationInterval = setInterval(() => {
        const stillLoggedIn = localStorage.getItem('userData');
        if (stillLoggedIn) {
          safeFetch();
        }
      }, 120000); // Every 2 minutes
      
      return () => {
        clearInterval(notificationInterval);
        clearTimeout(initialDelayedFetch);
      };
    }
  }, [initialFetchDone, safeFetch]);

  // Function to create a test notification
  const createTestNotification = useCallback(async () => {
    try {
      const userId = getUserId();
      if (!userId) {
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/notifications/test/overdue-task?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      // Fetch notifications to trigger the popup
      await fetchNotifications();
      
      return data;
    } catch (error) {
    }
  }, [getUserId, fetchNotifications]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    notifications,
    unreadCount,
    isLoadingNotifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    createTestNotification
  }), [
    notifications,
    unreadCount,
    isLoadingNotifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    createTestNotification
  ]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      
      {/* Render special notification popups */}
      {showOverdueTask && (
        <div className="notification-popup-container">
          <OverdueTaskPopup 
            task={showOverdueTask.details} 
            onClose={() => {
              setShowOverdueTask(null);
            }}
            onViewTask={handleViewTask}
          />
        </div>
      )}
      
      {!showOverdueTask && showDailySummary && (
        <div className="notification-popup-container">
          <DailyTasksSummary
            summaryData={showDailySummary}
            onClose={() => {
              setShowDailySummary(null);
            }}
            onViewTask={handleViewTask}
            onViewAllTasks={handleViewAllTasks}
          />
        </div>
      )}
    </NotificationContext.Provider>
  );
};

  // Custom hook to use the notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  
  return context;
};

export default NotificationContext;
