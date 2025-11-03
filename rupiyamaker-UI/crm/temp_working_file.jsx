import React, { useState, useEffect } from "react";
import { 
  Bell, 
  Plus, 
  Send, 
  Eye, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  AlertCircle,
  Power,
  BarChart3,
  Trash2,
  Edit,
  MessageSquare,
  X,
  User,
  Calendar,
  ChevronDown,
  CheckCircle,
  XCircle
} from "lucide-react";
import { API_BASE_URL } from '../config/api';

// Status card configuration for Notification Management (LeadCRM Style)
const statusCardConfig = [
  {
    key: 'total_sent',
    label: 'TOTAL SENT',
    icon: MessageSquare,
    gradient: 'from-blue-500 to-cyan-400',
    shadowColor: 'shadow-blue-500/25',
  },
  {
    key: 'active',
    label: 'ACTIVE',
    icon: CheckCircle,
    gradient: 'from-green-500 to-green-400',
    shadowColor: 'shadow-green-500/25',
  },
  {
    key: 'complete',
    label: 'COMPLETE',
    icon: CheckCircle2,
    gradient: 'from-emerald-500 to-teal-400',
    shadowColor: 'shadow-emerald-500/25',
  },
  {
    key: 'deactivate',
    label: 'DEACTIVATE',
    icon: XCircle,
    gradient: 'from-red-500 to-pink-400',
    shadowColor: 'shadow-red-500/25',
  },
];

/**
 * NotificationManagementPage - Admin interface for global notifications
 * 
 * This page allows users with notification permissions to:
 * - Send new global notifications
 * - View all sent notifications
 * - See acceptance statistics
 * - Deactivate notifications
 * - View detailed history
 */
const NotificationManagementPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [stats, setStats] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    content: "",
    priority: "normal",
    targetType: "all", // all, department, individual
    targetDepartments: [],
    targetEmployees: []
  });

  // Multi-select state
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Priority configurations
  const priorityConfig = {
    urgent: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
    high: { icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
    normal: { icon: Info, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
    low: { icon: Bell, color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" }
  };

  // Get user ID from localStorage (using _id as mentioned)
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

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const userId = getUserId();
      if (!userId) {
        setError('User ID not found');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/pop-notifications/?user_id=${userId}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Normalize list items: ensure `id` exists (fallback to _id)
        const items = (data.notifications || []).map(n => ({ ...n, id: n.id || n._id }));
        setNotifications(items);
        setError(null);
      } else {
        throw new Error("Failed to fetch notifications");
      }
    } catch (error) {
      setError("Failed to load notifications");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const userId = getUserId();
      if (!userId) {
        console.error('User ID not found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/pop-notifications/stats/overview?user_id=${userId}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  // Fetch departments from API
  const fetchDepartments = async () => {
    try {
      console.log('🏢 Fetching departments from:', `${API_BASE_URL}/departments`);
      const response = await fetch(`${API_BASE_URL}/departments?user_id=None`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      console.log('🏢 Departments API response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('🏢 Departments API response data:', data);
        // Handle both array response or object with departments array
        const departmentList = Array.isArray(data) ? data : (data.departments || []);
        console.log('🏢 Processed departments list:', departmentList);
        setDepartments(departmentList);
      } else {
        console.error("Failed to fetch departments:", response.statusText);
        const errorText = await response.text();
        console.error("Departments API error details:", errorText);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  // Fetch users/employees from API
  const fetchEmployees = async () => {
    try {
      console.log('👥 Fetching employees from:', `${API_BASE_URL}/users`);
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      console.log('👥 Users API response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('👥 Users API response data:', data);
        // Handle both array response or object with users array
        const userList = Array.isArray(data) ? data : (data.users || []);
        console.log('👥 Processed users list:', userList);
        setEmployees(userList);
      } else {
        console.error("Failed to fetch employees:", response.statusText);
        const errorText = await response.text();
        console.error("Users API error details:", errorText);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // Send notification
  const sendNotification = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const userId = getUserId();
      if (!userId) {
        setError('User ID not found');
        setLoading(false);
        return;
      }

      // Prepare the payload with targeting information
      const payload = {
        title: formData.title,
        message: formData.message,
        content: formData.content,
        priority: formData.priority,
        target_type: formData.targetType,
        target_departments: formData.targetType === 'department' ? selectedDepartments.map(dept => dept.id || dept) : [],
        target_employees: formData.targetType === 'individual' ? selectedEmployees.map(emp => emp.id || emp) : []
      };

      console.log('📤 Sending notification payload:', payload);
      console.log('📤 Selected departments:', selectedDepartments);
      console.log('📤 Selected employees:', selectedEmployees);

      const response = await fetch(`${API_BASE_URL}/pop-notifications/?user_id=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSuccess("Notification sent successfully!");
        setFormData({ 
          title: "", 
          message: "", 
          content: "", 
          priority: "normal", 
          targetType: "all", 
          targetDepartments: [], 
          targetEmployees: [] 
        });
        setSelectedDepartments([]);
        setSelectedEmployees([]);
        setShowCreateForm(false);
        fetchNotifications();
        fetchStats();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to send notification");
      }
    } catch (error) {
      setError(error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Deactivate notification
  const deactivateNotification = async (notificationId) => {
    if (!confirm("Are you sure you want to deactivate this notification?")) {
      return;
    }

    try {
      const userId = getUserId();
      if (!userId) {
        setError('User ID not found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/pop-notifications/${notificationId}/deactivate?user_id=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ reason: "Manually deactivated by admin" }),
      });

      if (response.ok) {
        setSuccess("Notification deactivated successfully!");
        fetchNotifications();
        fetchStats();
      } else {
        throw new Error("Failed to deactivate notification");
      }
    } catch (error) {
      setError(error.message);
      console.error(error);
    }
  };

  // Activate notification  
  const activateNotification = async (notificationId) => {
    if (!confirm("Are you sure you want to activate this notification?")) {
      return;
    }

    try {
      const userId = getUserId();
      if (!userId) {
        setError('User ID not found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/pop-notifications/${notificationId}/activate?user_id=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ reason: "Manually activated by admin" }),
      });

      if (response.ok) {
        setSuccess("Notification activated successfully!");
        fetchNotifications();
        fetchStats();
      } else {
        throw new Error("Failed to activate notification");
      }
    } catch (error) {
      setError(error.message);
      console.error(error);
    }
  };

  // View notification history
  const viewHistory = async (notificationId) => {
    try {
      const userId = getUserId();
      if (!userId) {
        setError('User ID not found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/pop-notifications/${notificationId}/history?user_id=${userId}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedNotification(data);
        setShowHistory(true);
      } else {
        throw new Error("Failed to fetch notification history");
      }
    } catch (error) {
      setError(error.message);
      console.error(error);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    // Convert to 12-hour format with AM/PM
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const formattedHours = hours.toString().padStart(2, '0');
    
    return `${day} ${month} ${year} ${formattedHours}:${minutes} ${ampm}`;
  };

  // Load data on component mount
  useEffect(() => {
    fetchNotifications();
    fetchStats();
    fetchDepartments();
    fetchEmployees();
  }, []);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8 bg-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
             
            
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center gap-3"
            >
              <Plus className="h-5 w-5" />
              Create Notification
            </button>
          </div>
        </div>

        {/* Status Cards - LeadCRM Style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6 mb-8">
          {statusCardConfig.map(({ key, label, icon: Icon, gradient, shadowColor }, index) => {
            let value = 0;
            
            // Calculate values based on notifications array
            if (notifications && notifications.length > 0) {
              switch(key) {
                case 'total_sent':
                  value = notifications.length;
                  break;
                case 'active':
                  // Active = notifications that are active but NOT yet complete (not 100% acceptance)
                  value = notifications.filter(n => {
                    if (!n.is_active) return false;
                    const stats = n.acceptance_stats || {};
                    const totalUsers = stats.total_users || 0;
                    const acceptedCount = stats.accepted_count || 0;
                    // Active means is_active=true AND not 100% complete
                    return !(totalUsers > 0 && acceptedCount === totalUsers);
                  }).length;
                  break;
                case 'complete':
                  // Complete = active notifications with 100% acceptance rate
                  value = notifications.filter(n => {
                    if (!n.is_active) return false;
                    const stats = n.acceptance_stats || {};
                    const totalUsers = stats.total_users || 0;
                    const acceptedCount = stats.accepted_count || 0;
                    return totalUsers > 0 && acceptedCount === totalUsers;
                  }).length;
                  break;
                case 'deactivate':
                  // Deactivate = notifications that are inactive (stopped/deactivated)
                  value = notifications.filter(n => !n.is_active).length;
                  break;
                default:
                  value = 0;
              }
            }
              
              return (
                <div 
                  key={index} 
                  className={`p-4 rounded-xl bg-gradient-to-r ${gradient} shadow-lg ${shadowColor || 'shadow-lg'} flex-1 cursor-pointer transition-transform hover:scale-105`}
                >
                  <div className="flex justify-between items-center">
                    <Icon className="w-6 h-6 text-white" />
                    <span className="text-xl font-bold text-white">{value}</span>
                  </div>
                  <p className="mt-4 text-md text-white font-medium uppercase tracking-wide">{label}</p>
                </div>
              );
            })}
        </div>

        {/* Messages */}
        {success && (
          <div className="mb-6 p-4 bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500 text-green-300 rounded-lg backdrop-blur-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500 text-red-300 rounded-lg backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Notifications Table - LeadCRM Style */}
        <div className="bg-black rounded-lg overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
          <table className="min-w-full w-full bg-black relative">
            <thead className="bg-white sticky top-0 z-50 shadow-lg border-b-2 border-gray-200">
              <tr>
                <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200 text-left">
                  #
                </th>
                <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200 text-left">
                  Date & Time
                </th>
                <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200 text-left">
                  Created By
                </th>
                <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200 text-left">
                  Subject
                </th>
                <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200 text-left">
                  Target
                </th>
                <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200 text-left">
                  Progress
                </th>
                <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200 text-left">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-black">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-gray-400 text-lg bg-black">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      <span className="text-xl font-semibold">Loading Notifications...</span>
                    </div>
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-gray-400 text-lg bg-black">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Bell className="w-12 h-12 text-gray-600" />
                      <span className="text-xl font-semibold">No Notifications Found</span>
                      <p className="text-sm text-gray-500">Create your first notification to get started</p>
                    </div>
                  </td>
                </tr>
              ) : 
                notifications.map((notification, index) => {
                  const config = priorityConfig[notification.priority] || priorityConfig.normal;
                  const IconComponent = config.icon;
                  const stats = notification.acceptance_stats || {};
                  const totalTargetUsers = stats.total_users || 0;
                  const acceptedCount = stats.accepted_count || 0;
                  const pendingCount = Math.max(0, totalTargetUsers - acceptedCount);
                  const acceptanceRate = totalTargetUsers > 0 ? (acceptedCount / totalTargetUsers * 100) : 0;
                  
                  return (
                    <tr 
                      key={notification.id} 
                      className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => viewHistory(notification.id || notification._id)}
                      title="Click to view notification history"
                    >
                        {/* # Column */}
                        <td className="px-4 py-3 text-white">
                          <span className="text-blue-400 font-bold text-lg">
                            #{notifications.length - index}
                          </span>
                        </td>
                        
                        {/* Date & Time Column */}
                        <td className="px-4 py-3 text-white">
                          <div className="text-white font-medium text-sm">
                            {formatDate(notification.created_at)}
                          </div>
                        </td>
                        
                        {/* Created By Column */}
                        <td className="px-4 py-3 text-white">
                          <div className="text-white font-medium text-sm">
                            {notification.sender_name || 'Unknown'}
                          </div>
                        </td>
                        
                        {/* Subject Column */}
                        <td className="px-4 py-3 text-white">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${config.bg} flex-shrink-0`}>
                              <IconComponent className={`h-4 w-4 ${config.color}`} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-medium text-white truncate text-sm">{notification.title}</h4>
                              <p className="text-gray-400 text-xs truncate max-w-xs">{notification.message}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color} ${config.bg}`}>
                                  {notification.priority.toUpperCase()}
                                </span>
                                {(() => {
                                  // If notification is not active
                                  if (!notification.is_active) {
                                    return (
                                      <span className="px-2 py-1 text-xs font-medium rounded-full text-gray-400 bg-gray-900/50">
                                        INACTIVE
                                      </span>
                                    );
                                  }
                                  // If notification is active and has 100% acceptance rate
                                  else if (notification.is_active && totalTargetUsers > 0 && acceptedCount === totalTargetUsers) {
                                    return (
                                      <span className="px-2 py-1 text-xs font-medium rounded-full text-blue-300 bg-blue-900/50">
                                        COMPLETE
                                      </span>
                                    );
                                  }
                                  // If notification is active but not complete
                                  else {
                                    return (
                                      <span className="px-2 py-1 text-xs font-medium rounded-full text-green-300 bg-green-900/50">
                                        ACTIVE
                                      </span>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        {/* Target Column */}
                        <td className="px-4 py-3 text-white">
                          {notification.target_type === 'all' && (
                            <span className="text-green-400 font-medium text-sm">All Employees</span>
                          )}
                          {notification.target_type === 'department' && (
                            <div>
                              <span className="text-blue-400 font-medium text-sm">Departments</span>
                              <div className="text-xs text-gray-400 mt-1">
                                {notification.target_departments?.length || 0} department(s)
                              </div>
                            </div>
                          )}
                          {notification.target_type === 'individual' && (
                            <div>
                              <span className="text-purple-400 font-medium text-sm">Specific Employees</span>
                              <div className="text-xs text-gray-400 mt-1">
                                {notification.target_employees?.length || 0} employee(s)
                              </div>
                            </div>
                          )}
                          {!notification.target_type && (
                            <span className="text-green-400 font-medium text-sm">All Employees</span>
                          )}
                        </td>
                        
                        {/* Progress Column */}
                        <td className="px-4 py-3 text-white">
                          <div className="flex flex-col gap-1 min-w-32">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-green-400 font-medium" title="Accepted">{acceptedCount}</span>
                              <span className="text-yellow-400 font-medium" title="Pending">{pendingCount}</span>
                              <span className="text-white font-medium" title="Total Targeted">{totalTargetUsers}</span>
                            </div>
                            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-300"
                                style={{ width: `${acceptanceRate}%` }}
                              ></div>
                            </div>
                            <span className="text-white font-medium text-center text-xs">
                              {acceptanceRate.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent row click
                                viewHistory(notification.id || notification._id);
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-medium text-xs uppercase tracking-wide transition-colors"
                              title="View Details"
                            >
                              VIEW
                            </button>
                            
                            {/* Status-based Action Button */}
                            {(() => {
                              // Inactive notification = Start button  
                              if (!notification.is_active) {
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent row click
                                      activateNotification(notification.id || notification._id);
                                    }}
                                    className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wide transition-all duration-300 transform hover:-translate-y-1"
                                    title="Activate Notification"
                                  >
                                    START
                                  </button>
                                );
                              }
                              // Active notification with 100% acceptance rate = Completed
                              else if (notification.is_active && totalTargetUsers > 0 && acceptedCount === totalTargetUsers) {
                                return (
                                  <span className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wide">
                                    COMPLETED
                                  </span>
                                );
                              }
                              // Active notification = Stop button
                              else {
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent row click
                                      deactivateNotification(notification.id || notification._id);
                                    }}
                                    className="bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wide transition-all duration-300 transform hover:-translate-y-1"
                                    title="Deactivate Notification"
                                  >
                                    STOP
                                  </button>
                                );
                              }
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Notification Modal */}
      {showCreateForm && (
        <div className="bg-transparent fixed inset-0 z-50 flex items-center justify-center">
          <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-3xl mx-4 space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
              onClick={() => setShowCreateForm(false)}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <form onSubmit={sendNotification}>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">
                    Date & Time
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value={formatDate(new Date())}
                    readOnly
                  />
                </div>
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">
                    Created By
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value="Admin User"
                    readOnly
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block font-bold text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  required
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="mt-4">
                <label className="block font-bold text-gray-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                  placeholder="Enter notification subject"
                  required
                />
              </div>

              <div className="mt-4">
                <label className="block font-bold text-gray-700 mb-1">
                  Notification Details *
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none"
                  rows="3"
                  placeholder="Enter notification details..."
                  required
                />
              </div>

              <div className="mt-4">
                <label className="block font-bold text-gray-700 mb-1">
                  Rich Content (HTML)
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none"
                  rows="3"
                  placeholder="Enter rich HTML content (optional)"
                />
              </div>

              <div className="mt-4">
                <label className="block font-bold text-gray-700 mb-1">
                  Target Type
                </label>
                <select
                  value={formData.targetType}
                  onChange={(e) => setFormData({ ...formData, targetType: e.target.value })}
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                >
                  <option value="all">All Employees</option>
                  <option value="department">Specific Departments</option>
                  <option value="individual">Individual Employees</option>
                </select>
              </div>

              {/* Department Selection */}
              {formData.targetType === 'department' && (
                <div className="mt-4">
                  <label className="block font-bold text-gray-700 mb-1">
                    Select Departments
                  </label>
                  <div className="relative">
                    <div 
                      className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100 cursor-pointer flex items-center justify-between min-h-[40px]"
                      onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                    >
                      {selectedDepartments.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedDepartments.map((dept, index) => (
                            <span key={dept.id || index} className="bg-cyan-500 text-white px-2 py-1 rounded-full text-sm flex items-center gap-1">
                              {dept.name || dept}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDepartments(selectedDepartments.filter(d => (d.id || d) !== (dept.id || dept)));
                                }}
                                className="text-white hover:text-gray-300"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">Select departments...</span>
                      )}
                      <span className={`transform transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                    {showDepartmentDropdown && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-cyan-400 border-t-0 rounded-b max-h-48 overflow-y-auto z-10 shadow-lg">
                        {departments.length > 0 ? departments.map((dept) => {
                          const deptName = dept.name || dept.department_name || dept.title || 'Unknown Department';
                          const deptId = dept.id || dept._id || dept.department_id;
                          const deptData = { id: deptId, name: deptName };
                          const isSelected = selectedDepartments.some(d => d.id === deptId);
                          
                          return (
                            <div
                              key={deptId}
                              className="p-3 hover:bg-gray-100 cursor-pointer flex items-center gap-3 text-black"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedDepartments(selectedDepartments.filter(d => d.id !== deptId));
                                } else {
                                  setSelectedDepartments([...selectedDepartments, deptData]);
                                }
                              }}
                            >
                              <div className={`w-4 h-4 border-2 border-gray-400 rounded ${isSelected ? 'bg-cyan-500 border-cyan-500' : ''} flex items-center justify-center`}>
                                {isSelected && <span className="text-white text-xs">✓</span>}
                              </div>
                              <span className="text-black font-medium">{deptName}</span>
                            </div>
                          );
                        }) : (
                          <div className="p-3 text-gray-500 text-center">
                            {departments.length === 0 ? 'Loading departments...' : 'No departments found'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Employee Selection */}
              {formData.targetType === 'individual' && (
                <div className="mt-4">
                  <label className="block font-bold text-gray-700 mb-1">
                    Select Employees
                  </label>
                  <div className="relative">
                    <div 
                      className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100 cursor-pointer flex items-center justify-between min-h-[40px]"
                      onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                    >
                      {selectedEmployees.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedEmployees.map((emp, index) => (
                            <span key={emp.id || index} className="bg-cyan-500 text-white px-2 py-1 rounded-full text-sm flex items-center gap-1">
                              {emp.name || emp}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEmployees(selectedEmployees.filter(e => (e.id || e) !== (emp.id || emp)));
                                }}
                                className="text-white hover:text-gray-300"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">Select employees...</span>
                      )}
                      <span className={`transform transition-transform ${showEmployeeDropdown ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                    {showEmployeeDropdown && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-cyan-400 border-t-0 rounded-b max-h-48 overflow-y-auto z-10 shadow-lg">
                        {employees.length > 0 ? employees.map((emp) => {
                          const empName = emp.name || emp.full_name || emp.username || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown User';
                          const empId = emp.id || emp._id || emp.user_id;
                          const displayName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.name || emp.username || 'Unknown User';
                          const empData = { id: empId, name: displayName };
                          const isSelected = selectedEmployees.some(e => e.id === empId);
                          
                          return (
                            <div
                              key={empId}
                              className="p-3 hover:bg-gray-100 cursor-pointer flex items-center gap-3 text-black"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedEmployees(selectedEmployees.filter(e => e.id !== empId));
                                } else {
                                  setSelectedEmployees([...selectedEmployees, empData]);
                                }
                              }}
                            >
                              <div className={`w-4 h-4 border-2 border-gray-400 rounded ${isSelected ? 'bg-cyan-500 border-cyan-500' : ''} flex items-center justify-center`}>
                                {isSelected && <span className="text-white text-xs">✓</span>}
                              </div>
                              <span className="text-black font-medium">{displayName}</span>
                            </div>
                          );
                        }) : (
                          <div className="p-3 text-gray-500 text-center">
                            {employees.length === 0 ? 'Loading employees...' : 'No employees found'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-3 bg-gray-400 text-white rounded-xl shadow hover:bg-gray-500 transition"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-cyan-600 text-white rounded-xl shadow hover:bg-cyan-700 transition flex items-center gap-2 font-bold"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Create Notification
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && selectedNotification && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
          <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-5xl mx-auto space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
              onClick={() => setShowHistory(false)}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-green-600 mb-4">NOTIFICATION HISTORY</h2>

            {/* Notification Details */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1">
                <label className="block font-bold text-gray-700 mb-1">
                  Date & Time
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={formatDate(selectedNotification.created_at)}
                  readOnly
                />
              </div>
              <div className="flex-1">
                <label className="block font-bold text-gray-700 mb-1">
                  Created By
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={selectedNotification.sender_name}
                  readOnly
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block font-bold text-gray-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                value={selectedNotification.title}
                readOnly
              />
            </div>

            <div className="mt-4">
              <label className="block font-bold text-gray-700 mb-1">
                Message
              </label>
              <textarea
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100 resize-none"
                rows="3"
                value={selectedNotification.message}
                readOnly
              />
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 mb-4">
              <div className="bg-green-100 border border-green-300 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-green-600 text-sm font-bold">Accepted</p>
                    <p className="text-2xl font-bold text-black">{selectedNotification.accepted_by?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-100 border border-yellow-300 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-yellow-600" />
                  <div>
                    <p className="text-yellow-600 text-sm font-bold">Pending</p>
                    <p className="text-2xl font-bold text-black">{selectedNotification.pending_users?.length || 0}</p>
                  </div>
                </div>
              <div className="bg-blue-100 border border-blue-300 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-blue-600 text-sm font-bold">Acceptance Rate</p>
                    <p className="text-2xl font-bold text-black">
                      {selectedNotification.total_active_users > 0 
                        ? ((selectedNotification.accepted_by?.length || 0) / selectedNotification.total_active_users * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

              {/* Accepted Users */}
            <div className="mt-4 mb-4">
              <label className="block font-bold text-gray-700 mb-2">
                Accepted Users ({selectedNotification.accepted_by?.length || 0})
              </label>
              {selectedNotification.accepted_by?.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded p-3 bg-gray-50">
                    {selectedNotification.accepted_by.map((acceptance, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="font-bold text-black">{acceptance.user_name}</span>
                        </div>
                        <span className="text-sm text-gray-600 font-medium">
                          {formatDate(acceptance.accepted_at)}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border border-gray-300">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium">No acceptances yet</p>
                </div>
              )}
              </div>

            {/* Pending Users */}
            <div className="mt-4">
              <label className="block font-bold text-gray-700 mb-2">
                Pending Users ({selectedNotification.pending_users?.length || 0})
              </label>
              {selectedNotification.pending_users && selectedNotification.pending_users.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded p-3 bg-gray-50">
                  {selectedNotification.pending_users.map((user, idx) => (
                    <div key={user.user_id || idx} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="font-bold text-black">{user.user_name}</span>
                      </div>
                      <span className="text-sm text-yellow-600 font-medium">Waiting for response</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border border-gray-300">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium">All users have accepted this notification!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManagementPage;