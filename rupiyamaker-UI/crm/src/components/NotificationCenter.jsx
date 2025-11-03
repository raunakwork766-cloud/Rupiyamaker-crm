import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bell, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  FileText, 
  Calendar,
  RefreshCw,
  Settings,
  MoreHorizontal,
  Check,
  CheckCheck,
  Trash2,
  Search,
  Filter,
  Star,
  AlertCircle,
  Info
} from 'lucide-react';

// Enhanced Notification Item Component
const NotificationItem = ({ notification, onMarkAsRead, onDelete, isCompact = false }) => {
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'task_overdue': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'task_due': return <Clock className="w-4 h-4 text-orange-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
      case 'user': return <User className="w-4 h-4 text-blue-500" />;
      case 'system': return <Settings className="w-4 h-4 text-gray-500" />;
      case 'lead': return <FileText className="w-4 h-4 text-purple-500" />;
      case 'calendar': return <Calendar className="w-4 h-4 text-indigo-500" />;
      default: return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'high':
        return {
          border: 'border-l-red-500',
          bg: 'bg-red-50',
          icon: 'bg-red-100',
          badge: 'bg-red-500 text-white'
        };
      case 'medium':
        return {
          border: 'border-l-orange-500',
          bg: 'bg-orange-50',
          icon: 'bg-orange-100',
          badge: 'bg-orange-500 text-white'
        };
      case 'low':
        return {
          border: 'border-l-gray-400',
          bg: 'bg-gray-50',
          icon: 'bg-gray-100',
          badge: 'bg-gray-500 text-white'
        };
      default:
        return {
          border: 'border-l-blue-500',
          bg: 'bg-blue-50',
          icon: 'bg-blue-100',
          badge: 'bg-blue-500 text-white'
        };
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const priorityStyles = getPriorityStyles(notification.priority);

  return (
    <div
      className={`relative group p-3 hover:bg-gray-50 cursor-pointer border-l-4 transition-all duration-200 ${
        !notification.read 
          ? `${priorityStyles.bg} ${priorityStyles.border}` 
          : 'bg-white border-l-transparent hover:border-l-gray-300'
      }`}
      onClick={() => !notification.read && onMarkAsRead(notification._id)}
    >
      {/* Priority badge */}
      {notification.priority && notification.priority !== 'normal' && (
        <div className="absolute top-2 right-2">
          <span className={`text-xs px-2 py-1 rounded-full ${priorityStyles.badge}`}>
            {notification.priority.toUpperCase()}
          </span>
        </div>
      )}

      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-3 left-1 w-2 h-2 bg-blue-500 rounded-full"></div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 p-2 rounded-full ${
          !notification.read ? priorityStyles.icon : 'bg-gray-100'
        }`}>
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-8">
          <h4 className={`text-sm font-medium text-gray-900 ${
            !notification.read ? 'font-semibold' : ''
          }`}>
            {notification.title}
          </h4>
          
          {!isCompact && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {notification.message}
            </p>
          )}
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {formatTimeAgo(notification.created_at)}
            </span>
            
            {/* Action buttons - show on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!notification.read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(notification._id);
                  }}
                  className="p-1 rounded hover:bg-blue-100 text-blue-600"
                  title="Mark as read"
                >
                  <Check className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(notification._id);
                }}
                className="p-1 rounded hover:bg-red-100 text-red-600"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Notification Center Component
const NotificationCenter = ({ 
  isOpen, 
  triggerRef, 
  notifications = [], 
  unreadCount = 0,
  isLoading = false,
  hasError = false,
  errorMessage = '',
  onRefresh,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClose 
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [isCompact, setIsCompact] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const popupRef = useRef(null);

  // Calculate position when popup opens
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const updatePosition = () => {
        const rect = triggerRef.current.getBoundingClientRect();
        const popupWidth = 400;
        let left = rect.left + rect.width / 2 - popupWidth / 2;
        const top = rect.bottom + 8;

        // Ensure popup stays within viewport
        if (left < 16) left = 16;
        if (left + popupWidth > window.innerWidth - 16) {
          left = window.innerWidth - popupWidth - 16;
        }

        setPosition({ top, left });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      return () => window.removeEventListener('resize', updatePosition);
    }
  }, [isOpen, triggerRef]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen &&
        popupRef.current &&
        !popupRef.current.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

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

  // Get unique categories from notifications
  const categories = ['all', ...new Set(notifications.map(n => n.type).filter(Boolean))];

  // Clear search when popup closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setCategoryFilter('all');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={popupRef}
      className="fixed bg-white rounded-lg shadow-2xl border border-gray-200"
      style={{
        top: position.top,
        left: position.left,
        width: '400px',
        maxHeight: '600px',
        minHeight: '300px',
        zIndex: 10002, // Higher than any modal
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(59, 130, 246, 0.5)', // More prominent shadow
        border: '2px solid #3b82f6' // Blue border to make it more visible
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <button
            onClick={() => setIsCompact(!isCompact)}
            className="p-1 rounded hover:bg-gray-200 text-gray-600"
            title={isCompact ? "Detailed view" : "Compact view"}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          
          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-200 text-gray-600"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'all', label: 'All', count: notifications.length },
          { key: 'unread', label: 'Unread', count: unreadCount },
          { key: 'read', label: 'Read', count: notifications.length - unreadCount }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search and category filter */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {/* Category filter */}
        {categories.length > 2 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

      {/* Actions bar */}
      {unreadCount > 0 && (
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        </div>
      )}

      {/* Notifications list */}
      <div className="max-h-96 overflow-y-auto">
        {hasError ? (
          <div className="flex flex-col items-center justify-center p-8 text-red-500">
            <AlertTriangle className="w-12 h-12 mb-3 text-red-400" />
            <p className="text-lg font-medium">Error Loading Notifications</p>
            <p className="text-sm text-gray-600 mb-4">{errorMessage}</p>
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Loading notifications...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-gray-500">
            <Bell className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium">No notifications</p>
            <p className="text-sm">
              {filter === 'unread' ? 'All caught up!' : 
               searchTerm || categoryFilter !== 'all' ? 'No notifications match your filters.' :
               'You have no notifications yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map(notification => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onMarkAsRead={onMarkAsRead}
                onDelete={onDeleteNotification}
                isCompact={isCompact}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <div className="text-xs text-gray-500 text-center">
          {filteredNotifications.length > 0 ? (
            <>
              Showing {filteredNotifications.length} of {notifications.length} notifications
              {searchTerm && ` matching "${searchTerm}"`}
              {categoryFilter !== 'all' && ` in ${categoryFilter}`}
            </>
          ) : searchTerm || categoryFilter !== 'all' ? (
            <>No notifications found matching your filters</>
          ) : null}
        </div>
        {(searchTerm || categoryFilter !== 'all') && (
          <div className="text-center mt-2">
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default NotificationCenter;
