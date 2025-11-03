import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  ArrowLeft,
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  FileText, 
  Calendar,
  RefreshCw,
  Settings,
  Check,
  CheckCheck,
  Search,
  Filter,
  AlertCircle,
  Info,
  Ticket,
  UserX,
  UserPlus
} from 'lucide-react';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Get user ID from localStorage
  const getUserId = () => {
    try {
      const userId = localStorage.getItem('userId');
      if (userId) return userId;
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        return parsedUser.id || parsedUser._id || parsedUser.user_id;
      }
      return null;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  };

  // Get read notifications from localStorage
  const getReadNotifications = () => {
    try {
      const userId = getUserId();
      if (!userId) return new Set();
      const readNotifs = localStorage.getItem(`readNotifications_${userId}`);
      return readNotifs ? new Set(JSON.parse(readNotifs)) : new Set();
    } catch (error) {
      console.error('Error getting read notifications:', error);
      return new Set();
    }
  };

  // Save read notifications to localStorage
  const saveReadNotifications = (readSet) => {
    try {
      const userId = getUserId();
      if (!userId) return;
      localStorage.setItem(`readNotifications_${userId}`, JSON.stringify([...readSet]));
    } catch (error) {
      console.error('Error saving read notifications:', error);
    }
  };

  // Get removed notifications from localStorage
  const getRemovedNotifications = () => {
    try {
      const userId = getUserId();
      if (!userId) return new Set();
      const removedNotifs = localStorage.getItem(`removedNotifications_${userId}`);
      return removedNotifs ? new Set(JSON.parse(removedNotifs)) : new Set();
    } catch (error) {
      console.error('Error getting removed notifications:', error);
      return new Set();
    }
  };

  // Save removed notifications to localStorage
  const saveRemovedNotifications = (removedSet) => {
    try {
      const userId = getUserId();
      if (!userId) return;
      localStorage.setItem(`removedNotifications_${userId}`, JSON.stringify([...removedSet]));
    } catch (error) {
      console.error('Error saving removed notifications:', error);
    }
  };

  // Navigation function for clicking notifications (same logic as NotificationBell)
  const navigateToNotification = (notification) => {
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
          } else {
            console.log('Unknown notification type:', notification.type);
          }
      }
    } catch (error) {
      console.error('Error navigating to notification:', error);
    }
  };

  // Fetch notifications data
  const fetchNotifications = async () => {
    const userId = getUserId();
    if (!userId) return;

    setLoading(true);
    try {
      // Get read and removed notifications from localStorage
      const readNotifications = getReadNotifications();
      const removedNotifications = getRemovedNotifications();

      // Use the same API endpoint as NotificationBell for consistency
      const notificationsPromise = fetch(`${API_BASE_URL}/notifications?user_id=${userId}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        }
      }).then(res => res.ok ? res.json() : []);
      
      const countPromise = fetch(`${API_BASE_URL}/notifications/count?user_id=${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        }
      }).then(res => res.ok ? res.json() : { unread_count: 0 });

      const [apiNotifications, countData] = await Promise.all([
        notificationsPromise,
        countPromise
      ]);

      console.log('🔔 NotificationsPage: API Response:', apiNotifications);
      console.log('🔔 NotificationsPage: Count Response:', countData);

      const notificationsList = [];

      // Process API notifications (same logic as NotificationBell)
      if (Array.isArray(apiNotifications)) {
        apiNotifications.forEach(notification => {
          const notificationId = notification._id || notification.id;
          
          // Skip if notification was removed locally
          if (removedNotifications.has(notificationId)) return;
          
          // Map API notification to our format with proper read status
          const isRead = notification.read || readNotifications.has(notificationId);
          
          notificationsList.push({
            _id: notificationId,
            type: notification.type || 'general',
            title: notification.title || 'Notification',
            message: notification.message || notification.body || '',
            created_at: notification.created_at || notification.timestamp || new Date().toISOString(),
            priority: notification.priority || 'medium',
            read: isRead,
            data: notification.data || notification
          });
        });
      }

      // Sort by date (newest first) and priority
      notificationsList.sort((a, b) => {
        // First sort by priority (high priority first)
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (b.priority === 'high' && a.priority !== 'high') return 1;
        
        // Then sort by date (newest first)
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setNotifications(notificationsList);
      setUnreadCount(notificationsList.filter(n => !n.read).length);

    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    console.log('🔔 NotificationsPage: Marking as read:', notificationId);
    
    // Try to mark as read via API first (same as NotificationBell)
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read/${notificationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ Successfully marked as read via API');
      } else {
        console.warn('⚠️ Failed to mark as read via API, using localStorage fallback');
      }
    } catch (error) {
      console.warn('❌ API mark as read failed, using localStorage fallback:', error);
    }
    
    // Update local state
    setNotifications(prev => 
      prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Also update localStorage as fallback
    const readNotifications = getReadNotifications();
    readNotifications.add(notificationId);
    saveReadNotifications(readNotifications);
  };

  // Mark notification as unread
  const markAsUnread = async (notificationId) => {
    console.log('🔔 NotificationsPage: Marking as unread:', notificationId);
    
    // Note: There might not be an API endpoint for marking as unread, so we'll use localStorage
    // Update local state
    setNotifications(prev => 
      prev.map(n => n._id === notificationId ? { ...n, read: false } : n)
    );
    setUnreadCount(prev => prev + 1);

    // Update localStorage
    const readNotifications = getReadNotifications();
    readNotifications.delete(notificationId);
    saveReadNotifications(readNotifications);
  };

  // Remove notification
  const removeNotification = (notificationId) => {
    setNotifications(prev => {
      const removedNotif = prev.find(n => n._id === notificationId);
      const filtered = prev.filter(n => n._id !== notificationId);
      
      if (removedNotif && !removedNotif.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      
      return filtered;
    });

    const removedNotifications = getRemovedNotifications();
    removedNotifications.add(notificationId);
    saveRemovedNotifications(removedNotifications);
    
    const readNotifications = getReadNotifications();
    readNotifications.delete(notificationId);
    saveReadNotifications(readNotifications);
  };

  // Mark all as read
  const markAllAsRead = async () => {
    console.log('🔔 NotificationsPage: Marking all as read');
    
    const userId = getUserId();
    if (!userId) return;
    
    // Try to mark all as read via API first (same as NotificationBell)
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read-all?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ Successfully marked all as read via API');
      } else {
        console.warn('⚠️ Failed to mark all as read via API, using localStorage fallback');
      }
    } catch (error) {
      console.warn('❌ API mark all as read failed, using localStorage fallback:', error);
    }
    
    // Update local state
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      
      // Save all notification IDs to localStorage as fallback
      const readNotifications = getReadNotifications();
      updated.forEach(notification => {
        readNotifications.add(notification._id);
      });
      saveReadNotifications(readNotifications);
      
      return updated;
    });
    setUnreadCount(0);
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    // Filter by read/unread status
    if (filter === 'unread' && notification.read) return false;
    if (filter === 'read' && !notification.read) return false;
    
    // Filter by category
    if (categoryFilter !== 'all' && notification.type !== categoryFilter) return false;
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        notification.title?.toLowerCase().includes(searchLower) ||
        notification.message?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  // Get notification icon (same logic as NotificationBell)
  const getNotificationIcon = (type) => {
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
  };

  // Format date
  const formatDate = (dateString) => {
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
  };

  // Get unique categories
  const categories = ['all', ...new Set(notifications.map(n => n.type).filter(Boolean))];

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.history.back()}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Bell className="w-6 h-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">All Notifications</h1>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-sm px-2 py-1 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={fetchNotifications}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <CheckCheck className="w-4 h-4 inline mr-2" />
                  Mark all as read
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          {/* Filters */}
          <div className="p-6 border-b border-gray-200">
            {/* Filter tabs */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-4">
              {[
                { key: 'all', label: 'All', count: notifications.length },
                { key: 'unread', label: 'Unread', count: unreadCount },
                { key: 'read', label: 'Read', count: notifications.length - unreadCount }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    filter === tab.key
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      filter === tab.key
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search and category filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {/* Category filter */}
              {categories.length > 2 && (
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Notifications list */}
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                <p>Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">No notifications</h3>
                <p className="text-sm">
                  {filter === 'unread' ? 'All caught up!' : 
                   searchTerm || categoryFilter !== 'all' ? 'No notifications match your filters.' :
                   'You have no notifications yet.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map(notification => {
                const { icon: NotificationIcon, color, bgColor } = getNotificationIcon(notification.type);
                
                return (
                  <div
                    key={notification._id}
                    className={`p-6 hover:bg-gray-50 transition-colors group cursor-pointer ${
                      !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    } ${
                      notification.type === 'task_overdue' && !notification.read ? 'bg-red-50 border-l-4 border-l-red-500' : ''
                    }`}
                    onClick={() => {
                      if (!notification.read) {
                        markAsRead(notification._id);
                      }
                      navigateToNotification(notification);
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-full ${bgColor} flex-shrink-0 ${
                        notification.type === 'task_overdue' && !notification.read ? 'animate-pulse' : ''
                      }`}>
                        <NotificationIcon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-base font-medium text-gray-900 ${
                          !notification.read ? 'font-semibold' : ''
                        }`}>
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {notification.read ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsUnread(notification._id);
                            }}
                            className="px-3 py-1 text-xs text-orange-600 hover:bg-orange-100 rounded-lg transition-colors font-medium"
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
                            className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-medium"
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
            )}
          </div>

          {/* Footer */}
          {filteredNotifications.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-500 text-center">
                Showing {filteredNotifications.length} of {notifications.length} notifications
                {searchTerm && ` matching "${searchTerm}"`}
                {categoryFilter !== 'all' && ` in ${categoryFilter}`}
              </p>
              {(searchTerm || categoryFilter !== 'all') && (
                <div className="text-center mt-2">
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setCategoryFilter('all');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
