import React, { useState, useEffect, useRef } from "react";
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
import { formatDateTime } from '../utils/dateUtils';
import { getUserPermissions, hasPermission, isSuperAdmin } from '../utils/permissions';

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

  // Search states for dropdowns
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Dropdown position states (true = open upward, false = open downward)
  const [departmentDropdownOpenUp, setDepartmentDropdownOpenUp] = useState(false);
  const [employeeDropdownOpenUp, setEmployeeDropdownOpenUp] = useState(false);
  
  // Dropdown position coordinates for fixed positioning
  const [departmentDropdownPosition, setDepartmentDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [employeeDropdownPosition, setEmployeeDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Refs for click-outside detection
  const departmentDropdownRef = useRef(null);
  const employeeDropdownRef = useRef(null);
  
  // Ref for auto-resizing textarea
  const notificationDetailsRef = useRef(null);

  // Announcement popup state
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  // Selection state for bulk actions
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false); // Control checkbox visibility
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  
  const [announcementData, setAnnouncementData] = useState(null);

  // Notification sound ref
  const notificationSoundRef = useRef(null);

  // Permission management
  const [permissions, setPermissions] = useState({
    view: true,
    send: false,
    delete: false
  });

  // Load permissions
  useEffect(() => {
    try {
      const userPermissions = getUserPermissions();
      
      if (isSuperAdmin(userPermissions)) {
        setPermissions({
          view: true,
          send: true,
          delete: true
        });
        return;
      }

      const notificationPermissions = {
        view: hasPermission(userPermissions, 'notification', 'view') || hasPermission(userPermissions, 'Notification', 'view'),
        send: hasPermission(userPermissions, 'notification', 'send') || hasPermission(userPermissions, 'Notification', 'send'),
        delete: hasPermission(userPermissions, 'notification', 'delete') || hasPermission(userPermissions, 'Notification', 'delete')
      };

      if (userPermissions?.notification === "*" || userPermissions?.Notification === "*") {
        setPermissions({
          view: true,
          send: true,
          delete: true
        });
        return;
      }

      setPermissions({
        view: notificationPermissions.view || true,
        send: notificationPermissions.send,
        delete: notificationPermissions.delete
      });
    } catch (error) {
      console.error("Error loading permissions:", error);
      setPermissions({
        view: true,
        send: false,
        delete: false
      });
    }
  }, []);

  // Click outside handler to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target)) {
        setShowDepartmentDropdown(false);
        setDepartmentSearch(""); // Clear search when closing
      }
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false);
        setEmployeeSearch(""); // Clear search when closing
      }
    };

    if (showDepartmentDropdown || showEmployeeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDepartmentDropdown, showEmployeeDropdown]);

  // Auto-resize textarea for notification details
  useEffect(() => {
    const resizeTextarea = () => {
      if (notificationDetailsRef.current) {
        notificationDetailsRef.current.style.height = 'auto';
        notificationDetailsRef.current.style.height = notificationDetailsRef.current.scrollHeight + 'px';
      }
    };
    
    // Resize when formData.message changes or modal opens
    if (showCreateForm) {
      resizeTextarea();
    }
  }, [formData.message, showCreateForm]);

  // Handler for textarea change with auto-resize
  const handleNotificationDetailsChange = (e) => {
    setFormData({ ...formData, message: e.target.value.toUpperCase() });
    
    // Auto-resize textarea
    if (e.target) {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    }
  };

  // Calculate dropdown position (upward or downward)
  const calculateDropdownPosition = (ref, setOpenUp, setPosition) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const dropdownHeight = 280; // Approximate dropdown height (max-h-60 + search bar)
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Open upward if not enough space below and more space above
    const openUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    setOpenUp(openUp);
    
    // Calculate exact position for fixed positioning
    setPosition({
      top: openUp ? rect.top - dropdownHeight : rect.bottom,
      left: rect.left,
      width: rect.width
    });
  };

  // Filter departments by search
  const filteredDepartments = departments.filter(dept => {
    const deptName = dept.name || dept.department_name || dept.title || '';
    return deptName.toLowerCase().includes(departmentSearch.toLowerCase());
  });

  // Filter employees by search
  const filteredEmployees = employees.filter(emp => {
    const displayName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.name || emp.username || '';
    return displayName.toLowerCase().includes(employeeSearch.toLowerCase());
  });

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

      // Always fetch ALL notifications (including inactive ones)
      // Using per_page=500 to show all notifications at once
      const response = await fetch(`${API_BASE_URL}/pop-notifications/?user_id=${userId}&include_inactive=true&per_page=500`, {
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

  // Helper function to get department names from IDs
  const getDepartmentNames = (departmentIds) => {
    if (!departmentIds || departmentIds.length === 0) return [];
    return departmentIds.map(id => {
      const dept = departments.find(d => d._id === id || d.id === id);
      return dept ? dept.name : `Unknown (${id})`;
    });
  };

  // Helper function to get employee names from IDs
  const getEmployeeNames = (employeeIds) => {
    if (!employeeIds || employeeIds.length === 0) return [];
    return employeeIds.map(id => {
      const emp = employees.find(e => e._id === id || e.id === id);
      if (emp) {
        const firstName = emp.first_name || '';
        const lastName = emp.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || emp.username || `Unknown (${id})`;
      }
      return `Unknown (${id})`;
    });
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
        priority: "normal", // Default priority
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
        const responseData = await response.json();
        
        // Show announcement popup to employees (instead of success message)
        const targetCount = formData.targetType === 'individual' ? selectedEmployees.length : 
                           formData.targetType === 'department' ? selectedDepartments.reduce((total, dept) => total + (dept.employee_count || 0), 0) : 
                           10; // Default estimate for 'all'
                           
        showAnnouncementPopup({
          title: formData.title,
          message: formData.message,
          senderName: getCurrentUserName(),
          targetCount: targetCount,
          targetType: formData.targetType,
          priority: "normal",
          notificationId: responseData.id || responseData._id
        });
        
        setFormData({ 
          title: "", 
          message: "", 
          targetType: "all", 
          targetDepartments: [], 
          targetEmployees: [] 
        });
        setSelectedDepartments([]);
        setSelectedEmployees([]);
        setShowCreateForm(false);
        fetchNotifications();
        fetchStats();
        
        // Trigger instant notification check globally so admin sees it immediately
        if (window.triggerNotificationCheck) {
          console.log('🔔 Triggering instant notification check for admin...');
          window.triggerNotificationCheck();
        }

        // Also trigger notification check for all other users via a broadcast mechanism
        // This ensures instant delivery to all targeted users
        triggerInstantNotificationForUsers(formData.targetType, selectedDepartments, selectedEmployees);
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

  // Get current user name
  const getCurrentUserName = () => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      // Try to get full name from first_name and last_name
      const firstName = userData.first_name || '';
      const lastName = userData.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();

      // Return full name if available, otherwise fallback to name, username, or default
      return fullName || userData.name || userData.username || 'Admin User';
    } catch (error) {
      return 'Admin User';
    }
  };

  // Trigger instant notification for targeted users
  const triggerInstantNotificationForUsers = async (targetType, selectedDepartments, selectedEmployees) => {
    try {
      console.log('🚀 Triggering instant notification for users:', { targetType, selectedDepartments, selectedEmployees });

      // For 'all' target type, we can't easily trigger all users individually
      // But we can force a cache refresh by updating a global timestamp
      if (targetType === 'all') {
        const globalNotificationTrigger = {
          type: 'global_notification_created',
          timestamp: Date.now(),
          notificationId: 'pending'
        };
        localStorage.setItem('globalNotificationTrigger', JSON.stringify(globalNotificationTrigger));
        console.log('📢 Global notification trigger set for all users');
        return;
      }

      // For department-specific notifications, we could potentially trigger
      // specific users, but for now we'll use the global trigger
      if (targetType === 'department' && selectedDepartments.length > 0) {
        const globalNotificationTrigger = {
          type: 'department_notification_created',
          timestamp: Date.now(),
          departments: selectedDepartments.map(d => d.id || d),
          notificationId: 'pending'
        };
        localStorage.setItem('globalNotificationTrigger', JSON.stringify(globalNotificationTrigger));
        console.log('📢 Department notification trigger set');
        return;
      }

      // For individual users, we could trigger specific user sessions
      // This would require a more sophisticated approach with WebSockets or SSE
      if (targetType === 'individual' && selectedEmployees.length > 0) {
        const globalNotificationTrigger = {
          type: 'individual_notification_created',
          timestamp: Date.now(),
          userIds: selectedEmployees.map(e => e.id || e),
          notificationId: 'pending'
        };
        localStorage.setItem('globalNotificationTrigger', JSON.stringify(globalNotificationTrigger));
        console.log('📢 Individual notification trigger set for users:', selectedEmployees.length);
        return;
      }

    } catch (error) {
      console.error('Error triggering instant notification:', error);
    }
  };

  // Show announcement popup
  const showAnnouncementPopup = (data) => {
    // Format current date and time
    const now = new Date();
    const options = { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    };
    const timestamp = 'Sent: ' + now.toLocaleDateString('en-GB', options).replace(',', '');
    
    const announcementPayload = {
      ...data,
      acceptedCount: 0, // Initially 0 accepted
      isAcknowledged: false,
      timestamp: timestamp,
      senderRole: data.senderRole || 'ADMIN'
    };
    
    // Store in localStorage for persistence across refreshes
    localStorage.setItem('pendingAnnouncement', JSON.stringify(announcementPayload));
    
    setAnnouncementData(announcementPayload);
    setShowAnnouncementModal(true);
  };

  // Handle announcement acknowledgment
  const handleAnnouncementAcknowledge = async () => {
    if (!announcementData || !announcementData.notificationId) {
      console.error('No notification ID found');
      return;
    }

    try {
      // Show acknowledging state
      setAnnouncementData(prev => ({
        ...prev,
        isAcknowledged: true,
        acceptedCount: prev.acceptedCount + 1
      }));

      // Call backend API to accept notification
      const response = await fetch(`${API_BASE_URL}/pop-notifications/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          notification_id: announcementData.notificationId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge notification');
      }

      console.log('✅ Notification acknowledged successfully');

      // Clear localStorage to remove persistent announcement
      localStorage.removeItem('pendingAnnouncement');

      // Close popup after acceptance
      setTimeout(() => {
        setShowAnnouncementModal(false);
        setAnnouncementData(null);
        setSuccess("Announcement acknowledged successfully!");
        
        // Refresh notifications list to update status
        fetchNotifications();
      }, 1500); // Show "Already Acknowledged" for 1.5 seconds before closing

    } catch (error) {
      console.error('Error acknowledging notification:', error);
      setError('Failed to acknowledge notification');
      
      // Revert acknowledged state on error
      setAnnouncementData(prev => ({
        ...prev,
        isAcknowledged: false,
        acceptedCount: Math.max(0, prev.acceptedCount - 1)
      }));
    }
  };

  // Close announcement popup (only used internally after acceptance)
  const closeAnnouncementPopup = () => {
    setShowAnnouncementModal(false);
    setAnnouncementData(null);
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

  // Format date to Indian Standard Time (IST)
  const formatDate = (dateString) => {
    return formatDateTime(dateString);
  };

  // Show checkboxes when Select button is clicked
  const handleShowCheckboxes = () => {
    setShowCheckboxes(true);
  };

  // Handle select all functionality
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedNotifications([]);
      setSelectAll(false);
    } else {
      const allIds = notifications.map(n => n.id || n._id);
      setSelectedNotifications(allIds);
      setSelectAll(true);
    }
  };

  // Handle individual notification selection
  const handleSelectNotification = (notificationId, e) => {
    e.stopPropagation(); // Prevent row click event
    if (selectedNotifications.includes(notificationId)) {
      setSelectedNotifications(selectedNotifications.filter(id => id !== notificationId));
      setSelectAll(false);
    } else {
      const newSelected = [...selectedNotifications, notificationId];
      setSelectedNotifications(newSelected);
      // Check if all are now selected
      if (newSelected.length === notifications.length) {
        setSelectAll(true);
      }
    }
  };

  // Clear all selections and hide checkboxes
  const handleCancelSelection = () => {
    setSelectedNotifications([]);
    setSelectAll(false);
    setShowCheckboxes(false);
  };

  // Delete selected notifications
  const handleDeleteSelected = async () => {
    if (selectedNotifications.length === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to PERMANENTLY DELETE ${selectedNotifications.length} notification${selectedNotifications.length !== 1 ? 's' : ''}? This action cannot be undone!`
    );

    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem("token");
      const userId = getUserId();
      
      if (!userId) {
        setError('User ID not found');
        return;
      }
      
      // Immediately update UI by removing deleted items from state
      setNotifications(prevNotifications => 
        prevNotifications.filter(n => !selectedNotifications.includes(n.id || n._id))
      );
      
      // Clear selection and hide toolbar
      setSelectedNotifications([]);
      setSelectAll(false);
      setShowCheckboxes(false);
      
      // Make DELETE API calls with user_id query parameter
      const deletePromises = selectedNotifications.map(id =>
        fetch(`${API_BASE_URL}/pop-notifications/${id}?user_id=${userId}`, {
          method: 'DELETE',
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        })
      );

      const results = await Promise.all(deletePromises);
      
      // Check if all deletions were successful
      const allSuccessful = results.every(res => res.ok);
      
      if (allSuccessful) {
        setSuccess(`Successfully deleted ${selectedNotifications.length} notification${selectedNotifications.length !== 1 ? 's' : ''}`);
      } else {
        setError('Some notifications could not be deleted. Refreshing...');
      }
      
      // Refresh data from server to ensure consistency
      await fetchNotifications();
      await fetchStats();
      
    } catch (error) {
      console.error('Error deleting notifications:', error);
      setError('Failed to delete notifications. Please try again.');
      // Refresh to show actual state
      await fetchNotifications();
    }
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

  // Auto-refresh notifications disabled to prevent unnecessary re-renders
  // Can be re-enabled if real-time updates are needed
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     fetchNotifications();
  //     fetchStats();
  //   }, 10000); // Refresh every 10 seconds
  //   
  //   return () => clearInterval(interval);
  // }, []);

  // NOTE: Global announcement polling and sound are now handled in App.jsx
  // This ensures notifications show on ALL pages, not just the notifications page

  // Prevent Escape key from closing announcement modal
  useEffect(() => {
    if (showAnnouncementModal) {
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
  }, [showAnnouncementModal]);

  // Handle announcement modal content visibility and scroll behavior
  useEffect(() => {
    if (showAnnouncementModal) {
      const timer = setTimeout(() => {
        const detailsContent = document.getElementById('announcement-details-content');
        const moreBtn = document.getElementById('announcement-more-btn');
        const modal = document.getElementById('announcement-modal');
        const acceptBtn = document.getElementById('announcement-accept-btn');
        const scrollIndicator = document.getElementById('announcement-scroll-indicator');
        const detailsOverlay = document.getElementById('announcement-details-overlay');
        
        if (!detailsContent || !moreBtn || !modal || !acceptBtn) {
          console.error('Announcement modal elements not found');
          return;
        }
        
        let hasReadFullContent = false;
        
        // Check if content is truncated
        const isTruncated = detailsContent.scrollHeight > detailsContent.clientHeight;
        
        console.log('Announcement Modal Debug:', {
          scrollHeight: detailsContent.scrollHeight,
          clientHeight: detailsContent.clientHeight,
          isTruncated: isTruncated
        });
        
        if (isTruncated) {
          // Long content - show more button, hide accept button
          moreBtn.style.display = 'flex';
          acceptBtn.style.display = 'none';
          
          const handleMoreClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isExpanded = detailsContent.classList.contains('expanded');
            
            if (isExpanded) {
              // Collapse
              detailsContent.classList.remove('expanded');
              modal.classList.remove('expanded');
              moreBtn.textContent = 'More Details';
              moreBtn.classList.remove('expanded');
              acceptBtn.style.display = 'none';
              if (scrollIndicator) scrollIndicator.classList.remove('show');
              if (detailsOverlay) detailsOverlay.style.opacity = '1';
              hasReadFullContent = false;
              
              modal.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              // Expand
              detailsContent.classList.add('expanded');
              modal.classList.add('expanded');
              moreBtn.textContent = 'Show Less';
              moreBtn.classList.add('expanded');
              if (scrollIndicator) scrollIndicator.classList.add('show');
              if (detailsOverlay) detailsOverlay.style.opacity = '0';
              
              setTimeout(() => {
                detailsContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }, 150);
            }
          };
          
          moreBtn.addEventListener('click', handleMoreClick);
          
          // Handle scroll behavior
          const handleScroll = () => {
            if (modal.classList.contains('expanded')) {
              const scrollTop = modal.scrollTop;
              const scrollHeight = modal.scrollHeight;
              const clientHeight = modal.clientHeight;
              const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 50;
              
              const shadowOpacity = Math.min(scrollTop / 50, 0.3);
              modal.style.boxShadow = '0 0 30px rgba(66, 165, 245, ' + (0.2 + shadowOpacity) + ')';
              
              if (scrolledToBottom && !hasReadFullContent) {
                hasReadFullContent = true;
                acceptBtn.style.display = 'flex';
                if (scrollIndicator) scrollIndicator.classList.remove('show');
                acceptBtn.style.animation = 'fadeInSuccess 0.5s ease';
              }
            }
          };
          
          modal.addEventListener('scroll', handleScroll);
          
          // Cleanup
          return () => {
            moreBtn.removeEventListener('click', handleMoreClick);
            modal.removeEventListener('scroll', handleScroll);
          };
        } else {
          // Short content - show accept button immediately
          moreBtn.style.display = 'none';
          acceptBtn.style.display = 'flex';
          if (detailsOverlay) detailsOverlay.style.display = 'none';
          hasReadFullContent = true;
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [showAnnouncementModal]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8 bg-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
             
            
            </div>
            {(permissions.send || isSuperAdmin(getUserPermissions())) && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center gap-3"
              >
                <Plus className="h-5 w-5" />
                Create Announcement
              </button>
            )}
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

        {/* Select Button / Selection Toolbar - LeadCRM Style with Search */}
        <div className="flex items-center justify-between gap-4 mb-4 mt-5">
          {/* Left Side: Select Button or Toolbar */}
          <div className="flex items-center gap-3">
            {/* Only show Select button if user has delete permission */}
            {(permissions.delete || isSuperAdmin(getUserPermissions())) && (
              <>
                {!showCheckboxes ? (
                  <button
                    className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
                    onClick={handleShowCheckboxes}
                  >
                    {selectedNotifications.length > 0
                      ? `Select (${selectedNotifications.length})`
                      : "Select"}
                  </button>
                ) : (
                  <div className="flex items-center gap-6 bg-gray-900 rounded-lg p-3">
                    <label className="flex items-center cursor-pointer text-[#03B0F5] font-bold">
                      <input
                        type="checkbox"
                        className="accent-blue-500 mr-2"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        style={{ width: 18, height: 18 }}
                      />
                      Select All
                    </label>
                    <span className="text-white font-semibold">
                      {selectedNotifications.length} row{selectedNotifications.length !== 1 ? "s" : ""} selected
                    </span>
                    <button
                      className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                      onClick={handleDeleteSelected}
                      disabled={selectedNotifications.length === 0}
                    >
                      Delete ({selectedNotifications.length})
                    </button>
                    <button
                      className="px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                      onClick={handleCancelSelection}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Search Results Indicator */}
            {searchTerm && (
              <div className="text-base text-gray-300 bg-[#1b2230] px-4 py-3 rounded-lg border border-gray-600">
                {notifications.filter(n => {
                  const searchLower = searchTerm.toLowerCase();
                  return (
                    n.title?.toLowerCase().includes(searchLower) ||
                    n.message?.toLowerCase().includes(searchLower) ||
                    n.sender_name?.toLowerCase().includes(searchLower)
                  );
                }).length} of {notifications.length} notifications
                <span className="ml-2">
                  matching "<span className="text-cyan-400 font-semibold">{searchTerm}</span>"
                </span>
              </div>
            )}
          </div>

          {/* Right Side: Search Box */}
          <div className="relative w-[320px]">
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-12 bg-[#1b2230] text-white border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-base"
            />
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Notifications Table - LeadCRM Style */}
        <div className="bg-black rounded-lg overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
          <table className="min-w-full w-full bg-black relative">
            <thead className="bg-white sticky top-0 z-50 shadow-lg border-b-2 border-gray-200">
              <tr>
                {showCheckboxes && (
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200 text-center w-16">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="w-5 h-5 accent-blue-500 cursor-pointer"
                    />
                  </th>
                )}
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
                  <td colSpan={showCheckboxes ? 8 : 7} className="py-20 text-center text-gray-400 text-lg bg-black">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      <span className="text-xl font-semibold">Loading Notifications...</span>
                    </div>
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={showCheckboxes ? 8 : 7} className="py-20 text-center text-gray-400 text-lg bg-black">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Bell className="w-12 h-12 text-gray-600" />
                      <span className="text-xl font-semibold">No Notifications Found</span>
                      <p className="text-sm text-gray-500">Create your first notification to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (() => {
                // Filter notifications based on search term
                const filteredNotifications = notifications.filter(notification => {
                  if (!searchTerm) return true;
                  const searchLower = searchTerm.toLowerCase();
                  return (
                    notification.title?.toLowerCase().includes(searchLower) ||
                    notification.message?.toLowerCase().includes(searchLower) ||
                    notification.sender_name?.toLowerCase().includes(searchLower) ||
                    notification.target_type?.toLowerCase().includes(searchLower)
                  );
                });

                // Show "no results" message if search filters out all notifications
                if (filteredNotifications.length === 0) {
                  return (
                    <tr>
                      <td colSpan={showCheckboxes ? 8 : 7} className="py-20 text-center text-gray-400 text-lg bg-black">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Bell className="w-12 h-12 text-gray-600" />
                          <span className="text-xl font-semibold">No Notifications Match Your Search</span>
                          <p className="text-sm text-gray-500">Try different search terms</p>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return filteredNotifications.map((notification, index) => {
                  const config = priorityConfig[notification.priority] || priorityConfig.normal;
                  const IconComponent = config.icon;
                  const stats = notification.acceptance_stats || {};
                  const totalTargetUsers = stats.total_users || 0;
                  const acceptedCount = stats.accepted_count || 0;
                  const pendingCount = Math.max(0, totalTargetUsers - acceptedCount);
                  const acceptanceRate = totalTargetUsers > 0 ? (acceptedCount / totalTargetUsers * 100) : 0;
                  const notificationId = notification.id || notification._id;
                  const isSelected = selectedNotifications.includes(notificationId);
                  const isDeactivated = notification.is_active === false;
                  
                  return (
                    <tr 
                      key={notification.id} 
                      className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer ${isSelected && showCheckboxes ? 'bg-blue-900/20' : ''} ${isDeactivated ? 'opacity-50 bg-red-900/10' : ''}`}
                      onClick={() => viewHistory(notification.id || notification._id)}
                      title={isDeactivated ? "Deactivated notification - Click to view history" : "Click to view notification history"}
                    >
                        {/* Checkbox Column - Only show when showCheckboxes is true */}
                        {showCheckboxes && (
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleSelectNotification(notificationId, e)}
                              className="w-5 h-5 accent-blue-500 cursor-pointer"
                            />
                          </td>
                        )}

                        {/* # Column */}
                        <td className="px-4 py-3 text-white">
                          <span className="text-blue-400 font-bold text-lg">
                            {index + 1}
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
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-white text-sm">
                              {notification.title}
                            </div>
                            {isDeactivated && (
                              <span className="px-2 py-0.5 text-xs font-semibold bg-red-600/20 text-red-400 border border-red-600 rounded">
                                DEACTIVATED
                              </span>
                            )}
                          </div>
                        </td>
                        
                        {/* Target Column */}
                        <td className="px-4 py-3 text-white">
                          {notification.target_type === 'all' && (
                            <span className="text-green-400 font-medium text-sm">All Employees</span>
                          )}
                          {notification.target_type === 'department' && (
                            <div>
                              <span className="text-blue-400 font-medium text-sm">Departments:</span>
                              <div className="text-xs text-gray-300 mt-1 max-w-xs">
                                {getDepartmentNames(notification.target_departments).length > 0 ? (
                                  <div className="space-y-0.5">
                                    {getDepartmentNames(notification.target_departments).map((name, idx) => (
                                      <div key={idx} className="truncate" title={name}>• {name}</div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-500">{notification.target_departments?.length || 0} department(s)</span>
                                )}
                              </div>
                            </div>
                          )}
                          {notification.target_type === 'individual' && (
                            <div>
                              <span className="text-purple-400 font-medium text-sm">Specific Employees:</span>
                              <div className="text-xs text-gray-300 mt-1 max-w-xs">
                                {getEmployeeNames(notification.target_employees).length > 0 ? (
                                  <div className="space-y-0.5">
                                    {getEmployeeNames(notification.target_employees).map((name, idx) => (
                                      <div key={idx} className="truncate" title={name}>• {name}</div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-500">{notification.target_employees?.length || 0} employee(s)</span>
                                )}
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
                  });
                })()
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Announcement Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-transparent bg-opacity-20">
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold z-10"
              onClick={() => setShowCreateForm(false)}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <div className="overflow-y-auto p-6 space-y-6">
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
                    value={getCurrentUserName()}
                    readOnly
                  />
                </div>
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
                  placeholder="Enter announcement subject"
                  required
                />
              </div>

              <div className="mt-4">
                <label className="block font-bold text-gray-700 mb-1">
                  Announcment Details *
                </label>
                <textarea
                  ref={notificationDetailsRef}
                  value={formData.message}
                  onChange={handleNotificationDetailsChange}
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none overflow-hidden"
                  rows="3"
                  placeholder="Enter announcement details..."
                  required
                  style={{ minHeight: '80px' }}
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
                  <div className="relative z-[10000]" ref={departmentDropdownRef}>
                    <div 
                      className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-white cursor-pointer flex items-center justify-between min-h-[40px]"
                      onClick={() => {
                        if (!showDepartmentDropdown) {
                          calculateDropdownPosition(departmentDropdownRef, setDepartmentDropdownOpenUp, setDepartmentDropdownPosition);
                        }
                        setShowDepartmentDropdown(!showDepartmentDropdown);
                        if (showDepartmentDropdown) {
                          setDepartmentSearch(""); // Clear search when closing
                        }
                      }}
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
                      <ChevronDown className={`transform transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''} text-gray-600`} size={20} />
                    </div>
                    {showDepartmentDropdown && (
                      <div 
                        className="fixed bg-white border-2 border-cyan-400 rounded-lg shadow-2xl"
                        style={{
                          top: `${departmentDropdownPosition.top}px`,
                          left: `${departmentDropdownPosition.left}px`,
                          width: `${departmentDropdownPosition.width}px`,
                          zIndex: 10001,
                          maxHeight: '280px'
                        }}
                      >
                        {/* Search Bar */}
                        <div className="sticky top-0 bg-white p-3 border-b-2 border-cyan-400 z-10">
                          <input
                            type="text"
                            placeholder="Search departments..."
                            value={departmentSearch}
                            onChange={(e) => setDepartmentSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          />
                        </div>
                        
                        {/* Scrollable List */}
                        <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                          {filteredDepartments.length > 0 ? filteredDepartments.map((dept) => {
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
                              {departmentSearch ? 'No departments found matching your search' : (departments.length === 0 ? 'Loading departments...' : 'No departments found')}
                            </div>
                          )}
                        </div>
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
                  <div className="relative z-[10000]" ref={employeeDropdownRef}>
                    <div 
                      className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-white cursor-pointer flex items-center justify-between min-h-[40px]"
                      onClick={() => {
                        if (!showEmployeeDropdown) {
                          calculateDropdownPosition(employeeDropdownRef, setEmployeeDropdownOpenUp, setEmployeeDropdownPosition);
                        }
                        setShowEmployeeDropdown(!showEmployeeDropdown);
                        if (showEmployeeDropdown) {
                          setEmployeeSearch(""); // Clear search when closing
                        }
                      }}
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
                      <ChevronDown className={`transform transition-transform ${showEmployeeDropdown ? 'rotate-180' : ''} text-gray-600`} size={20} />
                    </div>
                    {showEmployeeDropdown && (
                      <div 
                        className="fixed bg-white border-2 border-cyan-400 rounded-lg shadow-2xl"
                        style={{
                          top: `${employeeDropdownPosition.top}px`,
                          left: `${employeeDropdownPosition.left}px`,
                          width: `${employeeDropdownPosition.width}px`,
                          zIndex: 10001,
                          maxHeight: '280px'
                        }}
                      >
                        {/* Search Bar */}
                        <div className="sticky top-0 bg-white p-3 border-b-2 border-cyan-400 z-10">
                          <input
                            type="text"
                            placeholder="Search employees..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          />
                        </div>

                        {/* Scrollable List */}
                        <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                          {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => {
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
                              {employeeSearch ? 'No matching employees found' : (employees.length === 0 ? 'Loading employees...' : 'No employees found')}
                            </div>
                          )}
                        </div>
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
                      Create Announcement
                    </>
                  )}
                </button>
              </div>
            </form>
            </div>
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
            <h2 className="text-xl font-bold text-green-600 mb-4">ANNOUNCEMENT DETAILS</h2>

            {/* Notification Details Form */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block font-bold text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={selectedNotification.title || ''}
                  readOnly
                />
              </div>
              <div className="flex-1">
                <label className="block font-bold text-gray-700 mb-1">
                  Priority
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={selectedNotification.priority ? selectedNotification.priority.toUpperCase() : ''}
                  readOnly
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block font-bold text-gray-700 mb-1">
                Message
              </label>
              <textarea
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none bg-gray-100"
                rows={3}
                value={selectedNotification.message || ''}
                readOnly
                style={{
                  minHeight: "3rem",
                  maxHeight: "400px",
                }}
              />
            </div>

            <div className="flex flex-col md:flex-row gap-4 mt-4">
              <div className="flex-1">
                <label className="block font-bold text-gray-700 mb-1">
                  Sent By
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={selectedNotification.sender_name || 'Unknown'}
                  readOnly
                />
              </div>
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
            </div>

            <div className="mt-4">
              <label className="block font-bold text-gray-700 mb-1">
                Target Type
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                value={
                  selectedNotification.target_type === 'all' ? 'All Employees' :
                  selectedNotification.target_type === 'department' ? `Departments (${selectedNotification.target_departments?.length || 0} selected)` :
                  selectedNotification.target_type === 'individual' ? `Specific Employees (${selectedNotification.target_employees?.length || 0} selected)` :
                  'All Employees'
                }
                readOnly
              />
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 mb-6">
              <div className="bg-white border border-cyan-400 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-green-600 text-sm font-bold">Accepted</p>
                    <p className="text-2xl font-bold text-black">{selectedNotification.accepted_by?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-cyan-400 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-yellow-600" />
                  <div>
                    <p className="text-yellow-600 text-sm font-bold">Pending</p>
                    <p className="text-2xl font-bold text-black">{selectedNotification.pending_users?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-cyan-400 rounded-xl p-4">
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
            <div className="mb-6">
              <label className="block font-bold text-gray-700 mb-1">
                Accepted Users ({selectedNotification.accepted_by?.length || 0})
              </label>
              <div className="w-full px-3 py-2 border border-cyan-400 rounded bg-gray-100 max-h-32 overflow-y-auto">
                {selectedNotification.accepted_by?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedNotification.accepted_by.map((acceptance, index) => (
                      <div key={index} className="flex items-center justify-between py-2 px-3 bg-white border border-gray-200 rounded">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          <span className="font-medium text-black text-sm">{acceptance.user_name}</span>
                        </div>
                        <span className="text-xs text-gray-600">
                          {formatDate(acceptance.accepted_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-600">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No acceptances yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pending Users */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Pending Users ({selectedNotification.pending_users?.length || 0})
              </label>
              <div className="w-full px-3 py-2 border border-cyan-400 rounded bg-gray-100 max-h-32 overflow-y-auto">
                {selectedNotification.pending_users && selectedNotification.pending_users.length > 0 ? (
                  <div className="space-y-2">
                    {selectedNotification.pending_users.map((user, idx) => (
                      <div key={user.user_id || idx} className="flex items-center justify-between py-2 px-3 bg-white border border-gray-200 rounded">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
                          <span className="font-medium text-black text-sm">{user.user_name}</span>
                        </div>
                        <span className="text-xs text-yellow-600">Waiting for response</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-600">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">All users have accepted this announcement!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Popup Modal - MOVED TO APP.JSX FOR GLOBAL ACCESS */}
      {/* This modal now shows on ALL pages, not just the notifications page */}
      {/* The modal is rendered globally in App.jsx and controlled via localStorage */}
    </div>
  );
};

export default NotificationManagementPage;