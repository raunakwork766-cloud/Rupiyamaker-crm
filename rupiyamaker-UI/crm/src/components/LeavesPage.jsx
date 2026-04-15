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
  Warning as AlertTriangle,
  Settings as SettingsIcon
} from '@mui/icons-material';

import { getISTDateYMD } from '../utils/dateUtils';
import useTabWithHistory from '../hooks/useTabWithHistory';

// Import simplified permission system
import { 
  getPermissionLevel, 
  canViewAll, 
  canViewJunior, 
  canCreate, 
  canEdit, 
  canDelete,
  getPermissionDisplayText,
  getCurrentUserId,
  hasPermission,
  getUserPermissions,
  isSuperAdmin as isSuperAdminCheck
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
    const [selectedTab, setSelectedTab] = useTabWithHistory('tab', 0, { localStorageKey: 'leavesPageTab', isNumeric: true });
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
  
  // Enhanced leave modal state
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [calcResult, setCalcResult] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSubmitData, setLastSubmitData] = useState(null);

  // Leave approval settings state
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [allRoles, setAllRoles] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [approvalRoutes, setApprovalRoutes] = useState([]);
  const [settingsSelectedRole, setSettingsSelectedRole] = useState(null);
  const [settingsSelectedApprovers, setSettingsSelectedApprovers] = useState([]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsRoleSearch, setSettingsRoleSearch] = useState('');
  const [settingsEmpSearch, setSettingsEmpSearch] = useState('');

  // Approvers for apply modal (fetched based on current user's role)
  const [myApprovers, setMyApprovers] = useState([]);
  const [selectedApproverIds, setSelectedApproverIds] = useState(new Set());
  
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
    leaves_select: hasPermission(getUserPermissions(), 'leaves', 'select') || canDelete('leaves'), // select action
    leave_setting: isSuperAdminCheck(getUserPermissions()) || canUserViewAll() || hasPermission(getUserPermissions(), 'leaves', 'leave_setting'), // settings button
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
      leaves_select: hasPermission(getUserPermissions(), 'leaves', 'select') || canDelete('leaves'),
      leave_setting: isSuperAdminUser || hasPermission(getUserPermissions(), 'leaves', 'leave_setting'),
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
        if (response.status === 403) {
          throw new Error(errorData.detail || 'You don\'t have permission to delete this leave');
        }
        if (response.status === 400) {
          throw new Error(errorData.detail || 'You can only delete pending leave applications');
        }
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
          leaves_delete: canDelete('leaves'),
          leaves_select: hasPermission(getUserPermissions(), 'leaves', 'select') || canDelete('leaves'),
          leave_setting: perms.is_super_admin || hasPermission(getUserPermissions(), 'leaves', 'leave_setting'),
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
          leaves_delete: canDelete('leaves'),
          leaves_select: false,
          leave_setting: false,
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
        leaves_delete: canDelete('leaves'),
        leaves_select: false,
        leave_setting: false,
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
        body: JSON.stringify({
          ...newLeave,
          approver_ids: Array.from(selectedApproverIds),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const createdLeaveId = data.id;
        
        // Upload attachment if one was selected
        if (attachmentFile && createdLeaveId) {
          await handleUploadAttachment(createdLeaveId);
        }
        
        // Show success screen instead of closing dialog
        setLastSubmitData({ id: createdLeaveId });
        setShowSuccess(true);
        fetchLeaves();
        fetchStats();
        fetchLeaveBalance();
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

  // ═══ ENHANCED LEAVE MODAL HELPERS ═══

  // Ordinal helper: 1→1st, 2→2nd, 3→3rd, 4→4th
  const toOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Get current user name + department from localStorage
  const getUserDisplayName = () => {
    try {
      const userData = localStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        const name = user.name || user.full_name || user.username || 'Employee';
        const dept = user.department_name || user.department || '';
        return { name, department: dept };
      }
    } catch (e) {}
    return { name: 'Employee', department: '' };
  };

  // Fetch employee leave balance
  const fetchLeaveBalance = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/settings/leave-balance/${userId}?user_id=${userId}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setLeaveBalance(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    }
  };

  // Count leave days taken this month by current user
  const getMonthLeaveCount = () => {
    const userId = getCurrentUserId();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return leaves
      .filter(l => {
        if (l.employee_id !== userId) return false;
        const fromDate = new Date(l.from_date);
        return fromDate.getMonth() === currentMonth && fromDate.getFullYear() === currentYear;
      })
      .reduce((sum, l) => sum + (l.duration_days || 0), 0);
  };

  // Calculate monthly leave allocation from yearly balance
  const getMonthlyBalance = () => {
    if (!leaveBalance) return { monthlyPL: 0, monthlyEL: 0, plRemaining: 0, elRemaining: 0, total: 0 };
    const monthlyPL = Math.floor((leaveBalance.paid_leaves_total || 0) / 12);
    const monthlyEL = Math.floor((leaveBalance.earned_leaves_total || 0) / 12);
    // How many days used this month
    const usedThisMonth = getMonthLeaveCount();
    // PL-first deduction to figure out PL/EL used this month
    let rem = usedThisMonth;
    const plUsed = Math.min(rem, monthlyPL); rem -= plUsed;
    const elUsed = Math.min(rem, monthlyEL);
    const plRemaining = Math.max(0, monthlyPL - plUsed);
    const elRemaining = Math.max(0, monthlyEL - elUsed);
    return { monthlyPL, monthlyEL, plRemaining, elRemaining, total: plRemaining + elRemaining };
  };

  // Recalculate leave breakdown when dates change
  const recalcLeave = (fromDateStr, toDateStr) => {
    if (!fromDateStr || !toDateStr) {
      setCalcResult(null);
      return;
    }
    const from = new Date(fromDateStr);
    const to = new Date(toDateStr);
    if (to < from) { setCalcResult(null); return; }

    // Collect all days in range
    const allDays = [];
    const c = new Date(from);
    while (c <= to) { allDays.push(new Date(c)); c.setDate(c.getDate() + 1); }

    // Skip Sundays
    const bizDays = allDays.filter(d => d.getDay() !== 0);
    const sundays = allDays.filter(d => d.getDay() === 0);
    const days = bizDays.length || 1;

    // Use monthly allocation, not yearly remaining
    const mb = getMonthlyBalance();
    const plRemaining = mb.plRemaining;
    const elRemaining = mb.elRemaining;

    // Auto deduct: PL first then EL
    let rem = days;
    const plUsed = Math.min(rem, plRemaining);
    rem -= plUsed;
    const elUsed = Math.min(rem, elRemaining);
    rem -= elUsed;
    const unpaid = Math.max(0, rem);

    const prevDays = getMonthLeaveCount();
    const leaveEnd = prevDays + days;

    // Build chips data
    const chips = bizDays.map((d, i) => {
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
      let type;
      if (i < plUsed) type = 'pl';
      else if (i < plUsed + elUsed) type = 'el';
      else type = 'unpaid';
      return { label, type, date: d };
    });
    const sundayChips = sundays.map(d => ({
      label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }),
      type: 'sunday', date: d
    }));

    setCalcResult({
      days, plUsed, elUsed, unpaid,
      paidTotal: plUsed + elUsed,
      totalAvail: plRemaining + elRemaining,
      chips: [...chips, ...sundayChips],
      leaveEnd, prevDays,
      needDoc: unpaid > 0,
    });
  };

  // Open create dialog with balance fetch + approvers
  const handleOpenCreateDialog = async () => {
    setShowSuccess(false);
    setLastSubmitData(null);
    setCalcResult(null);
    setNewLeave({ leave_type: 'paid_leave', from_date: '', to_date: '', reason: '', attachments: [] });
    setAttachmentFile(null);
    setSelectedApproverIds(new Set());
    setOpenCreateDialog(true);
    await fetchLeaveBalance();
    // Fetch approvers and auto-select all of them
    const approvers = await fetchMyApprovers();
    if (approvers && approvers.length > 0) {
      setSelectedApproverIds(new Set(approvers.map(a => a.id || a._id)));
    }
  };

  // ═══ LEAVE APPROVAL SETTINGS FUNCTIONS ═══

  // Fetch all roles
  const fetchAllRoles = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/roles/?user_id=${userId}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setAllRoles(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error('Error fetching roles:', e); }
  };

  // Fetch all employees
  const fetchAllEmployees = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/users/?user_id=${userId}&is_active=true`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        // /users/ returns array of user objects with _id, first_name, last_name, designation, is_active
        const users = Array.isArray(data) ? data : (data.employees || data.data || []);
        // Normalize: add a "name" field and filter only active users
        const normalized = users
          .filter(u => u.is_active !== false)
          .map(u => ({
            ...u,
            id: u._id || u.id,
            name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Unknown',
          }));
        setAllEmployees(normalized);
      }
    } catch (e) { console.error('Error fetching employees:', e); }
  };

  // Fetch all approval routes
  const fetchApprovalRoutes = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/settings/leave-approval-routes?user_id=${userId}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setApprovalRoutes(data.data || []);
      }
    } catch (e) { console.error('Error fetching approval routes:', e); }
  };

  // Fetch my approvers (for Apply modal) — returns array
  const fetchMyApprovers = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/settings/leave-approvers-for-me?user_id=${userId}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        const list = data.data || [];
        setMyApprovers(list);
        return list;
      }
    } catch (e) { console.error('Error fetching my approvers:', e); }
    return [];
  };

  // Open settings modal
  const handleOpenSettings = async () => {
    setSettingsSelectedRole(null);
    setSettingsSelectedApprovers([]);
    setSettingsRoleSearch('');
    setSettingsEmpSearch('');
    setOpenSettingsModal(true);
    await Promise.all([fetchAllRoles(), fetchAllEmployees(), fetchApprovalRoutes()]);
  };

  // When a role is selected in settings, load existing approvers
  const handleSettingsRoleSelect = (roleId) => {
    setSettingsSelectedRole(roleId);
    const existing = approvalRoutes.find(r => r.role_id === roleId);
    setSettingsSelectedApprovers(existing ? existing.approver_ids : []);
  };

  // Toggle approver in settings
  const toggleSettingsApprover = (empId) => {
    setSettingsSelectedApprovers(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  // Save approval route
  const handleSaveApprovalRoute = async () => {
    if (!settingsSelectedRole || settingsSelectedApprovers.length === 0) return;
    setSettingsSaving(true);
    try {
      const userId = getCurrentUserId();
      const role = allRoles.find(r => (r.id || r._id) === settingsSelectedRole);
      const approverNames = settingsSelectedApprovers.map(id => {
        const emp = allEmployees.find(e => (e.id || e._id || e.user_id) === id);
        return emp ? (emp.name || emp.full_name || 'Unknown') : 'Unknown';
      });
      const response = await fetch(`${API_BASE_URL}/settings/leave-approval-routes?user_id=${userId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          role_id: settingsSelectedRole,
          role_name: role ? role.name : '',
          approver_ids: settingsSelectedApprovers,
          approver_names: approverNames,
        }),
      });
      if (response.ok) {
        showSnackbar('Approval route saved successfully', 'success');
        await fetchApprovalRoutes();
        setSettingsSelectedRole(null);
        setSettingsSelectedApprovers([]);
      } else {
        const err = await response.json().catch(() => ({}));
        showSnackbar(err.detail || 'Failed to save', 'error');
      }
    } catch (e) {
      showSnackbar('Error saving approval route', 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Delete approval route
  const handleDeleteApprovalRoute = async (roleId) => {
    if (!window.confirm('Delete this approval route?')) return;
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_BASE_URL}/settings/leave-approval-routes/${roleId}?user_id=${userId}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (response.ok) {
        showSnackbar('Route deleted', 'success');
        await fetchApprovalRoutes();
      }
    } catch (e) { showSnackbar('Error deleting route', 'error'); }
  };

  // Toggle approver in Apply modal
  const toggleApplyApprover = (approverId) => {
    setSelectedApproverIds(prev => {
      const next = new Set(prev);
      if (next.has(approverId)) next.delete(approverId);
      else next.add(approverId);
      return next;
    });
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
        // Ensure myApprovers is loaded (needed for fallback when leave has no approvers array)
        if (myApprovers.length === 0) fetchMyApprovers();
      } else if (response.status === 403) {
        showSnackbar('You don\'t have permission to view this leave', 'error');
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
    return new Date(dateString).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

  // Get filtered leaves based on selected tab
  const getFilteredLeaves = () => {
    if (!Array.isArray(leaves)) {
      return [];
    }
    
    let filtered = leaves;

    // Filter by tab (0=Pending, 1=Approved, 2=Rejected)
    if (selectedTab === 0) {
      filtered = filtered.filter(leave => leave.status === 'pending');
    } else if (selectedTab === 1) {
      filtered = filtered.filter(leave => leave.status === 'approved');
    } else if (selectedTab === 2) {
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
      {/* CSS Keyframes for leave modals */}
      <style>{`
        @keyframes leaveModalUp {
          from { opacity: 0; transform: translateY(22px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes leavePopIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center gap-3 px-2 sm:px-4 lg:px-6 py-6 bg-[#0c1019] border-b-4 border-cyan-400/70 shadow-lg w-full">
       
        <div className="flex items-center gap-2">
          {/* Select Button Controls */}
          {(permissions.leaves_delete || permissions.leaves_select) && (
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
              onClick={handleOpenCreateDialog}
              className="bg-gradient-to-b from-cyan-400 to-blue-700 px-3 sm:px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-sm sm:text-base flex items-center"
            >
              <Plus className="mr-2 h-4 w-4" /> APPLY LEAVE
            </button>
          )}
          {(permissions.leave_setting) && (
            <button
              onClick={handleOpenSettings}
              className="bg-gradient-to-b from-orange-400 to-orange-600 px-3 sm:px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-orange-600 hover:to-orange-400 uppercase tracking-wide transition text-sm sm:text-base flex items-center"
            >
              <SettingsIcon className="mr-2 h-4 w-4" /> SETTINGS
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
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
            { label: `Pending (${stats?.pending || 0})`, value: 0 },
            { label: `Approved (${stats?.approved || 0})`, value: 1 },
            { label: `Rejected (${stats?.rejected || 0})`, value: 2 }
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
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">Applied On</th>
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">Employee Name</th>
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">From</th>
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">To</th>
                  <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider text-left">Leave Duration</th>
                </tr>
              </thead>
              <tbody className="bg-transparent">
                {filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={showCheckboxes ? "7" : "6"} className="py-20 text-center text-gray-400 text-lg bg-transparent">
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
                        onDoubleClick={() => handleViewLeave(leave.id)}
                        onClick={() => handleViewLeave(leave.id)}
                        title="Double-click to view leave details"
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
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">{formatDate(leave.created_at)}</td>
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                              {(leave.employee_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-md">{leave.employee_name || 'Unknown'}</span>
                              {leave.department_name && (
                                <span className="text-xs text-gray-400">{leave.department_name}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">{formatDate(leave.from_date)}</td>
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">{formatDate(leave.to_date)}</td>
                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">{leave.duration_days} day{leave.duration_days > 1 ? 's' : ''}</td>
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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center"
             style={{ background: 'rgba(10,5,30,0.78)', backdropFilter: 'blur(6px)' }}
             onClick={(e) => { if (e.target === e.currentTarget) setOpenCreateDialog(false); }}>
          <div className="relative w-full max-w-[520px] max-h-[92vh] overflow-y-auto bg-white"
               style={{ borderRadius: '22px', boxShadow: '0 30px 70px rgba(0,0,0,.28)', animation: 'leaveModalUp 0.28s cubic-bezier(.34,1.4,.64,1)' }}>

            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-6 pt-5">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] flex items-center justify-center text-xl flex-shrink-0"
                     style={{ borderRadius: '11px', background: '#DCFCE7' }}>📅</div>
                <div>
                  <div className="text-[17px] font-extrabold" style={{ color: '#16A34A' }}>Apply for Leave</div>
                  <div className="text-xs" style={{ color: '#9CA3AF' }}>
                    {getUserDisplayName().name}{getUserDisplayName().department ? ` · ${getUserDisplayName().department}` : ''}
                  </div>
                </div>
              </div>
              <button onClick={() => setOpenCreateDialog(false)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 hover:bg-red-50 hover:text-red-500 transition"
                      style={{ background: '#F3F4F6', color: '#6B7280' }}>✕</button>
            </div>

            {!showSuccess ? (
              <>
                <div className="px-6 py-4">

                  {/* ═══ Total Available Leaves Block (Monthly) ═══ */}
                  {leaveBalance && (() => {
                    const mb = getMonthlyBalance();
                    const plR = mb.plRemaining;
                    const elR = mb.elRemaining;
                    const total = mb.total;
                    const isZero = total === 0;
                    return (
                      <div className="flex items-center justify-between gap-4 p-4 mb-3.5"
                           style={{
                             borderRadius: '16px',
                             background: isZero ? '#FEF2F2' : 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
                             border: isZero ? '2px solid #FECACA' : '2px solid #86EFAC'
                           }}>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider"
                               style={{ color: isZero ? '#DC2626' : '#15803D', letterSpacing: '.06em' }}>
                            Total Available Leaves
                          </div>
                          <div className="text-[40px] font-black leading-none" style={{ color: isZero ? '#DC2626' : '#166534' }}>
                            {total}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: isZero ? '#DC2626' : '#15803D' }}>days this month</div>
                        </div>
                        <div className="flex gap-2.5">
                          <div className="text-center min-w-[68px]" style={{
                            borderRadius: '10px', padding: '10px 14px',
                            background: plR > 0 ? 'rgba(22,163,74,0.15)' : '#F3F4F6',
                            border: plR > 0 ? '1.5px solid #86EFAC' : '1.5px solid #E5E7EB'
                          }}>
                            <div className="text-xl font-black" style={{ color: plR > 0 ? '#166534' : '#9CA3AF' }}>{plR}</div>
                            <div className="text-[10px] font-semibold uppercase" style={{ color: '#6B7280', letterSpacing: '.04em', marginTop: '2px' }}>PL Days</div>
                          </div>
                          <div className="text-center min-w-[68px]" style={{
                            borderRadius: '10px', padding: '10px 14px',
                            background: elR > 0 ? '#FFFBEB' : '#F3F4F6',
                            border: elR > 0 ? '1.5px solid #FCD34D' : '1.5px solid #E5E7EB'
                          }}>
                            <div className="text-xl font-black" style={{ color: elR > 0 ? '#D97706' : '#9CA3AF' }}>{elR}</div>
                            <div className="text-[10px] font-semibold uppercase" style={{ color: '#6B7280', letterSpacing: '.04em', marginTop: '2px' }}>EL Days</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ═══ Month Tracker ═══ */}
                  {(() => {
                    const mDays = getMonthLeaveCount();
                    const leaveEnd = calcResult ? calcResult.leaveEnd : mDays;
                    return (
                      <div className="flex items-center justify-between gap-2 flex-wrap px-3.5 py-2.5 mb-3.5"
                           style={{ borderRadius: '11px', background: '#F5F3FF', border: '1.5px solid #DDD6FE' }}>
                        <span className="text-[13px] font-semibold" style={{ color: '#5B21B6' }}>
                          {calcResult
                            ? <>This will be your <strong>{toOrdinal(leaveEnd)}</strong> leave day this month</>
                            : mDays > 0
                              ? <>You have taken your <strong>{toOrdinal(mDays)}</strong> leave day this month</>
                              : 'No leaves taken this month yet'
                          }
                        </span>
                        {calcResult && mDays > 0 && (
                          <span className="text-xs" style={{ color: '#5B21B6', opacity: 0.8 }}>
                            (previously {mDays} day{mDays > 1 ? 's' : ''} taken)
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* ═══ Info Banner — zero balance warning ═══ */}
                  {leaveBalance && (() => {
                    const total = getMonthlyBalance().total;
                    if (total === 0 && calcResult) {
                      return (
                        <div className="px-3.5 py-3 text-[13px] leading-relaxed mb-3.5"
                             style={{ borderRadius: '11px', background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#7F1D1D' }}>
                          You have 0 leaves available. All {calcResult.days} day{calcResult.days > 1 ? 's' : ''} will be <strong>unpaid</strong> — salary will be deducted.
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <hr style={{ border: 'none', borderTop: '1.5px solid #F3F4F6', margin: '16px 0' }} />

                  {/* ═══ Date Row ═══ */}
                  <div className="grid grid-cols-2 gap-3 mb-3.5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase" style={{ color: '#6B7280', letterSpacing: '.05em' }}>
                        From Date <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input type="date" value={newLeave.from_date}
                        min={getISTDateYMD()}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = { ...newLeave, from_date: val };
                          if (newLeave.to_date && newLeave.to_date < val) updated.to_date = val;
                          setNewLeave(updated);
                          recalcLeave(val, updated.to_date);
                        }}
                        className="w-full px-3 py-2.5 text-sm font-medium outline-none transition"
                        style={{ border: '2px solid #E5E7EB', borderRadius: '10px', color: '#1F2937', background: '#fff', fontFamily: 'Inter, sans-serif' }}
                        onFocus={(e) => e.target.style.borderColor = '#0891B2'}
                        onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase" style={{ color: '#6B7280', letterSpacing: '.05em' }}>
                        To Date <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input type="date" value={newLeave.to_date}
                        min={newLeave.from_date || getISTDateYMD()}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewLeave({ ...newLeave, to_date: val });
                          recalcLeave(newLeave.from_date, val);
                        }}
                        className="w-full px-3 py-2.5 text-sm font-medium outline-none transition"
                        style={{ border: '2px solid #E5E7EB', borderRadius: '10px', color: '#1F2937', background: '#fff', fontFamily: 'Inter, sans-serif' }}
                        onFocus={(e) => e.target.style.borderColor = '#0891B2'}
                        onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  </div>

                  {/* ═══ Day Chips ═══ */}
                  {calcResult && calcResult.chips.length > 0 && (
                    <div className="mb-3.5">
                      <div className="flex items-center gap-2.5 mb-2 text-[10px] font-bold uppercase" style={{ color: '#9CA3AF', letterSpacing: '.07em' }}>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#16A34A' }}></span> PL</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#D97706' }}></span> EL</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#EF4444' }}></span> Unpaid</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#9CA3AF' }}></span> Sunday</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {calcResult.chips.map((chip, i) => {
                          const chipStyles = {
                            pl: { background: '#DCFCE7', color: '#166534', border: '1.5px solid #86EFAC' },
                            el: { background: '#FFFBEB', color: '#78350F', border: '1.5px solid #FCD34D' },
                            unpaid: { background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA' },
                            sunday: { background: '#F3F4F6', color: '#9CA3AF', border: '1.5px solid #E5E7EB' },
                          };
                          const cs = chipStyles[chip.type];
                          return (
                            <span key={i} className="px-2.5 py-1 text-[11px] font-semibold"
                                  style={{ ...cs, borderRadius: '6px' }}>
                              {chip.label}{chip.type === 'sunday' ? ' ✕' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ═══ Summary 3-Box ═══ */}
                  {calcResult && (
                    <div className="grid grid-cols-3 gap-2 mb-3.5">
                      <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px' }}>
                        <div className="text-[10px] font-semibold uppercase" style={{ color: '#9CA3AF', letterSpacing: '.07em' }}>Leave Duration</div>
                        <div className="text-[15px] font-extrabold mt-0.5" style={{ color: '#1F2937' }}>
                          {calcResult.days} day{calcResult.days > 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px' }}>
                        <div className="text-[10px] font-semibold uppercase" style={{ color: '#9CA3AF', letterSpacing: '.07em' }}>Paid (PL+EL)</div>
                        <div className="text-[15px] font-extrabold mt-0.5" style={{ color: '#1F2937' }}>
                          {calcResult.paidTotal > 0 ? `${calcResult.paidTotal}d` : '0'}
                        </div>
                      </div>
                      <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px' }}>
                        <div className="text-[10px] font-semibold uppercase" style={{ color: '#9CA3AF', letterSpacing: '.07em' }}>Unpaid (Deduct)</div>
                        <div className="text-[15px] font-extrabold mt-0.5">
                          {calcResult.unpaid > 0
                            ? <span style={{ color: '#DC2626', fontWeight: 800 }}>{calcResult.unpaid}d salary cut</span>
                            : <span style={{ color: '#16A34A' }}>None ✔</span>
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ═══ Reason / Remarks ═══ */}
                  <div className="flex flex-col gap-1.5 mb-3.5">
                    <label className="text-[11px] font-bold uppercase" style={{ color: '#6B7280', letterSpacing: '.05em' }}>
                      Reason / Remarks
                    </label>
                    <textarea value={newLeave.reason}
                      onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                      placeholder="Brief reason for leave..."
                      rows={3}
                      className="w-full px-3 py-2.5 text-sm font-medium outline-none transition resize-y"
                      style={{ border: '2px solid #E5E7EB', borderRadius: '10px', color: '#1F2937', minHeight: '68px', fontFamily: 'Inter, sans-serif' }}
                      onFocus={(e) => e.target.style.borderColor = '#0891B2'}
                      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </div>

                  {/* ═══ Document Section — only when unpaid > 0 ═══ */}
                  {calcResult && calcResult.needDoc && (
                    <div className="mb-3.5">
                      <div className="p-3.5" style={{ background: '#FFFBEB', border: '2px solid #FCD34D', borderRadius: '12px' }}>
                        <div className="text-[13px] font-bold mb-1" style={{ color: '#92400E' }}>⚠️ Document Required</div>
                        <div className="text-xs leading-relaxed" style={{ color: '#78350F' }}>
                          You are taking {calcResult.unpaid} extra day{calcResult.unpaid > 1 ? 's' : ''} beyond your available leaves. Supporting document is required.
                        </div>
                        <div className="text-xs font-bold mt-1.5" style={{ color: '#92400E' }}>
                          Without a document, your leave will <u>not be approved</u>.
                        </div>
                        <label className="block mt-2.5 p-4 text-center cursor-pointer transition relative"
                               style={{ border: '2px dashed #FCD34D', borderRadius: '9px', background: 'rgba(252,211,77,0.08)' }}>
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                                 onChange={(e) => setAttachmentFile(e.target.files[0])} />
                          <div className="text-xs font-bold" style={{ color: '#92400E' }}>📎 Upload Document (optional before submit)</div>
                          <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>PDF, JPG, PNG — max 5 MB</div>
                        </label>
                        {attachmentFile && (
                          <div className="text-xs font-bold mt-2" style={{ color: '#16A34A' }}>
                            ✅ {attachmentFile.name} attached
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ═══ Approver Selection — matches HTML approver-sec ═══ */}
                  {myApprovers.length > 0 ? (
                    <div className="mb-3.5">
                      <label className="text-[11px] font-bold uppercase block mb-2" style={{ color: '#6B7280', letterSpacing: '.05em' }}>
                        Send Leave Request To <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <div className="flex flex-col gap-1.5">
                        {myApprovers.map(ap => {
                          const apId = ap.id || ap._id;
                          const isSelected = selectedApproverIds.has(apId);
                          return (
                            <div key={apId}
                                 onClick={() => toggleApplyApprover(apId)}
                                 className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition select-none"
                                 style={{
                                   borderRadius: '10px',
                                   border: isSelected ? '2px solid #0891B2' : '2px solid #E5E7EB',
                                   background: isSelected ? '#ECFEFF' : '#fff',
                                 }}>
                              {/* Checkbox */}
                              <div className="w-[18px] h-[18px] flex items-center justify-center flex-shrink-0 text-[11px]"
                                   style={{
                                     borderRadius: '5px',
                                     border: isSelected ? 'none' : '2px solid #D1D5DB',
                                     background: isSelected ? '#0891B2' : '#fff',
                                     color: '#fff',
                                   }}>
                                {isSelected && '✓'}
                              </div>
                              {/* Info */}
                              <div className="flex-1">
                                <div className="text-[13px] font-bold" style={{ color: '#1F2937' }}>
                                  {ap.name || 'Unknown'}
                                </div>
                                {ap.role && (
                                  <div className="text-[11px]" style={{ color: '#9CA3AF', marginTop: '1px' }}>
                                    {ap.role}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {selectedApproverIds.size === 0 && (
                        <div className="text-[11px] font-medium mt-1.5" style={{ color: '#EF4444' }}>
                          Please select at least one approver
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mb-3.5 p-3.5" style={{ background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: '12px' }}>
                      <div className="text-[13px] font-bold mb-1" style={{ color: '#DC2626' }}>⚠️ No Approvers Configured</div>
                      <div className="text-xs leading-relaxed" style={{ color: '#991B1B' }}>
                        No leave approvers have been configured for your role. Please contact your admin to set up leave approval routing in Settings.
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer */}
                <div className="flex gap-2.5 justify-end px-6 pb-5">
                  <button onClick={() => setOpenCreateDialog(false)}
                          className="px-5 py-2.5 text-sm font-bold transition"
                          style={{ borderRadius: '10px', background: '#F3F4F6', color: '#4B5563' }}>
                    Cancel
                  </button>
                  <button onClick={handleCreateLeave}
                    disabled={!newLeave.from_date || !newLeave.to_date || !newLeave.reason.trim() || (myApprovers.length > 0 && selectedApproverIds.size === 0)}
                    className="px-5 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed"
                    style={{
                      borderRadius: '10px',
                      background: (!newLeave.from_date || !newLeave.to_date || !newLeave.reason.trim() || (myApprovers.length > 0 && selectedApproverIds.size === 0)) ? '#E5E7EB' : '#16A34A',
                      color: (!newLeave.from_date || !newLeave.to_date || !newLeave.reason.trim() || (myApprovers.length > 0 && selectedApproverIds.size === 0)) ? '#9CA3AF' : '#fff',
                      boxShadow: (!newLeave.from_date || !newLeave.to_date || !newLeave.reason.trim() || (myApprovers.length > 0 && selectedApproverIds.size === 0)) ? 'none' : '0 3px 12px rgba(22,163,74,0.3)'
                    }}>
                    Submit Application
                  </button>
                </div>
              </>
            ) : (
              /* ═══ Success Screen ═══ */
              <div className="text-center px-6 py-7">
                <div className="text-[52px] mb-2.5" style={{ animation: 'leavePopIn 0.45s cubic-bezier(.34,1.8,.64,1)' }}>✅</div>
                <div className="text-[19px] font-extrabold mb-1.5" style={{ color: '#111827' }}>Leave Application Submitted!</div>
                <p className="text-[13px] leading-relaxed mb-1.5" style={{ color: '#6B7280' }}>Your request has been sent for approval.</p>
                {calcResult && calcResult.unpaid > 0 && (
                  <div className="text-xs font-semibold mb-5" style={{ color: '#D97706' }}>
                    Note: {calcResult.unpaid} unpaid day{calcResult.unpaid > 1 ? 's' : ''} — salary will be deducted.
                  </div>
                )}
                <div className="flex gap-2.5 justify-center flex-wrap">
                  {lastSubmitData && (
                    <button onClick={() => { setOpenCreateDialog(false); handleViewLeave(lastSubmitData.id); }}
                            className="px-5 py-2.5 text-sm font-bold text-white transition"
                            style={{ borderRadius: '10px', background: '#0891B2', boxShadow: '0 3px 12px rgba(8,145,178,0.3)' }}>
                      View Details
                    </button>
                  )}
                  <button onClick={() => {
                            setShowSuccess(false);
                            setCalcResult(null);
                            setNewLeave({ leave_type: 'paid_leave', from_date: '', to_date: '', reason: '', attachments: [] });
                            setAttachmentFile(null);
                            fetchLeaveBalance();
                          }}
                          className="px-5 py-2.5 text-sm font-bold transition"
                          style={{ borderRadius: '10px', background: '#F3F4F6', color: '#374151' }}>
                    Apply Another
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ═══ VIEW LEAVE DETAIL DIALOG — matches leave-application-modal.html det-modal ═══ */}
      {openViewDialog && selectedLeave && (() => {
        // Compute paid vs unpaid for detail display
        const totalDays = selectedLeave.duration_days || 0;
        const leaveType = selectedLeave.leave_type || '';
        const isPaid = leaveType === 'paid_leave' || leaveType === 'casual_leave';
        const paidDays = isPaid ? totalDays : 0;
        const unpaidDays = isPaid ? 0 : totalDays;
        const hasAttachment = selectedLeave.attachments && selectedLeave.attachments.length > 0;

        // Helper: ordinal
        const toOrdinal = (n) => {
          const s = ['th','st','nd','rd'];
          const v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        // Status helpers
        const status = (selectedLeave.status || 'pending').toLowerCase();

        // Multi-approval: get approvers array from backend
        // Fallback: if leave has no stored approvers, show the configured approvers for this role
        const storedApprovers = selectedLeave.approvers || [];
        const approvers = storedApprovers.length > 0
          ? storedApprovers
          : myApprovers.map(a => ({ approver_id: a.id, name: a.name, role: a.role, status: 'pending' }));
        const hasMultiApproval = approvers.length > 0;
        const isCreator = selectedLeave.user_id === currentUserId;
        const approvedCount = approvers.filter(a => (a.status || '').toLowerCase() === 'approved').length;
        const rejectedCount = approvers.filter(a => (a.status || '').toLowerCase() === 'rejected').length;
        const totalApprovers = approvers.length;
        // Check if current user is one of the approvers
        const currentUserApprover = approvers.find(a => a.approver_id === currentUserId);
        const canCurrentUserAct = currentUserApprover && !isCreator && (currentUserApprover.status || '').toLowerCase() === 'pending';
        // Legacy single approver fallback
        const legacyApproverName = selectedLeave.approved_by_name || selectedLeave.rejected_by_name || null;

        return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center"
             style={{ background: 'rgba(10,5,30,0.78)', backdropFilter: 'blur(6px)' }}
             onClick={(e) => { if (e.target === e.currentTarget) setOpenViewDialog(false); }}>
          <div className="w-full max-w-[480px] max-h-[92vh] overflow-y-auto bg-white"
               style={{ borderRadius: '22px', boxShadow: '0 30px 70px rgba(0,0,0,.28)', animation: 'leaveModalUp 0.28s cubic-bezier(.34,1.4,.64,1)' }}>

            {/* det-hd */}
            <div className="flex items-center justify-between gap-3" style={{ padding: '20px 24px 0', marginBottom: '18px' }}>
              <h2 className="text-[15px] font-extrabold uppercase" style={{ color: '#16A34A', letterSpacing: '.05em' }}>
                Leave Application Details
              </h2>
              <button onClick={() => setOpenViewDialog(false)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 hover:bg-red-50 hover:text-red-500 transition"
                      style={{ background: '#F3F4F6', color: '#6B7280' }}>✕</button>
            </div>

            {/* det-bd */}
            <div style={{ padding: '0 24px' }}>

              {/* Row 1: Employee Name + Applied On */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="flex flex-col" style={{ gap: '5px' }}>
                  <div className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Employee Name</div>
                  <div className="flex items-center" style={{ border: '2px solid #67E8F9', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#1F2937', minHeight: '38px', background: '#fff' }}>
                    {selectedLeave.employee_name || 'Unknown'}
                  </div>
                </div>
                <div className="flex flex-col" style={{ gap: '5px' }}>
                  <div className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Applied On</div>
                  <div className="flex items-center" style={{ border: '2px solid #67E8F9', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#1F2937', minHeight: '38px', background: '#fff' }}>
                    {formatDate(selectedLeave.created_at)}
                  </div>
                </div>
              </div>

              {/* Row 2: From + To */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="flex flex-col" style={{ gap: '5px' }}>
                  <div className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>From Date</div>
                  <div className="flex items-center" style={{ border: '2px solid #67E8F9', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#1F2937', minHeight: '38px', background: '#fff' }}>
                    {formatDate(selectedLeave.from_date)}
                  </div>
                </div>
                <div className="flex flex-col" style={{ gap: '5px' }}>
                  <div className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>To Date</div>
                  <div className="flex items-center" style={{ border: '2px solid #67E8F9', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#1F2937', minHeight: '38px', background: '#fff' }}>
                    {formatDate(selectedLeave.to_date)}
                  </div>
                </div>
              </div>

              {/* Row 3: Duration + Leave of This Month (ordinal badge) */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="flex flex-col" style={{ gap: '5px' }}>
                  <div className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Leave Duration</div>
                  <div className="flex items-center" style={{ border: '2px solid #67E8F9', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#1F2937', minHeight: '38px', background: '#fff' }}>
                    {totalDays} day{totalDays > 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex flex-col" style={{ gap: '5px' }}>
                  <div className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Leave of This Month</div>
                  <div className="flex items-center" style={{ border: '2px solid #67E8F9', borderRadius: '9px', padding: '9px 12px', minHeight: '38px', background: '#fff' }}>
                    <span className="inline-flex items-center gap-1.5" style={{ background: '#F5F3FF', border: '1.5px solid #DDD6FE', borderRadius: '7px', padding: '4px 10px', fontSize: '12px', fontWeight: 700, color: '#7C3AED' }}>
                      {toOrdinal(totalDays)} leave day
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 4: Paid Days + Salary Deduction */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="flex flex-col" style={{ gap: '5px' }}>
                  <div className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Paid Days ✔</div>
                  <div className="flex items-center" style={{ border: '2px solid #67E8F9', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, minHeight: '38px', background: '#fff' }}>
                    {paidDays > 0
                      ? <span style={{ color: '#166534', fontWeight: 800 }}>{paidDays} day{paidDays > 1 ? 's' : ''} — paid ✔</span>
                      : <span style={{ color: '#9CA3AF' }}>—</span>
                    }
                  </div>
                </div>
                <div className="flex flex-col" style={{ gap: '5px' }}>
                  <div className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Salary Deduction</div>
                  <div className="flex items-center" style={{ border: '2px solid #67E8F9', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, minHeight: '38px', background: '#fff' }}>
                    {unpaidDays > 0
                      ? <span style={{ color: '#DC2626', fontWeight: 800 }}>{unpaidDays} day{unpaidDays > 1 ? 's' : ''} salary cut ⚠</span>
                      : <span style={{ color: '#16A34A', fontWeight: 700 }}>None ✔</span>
                    }
                  </div>
                </div>
              </div>

              {/* Full-width: Reason / Remarks */}
              <div className="flex flex-col mb-3" style={{ gap: '5px' }}>
                <div className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Reason / Remarks</div>
                <div className="flex items-start" style={{ border: '2px solid #67E8F9', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#1F2937', minHeight: '64px', background: '#fff', whiteSpace: 'pre-wrap' }}>
                  {selectedLeave.reason || '—'}
                </div>
              </div>

              {/* Document Status Row */}
              {(hasAttachment || status === 'pending') && (
                <div className="mb-3">
                  <div className="text-[11px] font-semibold mb-1.5" style={{ color: '#6B7280' }}>Document</div>
                  {hasAttachment ? (
                    <div className="flex items-center gap-2" style={{ borderRadius: '9px', padding: '10px 13px', fontSize: '12px', fontWeight: 600, background: '#DCFCE7', color: '#166534', border: '1.5px solid #86EFAC' }}>
                      ✔ Document uploaded
                      {selectedLeave.attachments.map((att, i) => (
                        <button key={i} onClick={() => handleDownloadAttachment(att)}
                                className="ml-1 px-2 py-1 rounded text-xs font-bold transition hover:opacity-80"
                                style={{ background: '#16A34A', color: '#fff' }}>
                          📎 {att.filename || `File ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2" style={{ borderRadius: '9px', padding: '10px 13px', fontSize: '12px', fontWeight: 600, background: '#FFFBEB', color: '#92400E', border: '1.5px solid #FCD34D' }}>
                      ⚠️ Document not uploaded — leave may be rejected
                    </div>
                  )}
                </div>
              )}

              {/* Rejection Reason */}
              {selectedLeave.rejection_reason && (
                <div className="flex flex-col mb-3" style={{ gap: '5px' }}>
                  <div className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Rejection Reason</div>
                  <div className="flex items-start" style={{ border: '2px solid #FECACA', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#991B1B', background: '#FEF2F2', minHeight: '38px', whiteSpace: 'pre-wrap' }}>
                    {selectedLeave.rejection_reason}
                  </div>
                </div>
              )}

              {/* Approval Comments */}
              {selectedLeave.approval_comments && (
                <div className="flex flex-col mb-3" style={{ gap: '5px' }}>
                  <div className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>
                    {status === 'approved' ? 'Approval Comments' : 'Comments'}
                  </div>
                  <div className="flex items-start" style={{ border: '2px solid #86EFAC', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#166534', background: '#DCFCE7', minHeight: '38px', whiteSpace: 'pre-wrap' }}>
                    {selectedLeave.approval_comments}
                  </div>
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1.5px solid #F3F4F6', margin: '12px 0' }} />

              {/* ═══ MULTI-APPROVER STATUS TABLE ═══ */}
              <div className="text-[11px] font-semibold mb-2" style={{ color: '#6B7280' }}>Approval Status</div>
              <table className="w-full mb-1" style={{ borderCollapse: 'collapse', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid #E5E7EB' }}>
                <thead>
                  <tr>
                    <th className="text-left" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6B7280', padding: '8px 12px', background: '#F9FAFB' }}>Approver</th>
                    <th className="text-left" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6B7280', padding: '8px 12px', background: '#F9FAFB' }}>Role</th>
                    <th className="text-center" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6B7280', padding: '8px 12px', background: '#F9FAFB' }}>Status</th>
                    <th className="text-center" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6B7280', padding: '8px 12px', background: '#F9FAFB' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {hasMultiApproval ? approvers.map((apr, idx) => {
                    const aprStatus = (apr.status || 'pending').toLowerCase();
                    const isCurrentUserRow = apr.approver_id === currentUserId;
                    const canAct = isCurrentUserRow && !isCreator && aprStatus === 'pending';
                    return (
                      <tr key={apr.approver_id || idx} style={{ background: isCurrentUserRow ? '#FFFBEB' : '#fff' }}>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid #F3F4F6', fontSize: '13px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 700, color: '#1F2937' }}>
                            {apr.name || 'Unknown'}
                            {isCurrentUserRow && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>You</span>}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid #F3F4F6', fontSize: '12px', verticalAlign: 'middle', color: '#6B7280' }}>
                          {apr.role || '—'}
                        </td>
                        <td className="text-center" style={{ padding: '10px 12px', borderTop: '1px solid #F3F4F6', fontSize: '13px', verticalAlign: 'middle' }}>
                          {aprStatus === 'approved' ? (
                            <span className="inline-block px-2.5 py-0.5 font-bold text-xs" style={{ borderRadius: '999px', background: '#DCFCE7', color: '#166534' }}>✔ Approved</span>
                          ) : aprStatus === 'rejected' ? (
                            <span className="inline-block px-2.5 py-0.5 font-bold text-xs" style={{ borderRadius: '999px', background: '#FEF2F2', color: '#991B1B' }}>✖ Rejected</span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 font-bold text-xs" style={{ borderRadius: '999px', background: '#FFFBEB', color: '#92400E' }}>⏳ Pending</span>
                          )}
                        </td>
                        <td className="text-center" style={{ padding: '10px 12px', borderTop: '1px solid #F3F4F6', fontSize: '13px', verticalAlign: 'middle' }}>
                          {canAct ? (
                            <div className="flex gap-1.5 justify-center">
                              <button onClick={() => { setOpenViewDialog(false); openApprovalDialogHandler(selectedLeave, 'approved'); }}
                                      className="text-xs font-bold px-3 py-1 transition hover:opacity-80"
                                      style={{ borderRadius: '7px', background: '#DCFCE7', color: '#166534', border: '1.5px solid #86EFAC' }}>Approve</button>
                              <button onClick={() => { setOpenViewDialog(false); openApprovalDialogHandler(selectedLeave, 'rejected'); }}
                                      className="text-xs font-bold px-3 py-1 transition hover:opacity-80"
                                      style={{ borderRadius: '7px', background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA' }}>Reject</button>
                            </div>
                          ) : aprStatus !== 'pending' ? (
                            <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>
                          ) : isCreator ? (
                            <span className="text-[10px] font-semibold" style={{ color: '#9CA3AF' }}>Own leave</span>
                          ) : (
                            <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    /* Legacy single approver fallback for older leaves */
                    <tr>
                      <td style={{ padding: '10px 12px', borderTop: '1px solid #F3F4F6', fontSize: '13px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: '#1F2937' }}>{legacyApproverName || '—'}</div>
                      </td>
                      <td style={{ padding: '10px 12px', borderTop: '1px solid #F3F4F6', fontSize: '12px', color: '#6B7280' }}>—</td>
                      <td className="text-center" style={{ padding: '10px 12px', borderTop: '1px solid #F3F4F6', fontSize: '13px', verticalAlign: 'middle' }}>
                        {status === 'approved' ? (
                          <span className="inline-block px-2.5 py-0.5 font-bold text-xs" style={{ borderRadius: '999px', background: '#DCFCE7', color: '#166534' }}>✔ Approved</span>
                        ) : status === 'rejected' ? (
                          <span className="inline-block px-2.5 py-0.5 font-bold text-xs" style={{ borderRadius: '999px', background: '#FEF2F2', color: '#991B1B' }}>✖ Rejected</span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 font-bold text-xs" style={{ borderRadius: '999px', background: '#FFFBEB', color: '#92400E' }}>⏳ Pending</span>
                        )}
                      </td>
                      <td className="text-center" style={{ padding: '10px 12px', borderTop: '1px solid #F3F4F6', fontSize: '13px', color: '#9CA3AF' }}>
                        {status === 'pending' ? 'Awaiting…' : '—'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Final Status Bar with approval counts */}
              <div className="text-center text-sm font-extrabold py-3 mb-1"
                   style={{
                     borderRadius: '10px',
                     marginTop: '4px',
                     ...(status === 'approved'
                       ? { background: '#DCFCE7', color: '#166534', border: '1.5px solid #86EFAC' }
                       : status === 'rejected'
                         ? { background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA' }
                         : { background: '#FFFBEB', color: '#92400E', border: '1.5px solid #FCD34D' })
                   }}>
                {status === 'approved'
                  ? `✔ APPROVED — All approvers confirmed${hasMultiApproval ? ` (${approvedCount}/${totalApprovers})` : ''}`
                  : status === 'rejected'
                    ? `✖ REJECTED — ${hasMultiApproval ? `${rejectedCount}/${totalApprovers} rejected` : 'Approver rejected'}`
                    : `⏳ PENDING — Awaiting approvals${hasMultiApproval ? ` (${approvedCount}/${totalApprovers} approved)` : ''}`}
              </div>
            </div>

            {/* det-ft: Action Buttons — only for approvers who can act, NOT for creator */}
            <div style={{ padding: '14px 24px 22px' }}>
              {canCurrentUserAct && status === 'pending' ? (
                <div className="flex gap-2.5">
                  <button onClick={() => { setOpenViewDialog(false); openApprovalDialogHandler(selectedLeave, 'approved'); }}
                          className="flex-1 px-4 py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 transition hover:opacity-90"
                          style={{ borderRadius: '10px', background: '#16A34A', boxShadow: '0 3px 12px rgba(22,163,74,0.3)' }}>
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => { setOpenViewDialog(false); openApprovalDialogHandler(selectedLeave, 'rejected'); }}
                          className="flex-1 px-4 py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 transition hover:opacity-90"
                          style={{ borderRadius: '10px', background: '#DC2626', boxShadow: '0 3px 12px rgba(220,38,38,0.3)' }}>
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              ) : (
                <button onClick={() => setOpenViewDialog(false)}
                        className="w-full px-4 py-2.5 text-sm font-bold transition hover:opacity-90"
                        style={{ borderRadius: '10px', background: '#F3F4F6', color: '#4B5563' }}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}

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

      {/* ═══ LEAVE APPROVAL SETTINGS MODAL — Enterprise CRM Style ═══ */}
      {openSettingsModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center" style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.5)' }}>
          <div className="relative bg-white w-full max-w-5xl mx-4 overflow-hidden"
               style={{ borderRadius: '16px', animation: 'leaveModalUp 0.3s ease-out', boxShadow: '0 25px 80px rgba(0,0,0,0.25)', height: '85vh', display: 'flex', flexDirection: 'column' }}>

            {/* ── Top Bar ── */}
            <div className="flex items-center justify-between px-6 py-3.5 shrink-0"
                 style={{ background: '#1E293B', borderBottom: '2px solid #334155' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F97316' }}>
                  <SettingsIcon style={{ color: '#fff', fontSize: '18px' }} />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-white tracking-wide">Leave Approval Routing</h2>
                  <div className="text-[11px] text-slate-400">Configure which employees approve leaves for each role</div>
                </div>
              </div>
              <button onClick={() => { setOpenSettingsModal(false); setSettingsRoleSearch(''); setSettingsEmpSearch(''); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition">
                <X style={{ fontSize: '18px' }} />
              </button>
            </div>

            {/* ── Main Content — 2 Column Layout ── */}
            <div className="flex flex-1 overflow-hidden">

              {/* ═══ LEFT PANEL — Roles List ═══ */}
              <div className="shrink-0 flex flex-col" style={{ width: '260px', borderRight: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                {/* Role search */}
                <div className="px-3 py-3 shrink-0" style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <div className="relative">
                    <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#94A3B8' }} />
                    <input
                      type="text"
                      placeholder="Search roles..."
                      value={settingsRoleSearch}
                      onChange={e => setSettingsRoleSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs font-medium"
                      style={{ borderRadius: '8px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#1E293B', outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#F97316'}
                      onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                    />
                  </div>
                </div>

                {/* Role list */}
                <div className="flex-1 overflow-y-auto py-1">
                  {allRoles
                    .filter(r => !settingsRoleSearch || (r.name || '').toLowerCase().includes(settingsRoleSearch.toLowerCase()))
                    .map(role => {
                      const roleId = role.id || role._id;
                      const isActive = settingsSelectedRole === roleId;
                      const route = approvalRoutes.find(r => r.role_id === roleId);
                      const approverCount = route ? (route.approver_ids || []).length : 0;
                      return (
                        <button key={roleId} type="button"
                                onClick={() => handleSettingsRoleSelect(roleId)}
                                className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 transition-all"
                                style={{
                                  background: isActive ? '#fff' : 'transparent',
                                  borderLeft: isActive ? '3px solid #F97316' : '3px solid transparent',
                                  borderBottom: '1px solid #F1F5F9',
                                }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                               style={{
                                 background: isActive ? '#FFF7ED' : '#F1F5F9',
                                 color: isActive ? '#EA580C' : '#64748B',
                                 border: isActive ? '1.5px solid #FDBA74' : '1.5px solid #E2E8F0',
                               }}>
                            {(role.name || 'R').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate" style={{ color: isActive ? '#EA580C' : '#334155' }}>
                              {role.name || 'Unnamed'}
                            </div>
                            {approverCount > 0 && (
                              <div className="text-[10px] font-medium" style={{ color: '#16A34A' }}>
                                {approverCount} approver{approverCount > 1 ? 's' : ''}
                              </div>
                            )}
                            {approverCount === 0 && (
                              <div className="text-[10px]" style={{ color: '#94A3B8' }}>Not configured</div>
                            )}
                          </div>
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#F97316' }}></div>
                          )}
                        </button>
                      );
                    })}
                  {allRoles.length === 0 && (
                    <div className="text-xs text-center py-8" style={{ color: '#94A3B8' }}>Loading roles...</div>
                  )}
                  {allRoles.length > 0 && allRoles.filter(r => !settingsRoleSearch || (r.name || '').toLowerCase().includes(settingsRoleSearch.toLowerCase())).length === 0 && (
                    <div className="text-xs text-center py-6" style={{ color: '#94A3B8' }}>No roles match "{settingsRoleSearch}"</div>
                  )}
                </div>
              </div>

              {/* ═══ RIGHT PANEL — Approver Config ═══ */}
              <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#fff' }}>

                {!settingsSelectedRole ? (
                  /* Empty state */
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#F1F5F9' }}>
                      <Users style={{ fontSize: '28px', color: '#94A3B8' }} />
                    </div>
                    <div className="text-sm font-semibold" style={{ color: '#64748B' }}>Select a Role</div>
                    <div className="text-xs text-center max-w-[260px]" style={{ color: '#94A3B8' }}>
                      Choose a role from the left panel to configure which employees can approve leave requests for that role.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Right panel header */}
                    <div className="px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg text-white" style={{ background: '#F97316' }}>
                              {allRoles.find(r => (r.id || r._id) === settingsSelectedRole)?.name || 'Role'}
                            </span>
                            <span className="text-[11px]" style={{ color: '#94A3B8' }}>→ Approvers</span>
                          </div>
                          <div className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>
                            Employees of this role will send leave requests to the selected approvers below
                          </div>
                        </div>
                        {/* Existing route indicator */}
                        {approvalRoutes.find(r => r.role_id === settingsSelectedRole) && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold"
                               style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                            <CheckCircle style={{ fontSize: '12px' }} /> Configured
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected approvers chips */}
                    {settingsSelectedApprovers.length > 0 && (
                      <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
                        <div className="text-[10px] font-bold uppercase mb-2" style={{ color: '#64748B', letterSpacing: '.06em' }}>
                          Selected Approvers ({settingsSelectedApprovers.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {settingsSelectedApprovers.map(empId => {
                            const emp = allEmployees.find(e => (e.id || e._id || e.user_id) === empId);
                            const empName = emp ? (emp.name || emp.full_name || 'Unknown') : 'Unknown';
                            const empDesig = emp?.designation || '';
                            return (
                              <span key={empId}
                                    className="inline-flex items-center gap-2 pl-1.5 pr-1.5 py-1.5 text-xs font-semibold group"
                                    style={{ borderRadius: '10px', background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                                <span className="w-6 h-6 flex items-center justify-center rounded-lg text-white text-[10px] font-bold"
                                      style={{ background: '#3B82F6' }}>
                                  {empName.charAt(0).toUpperCase()}
                                </span>
                                <span className="flex flex-col leading-tight">
                                  <span className="text-[11px] font-semibold">{empName}</span>
                                  {empDesig && <span className="text-[9px] font-normal" style={{ color: '#6B7280' }}>{empDesig}</span>}
                                </span>
                                <button type="button" onClick={() => toggleSettingsApprover(empId)}
                                        className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-red-100 transition ml-1"
                                        style={{ color: '#94A3B8', fontSize: '14px' }}>×</button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Employee search */}
                    <div className="px-5 pt-3 pb-2 shrink-0">
                      <div className="relative">
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#94A3B8' }} />
                        <input
                          type="text"
                          placeholder="Search employees by name or designation..."
                          value={settingsEmpSearch}
                          onChange={e => setSettingsEmpSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 text-xs font-medium"
                          style={{ borderRadius: '10px', border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#1E293B', outline: 'none' }}
                          onFocus={e => { e.target.style.borderColor = '#3B82F6'; e.target.style.background = '#fff'; }}
                          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.background = '#F8FAFC'; }}
                        />
                      </div>
                    </div>

                    {/* Employee list */}
                    <div className="flex-1 overflow-y-auto px-5 pb-3">
                      {(() => {
                        const filtered = allEmployees.filter(emp => {
                          if (!settingsEmpSearch) return true;
                          const q = settingsEmpSearch.toLowerCase();
                          const name = (emp.name || emp.full_name || '').toLowerCase();
                          const desig = (emp.designation || '').toLowerCase();
                          return name.includes(q) || desig.includes(q);
                        });
                        if (filtered.length === 0) {
                          return (
                            <div className="text-xs text-center py-10" style={{ color: '#94A3B8' }}>
                              {settingsEmpSearch ? `No employees match "${settingsEmpSearch}"` : 'Loading employees...'}
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-col gap-1">
                            {filtered.map(emp => {
                              const empId = emp.id || emp._id || emp.user_id;
                              const isChecked = settingsSelectedApprovers.includes(empId);
                              const empName = emp.name || emp.full_name || 'Unknown';
                              return (
                                <div key={empId}
                                     onClick={() => toggleSettingsApprover(empId)}
                                     className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-all"
                                     style={{
                                       borderRadius: '10px',
                                       background: isChecked ? '#EFF6FF' : 'transparent',
                                       border: isChecked ? '1.5px solid #93C5FD' : '1.5px solid transparent',
                                     }}
                                     onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = '#F8FAFC'; }}
                                     onMouseLeave={e => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}>
                                  {/* Checkbox */}
                                  <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition"
                                       style={{
                                         border: isChecked ? 'none' : '2px solid #CBD5E1',
                                         background: isChecked ? '#3B82F6' : '#fff',
                                       }}>
                                    {isChecked && <span className="text-white text-[11px] font-bold">✓</span>}
                                  </div>
                                  {/* Avatar */}
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                                       style={{
                                         background: isChecked ? '#DBEAFE' : '#F1F5F9',
                                         color: isChecked ? '#1D4ED8' : '#64748B',
                                       }}>
                                    {empName.charAt(0).toUpperCase()}
                                  </div>
                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold truncate" style={{ color: isChecked ? '#1E40AF' : '#334155' }}>
                                      {empName}
                                    </div>
                                    {emp.designation && (
                                      <div className="text-[10px] truncate" style={{ color: '#94A3B8' }}>{emp.designation}</div>
                                    )}
                                  </div>
                                  {isChecked && (
                                    <div className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                         style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                                      Approver
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Bottom Bar ── */}
            <div className="flex items-center justify-between px-5 py-3 shrink-0"
                 style={{ borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div className="text-[11px]" style={{ color: '#94A3B8' }}>
                {approvalRoutes.length} route{approvalRoutes.length !== 1 ? 's' : ''} configured
              </div>
              <div className="flex gap-2.5">
                {settingsSelectedRole && approvalRoutes.find(r => r.role_id === settingsSelectedRole) && (
                  <button onClick={() => handleDeleteApprovalRoute(settingsSelectedRole)}
                          className="px-4 py-2 text-xs font-bold transition"
                          style={{ borderRadius: '8px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                    Delete Route
                  </button>
                )}
                <button onClick={() => { setOpenSettingsModal(false); setSettingsRoleSearch(''); setSettingsEmpSearch(''); }}
                        className="px-4 py-2 text-xs font-bold transition"
                        style={{ borderRadius: '8px', background: '#F1F5F9', color: '#475569' }}>
                  Cancel
                </button>
                <button onClick={handleSaveApprovalRoute}
                        disabled={!settingsSelectedRole || settingsSelectedApprovers.length === 0 || settingsSaving}
                        className="px-5 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed"
                        style={{
                          borderRadius: '8px',
                          background: (!settingsSelectedRole || settingsSelectedApprovers.length === 0 || settingsSaving)
                            ? '#E2E8F0' : 'linear-gradient(135deg, #F97316, #EA580C)',
                          color: (!settingsSelectedRole || settingsSelectedApprovers.length === 0 || settingsSaving) ? '#94A3B8' : '#fff',
                          boxShadow: (!settingsSelectedRole || settingsSelectedApprovers.length === 0 || settingsSaving)
                            ? 'none' : '0 2px 8px rgba(249,115,22,0.3)',
                        }}>
                  {settingsSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
