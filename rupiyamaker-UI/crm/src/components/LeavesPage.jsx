import React, { useState, useEffect, useMemo } from 'react';
import {
  Add as Plus,
  Visibility as Eye,
  CheckCircle,
  Cancel as XCircle,
  Refresh as RefreshCw,
  CloudUpload,
  Download,
  AttachFile,
  Search,
  FilterList as Filter,
  Close as X,
  CalendarToday as Calendar,
  Person as User,
  People as Users,
  AccessTime as Clock,
  Description as FileText,
  Warning as AlertTriangle
} from '@mui/icons-material';

// Import simplified permission system
import { 
  getPermissionLevel, 
  canViewAll, 
  canViewJunior, 
  canCreate, 
  canEdit, 
  canDelete,
  getPermissionDisplayText,
  getCurrentUserId
} from '../utils/permissions';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

// Status card configuration for dark UI - solid colors
const statusCardConfig = [
  {
    key: "pending",
    label: "PENDING LEAVES",
    icon: Clock,
    backgroundColor: "bg-orange-500",
    gradient: "from-orange-400 to-orange-600",
    shadowColor: "shadow-orange-500/25",
  },
  {
    key: "approved",
    label: "APPROVED LEAVES",
    icon: CheckCircle,
    backgroundColor: "bg-green-500",
    gradient: "from-green-400 to-green-600",
    shadowColor: "shadow-green-500/25",
  },
  {
    key: "rejected",
    label: "REJECTED LEAVES",
    icon: XCircle,
    backgroundColor: "bg-red-500",
    gradient: "from-red-400 to-red-600",
    shadowColor: "shadow-red-500/25",
  },
  {
    key: "total",
    label: "TOTAL LEAVES",
    icon: Users,
    backgroundColor: "bg-blue-500",
    gradient: "from-blue-400 to-blue-600",
    shadowColor: "shadow-blue-500/25",
  },
];

const LeaveTypeChip = ({ leavetype, label }) => {
  const getTypeColor = (type) => {
    switch(type) {
      case 'paid_leave': return 'bg-blue-500';
      case 'casual_leave': return 'bg-purple-500';
      case 'sick_leave': return 'bg-red-500';
      case 'emergency_leave': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <span className={`${getTypeColor(leavetype)} text-white text-xs px-2 py-1 rounded-full font-semibold`}>
      {label}
    </span>
  );
};

const StatusChip = ({ status, label }) => {
  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'pending': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <span className={`${getStatusColor(status)} text-white text-xs px-2 py-1 rounded-full font-semibold`}>
      {label}
    </span>
  );
};

const LeavesPage = () => {
  // Add early return with minimal UI to test if component loads
  const [isReady, setIsReady] = useState(false);
    
    // State management
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedTab, setSelectedTab] = useState(0);
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openViewDialog, setOpenViewDialog] = useState(false);
    const [selectedLeave, setSelectedLeave] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  
  // Form state
  const [newLeave, setNewLeave] = useState({
    leave_type: 'paid_leave',
    from_date: '',
    to_date: '',
    reason: '',
    attachments: []
  });
  const [attachmentFile, setAttachmentFile] = useState(null);
  
  // Filter state
  const [filters, setFilters] = useState({
    status: '',
    leave_type: '',
    search: ''
  });
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Select button and bulk delete functionality
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false);

  // Simplified permission checking using new 3-type system
  const permissionLevel = getPermissionLevel('leaves');
  
  // Get current user ID
  const getCurrentUserIdFromStorage = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { user_id } = JSON.parse(userData);
      return user_id;
    }
    return '6852b84716a499bb6868e6a4'; // Default fallback user ID
  };
  
  const currentUserId = getCurrentUserIdFromStorage();
  
  // Permission check functions with proper super admin handling
  const canUserViewAll = () => {
    // Check if user is super admin first
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.is_super_admin) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return canViewAll('leaves');
  };
  
  const canUserViewJunior = () => {
    // Check if user is super admin first
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.is_super_admin) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return canViewJunior('leaves');
  };
  
  const canUserCreate = () => {
    // Check if user is super admin first
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.is_super_admin) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return canCreate('leaves');
  };
  
  const canUserEdit = (recordOwnerId) => {
    // Check if user is super admin first
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.is_super_admin) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return canEdit('leaves', recordOwnerId);
  };
  
  const canUserDelete = (recordOwnerId) => {
    // Check if user is super admin first
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.is_super_admin) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return canDelete('leaves', recordOwnerId);
  };
  
  // Check if current user is super admin
  const isSuperAdmin = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.is_super_admin === true;
      } catch (e) {
        console.warn('Error parsing user data:', e);
      }
    }
    return false;
  };

  // Permission state - updated to use simplified system
  const [permissions, setPermissions] = useState({
    leaves_show: true,
    leaves_own: true,
    leave_admin: canUserViewAll(),
    leaves_create: canUserCreate(),
    leaves_delete: canDelete('leaves'), // Use proper permission function for leaves delete
    can_view_all: canUserViewAll(),
    can_approve_reject: isSuperAdmin() || canUserViewJunior() || canUserViewAll(), // Super admin, junior and all can approve/reject
    is_super_admin: isSuperAdmin(),
    permission_level: permissionLevel // Store the permission level
  });

  // Approval dialog state
  const [openApprovalDialog, setOpenApprovalDialog] = useState(false);
  const [approvalLeave, setApprovalLeave] = useState(null);
  const [approvalData, setApprovalData] = useState({
    status: 'approved',
    rejection_reason: '',
    comments: ''
  });

  // Upload dialog state
  const [uploadLeaveId, setUploadLeaveId] = useState(null);
  const [uploadAttachmentFile, setUploadAttachmentFile] = useState(null);
  const [openUploadDialog, setOpenUploadDialog] = useState(false);

  // API base URL
  const API_BASE_URL = '/api'; // Always use proxy

  // Get current user ID
  const getCurrentUserId = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { user_id } = JSON.parse(userData);
      return user_id;
    }
    return '6852b84716a499bb6868e6a4'; // Default fallback user ID
  };

  // Get auth headers
  const getAuthHeaders = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { access_token } = JSON.parse(userData);
      return {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      };
    }
    return { 'Content-Type': 'application/json' };
  };

  const getAuthHeadersForFiles = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const { access_token } = JSON.parse(userData);
      return {
        'Authorization': `Bearer ${access_token}`,
      };
    }
    return {};
  };

  // Check user permissions using hierarchical permission system
  const checkUserPermissions = () => {
    const permLevel = getPermissionLevel('leaves');
    const isSuperAdminUser = isSuperAdmin();
    
    // Hierarchical permission logic:
    // 1. page: "*" and actions: "*" = superadmin (can do everything)
    // 2. page: "leaves" and actions: "own" = own leaves only
    // 3. page: "leaves" and actions: "junior" = all leaves + can approve/reject below him (not own)
    // 4. page: "leaves" and actions: "all" = can view all leaves + approve all leaves + view own leaves
    
    let canApproveReject = false;
    let canViewAllLeaves = false;
    let canViewJuniorLeaves = false;
    
    if (isSuperAdminUser) {
      // Super admin can do everything
      canApproveReject = true;
      canViewAllLeaves = true;
      canViewJuniorLeaves = true;
    } else {
      // Regular users based on permission level
      canViewAllLeaves = canUserViewAll();
      canViewJuniorLeaves = canUserViewJunior();
      
      // Junior and All permission levels can approve/reject
      // But junior users cannot approve/reject their own leaves
      canApproveReject = canViewJuniorLeaves || canViewAllLeaves;
    }
    
    const updatedPermissions = {
      leaves_show: true, // Everyone can view their own records
      leaves_own: true,
      leave_admin: canViewAllLeaves,
      leaves_create: canUserCreate(),
      leaves_delete: canDelete('leaves'), // Use proper permission function for leaves delete
      can_view_all: canViewAllLeaves,
      can_approve_reject: canApproveReject,
      is_super_admin: isSuperAdminUser,
      permission_level: permLevel // Store the permission level for use elsewhere
    };
    
    console.log('LeavesPage - Updated permissions:', updatedPermissions);
    setPermissions(updatedPermissions);
    
    return updatedPermissions;
  };

  // Legacy compatibility function
  const hasAdminPermission = () => canUserViewAll();

  // Fetch leaves
  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const userId = getCurrentUserId();
      
      if (!userId) {
        console.warn('No user ID found, using default');
        showSnackbar('User ID not found. Please login again.', 'error');
        return;
      }
      
      // Check user permissions
      const canViewAll = canUserViewAll();
      const canViewJunior = canUserViewJunior();
      const isSuperAdminUser = isSuperAdmin();
      
      const queryParams = new URLSearchParams();
      
      // Always send user_id for authentication, but backend will use permissions to filter
      queryParams.append('user_id', userId);
      
      // Send permission level to help backend understand what data to return
      if (isSuperAdminUser) {
        queryParams.append('permission_level', 'superadmin');
      } else if (canViewAll) {
        queryParams.append('permission_level', 'all');
      } else if (canViewJunior) {
        queryParams.append('permission_level', 'junior');
      } else {
        queryParams.append('permission_level', 'own');
      }
      
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.leave_type) queryParams.append('leave_type', filters.leave_type);
      if (filters.search) queryParams.append('search', filters.search);

      const response = await fetch(`${API_BASE_URL}/leaves/?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setLeaves(Array.isArray(data.leaves) ? data.leaves : []);
      } else {
        console.error('API Response not OK:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error details:', errorData);
        
        if (response.status === 401) {
          showSnackbar('Authentication failed. Please login again.', 'error');
        } else if (response.status === 422) {
          showSnackbar('Invalid request parameters. Please refresh the page.', 'error');
        } else {
          throw new Error(`Failed to fetch leaves: ${response.status} - ${errorData.detail || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
      showSnackbar('Failed to fetch leaves. Please check your connection.', 'error');
      setLeaves([]); // Set empty array to prevent undefined errors
    } finally {
      setLoading(false);
    }
  };

  // Delete leave function
  const deleteLeave = async (leaveId) => {
    try {
      const userId = getCurrentUserId();
      
      if (!userId) {
        showSnackbar('User not authenticated', 'error');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/leaves/${leaveId}?user_id=${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to delete leave: ${response.status} - ${errorData.detail || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting leave:', error);
      throw error;
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    try {
      await deleteLeave(leaveId);
      showSnackbar('Leave deleted successfully', 'success');
      fetchLeaves(); // Refresh the list
      fetchStats(); // Refresh stats
    } catch (error) {
      showSnackbar(error.message || 'Failed to delete leave', 'error');
    }
  };

  // Select button and bulk delete functionality
  const handleShowCheckboxes = () => {
    setShowCheckboxes(true);
    setSelectedRows([]);
    setSelectAll(false);
  };

  const handleRowSelect = (leaveId, checked) => {
    setSelectedRows(prev => 
      checked 
        ? [...prev, leaveId] 
        : prev.filter(id => id !== leaveId)
    );
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    setSelectedRows(checked ? filteredLeaves.map(leave => leave.id) : []);
  };

  const handleCancelSelection = () => {
    setSelectedRows([]);
    setSelectAll(false);
    setShowCheckboxes(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} selected leave(s)?`)) {
      return;
    }

    try {
      // Delete all selected leaves
      for (const leaveId of selectedRows) {
        await deleteLeave(leaveId);
      }
      
      showSnackbar(`Successfully deleted ${selectedRows.length} leave(s)`, 'success');
      fetchLeaves(); // Refresh the list
      fetchStats(); // Refresh stats
      
      // Reset selection state
      handleCancelSelection();
    } catch (error) {
      showSnackbar(error.message || 'Failed to delete leaves', 'error');
    }
  };

  // Fetch leave statistics
  const fetchStats = async () => {
    try {
      const userId = getCurrentUserId();
      
      if (!userId) {
        console.warn('No user ID found for stats');
        return;
      }
      
      const queryParams = new URLSearchParams();
      queryParams.append('user_id', userId);
      
      // Add permission level for stats as well
      const isSuperAdminUser = isSuperAdmin();
      const canViewAll = canUserViewAll();
      const canViewJunior = canUserViewJunior();
      
      if (isSuperAdminUser) {
        queryParams.append('permission_level', 'superadmin');
      } else if (canViewAll) {
        queryParams.append('permission_level', 'all');
      } else if (canViewJunior) {
        queryParams.append('permission_level', 'junior');
      } else {
        queryParams.append('permission_level', 'own');
      }

      const response = await fetch(`${API_BASE_URL}/leaves/stats/overview?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStats({
          pending: data.pending || 0,
          approved: data.approved || 0,
          rejected: data.rejected || 0,
          total: data.total || 0
        });
      } else {
        console.warn('Failed to fetch stats, using defaults');
        setStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
    }
  };

  // Fetch user permissions
  const fetchPermissions = async () => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const response = await fetch(`${API_BASE_URL}/leaves/permissions?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        let perms = data.permissions || {
          can_view_own: true,
          can_view_all: false,
          can_approve_reject: false,
          can_create: true,
          is_super_admin: false
        };
        
        // Check if user has admin permissions (page "*" and actions "*" or "admin")
        if (hasAdminPermission()) {
          perms = {
            can_view_own: true,
            can_view_all: true,
            can_approve_reject: true,
            can_create: true,
            is_super_admin: true
          };
        }
        
        // Map new permission structure to old format for backward compatibility
        const mappedPerms = {
          leaves_show: perms.can_view_own,
          leaves_own: perms.can_view_own,
          leave_admin: perms.can_approve_reject,
          leaves_create: perms.can_create,
          leaves_delete: canDelete('leaves'), // Use proper permission function for leaves delete
          can_view_all: perms.can_view_all,
          can_approve_reject: perms.can_approve_reject,
          is_super_admin: perms.is_super_admin
        };
        
        setPermissions(mappedPerms);
      } else {
        console.warn('Failed to fetch permissions, using defaults');
        // Use default permissions if API fails
        setPermissions({
          leaves_show: true,
          leaves_own: true,
          leave_admin: false,
          leaves_create: true,
          leaves_delete: canDelete('leaves'), // Use proper permission function for leaves delete
          can_view_all: false,
          can_approve_reject: false,
          is_super_admin: false
        });
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      // Set default permissions on error
      setPermissions({
        leaves_show: true,
        leaves_own: true,
        leave_admin: false,
        leaves_create: true,
        leaves_delete: canDelete('leaves'), // Use proper permission function for leaves delete
        can_view_all: false,
        can_approve_reject: false,
        is_super_admin: false
      });
    }
  };

  // Create new leave
  const handleCreateLeave = async () => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const response = await fetch(`${API_BASE_URL}/leaves/?${queryParams}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newLeave),
      });

      if (response.ok) {
        const data = await response.json();
        const createdLeaveId = data.id;
        
        showSnackbar('Leave application submitted successfully', 'success');
        
        // Upload attachment if one was selected
        if (attachmentFile && createdLeaveId) {
          await handleUploadAttachment(createdLeaveId);
        }
        
        setOpenCreateDialog(false);
        setNewLeave({
          leave_type: 'paid_leave',
          from_date: '',
          to_date: '',
          reason: '',
          attachments: []
        });
        setAttachmentFile(null);
        fetchLeaves();
        fetchStats();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create leave application');
      }
    } catch (error) {
      console.error('Error creating leave:', error);
      showSnackbar(error.message, 'error');
    }
  };

  // Approve or reject leave
  const handleApproveReject = async () => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const response = await fetch(`${API_BASE_URL}/leaves/${approvalLeave.id}/approve?${queryParams}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(approvalData),
      });

      if (response.ok) {
        const actionText = approvalData.status === 'approved' ? 'approved' : 'rejected';
        showSnackbar(`Leave application ${actionText} successfully`, 'success');
        setOpenApprovalDialog(false);
        setApprovalLeave(null);
        setApprovalData({
          status: 'approved',
          rejection_reason: '',
          comments: ''
        });
        fetchLeaves();
        fetchStats();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process leave application');
      }
    } catch (error) {
      console.error('Error processing leave:', error);
      showSnackbar(error.message, 'error');
    }
  };

  // Open approval dialog
  const openApprovalDialogHandler = (leave, status) => {
    setApprovalLeave(leave);
    setApprovalData({
      status: status,
      rejection_reason: '',
      comments: ''
    });
    setOpenApprovalDialog(true);
  };

  // Calculate leave duration
  const calculateDuration = () => {
    if (newLeave.from_date && newLeave.to_date) {
      const fromDate = new Date(newLeave.from_date);
      const toDate = new Date(newLeave.to_date);
      const diffTime = Math.abs(toDate - fromDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  };

  // Upload attachment
  const handleUploadAttachment = async (leaveId) => {
    if (!attachmentFile || !leaveId) return;

    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const formData = new FormData();
      formData.append('file', attachmentFile);

      const response = await fetch(`${API_BASE_URL}/leaves/${leaveId}/attachments?${queryParams}`, {
        method: 'POST',
        headers: getAuthHeadersForFiles(),
        body: formData,
      });

      if (response.ok) {
        showSnackbar('Attachment uploaded successfully', 'success');
        setAttachmentFile(null);
        fetchLeaves();
      } else {
        throw new Error('Failed to upload attachment');
      }
    } catch (error) {
      console.error('Error uploading attachment:', error);
      showSnackbar('Failed to upload attachment', 'error');
    }
  };

  // Download attachment
  const handleDownloadAttachment = async (attachment) => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const leaveId = selectedLeave?.id;
      const attachmentId = attachment.attachment_id;

      const response = await fetch(`${API_BASE_URL}/leaves/${leaveId}/attachments/${attachmentId}?${queryParams}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        // Create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.filename || 'attachment';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showSnackbar('Attachment downloaded successfully', 'success');
      } else {
        throw new Error('Failed to download attachment');
      }
    } catch (error) {
      console.error('Error downloading attachment:', error);
      showSnackbar('Failed to download attachment', 'error');
    }
  };

  // Open leave details
  const handleViewLeave = async (leaveId) => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const response = await fetch(`${API_BASE_URL}/leaves/${leaveId}?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedLeave(data);
        setOpenViewDialog(true);
        
        // Force refresh permissions when opening the dialog
        checkUserPermissions();
      } else {
        throw new Error('Failed to fetch leave details');
      }
    } catch (error) {
      console.error('Error fetching leave details:', error);
      showSnackbar('Failed to load leave details', 'error');
    }
  };

  // Show snackbar message
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Get filtered leaves based on selected tab
  const getFilteredLeaves = () => {
    if (!Array.isArray(leaves)) {
      return [];
    }
    
    let filtered = leaves;

    // Filter by tab
    if (selectedTab === 1) {
      filtered = filtered.filter(leave => leave.status === 'pending');
    } else if (selectedTab === 2) {
      filtered = filtered.filter(leave => leave.status === 'approved');
    } else if (selectedTab === 3) {
      filtered = filtered.filter(leave => leave.status === 'rejected');
    }

    return filtered;
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  // Load data on component mount and when specific dependencies change
  useEffect(() => {
    try {
      fetchLeaves();
      fetchStats();
    } catch (error) {
      console.error('Error in data loading useEffect:', error);
      if (typeof showSnackbar === 'function') {
        showSnackbar('Failed to load component data', 'error');
      }
    }
  }, [filters.status, filters.leave_type, filters.search]);

  // Load permissions only on component mount
  useEffect(() => {
    try {
      // Use the simplified permission system instead of API fetch
      checkUserPermissions();
    } catch (error) {
      console.error('Error in permissions useEffect:', error);
      if (typeof showSnackbar === 'function') {
        showSnackbar('Failed to load permissions', 'error');
      }
    }
  }, []);

  // Memoized filtered leaves based on selected tab and leaves data
  const filteredLeaves = useMemo(() => {
    return getFilteredLeaves();
  }, [leaves, selectedTab]);

  // Update select all checkbox based on selected rows and filtered leaves
  useEffect(() => {
    if (filteredLeaves.length > 0) {
      if (selectedRows.length === filteredLeaves.length) {
        setSelectAll(true);
      } else {
        setSelectAll(false);
      }
    }
  }, [selectedRows, filteredLeaves]);

  // Initialize component readiness
  useEffect(() => {
    setIsReady(true);
  }, []);

  // Progressive loading check - start with minimal UI
  if (!isReady) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#03B0F5] mx-auto mb-4"></div>
          <p className="text-[#03B0F5]">Loading Leave Management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white text-base">
      {/* Header */}
      <div className="flex items-center gap-3 px-2 sm:px-4 lg:px-6 py-6 bg-[#0c1019] border-b-4 border-cyan-400/70 shadow-lg w-full">
       
        <div className="flex items-center gap-2">
          {/* Select Button Controls */}
          {permissions.leaves_delete && (
            <div className="flex items-center gap-3">
              {!showCheckboxes ? (
                <button
                  className="bg-[#03B0F5] text-white px-3 sm:px-5 py-1.5 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-sm sm:text-base"
                  onClick={handleShowCheckboxes}
                >
                  {selectedRows.length > 0 ? `Select (${selectedRows.length})` : "Select"}
                </button>
              ) : (
                <div className="flex items-center gap-4 bg-gray-900 rounded-lg p-2">
                  <label className="flex items-center cursor-pointer text-[#03B0F5] font-bold text-sm">
                    <input
                      type="checkbox"
                      className="accent-blue-500 mr-2"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    Select All
                  </label>
                  <span className="text-white font-semibold text-sm">
                    {selectedRows.length} selected
                  </span>
                  <button
                    className="px-2 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition text-sm"
                    onClick={handleDeleteSelected}
                    disabled={selectedRows.length === 0}
                  >
                    Delete ({selectedRows.length})
                  </button>
                  <button
                    className="px-2 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition text-sm"
                    onClick={handleCancelSelection}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex-1"></div>
        <div className="flex flex-wrap gap-2">
          {(permissions.leaves_create || permissions.leaves_own || permissions.leaves_show) && (
            <button
              onClick={() => setOpenCreateDialog(true)}
              className="bg-gradient-to-b from-cyan-400 to-blue-700 px-3 sm:px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-sm sm:text-base flex items-center"
            >
              <Plus className="mr-2 h-4 w-4" /> APPLY LEAVE
            </button>
          )}
          <button
            onClick={() => { fetchLeaves(); fetchStats(); }}
            className="bg-gradient-to-b from-cyan-400 to-blue-700 px-3 sm:px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-sm sm:text-base flex items-center"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> REFRESH
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="px-2 sm:px-4 lg:px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6 mb-8">
          {statusCardConfig.map((config) => {
            const Icon = config.icon;
            const count = stats && typeof stats[config.key] === 'number' ? stats[config.key] : 0;
            
            return (
              <div
                key={config.key}
                className={`p-4 rounded-xl bg-gradient-to-r ${config.gradient || config.backgroundColor} shadow-lg ${config.shadowColor || 'shadow-lg'} flex-1`}
              >
                <div className="flex justify-between items-center">
                  <Icon className="w-6 h-6 text-white" />
                  <span className="text-xl font-bold text-white">{count}</span>
                </div>
                <p className="mt-4 text-md text-white font-medium uppercase tracking-wide">{config.label}</p>
              </div>
            );
          })}
        </div>

        {/* Filter Section */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#03B0F5]" style={{ fontSize: 16 }} />
                <input
                  type="text"
                  placeholder="Search leaves..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-12 pr-4 py-2 bg-[#1a2332] border border-[#2D3C56] rounded-lg text-white placeholder-gray-400 focus:border-[#03B0F5] focus:outline-none"
                />
              </div>
            </div>
            
            {/* Search Results Indicator */}
            {(filters.search || filters.status || filters.leave_type) && (
              <div className="text-base text-gray-300 bg-[#1b2230] px-4 py-3 rounded-lg border border-gray-600">
                {filteredLeaves.length} of {leaves.length} leaves
                {filters.search && (
                  <span className="ml-2">
                    matching "<span className="text-cyan-400 font-semibold">{filters.search}</span>"
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-2 bg-[#1a2332] border border-[#2D3C56] rounded-lg text-white focus:border-[#03B0F5] focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={filters.leave_type}
              onChange={(e) => setFilters({ ...filters, leave_type: e.target.value })}
              className="px-4 py-2 bg-[#1a2332] border border-[#2D3C56] rounded-lg text-white focus:border-[#03B0F5] focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="paid_leave">Paid Leave</option>
              <option value="casual_leave">Casual Leave</option>
              <option value="sick_leave">Sick Leave</option>
              <option value="emergency_leave">Emergency Leave</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6 overflow-x-auto">
          {[
            { label: `All Leaves (${stats?.total || 0})`, value: 0 },
            { label: `Pending (${stats?.pending || 0})`, value: 1 },
            { label: `Approved (${stats?.approved || 0})`, value: 2 },
            { label: `Rejected (${stats?.rejected || 0})`, value: 3 }
          ].map((tab, idx) => (
            <button
              key={idx}
              className={`
                flex items-center px-4 py-3 rounded-3xl font-extrabold border shadow-md text-sm sm:text-base transition whitespace-nowrap
                ${idx === selectedTab
                  ? "bg-[#03B0F5] via-blue-700 to-cyan-500 text-white border-cyan-400 shadow-lg scale-105"
                  : "bg-white text-[#03b0f5] border-[#2D3C56] hover:bg-cyan-400/10 hover:text-cyan-400"
                }
                focus:outline-none
              `}
              onClick={() => handleTabChange(null, idx)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-[#1a2332] border border-[#2D3C56] rounded-lg p-4 mb-6 shadow-lg">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#03B0F5]"></div>
              <span className="ml-2 text-[#03B0F5]">Loading leaves...</span>
            </div>
          </div>
        )}

        {/* Table Section */}
        <div className="overflow-auto rounded-xl">
          <div className="overflow-x-auto bg-transparent rounded-lg">
            <table className="min-w-full w-full bg-transparent">
              <thead className="bg-white">
                <tr>
                  {/* Checkbox column header - only show when in selection mode */}
                  {permissions.leaves_delete && showCheckboxes && (
                    <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">
                      <input
                        type="checkbox"
                        className="accent-blue-500"
                        checked={selectAll}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        style={{ width: 18, height: 18 }}
                      />
                    </th>
                  )}
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">S.No</th>
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">Employee Name</th>
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">Leave Type</th>
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">From</th>
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">To</th>
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">Duration</th>
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">Approved By</th>
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">Status</th>
                </tr>
              </thead>
              <tbody className="bg-transparent">
                {filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={showCheckboxes ? "9" : "8"} className="py-20 text-center text-gray-400 text-lg bg-transparent">
                      <div className="flex items-center justify-center gap-3">
                        {loading && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>}
                        <span className="text-xl font-semibold">
                          {loading ? 'Loading Leaves...' : 'No leaves found'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeaves
                    .map((leave, index) => (
                      <tr 
                        key={leave.id} 
                        className="border-b border-gray-800 hover:bg-gray-900/50 transition cursor-pointer bg-transparent"
                        onClick={() => handleViewLeave(leave.id)}
                        title="Click to view leave details"
                      >
                        {/* Checkbox column - only show when in selection mode */}
                        {permissions.leaves_delete && showCheckboxes && (
                          <td className="py-2 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="accent-blue-500"
                              checked={selectedRows.includes(leave.id)}
                              onChange={(e) => handleRowSelect(leave.id, e.target.checked)}
                              style={{ width: 18, height: 18 }}
                            />
                          </td>
                        )}
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">{index + 1}</td>
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                              {(leave.employee_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-md">{leave.employee_name || 'Unknown'}</span>
                              {leave.attachments && leave.attachments.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <AttachFile className="w-3 h-3 text-green-400" />
                                  <span className="text-xs text-green-400">Has Attachment</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                          <LeaveTypeChip
                            leavetype={leave.leave_type}
                            label={leave.leave_type.replace('_', ' ').toUpperCase()}
                          />
                        </td>
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">{formatDate(leave.from_date)}</td>
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">{formatDate(leave.to_date)}</td>
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">{leave.duration_days} days</td>
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                          {leave.approved_by_name || leave.rejected_by_name || 'N/A'}
                        </td>
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                          <StatusChip
                            status={leave.status}
                            label={leave.status.toUpperCase()}
                          />
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      
      {/* Snackbar */}
      {snackbar.open && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-4 py-2 rounded-lg text-white ${
            snackbar.severity === 'success' ? 'bg-green-600' :
            snackbar.severity === 'error' ? 'bg-red-600' :
            snackbar.severity === 'warning' ? 'bg-orange-600' :
            'bg-blue-600'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span>{snackbar.message}</span>
              <button 
                onClick={() => setSnackbar({ ...snackbar, open: false })}
                className="text-white hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Leave Dialog */}
      {openCreateDialog && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
          <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl mx-auto space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
              onClick={() => setOpenCreateDialog(false)}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-green-600 mb-4">APPLY FOR LEAVE</h2>
            
            <form onSubmit={(e) => { e.preventDefault(); handleCreateLeave(); }}>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">Leave Type</label>
                  <select
                    value={newLeave.leave_type}
                    onChange={(e) => setNewLeave({ ...newLeave, leave_type: e.target.value })}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                  >
                    <option value="paid_leave">Paid Leave</option>
                    <option value="casual_leave">Casual Leave</option>
                    <option value="sick_leave">Sick Leave</option>
                    <option value="emergency_leave">Emergency Leave</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">Duration</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value={`${calculateDuration()} days`}
                    readOnly
                  />
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 mt-4">
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={newLeave.from_date}
                    onChange={(e) => setNewLeave({ ...newLeave, from_date: e.target.value })}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={newLeave.to_date}
                    onChange={(e) => setNewLeave({ ...newLeave, to_date: e.target.value })}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    required
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block font-bold text-gray-700 mb-1">Reason for Leave</label>
                <textarea
                  rows={4}
                  value={newLeave.reason}
                  onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                  placeholder="Please provide a detailed reason for your leave application..."
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none"
                  required
                />
              </div>
              
              <div className="mt-4">
                <label className="block font-bold text-gray-700 mb-1">Attachment</label>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center px-4 py-2 bg-cyan-500 text-white font-bold rounded-lg shadow cursor-pointer hover:bg-cyan-600 transition">
                    Photo/PDF
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx"
                      onChange={(e) => setAttachmentFile(e.target.files[0])}
                    />
                  </label>
                  {attachmentFile && (
                    <div className="flex items-center gap-1 text-green-600 font-medium">
                      <AttachFile className="w-4 h-4" />
                      <span className="text-sm">{attachmentFile.name}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setOpenCreateDialog(false)}
                  className="flex-1 px-6 py-3 bg-gray-400 text-white font-bold rounded-lg shadow hover:bg-gray-500 transition text-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newLeave.from_date || !newLeave.to_date || !newLeave.reason.trim()}
                  className="flex-1 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg shadow hover:bg-cyan-700 transition text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Leave Dialog */}
      {openViewDialog && selectedLeave && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
          <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl mx-auto space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
              onClick={() => setOpenViewDialog(false)}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-green-600 mb-4">LEAVE APPLICATION DETAILS</h2>
            
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">Employee Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value={selectedLeave.employee_name || 'Unknown'}
                    readOnly
                  />
                </div>
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">Leave Type</label>
                  <div className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100 flex items-center">
                    <LeaveTypeChip
                      leavetype={selectedLeave.leave_type}
                      label={selectedLeave.leave_type.replace('_', ' ').toUpperCase()}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">From Date</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value={formatDate(selectedLeave.from_date)}
                    readOnly
                  />
                </div>
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">To Date</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value={formatDate(selectedLeave.to_date)}
                    readOnly
                  />
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">Duration</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value={`${selectedLeave.duration_days} days`}
                    readOnly
                  />
                </div>
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">Status</label>
                  <div className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100 flex items-center">
                    <StatusChip
                      status={selectedLeave.status}
                      label={selectedLeave.status.toUpperCase()}
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block font-bold text-gray-700 mb-1">Reason</label>
                <textarea
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100 resize-none"
                  rows={3}
                  value={selectedLeave.reason}
                  readOnly
                />
              </div>
              
              {selectedLeave.approved_by_name && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Approved By</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value={selectedLeave.approved_by_name}
                    readOnly
                  />
                </div>
              )}
              
              {selectedLeave.rejected_by_name && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Rejected By</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value={selectedLeave.rejected_by_name}
                    readOnly
                  />
                </div>
              )}
              
              {selectedLeave.rejection_reason && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Rejection Reason</label>
                  <textarea
                    className="w-full px-3 py-2 border border-red-400 rounded text-black font-bold bg-red-50 resize-none"
                    rows={2}
                    value={selectedLeave.rejection_reason}
                    readOnly
                  />
                </div>
              )}
              
              {selectedLeave.approval_comments && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    {selectedLeave.status === 'approved' ? 'Approval Comments' : 'Comments'}
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-green-400 rounded text-black font-bold bg-green-50 resize-none"
                    rows={2}
                    value={selectedLeave.approval_comments}
                    readOnly
                  />
                </div>
              )}
              
              <div>
                <label className="block font-bold text-gray-700 mb-1">Applied On</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={formatDate(selectedLeave.created_at)}
                  readOnly
                />
              </div>
              
              {/* Attachments Section */}
              {selectedLeave.attachments && selectedLeave.attachments.length > 0 && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Attachments</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedLeave.attachments.map((attachment, index) => (
                      <button
                        key={index}
                        onClick={() => handleDownloadAttachment(attachment)}
                        className="flex items-center gap-1 bg-cyan-500 hover:bg-cyan-600 text-white px-3 py-2 rounded font-bold transition"
                      >
                        <AttachFile className="w-4 h-4" />
                        {attachment.filename || `Attachment ${index + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Approval Actions for authorized users */}
              {(() => {
                const currentUserId = getCurrentUserId();
                const isOwnLeave = selectedLeave.employee_id === currentUserId;
                const canApprove = permissions.can_approve_reject || permissions.is_super_admin;
                const isJuniorLevel = permissions.permission_level === 'junior';
                const canApproveThisLeave = canApprove && !(isJuniorLevel && isOwnLeave);
                
                return canApprove;
              })() && (
                <div className="border-t border-gray-300 pt-4">
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setOpenViewDialog(false);
                        openApprovalDialogHandler(selectedLeave, 'approved');
                      }}
                      className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow hover:bg-green-700 transition text-lg flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setOpenViewDialog(false);
                        openApprovalDialogHandler(selectedLeave, 'rejected');
                      }}
                      className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-700 transition text-lg flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-5 h-5" />
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approval Dialog */}
      {openApprovalDialog && approvalLeave && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
          <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg mx-auto space-y-6">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
              onClick={() => setOpenApprovalDialog(false)}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-green-600 mb-4">
              {approvalData.status === 'approved' ? 'APPROVE LEAVE' : 'REJECT LEAVE'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <h4 className="block font-bold text-gray-700 mb-2">Leave Details</h4>
                <div className="bg-gray-50 p-4 rounded border border-gray-300 space-y-2 text-sm">
                  <div><span className="font-semibold">Employee:</span> {approvalLeave.employee_name}</div>
                  <div><span className="font-semibold">Leave Type:</span> {approvalLeave.leave_type.replace('_', ' ').toUpperCase()}</div>
                  <div><span className="font-semibold">Duration:</span> {approvalLeave.duration_days} days</div>
                  <div><span className="font-semibold">From:</span> {formatDate(approvalLeave.from_date)}</div>
                  <div><span className="font-semibold">To:</span> {formatDate(approvalLeave.to_date)}</div>
                  <div><span className="font-semibold">Reason:</span> {approvalLeave.reason}</div>
                </div>
              </div>
              
              {approvalData.status === 'rejected' && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Rejection Reason *</label>
                  <textarea
                    rows={3}
                    value={approvalData.rejection_reason}
                    onChange={(e) => setApprovalData({ ...approvalData, rejection_reason: e.target.value })}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none"
                    placeholder="Please provide a reason for rejection..."
                    required
                  />
                </div>
              )}
              
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Comments (Optional - for {approvalData.status === 'approved' ? 'approval' : 'rejection'})
                </label>
                <textarea
                  rows={2}
                  value={approvalData.comments}
                  onChange={(e) => setApprovalData({ ...approvalData, comments: e.target.value })}
                  placeholder="Add any additional comments..."
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none"
                />
              </div>
              
              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setOpenApprovalDialog(false)}
                  className="flex-1 px-6 py-3 bg-gray-400 text-white font-bold rounded-lg shadow hover:bg-gray-500 transition text-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveReject}
                  disabled={approvalData.status === 'rejected' && !approvalData.rejection_reason.trim()}
                  className={`flex-1 px-6 py-3 text-white font-bold rounded-lg shadow transition text-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                    approvalData.status === 'approved' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {approvalData.status === 'approved' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Attachment Dialog */}
      {openUploadDialog && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
          <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-md mx-auto space-y-6">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
              onClick={() => setOpenUploadDialog(false)}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-green-600 mb-4">UPLOAD ATTACHMENT</h2>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded border border-gray-300">
                <p className="text-sm text-gray-700 font-medium">
                  Upload your attachment for the leave application. Supported formats: PDF, PNG, JPG, DOCX.
                </p>
              </div>
              
              <div>
                <label className="block font-bold text-gray-700 mb-1">Choose File</label>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center px-4 py-2 bg-cyan-500 text-white font-bold rounded-lg shadow cursor-pointer hover:bg-cyan-600 transition">
                    Photo/PDF
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      onChange={(e) => setUploadAttachmentFile(e.target.files[0])}
                    />
                  </label>
                  {uploadAttachmentFile && (
                    <div className="flex items-center gap-1 text-green-600 font-medium">
                      <AttachFile className="w-4 h-4" />
                      <span className="text-sm">{uploadAttachmentFile.name}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setOpenUploadDialog(false)}
                  className="flex-1 px-6 py-3 bg-gray-400 text-white font-bold rounded-lg shadow hover:bg-gray-500 transition text-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (uploadLeaveId && uploadAttachmentFile) {
                      await handleUploadAttachment(uploadLeaveId);
                      setOpenUploadDialog(false);
                    }
                  }}
                  disabled={!uploadAttachmentFile}
                  className="flex-1 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg shadow hover:bg-cyan-700 transition text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Upload Attachment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeavesPage;
