import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  Bell, 
  X, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Ticket,
  UserX,
  Check,
  RefreshCw,
  UserPlus
} from "lucide-react";

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeTab, setActiveTab] = useState('unread'); // New state for tab management

  // Navigation function for clicking notifications - optimized with useCallback
  const navigateToNotification = useCallback((notification) => {
    const data = notification.data;
    
    if (!data) return;
    
    try {
      // Navigate based on notification type
      switch (notification.type) {
        case 'task_overdue':
        case 'task_pending':
          // Navigate to tasks page with task ID
          window.location.href = `/tasks?task_id=${data._id || data.id}`;
          break;
        case 'ticket_open':
          // Navigate to tickets page with ticket ID
          window.location.href = `/tickets?ticket_id=${data._id || data.id}`;
          break;
        case 'warning':
          // Navigate to warnings/employee page
          window.location.href = `/warnings?warning_id=${data.id}`;
          break;
        case 'leave_status':
          // Navigate to leaves page with leave ID
          window.location.href = `/leaves?leave_id=${data._id || data.id}`;
          break;
        case 'lead_submission':
          // Navigate to leads page with lead ID
          if (data.reference_id) {
            window.location.href = `/lead-crm?lead_id=${data.reference_id}`;
          } else if (data.link) {
            window.location.href = data.link;
          }
          break;
        default:
          // Try to use the link if available
          if (data.link) {
            window.location.href = data.link;
          }
      }
    } catch (error) {
      // Silent error handling
    }
  }, []);

  // Get user ID from localStorage - optimized with useMemo
  const userId = useMemo(() => {
    try {
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) return storedUserId;
      
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        return parsedUser.id || parsedUser._id || parsedUser.user_id;
      }
      return null;
    } catch (error) {
      return null;
    }
  }, []);

  // Optimized localStorage utility functions with useCallback
  const getReadNotifications = useCallback(() => {
    try {
      if (!userId) return new Set();
      const readNotifs = localStorage.getItem(`readNotifications_${userId}`);
      return readNotifs ? new Set(JSON.parse(readNotifs)) : new Set();
    } catch (error) {
      return new Set();
    }
  }, [userId]);

  const saveReadNotifications = useCallback((readSet) => {
    try {
      if (!userId) return;
      localStorage.setItem(`readNotifications_${userId}`, JSON.stringify([...readSet]));
    } catch (error) {
      // Silent error handling
    }
  }, [userId]);

  const getRemovedNotifications = useCallback(() => {
    try {
      if (!userId) return new Set();
      const removedNotifs = localStorage.getItem(`removedNotifications_${userId}`);
      return removedNotifs ? new Set(JSON.parse(removedNotifs)) : new Set();
    } catch (error) {
      return new Set();
    }
  }, [userId]);

  const saveRemovedNotifications = useCallback((removedSet) => {
    try {
      if (!userId) return;
      localStorage.setItem(`removedNotifications_${userId}`, JSON.stringify([...removedSet]));
    } catch (error) {
      // Silent error handling
    }
  }, [userId]);

  const getDeletedNotifications = useCallback(() => {
    try {
      if (!userId) return [];
      const deletedNotifs = localStorage.getItem(`deletedNotificationsData_${userId}`);
      return deletedNotifs ? JSON.parse(deletedNotifs) : [];
    } catch (error) {
      return [];
    }
  }, [userId]);

  const saveDeletedNotification = useCallback((notification) => {
    try {
      if (!userId) return;
      const existing = getDeletedNotifications();
      const updated = [...existing, { ...notification, deletedAt: new Date().toISOString() }];
      localStorage.setItem(`deletedNotificationsData_${userId}`, JSON.stringify(updated));
    } catch (error) {
      // Silent error handling
    }
  }, [userId, getDeletedNotifications]);

  // Fetch notifications data - optimized with useCallback and memoization
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Get read and removed notifications from localStorage
      const readNotifications = getReadNotifications();
      const removedNotifications = getRemovedNotifications();

      // Fetch notifications from the proper API endpoint with Promise.all for parallel requests
      const [apiNotifications, countData] = await Promise.all([
        fetch(`${API_BASE_URL}/notifications?user_id=${userId}&limit=50`)
          .then(res => res.ok ? res.json() : []),
        fetch(`${API_BASE_URL}/notifications/count?user_id=${userId}`)
          .then(res => res.ok ? res.json() : { unread_count: 0 })
      ]);


      const notificationsList = [];

      // Process API notifications
      if (Array.isArray(apiNotifications)) {
        apiNotifications.forEach(notification => {
          const notificationId = notification._id || notification.id;
          
          // Skip if notification was removed locally
          if (removedNotifications.has(notificationId)) return;
          
          // Map API notification to our format
          notificationsList.push({
            _id: notificationId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            created_at: notification.created_at,
            priority: getPriorityFromType(notification.type),
            read: notification.read || readNotifications.has(notificationId),
            data: {
              id: notificationId,
              link: notification.link,
              reference_id: notification.reference_id,
              created_by_name: notification.created_by_name
            }
          });
        });
      }

      // Fallback: Try to fetch legacy notifications if API notifications are empty
      if (notificationsList.length === 0) {
        await fetchLegacyNotifications(notificationsList, readNotifications, removedNotifications, userId);
      }

      // Sort by priority and date
      notificationsList.sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (b.priority === 'high' && a.priority !== 'high') return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setNotifications(notificationsList);
      
      // Use server count if available, otherwise count unread locally
      const unreadCount = countData.unread_count !== undefined 
        ? countData.unread_count 
        : notificationsList.filter(n => !n.read).length;
      
      setUnreadCount(unreadCount);
      

    } catch (error) {
      // Fallback to legacy notifications on error
      await fetchLegacyNotifications([], getReadNotifications(), getRemovedNotifications(), userId);
    } finally {
      setLoading(false);
    }
  }, [userId, getReadNotifications, getRemovedNotifications]);

  // Helper function to get priority from notification type - optimized with useCallback
  const getPriorityFromType = useCallback((type) => {
    switch (type) {
      case 'task_overdue':
      case 'warning':
        return 'high';
      case 'leave_status':
      case 'lead_submission':
        return 'medium';
      default:
        return 'medium';
    }
  }, []);

  // Legacy notification fetching (fallback)
  const fetchLegacyNotifications = async (notificationsList, readNotifications, removedNotifications, userId) => {
    try {
      // Try different API approaches for better compatibility
      const tasksPromise = fetch(`${API_BASE_URL}/tasks/?assigned_to=${userId}&user_id=${userId}&page_size=100`)
        .then(res => res.ok ? res.json() : { tasks: [] });
      
      const ticketsPromise = fetch(`${API_BASE_URL}/tickets/?assigned_to=${userId}&status=open&user_id=${userId}&page=1&per_page=100`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      }).then(res => res.ok ? res.json() : { tickets: [] });
      
      const warningsPromise = fetch(`${API_BASE_URL}/warnings/user/${userId}?user_id=${userId}`)
        .then(res => res.ok ? res.json() : { warnings: [] });

      // Add leave requests for current month
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; // getMonth() is 0-indexed
      const currentYear = currentDate.getFullYear();
      
      const leavesPromise = fetch(`${API_BASE_URL}/leaves/?user_id=${userId}&month=${currentMonth}&year=${currentYear}`)
        .then(res => res.ok ? res.json() : { leaves: [] });

      const [tasks, tickets, warnings, leaves] = await Promise.all([
        tasksPromise,
        ticketsPromise, 
        warningsPromise,
        leavesPromise
      ]);


      const notificationsList = [];

      // Add incomplete tasks (filter for all non-completed status)
      if (tasks.tasks && Array.isArray(tasks.tasks)) {
        tasks.tasks
          .filter(task => {
            const status = task.status ? task.status.toLowerCase() : '';
            return status !== 'completed' && status !== 'done' && status !== 'finished' && status !== 'closed';
          })
          .forEach(task => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date();
            const taskStatus = task.status ? task.status.toLowerCase() : 'pending';
            const notificationId = `task_${task._id || task.id}`;
            
            // Skip if notification was removed
            if (removedNotifications.has(notificationId)) return;
            
            notificationsList.push({
              _id: notificationId,
              type: isOverdue ? 'task_overdue' : 'task_pending',
              title: isOverdue ? '🚨 Overdue Task' : `Task (${taskStatus})`,
              message: `${task.title || task.subject} - Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'No due date'}`,
              created_at: task.created_at,
              priority: isOverdue ? 'high' : task.priority || 'medium',
              read: readNotifications.has(notificationId),
              data: task
            });
          });
      } else if (Array.isArray(tasks)) {
        // Handle case where tasks is directly an array
        tasks
          .filter(task => {
            const status = task.status ? task.status.toLowerCase() : '';
            return status !== 'completed' && status !== 'done' && status !== 'finished' && status !== 'closed';
          })
          .forEach(task => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date();
            const taskStatus = task.status ? task.status.toLowerCase() : 'pending';
            const notificationId = `task_${task._id || task.id}`;
            
            // Skip if notification was removed
            if (removedNotifications.has(notificationId)) return;
            
            notificationsList.push({
              _id: notificationId,
              type: isOverdue ? 'task_overdue' : 'task_pending',
              title: isOverdue ? '🚨 Overdue Task' : `Task (${taskStatus})`,
              message: `${task.title || task.subject} - Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'No due date'}`,
              created_at: task.created_at,
              priority: isOverdue ? 'high' : task.priority || 'medium',
              read: readNotifications.has(notificationId),
              data: task
            });
          });
      }

      // Add open tickets (filter for open status)
      if (tickets.tickets && Array.isArray(tickets.tickets)) {
        tickets.tickets
          .filter(ticket => ticket.status === 'open' || !ticket.status)
          .forEach(ticket => {
            const notificationId = `ticket_${ticket._id || ticket.id}`;
            
            // Skip if notification was removed
            if (removedNotifications.has(notificationId)) return;
            
            notificationsList.push({
              _id: notificationId,
              type: 'ticket_open',
              title: 'Open Ticket',
              message: `${ticket.subject || ticket.title} - Priority: ${ticket.priority || 'Medium'}`,
              created_at: ticket.created_at,
              priority: ticket.priority === 'high' ? 'high' : 'medium',
              read: readNotifications.has(notificationId),
              data: ticket
            });
          });
      } else if (Array.isArray(tickets)) {
        // Handle case where tickets is directly an array
        tickets
          .filter(ticket => ticket.status === 'open' || !ticket.status)
          .forEach(ticket => {
            const notificationId = `ticket_${ticket._id || ticket.id}`;
            
            // Skip if notification was removed
            if (removedNotifications.has(notificationId)) return;
            
            notificationsList.push({
              _id: notificationId,
              type: 'ticket_open',
              title: 'Open Ticket',
              message: `${ticket.subject || ticket.title} - Priority: ${ticket.priority || 'Medium'}`,
              created_at: ticket.created_at,
              priority: ticket.priority === 'high' ? 'high' : 'medium',
              read: readNotifications.has(notificationId),
              data: ticket
            });
          });
      }

      // Add warnings issued to current user only
      if (warnings.warnings) {
        warnings.warnings.forEach(warning => {
          const notificationId = `warning_${warning.id}`;
          
          // Skip if notification was removed
          if (removedNotifications.has(notificationId)) return;
          
          notificationsList.push({
            _id: notificationId,
            type: 'warning',
            title: 'Warning Issued',
            message: `${warning.warning_type} - ${warning.warning_message || 'No additional details'}`,
            created_at: warning.created_at,
            priority: 'high',
            read: readNotifications.has(notificationId),
            data: warning
          });
        });
      }

      // Add leave request status updates for current month
      if (leaves.leaves || Array.isArray(leaves)) {
        const leaveData = leaves.leaves || leaves;
        leaveData
          .filter(leave => {
            // Only show leaves with status updates (approved/rejected) in current month
            const updatedAt = new Date(leave.updated_at || leave.created_at);
            const currentDate = new Date();
            return leave.status !== 'pending' && 
                   updatedAt.getMonth() === currentDate.getMonth() &&
                   updatedAt.getFullYear() === currentDate.getFullYear();
          })
          .forEach(leave => {
            const notificationId = `leave_${leave._id || leave.id}`;
            
            // Skip if notification was removed
            if (removedNotifications.has(notificationId)) return;
            
            const status = leave.status?.charAt(0).toUpperCase() + leave.status?.slice(1) || 'Updated';
            const leaveType = leave.leave_type?.replace('_', ' ').split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ') || 'Leave';
            
            const fromDate = leave.from_date ? new Date(leave.from_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
            const toDate = leave.to_date ? new Date(leave.to_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
            const dateRange = fromDate && toDate ? 
              (fromDate === toDate ? ` for ${fromDate}` : ` from ${fromDate} to ${toDate}`) : '';
            
            notificationsList.push({
              _id: notificationId,
              type: 'leave_status',
              title: `Leave Request ${status}`,
              message: `Your ${leaveType} request${dateRange} has been ${status.toLowerCase()}`,
              created_at: leave.updated_at || leave.created_at,
              priority: leave.status === 'approved' ? 'medium' : 'high',
              read: readNotifications.has(notificationId),
              data: leave
            });
          });
      }

      // Sort by priority and date
      notificationsList.sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (b.priority === 'high' && a.priority !== 'high') return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      // Update the passed array reference
      notificationsList.forEach(notification => {
        notificationsList.push(notification);
      });
      
    } catch (error) {
    }
  };

  // Mark notification as read - optimized with useCallback
  const markAsRead = useCallback(async (notificationId) => {
    // Try to mark as read via API first
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read/${notificationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // API response handled silently
    } catch (error) {
      // Silent error handling
    }
    
    // Update the notifications state
    setNotifications(prev => 
      prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
    );
    
    // Update unread count
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Persist to localStorage
    const readNotifications = getReadNotifications();
    readNotifications.add(notificationId);
    saveReadNotifications(readNotifications);
  }, [getReadNotifications, saveReadNotifications]);

  // Mark notification as unread - optimized with useCallback
  const markAsUnread = useCallback((notificationId) => {
    // Update the notifications state
    setNotifications(prev => 
      prev.map(n => n._id === notificationId ? { ...n, read: false } : n)
    );
    
    // Update unread count
    setUnreadCount(prev => prev + 1);

    // Remove from localStorage read notifications
    const readNotifications = getReadNotifications();
    readNotifications.delete(notificationId);
    saveReadNotifications(readNotifications);
  }, [getReadNotifications, saveReadNotifications]);

  // Remove notification - optimized with useCallback
  const removeNotification = useCallback((notificationId) => {
    // Find the notification to save its data before removal
    const notificationToDelete = notifications.find(n => n._id === notificationId);
    if (notificationToDelete) {
      saveDeletedNotification(notificationToDelete);
    }
    
    setNotifications(prev => {
      const removedNotif = prev.find(n => n._id === notificationId);
      const filtered = prev.filter(n => n._id !== notificationId);
      
      if (removedNotif && !removedNotif.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      
      return filtered;
    });

    // Add to removed notifications list in localStorage
    const removedNotifications = getRemovedNotifications();
    removedNotifications.add(notificationId);
    saveRemovedNotifications(removedNotifications);
    
    // Also remove from read notifications if it was marked as read
    const readNotifications = getReadNotifications();
    readNotifications.delete(notificationId);
    saveReadNotifications(readNotifications);
  }, [notifications, saveDeletedNotification, getReadNotifications, saveReadNotifications, getRemovedNotifications, saveRemovedNotifications]);

  // Mark all as read - optimized with useCallback
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    
    // Try to mark all as read via API first
    try {
      await fetch(`${API_BASE_URL}/notifications/read-all?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      // API response handled silently
    } catch (error) {
      // Silent error handling
    }
    
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      
      // Save all notification IDs to localStorage
      const readNotifications = getReadNotifications();
      updated.forEach(notification => {
        readNotifications.add(notification._id);
      });
      saveReadNotifications(readNotifications);
      
      return updated;
    });
    setUnreadCount(0);
  }, [userId, getReadNotifications, saveReadNotifications]);

  // Get filtered notifications based on active tab
  const getFilteredNotifications = () => {
    switch (activeTab) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'read':
        return notifications.filter(n => n.read);
      default:
        return notifications;
    }
  };

  // Get tab counts
  const getTabCounts = () => {
    const unreadCount = notifications.filter(n => !n.read).length;
    const readCount = notifications.filter(n => n.read).length;
    
    return { unreadCount, readCount };
  };

  // Update position when opened
  useEffect(() => {
    if (isOpen && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      const dropdownWidth = 420;
      let left = rect.left + rect.width / 2 - dropdownWidth / 2;
      const top = rect.bottom + 8;

      if (left < 16) left = 16;
      if (left + dropdownWidth > window.innerWidth - 16) {
        left = window.innerWidth - dropdownWidth - 16;
      }
      setPosition({ top, left });
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && bellRef.current && !bellRef.current.contains(event.target)) {
        const dropdown = document.querySelector('[data-notification-popup]');
        if (dropdown && !dropdown.contains(event.target)) {
          setIsOpen(false);
        }
      }
    };

    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOpen]);

  // Fetch notifications on mount and when bell is clicked - optimized with proper dependencies
  useEffect(() => {
    if (userId) {
      fetchNotifications();
      // Auto-refresh every 5 minutes (reduced for better performance)
      const interval = setInterval(() => {
        if (userId) fetchNotifications();
      }, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [userId, fetchNotifications]);

  // Optimized click handlers with useCallback
  const handleBellClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen && userId) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  }, [isOpen, userId, fetchNotifications]);

  // Optimized icon getter with useCallback
  const getNotificationIcon = useCallback((type) => {
    switch (type) {
      case 'task_overdue':
        return { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' };
      case 'task_pending':
        return { icon: Clock, color: 'text-orange-500', bgColor: 'bg-orange-100' };
      case 'ticket_open':
        return { icon: Ticket, color: 'text-blue-500', bgColor: 'bg-blue-100' };
      case 'warning':
        return { icon: UserX, color: 'text-red-500', bgColor: 'bg-red-100' };
      case 'leave_status':
        return { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-100' };
      case 'lead_submission':
        return { icon: UserPlus, color: 'text-purple-500', bgColor: 'bg-purple-100' };
      default:
        return { icon: AlertCircle, color: 'text-gray-500', bgColor: 'bg-gray-100' };
    }
  }, []);

  // Optimized date formatter with useCallback
  const formatDate = useCallback((dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  }, []);

  // Memoized filtered notifications for better performance
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter(n => !n.read);
    } else if (activeTab === 'read') {
      return notifications.filter(n => n.read);
    }
    return notifications;
  }, [notifications, activeTab]);

  // Memoized notification counts
  const notificationCounts = useMemo(() => {
    const unread = notifications.filter(n => !n.read).length;
    const read = notifications.filter(n => n.read).length;
    return { unread, read, total: notifications.length };
  }, [notifications]);

  return (
    <>
      <div className="relative">
        <button
          ref={bellRef}
          onClick={handleBellClick}
          className="relative p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {isOpen && createPortal(
        <div
          data-notification-popup
          className="fixed bg-white rounded-lg shadow-2xl max-h-[600px] overflow-y-auto border border-gray-200"
          style={{ 
            top: Math.max(position.top, 10), 
            left: Math.max(position.left, 10), 
            zIndex: 99999, 
            width: '420px',
            minHeight: '200px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-white sticky top-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchNotifications}
                  disabled={loading}
                  className="text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {[
                { id: 'unread', label: 'Unread', count: getTabCounts().unreadCount },
                { id: 'read', label: 'Read', count: getTabCounts().readCount }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            {/* View All Notifications Button */}
            <div className="mt-2">
              <button
                onClick={() => {
                  window.location.href = '/all-notifications';
                  setIsOpen(false);
                }}
                className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg"
              >
                📋 View All Notifications
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                Loading notifications...
              </div>
            ) : (() => {
              const filteredNotifications = getFilteredNotifications();
              return filteredNotifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <div className="font-medium">
                    {activeTab === 'unread' && 'All caught up!'}
                    {activeTab === 'read' && 'No read notifications'}
                  </div>
                  <div className="text-sm">
                    {activeTab === 'unread' && 'No unread notifications at this time'}
                    {activeTab === 'read' && 'Mark notifications as read to see them here'}
                  </div>
                </div>
              ) : (
                filteredNotifications.map(notification => {
                  const { icon: NotificationIcon, color, bgColor } = getNotificationIcon(notification.type);
                  
                  return (
                    <div
                      key={notification._id}
                      className={`p-3 hover:bg-gray-50 transition-colors group cursor-pointer ${
                        !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      } ${
                        notification.type === 'task_overdue' && !notification.read ? 'bg-red-50 border-l-4 border-l-red-500 border-t border-t-red-200' : ''
                      }`}
                      onClick={() => {
                        // Mark as read when clicked and navigate
                        if (!notification.read) {
                          markAsRead(notification._id);
                        }
                        navigateToNotification(notification);
                        setIsOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-full ${bgColor || 'bg-gray-100'} flex-shrink-0 ${
                          notification.type === 'task_overdue' && !notification.read ? 'animate-pulse' : ''
                        }`}>
                          <NotificationIcon className={`w-4 h-4 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium text-gray-900 ${
                            !notification.read ? 'font-bold' : ''
                          }`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(notification.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {notification.read ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsUnread(notification._id);
                              }}
                              className="px-2 py-1 text-xs text-orange-600 hover:bg-orange-100 rounded transition-colors font-medium"
                              title="Mark as unread"
                            >
                              Unread
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification._id);
                              }}
                              className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 rounded transition-colors font-medium"
                              title="Mark as read"
                            >
                              Read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// Export optimized component with React.memo for better performance
export default React.memo(NotificationBell);