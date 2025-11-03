import React, { useState, useEffect } from 'react';
import { Bell, Clock, AlertTriangle, Calendar, Users, Loader, Search, X } from 'lucide-react';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

function SimpleNotificationBell({ className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'unread', 'read'
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  
  // Format date to check if it's due
  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    const today = new Date();
    const due = new Date(dueDate);
    return due < today;
  };

  const isDueSoon = (dueDate, days = 15) => {
    if (!dueDate) return false;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= days;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Function to filter notifications based on tab and search query
  const filterNotifications = (notificationsList, tab, query) => {
    let filtered = [...notificationsList];
    
    // Filter by tab
    if (tab === 'unread') {
      filtered = filtered.filter(notification => !notification.isRead);
    } else if (tab === 'read') {
      filtered = filtered.filter(notification => notification.isRead);
    }
    
    // Filter by search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(notification => 
        notification.title.toLowerCase().includes(lowerQuery) ||
        notification.description.toLowerCase().includes(lowerQuery) ||
        notification.type.toLowerCase().includes(lowerQuery)
      );
    }
    
    return filtered;
  };

  // Update filtered notifications when notifications, activeTab, or searchQuery changes
  useEffect(() => {
    const filtered = filterNotifications(notifications, activeTab, searchQuery);
    setFilteredNotifications(filtered);
  }, [notifications, activeTab, searchQuery]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return;
      
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Function to mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        return; // Silently return if no userId
      }
      
      // Update local state immediately
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      );
      
      // Update notification count
      const unreadCount = notifications.filter(n => n.id !== notificationId && !n.isRead).length;
      setNotificationCount(unreadCount);
      
      // Store read state in localStorage since backend might not have read/unread functionality
      const readNotificationsKey = `read_notifications_${userId}`;
      const readNotifications = JSON.parse(localStorage.getItem(readNotificationsKey) || '{}');
      readNotifications[notificationId] = true;
      localStorage.setItem(readNotificationsKey, JSON.stringify(readNotifications));
      
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Function to handle notification click - navigate to the respective page
  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    
    // Close the popup first
    setIsOpen(false);
    
    // Navigate to the specific page based on notification type
    try {
      const baseUrl = window.location.origin;
      let targetUrl = '';
      
      switch (notification.type) {
        case 'task':
          targetUrl = `${baseUrl}/tasks?id=${notification.entityId}`;
          break;
        case 'ticket':
          targetUrl = `${baseUrl}/tickets?id=${notification.entityId}`;
          break;
        case 'lead':
          targetUrl = `${baseUrl}/leads?id=${notification.entityId}`;
          break;
        case 'warning':
          targetUrl = `${baseUrl}/warnings?id=${notification.entityId}`;
          break;
        default:
          console.warn('Unknown notification type:', notification.type);
          return;
      }
      
      // Use setTimeout to ensure popup closes before navigation
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 100);
    } catch (error) {
      console.error('Failed to navigate to notification target:', error);
    }
  };

  // Function to mark all as read
  const markAllAsRead = () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      return; // Silently return if no userId
    }
    
    const readNotificationsKey = `read_notifications_${userId}`;
    const readNotifications = {};
    
    notifications.forEach(notification => {
      readNotifications[notification.id] = true;
    });
    
    localStorage.setItem(readNotificationsKey, JSON.stringify(readNotifications));
    
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    );
    setNotificationCount(0);
  };

  const fetchNotifications = async () => {
    if (!isOpen) return;
    
    setLoading(true);
    const allNotifications = [];
    
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
      if (!token || !userId) {
        console.log('No authentication found, showing empty notifications');
        setNotifications([]);
        setNotificationCount(0);
        setLoading(false);
        return;
      }
      
      console.log('Fetching notifications for user:', userId);

      // Get read notifications from localStorage
      const readNotificationsKey = `read_notifications_${userId}`;
      const readNotifications = JSON.parse(localStorage.getItem(readNotificationsKey) || '{}');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Fetch due tasks - using the correct API pattern from Task.jsx
      try {
        const params = new URLSearchParams({
          user_id: userId,
          page: '1',
          page_size: '100', // Get more tasks to check for due ones
          filter: 'overdue' // Get overdue tasks
        });
        
        const tasksResponse = await fetch(`${API_BASE_URL}/tasks/?${params}`, {
          headers
        });
        
        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          
          // Handle both direct array and object with tasks property
          const taskArray = tasksData.tasks || tasksData || [];
          
          // Also get upcoming tasks that are due soon
          const upcomingParams = new URLSearchParams({
            user_id: userId,
            page: '1',
            page_size: '100',
            filter: 'upcoming' // Get upcoming tasks
          });
          
          const upcomingResponse = await fetch(`${API_BASE_URL}/tasks/?${upcomingParams}`, {
            headers
          });
          
          let upcomingTasks = [];
          if (upcomingResponse.ok) {
            const upcomingData = await upcomingResponse.json();
            upcomingTasks = upcomingData.tasks || upcomingData || [];
          }
          
          // Combine overdue and upcoming tasks
          const allTasks = [...taskArray, ...upcomingTasks];
          
          allTasks.forEach(task => {
            const dueDate = task.due_date || task.dueDate;
            const isTaskOverdue = isOverdue(dueDate);
            const isTaskDueSoon = isDueSoon(dueDate);
            
            if ((isTaskOverdue || isTaskDueSoon) && task.status !== 'Completed' && task.status !== 'completed') {
              const notificationId = `task-${task.id || task._id}`;
              allNotifications.push({
                id: notificationId,
                type: 'task',
                title: 'Due Task',
                description: task.subject || task.title || 'Task',
                message: task.subject || task.title || 'Task',
                dueDate: dueDate,
                isOverdue: isTaskOverdue,
                priority: task.priority || 'medium',
                icon: Clock,
                isRead: readNotifications[notificationId] || false,
                entityId: task.id || task._id
              });
            }
          });
          
        }
      } catch (error) {
        console.warn('Failed to fetch tasks:', error);
      }

      // Fetch due tickets - using the correct API pattern from TicketPage.jsx
      try {
        const ticketParams = new URLSearchParams({
          user_id: userId,
          page: '1',
          per_page: '100',
          status: 'open' // Only get open tickets
        });
        
        const ticketsResponse = await fetch(`${API_BASE_URL}/tickets?${ticketParams}`, {
          headers
        });
        
        if (ticketsResponse.ok) {
          const ticketsData = await ticketsResponse.json();
          
          const ticketArray = ticketsData.tickets || ticketsData || [];
          
          ticketArray.forEach(ticket => {
            const dueDate = ticket.due_date || ticket.dueDate;
            const isTicketOverdue = isOverdue(dueDate);
            const isTicketDueSoon = isDueSoon(dueDate);
            
            if ((isTicketOverdue || isTicketDueSoon) && ticket.status !== 'closed') {
              const notificationId = `ticket-${ticket.id || ticket._id}`;
              allNotifications.push({
                id: notificationId,
                type: 'ticket',
                title: 'Due Ticket',
                description: ticket.subject || ticket.title || 'Support Ticket',
                message: ticket.subject || ticket.title || 'Support Ticket',
                dueDate: dueDate,
                isOverdue: isTicketOverdue,
                priority: ticket.priority || 'medium',
                icon: AlertTriangle,
                isRead: readNotifications[notificationId] || false,
                entityId: ticket.id || ticket._id
              });
            }
          });
          
        }
      } catch (error) {
        console.warn('Failed to fetch tickets:', error);
      }

      // Fetch leads (stale after 15 days from creation) - using the correct API pattern from LeadCRM.jsx
      try {
        const leadParams = new URLSearchParams({
          user_id: userId,
          page: '1',
          limit: '100'
        });
        
        const leadsResponse = await fetch(`${API_BASE_URL}/leads?${leadParams}`, {
          headers
        });
        
        if (leadsResponse.ok) {
          const leadsData = await leadsResponse.json();
          
          // Handle different response formats
          const leadArray = leadsData.leads || leadsData.items || leadsData || [];
          
          leadArray.forEach(lead => {
            // Skip converted or closed leads
            if (lead.status === 'converted' || lead.status === 'closed' || lead.status === 'Converted' || lead.status === 'Closed') {
              return;
            }
            
            const createdDate = new Date(lead.created_at || lead.date_created || lead.createdAt);
            const daysSinceCreated = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceCreated >= 15) {
              const notificationId = `lead-${lead.id || lead._id}`;
              allNotifications.push({
                id: notificationId,
                type: 'lead',
                title: 'Stale Lead',
                description: `${lead.name || lead.lead_name || 'Lead'} - ${daysSinceCreated} days old`,
                message: `${lead.name || lead.lead_name || 'Lead'} - ${daysSinceCreated} days old`,
                dueDate: lead.created_at || lead.date_created || lead.createdAt,
                isOverdue: daysSinceCreated > 30,
                priority: daysSinceCreated > 30 ? 'high' : 'medium',
                icon: Users,
                isRead: readNotifications[notificationId] || false,
                entityId: lead.id || lead._id
              });
            }
          });
          
        }
      } catch (error) {
        console.warn('Failed to fetch leads:', error);
      }

      // Fetch warnings/issues - Check if warnings endpoint exists
      try {
        const warningsResponse = await fetch(`${API_BASE_URL}/warnings?user_id=${userId}`, {
          headers
        });
        
        if (warningsResponse.ok) {
          const warningsData = await warningsResponse.json();
          
          const warningArray = warningsData.warnings || warningsData || [];
          
          warningArray.forEach(warning => {
            if (warning.status === 'active' || warning.status === 'pending') {
              const notificationId = `warning-${warning.id || warning._id}`;
              allNotifications.push({
                id: notificationId,
                type: 'warning',
                title: 'Warning Issue',
                description: warning.message || warning.title || 'System Warning',
                message: warning.message || warning.title || 'System Warning',
                dueDate: warning.created_at,
                isOverdue: warning.severity === 'high',
                priority: warning.severity || 'medium',
                icon: AlertTriangle,
                isRead: readNotifications[notificationId] || false,
                entityId: warning.id || warning._id
              });
            }
          });
          
        }
      } catch (error) {
        console.warn('Failed to fetch warnings (endpoint may not exist):', error);
      }

      // Sort notifications by priority and due date
      allNotifications.sort((a, b) => {
        // First sort by overdue status
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        
        // Then by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 1;
        const bPriority = priorityOrder[b.priority] || 1;
        if (aPriority !== bPriority) return bPriority - aPriority;
        
        // Finally by due date
        return new Date(a.dueDate) - new Date(b.dueDate);
      });

      setNotifications(allNotifications);
      
      // Update notification count based on unread notifications
      const unreadCount = allNotifications.filter(notification => !notification.isRead).length;
      setNotificationCount(unreadCount);

    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Set up periodic refresh every 5 minutes
    const interval = setInterval(() => {
      fetchNotifications();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Initial load when component mounts to show notification count
  useEffect(() => {
    const loadInitialNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');
        
        if (!token || !userId) {
          // Silently handle unauthenticated state - no warnings needed
          setNotificationCount(0);
          return;
        }

        // Quick count fetch without full details
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };

        let count = 0;

        // Count due tasks - using overdue and upcoming filters
        try {
          const overdueParams = new URLSearchParams({
            user_id: userId,
            page: '1',
            page_size: '100',
            filter: 'overdue'
          });
          
          const upcomingParams = new URLSearchParams({
            user_id: userId,
            page: '1',
            page_size: '100',
            filter: 'upcoming'
          });

          const [overdueResponse, upcomingResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/tasks/?${overdueParams}`, { headers }),
            fetch(`${API_BASE_URL}/tasks/?${upcomingParams}`, { headers })
          ]);

          if (overdueResponse.ok) {
            const overdueData = await overdueResponse.json();
            const overdueTasks = (overdueData.tasks || overdueData || []).filter(task => 
              task.status !== 'Completed' && task.status !== 'completed'
            );
            count += overdueTasks.length;
          }

          if (upcomingResponse.ok) {
            const upcomingData = await upcomingResponse.json();
            const upcomingTasks = (upcomingData.tasks || upcomingData || []).filter(task => 
              isDueSoon(task.due_date || task.dueDate) && 
              task.status !== 'Completed' && task.status !== 'completed'
            );
            count += upcomingTasks.length;
          }
        } catch (error) {
          console.warn('Failed to fetch tasks count:', error);
        }

        // Count due tickets
        try {
          const ticketParams = new URLSearchParams({
            user_id: userId,
            page: '1',
            per_page: '100',
            status: 'open'
          });

          const ticketsResponse = await fetch(`${API_BASE_URL}/tickets?${ticketParams}`, { headers });
          if (ticketsResponse.ok) {
            const ticketsData = await ticketsResponse.json();
            const dueTickets = (ticketsData.tickets || ticketsData || []).filter(ticket => 
              (isOverdue(ticket.due_date) || isDueSoon(ticket.due_date)) && 
              ticket.status !== 'closed'
            );
            count += dueTickets.length;
          }
        } catch (error) {
          console.warn('Failed to fetch tickets count:', error);
        }

        // Count stale leads
        try {
          const leadParams = new URLSearchParams({
            user_id: userId,
            page: '1',
            limit: '100'
          });

          const leadsResponse = await fetch(`${API_BASE_URL}/leads?${leadParams}`, { headers });
          if (leadsResponse.ok) {
            const leadsData = await leadsResponse.json();
            const leadArray = leadsData.leads || leadsData.items || leadsData || [];
            const staleLeads = leadArray.filter(lead => {
              if (lead.status === 'converted' || lead.status === 'closed' || lead.status === 'Converted' || lead.status === 'Closed') return false;
              const createdDate = new Date(lead.created_at || lead.date_created || lead.createdAt);
              const daysSinceCreated = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));
              return daysSinceCreated >= 15;
            });
            count += staleLeads.length;
          }
        } catch (error) {
          console.warn('Failed to fetch leads count:', error);
        }

        // Count active warnings (if endpoint exists)
        try {
          const warningsResponse = await fetch(`${API_BASE_URL}/warnings?user_id=${userId}`, { headers });
          if (warningsResponse.ok) {
            const warningsData = await warningsResponse.json();
            const activeWarnings = (warningsData.warnings || warningsData || []).filter(warning => 
              warning.status === 'active' || warning.status === 'pending'
            );
            count += activeWarnings.length;
          }
        } catch (error) {
          console.warn('Failed to fetch warnings count (endpoint may not exist):', error);
        }

        setNotificationCount(count);
      } catch (error) {
        console.error('Failed to load initial notifications:', error);
        setNotificationCount(0);
      }
    };

    loadInitialNotifications();
  }, []);

  const getPriorityColor = (priority, isOverdue) => {
    if (isOverdue) return 'text-red-600 bg-red-50 border-red-200';
    switch (priority) {
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'task': return 'text-blue-600 bg-blue-50';
      case 'ticket': return 'text-red-600 bg-red-50';
      case 'lead': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-white hover:text-gray-300 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
      </button>
      {isOpen && (
        <>
          {/* Backdrop - Click outside to close */}
          <div 
            className="fixed inset-0 z-[998]" 
            onClick={() => setIsOpen(false)}
          />
          
          <div 
            className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-[999] max-h-[480px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Arrow pointing to the bell */}
            <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-t border-l border-gray-200 transform rotate-45"></div>
          
          <div className="p-4 border-b bg-gray-50 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </h3>
              {notifications.filter(n => !n.isRead).length > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Search Box */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'all'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setActiveTab('unread')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'unread'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                }`}
              >
                Unread ({notifications.filter(n => !n.isRead).length})
              </button>
              <button
                onClick={() => setActiveTab('read')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'read'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                }`}
              >
                Read ({notifications.filter(n => n.isRead).length})
              </button>
            </div>
          </div>
          
          {/* Notification content */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-500 text-sm">Loading notifications...</span>
              </div>
            ) : !localStorage.getItem('token') && !localStorage.getItem('authToken') ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm mb-2">Authentication Required</p>
                  <p className="text-gray-400 text-xs">Please log in to view your notifications</p>
                  <p className="text-gray-400 text-xs mt-2">
                    Debug: token={localStorage.getItem('token') ? 'exists' : 'missing'}, 
                    authToken={localStorage.getItem('authToken') ? 'exists' : 'missing'}
                  </p>
                </div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">
                  {searchQuery ? `No notifications found for "${searchQuery}"` : 
                   activeTab === 'read' ? 'No read notifications' :
                   activeTab === 'unread' ? 'No unread notifications' :
                   'No notifications'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => {
                  const IconComponent = notification.icon;
                  return (
                    <div
                      key={notification.id}
                      className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-all cursor-pointer group ${
                        notification.isOverdue ? 'bg-red-50 border-l-4 border-l-red-500' : ''
                      } ${!notification.isRead ? 'bg-blue-50/50' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${getTypeColor(notification.type)} flex-shrink-0`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(notification.priority, notification.isOverdue)}`}>
                              {notification.title}
                            </span>
                            {notification.isOverdue && (
                              <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-200">
                                OVERDUE
                              </span>
                            )}
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 font-medium line-clamp-2 group-hover:text-gray-700" title={notification.description}>
                            {notification.description}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {notification.type === 'lead' ? 'Created' : 'Due'}: {formatDate(notification.dueDate)}
                            </p>
                            <div className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to view →
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
          </div>
          
          {/* Footer only for authenticated users with notifications */}
          {(localStorage.getItem('token') || localStorage.getItem('authToken')) && filteredNotifications.length > 0 && (
            <div className="p-3 border-t bg-gray-50 flex justify-between items-center text-xs">
              <div className="text-gray-500">
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}

// Add custom styles for scrollbar and animations
const styles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .animate-in {
    animation: slideIn 0.2s ease-out;
  }
  
  .slide-in-from-top-2 {
    transform: translateY(-8px);
    opacity: 0;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const existingStyle = document.getElementById('notification-bell-styles');
  if (!existingStyle) {
    const styleElement = document.createElement('style');
    styleElement.id = 'notification-bell-styles';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
}

export default SimpleNotificationBell;
