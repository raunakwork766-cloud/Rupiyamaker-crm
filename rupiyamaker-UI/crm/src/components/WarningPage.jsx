import React, { useState, useEffect, memo, useRef } from 'react';
import { format } from 'date-fns';
import { 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  TrendingUp, 
  BarChart3, 
  Filter, 
  X, 
  Download, 
  Users, 
  Building, 
  Calendar, 
  DollarSign, 
  Tag, 
  Search,
  User,
  FileText,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  FolderPlus,
  Send,
  BellRing,
  Eye,
  Smartphone,
  CheckCircle2,
  Clock,
  Info
} from 'lucide-react';

// Import simplified permission system
import { 
  getPermissionLevel, 
  canViewAll, 
  canViewJunior, 
  canViewOwn,
  canCreate, 
  canEdit, 
  canDelete,
  getPermissionDisplayText,
  getCurrentUserId,
  hasWarningsPermission
} from '../utils/permissions';

const API_URL = "/api";

const WarningPage = memo(() => {
  // CSS styles for sticky headers
  const stickyHeaderStyles = `
    .sticky-table-container {
      max-height: 600px;
      overflow-y: auto;
      overflow-x: auto;
      border-radius: 12px;
    }
    
    .sticky-header {
      position: sticky;
      top: 0;
      background: white;
      z-index: 10;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .sticky-th {
      position: sticky;
      top: 0;
      background: white;
      z-index: 10;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .similar-warnings-row:nth-child(even) {
      background-color: #f9fafb;
    }
    
    .similar-warnings-row:nth-child(odd) {
      background-color: #ffffff;
    }
    
    .similar-warnings-row:hover {
      background-color: #f3f4f6 !important;
    }
  `;

  // State management
  const [warnings, setWarnings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [warningTypes, setWarningTypes] = useState([]);
  const [mistakeTypes, setMistakeTypes] = useState([]);
  const [warningActions, setWarningActions] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [stats, setStats] = useState({});
  const [rankings, setRankings] = useState([]);
  const [renderError, setRenderError] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalWarnings, setTotalWarnings] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Employee search states
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  
  // Department search states
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [selectedDepartmentName, setSelectedDepartmentName] = useState('');
  
  // Warning type search states
  const [warningTypeSearchTerm, setWarningTypeSearchTerm] = useState('');
  const [showWarningTypeDropdown, setShowWarningTypeDropdown] = useState(false);
  const [selectedWarningTypeName, setSelectedWarningTypeName] = useState('');
  
  // Warning action search states
  const [showWarningActionDropdown, setShowWarningActionDropdown] = useState(false);
  const [selectedWarningActionName, setSelectedWarningActionName] = useState('');
  const [warningActionSearchTerm, setWarningActionSearchTerm] = useState('');
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('warningType');
  
  // Form states
  const [formData, setFormData] = useState({
    warning_type: '',
    issued_to: [], // Changed to array for multi-select
    penalty_amount: '',
    warning_message: ''
  });
  const [selectedDepartmentForAdd, setSelectedDepartmentForAdd] = useState('');
  const [editingWarning, setEditingWarning] = useState(null);
  
  // Multi-select employee states
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedEmployeeNames, setSelectedEmployeeNames] = useState([]);
  const [selectedWarning, setSelectedWarning] = useState(null);
  const [warningToDelete, setWarningToDelete] = useState(null);
  
  // Dropdown refs for click outside detection
  const employeeDropdownRef = useRef(null);
  const departmentDropdownRef = useRef(null);
  const warningTypeDropdownRef = useRef(null);
  const warningActionDropdownRef = useRef(null);
  
  // Table horizontal scroll controls - matching LeadCRM.jsx
  const tableScrollRef = useRef(null);
  const rankingTableScrollRef = useRef(null);
  const myWarningsTableScrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [rankingCanScrollLeft, setRankingCanScrollLeft] = useState(false);
  const [rankingCanScrollRight, setRankingCanScrollRight] = useState(false);
  const [myWarningsCanScrollLeft, setMyWarningsCanScrollLeft] = useState(false);
  const [myWarningsCanScrollRight, setMyWarningsCanScrollRight] = useState(false);
  
  // File attachment states
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Select button states
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    department_id: '',
    employee_id: '',
    warning_type: '',
    start_date: null,
    end_date: null,
    penalty_amount_min: '',
    penalty_amount_max: '',
    penalty_amount_sort: '' // none, asc, desc
  });
  
  // Filter search states
  const [filterSearchTerms, setFilterSearchTerms] = useState({
    warningType: '',
    department: '',
    employee: ''
  });

  // Filter dropdown focus states
  const [filterDropdownFocus, setFilterDropdownFocus] = useState({
    warningType: false,
    department: false,
    employee: false
  });
  
  // Notification states
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Table horizontal scroll functions - exactly from LeadCRM.jsx
  const scrollTable = (direction, tableRef, setCanLeft, setCanRight) => {
    if (tableRef.current) {
      const scrollAmount = 300;
      const currentScroll = tableRef.current.scrollLeft;
      const newScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      tableRef.current.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
      
      // Update scroll buttons after scrolling
      setTimeout(() => {
        updateScrollButtons(tableRef, setCanLeft, setCanRight);
      }, 100);
    }
  };

  const updateScrollButtons = (tableRef, setCanLeft, setCanRight) => {
    if (tableRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableRef.current;
      setCanLeft(scrollLeft > 0);
      setCanRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  // Specific scroll functions for each table
  const scrollMainTable = (direction) => scrollTable(direction, tableScrollRef, setCanScrollLeft, setCanScrollRight);
  const scrollRankingTable = (direction) => scrollTable(direction, rankingTableScrollRef, setRankingCanScrollLeft, setRankingCanScrollRight);
  const scrollMyWarningsTable = (direction) => scrollTable(direction, myWarningsTableScrollRef, setMyWarningsCanScrollLeft, setMyWarningsCanScrollRight);

  // Similar warnings state
  const [similarWarnings, setSimilarWarnings] = useState([]);
  const [showingSimilarWarnings, setShowingSimilarWarnings] = useState(false);

  // Mistakes Directory state
  const [mistakeDirectorySearch, setMistakeDirectorySearch] = useState('');
  const [createMistakeOpen, setCreateMistakeOpen] = useState(false);
  const [newMistakeTitle, setNewMistakeTitle] = useState('');
  const [newMistakeDescription, setNewMistakeDescription] = useState('');
  const [editMistakeOpen, setEditMistakeOpen] = useState(false);
  const [editingMistakeType, setEditingMistakeType] = useState(null);
  const [editMistakeTitle, setEditMistakeTitle] = useState('');
  const [editMistakeDescription, setEditMistakeDescription] = useState('');

  // Employee App View modal state
  const [employeeAppViewOpen, setEmployeeAppViewOpen] = useState(false);

  // Waived penalties tracking (local state - maps warning id to waived status)
  const [waivedPenalties, setWaivedPenalties] = useState({});

  // Get current user ID
  const getCurrentUserId = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const { user_id } = JSON.parse(userData);
        return user_id;
      } catch (error) {
      }
    }
    return null;
  };

  // Get current user role information
  const getCurrentUserRole = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        return {
          role_id: parsed.role_id,
          role_name: parsed.role_name,
          user_id: parsed.user_id
        };
      } catch (error) {
      }
    }
    return null;
  };

  // Get current user's full name
  const getCurrentUserFullName = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        // Try different possible name fields in order of preference
        return parsed.full_name || 
               parsed.name || 
               `${parsed.first_name || ''} ${parsed.last_name || ''}`.trim() || 
               parsed.username || 
               'Unknown User';
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    return 'Unknown User';
  };

  // Simplified permission checking using new 3-type system
  const permissionLevel = getPermissionLevel('warnings');
  const currentUserId = getCurrentUserId();
  
  // Permission check functions
  const canUserViewAll = () => canViewAll('warnings');
  const canUserViewJunior = () => canViewJunior('warnings');  
  const canUserViewOwn = () => canViewOwn('warnings');
  const canUserCreate = () => canCreate('warnings');
  const canUserEdit = (recordOwnerId) => canEdit('warnings', recordOwnerId);
  const canUserDelete = (recordOwnerId) => canDelete('warnings', recordOwnerId);

  // Legacy compatibility functions
  const isSuperAdmin = () => canUserViewAll();
  const isManager = () => canUserViewJunior();
  const hasOwnPermission = () => canUserViewOwn();

  /**
   * STRICT action checker for warnings granular permissions.
   * Checks ONLY for the exact specific action in the user's permissions array.
   * Does NOT treat 'all' (view-all scope) as a wildcard — 'all' in warnings means
   * "view all warnings", not "all capabilities". Only a true global '*' wildcard passes.
   */
  const hasStrictWarningsAction = (action) => {
    try {
      const userPerms = JSON.parse(localStorage.getItem('userPermissions') || '[]');
      // Handle object-format super admin permissions (e.g. {"*": "*"}, {Global: "*"})
      if (!Array.isArray(userPerms)) {
        if (typeof userPerms === 'object' && userPerms !== null &&
            (userPerms['*'] === '*' || userPerms.Global === '*' || userPerms.global === '*')) {
          return true;
        }
        return false;
      }
      // Check for global super-admin ('*') first
      const isGlobalAdmin = userPerms.some(p =>
        (p.page === '*' || p.page === 'any' || p.page === 'Global') &&
        (p.actions === '*' || (Array.isArray(p.actions) && p.actions.includes('*')))
      );
      if (isGlobalAdmin) return true;
      // Find the warnings-specific entry and check for the exact action
      const warningPerm = userPerms.find(p => p.page?.toLowerCase() === 'warnings');
      if (!warningPerm) return false;
      const actions = warningPerm.actions;
      if (Array.isArray(actions)) {
        return actions.includes(action) || actions.includes('*');
      }
      return actions === action || actions === '*';
    } catch {
      return false;
    }
  };

  // Granular warning action permission helpers — use strict (exact) action check only
  const canIssueWarning = () => hasStrictWarningsAction('issue');
  const canViewMistakeDirectory = () => hasStrictWarningsAction('view_mistakes');
  const canCreateMistakeCategory = () => hasStrictWarningsAction('create_mistake');
  const canEditMistakeCategory = () => hasStrictWarningsAction('edit_mistake');
  const canDeleteMistakeCategory = () => hasStrictWarningsAction('delete_mistake');

  // Get auth headers
  const getAuthHeaders = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        const access_token = parsed.access_token || parsed.token;
        if (access_token && access_token !== 'undefined') {
          return {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          };
        }
      } catch (error) {
      }
    }
    return {
      'Content-Type': 'application/json'
    };
  };

  // Show notification
  const showNotification = (message, severity = 'info') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };

  // Check user permissions using simplified 3-type system
  const checkUserPermissions = () => {
    const permLevel = getPermissionLevel('warnings');
    
    // UPDATED: Add explicit delete permission check (like Tickets)
    const hasDeletePermission = () => {
      // Use strict action check - 'all' (view scope) does NOT grant delete
      return hasStrictWarningsAction('delete');
    };
    
    const permissions = {
      can_view_own: true, // Everyone can view their own records
      can_view_all: canUserViewAll(),
      can_view_team: canUserViewJunior(),
      can_add: canUserCreate(),
      // Edit requires explicit 'issue' action (same permission as issuing/creating warnings)
      // View scope ('all'/'junior') does NOT automatically grant edit capability
      can_edit: hasStrictWarningsAction('issue'),
      can_delete: hasDeletePermission(), // Check explicit delete permission
      can_export: canUserViewJunior(), // Junior and All can export
      permission_level: permLevel, // Store the permission level for use elsewhere
      // Granular warning action permissions
      can_issue_warning: canIssueWarning(),
      can_view_mistakes: canViewMistakeDirectory(),
      can_create_mistake_category: canCreateMistakeCategory(),
      can_edit_mistake_category: canEditMistakeCategory(),
      can_delete_mistake_category: canDeleteMistakeCategory(),
    };
    
    console.log('⚠️ Warning Permissions:', permissions);
    return permissions;
  };

  // Load initial data
  useEffect(() => {
    const userId = getCurrentUserId();
    if (!userId) {
      showNotification('User not authenticated. Please log in again.', 'error');
      return;
    }
    
    const userPermissions = checkUserPermissions();
    setPermissions(userPermissions);
    loadWarningTypes();
    loadMistakeTypes();
    loadWarningActions();
    loadEmployees();
    loadDepartments();
    loadWarnings();
    loadRankings();
  }, []);

  // Listen for permission changes (like Tickets)
  useEffect(() => {
    const handlePermissionUpdate = () => {
      console.log('🔄 Warnings - Permissions updated, reloading...');
      const userPermissions = checkUserPermissions();
      setPermissions(userPermissions);
    };
    
    window.addEventListener('permissionsUpdated', handlePermissionUpdate);
    
    return () => {
      window.removeEventListener('permissionsUpdated', handlePermissionUpdate);
    };
  }, []);

  // Load data when filters or pagination change
  useEffect(() => {
    loadWarnings();
    loadRankings();
  }, [filters, page, rowsPerPage, selectedTab]);

  useEffect(() => {
  }, [stats]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check each dropdown individually
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false);
      }
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target)) {
        setShowDepartmentDropdown(false);
      }
      if (warningTypeDropdownRef.current && !warningTypeDropdownRef.current.contains(event.target)) {
        setShowWarningTypeDropdown(false);
      }
      if (warningActionDropdownRef.current && !warningActionDropdownRef.current.contains(event.target)) {
        setShowWarningActionDropdown(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        closeAllDropdowns();
      }
    };

    // Add event listeners when any dropdown is open
    if (showDepartmentDropdown || showEmployeeDropdown || showWarningTypeDropdown || showWarningActionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [showDepartmentDropdown, showEmployeeDropdown, showWarningTypeDropdown, showWarningActionDropdown]);

  // Update scroll buttons when table content changes - from LeadCRM.jsx
  useEffect(() => {
    updateScrollButtons(tableScrollRef, setCanScrollLeft, setCanScrollRight);
    updateScrollButtons(rankingTableScrollRef, setRankingCanScrollLeft, setRankingCanScrollRight);
    updateScrollButtons(myWarningsTableScrollRef, setMyWarningsCanScrollLeft, setMyWarningsCanScrollRight);
  }, [warnings, rankings]);

  // Helper function to close all dropdowns
  const closeAllDropdowns = () => {
    setShowDepartmentDropdown(false);
    setShowEmployeeDropdown(false);
    setShowWarningTypeDropdown(false);
    setShowWarningActionDropdown(false);
  };

  // Helper function to toggle specific dropdown (closes others)
  const toggleDropdown = (dropdownType) => {
    closeAllDropdowns();
    switch (dropdownType) {
      case 'employee':
        setShowEmployeeDropdown(true);
        break;
      case 'department':
        setShowDepartmentDropdown(true);
        break;
      case 'warningType':
        setShowWarningTypeDropdown(true);
        break;
      case 'warningAction':
        setShowWarningActionDropdown(true);
        break;
      default:
        break;
    }
  };

  // Load warning types
  const loadWarningTypes = async () => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const response = await fetch(`${API_URL}/warnings/types/list?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setWarningTypes(data.warning_types || []);
      }
    } catch (error) {
    }
  };

  // Load mistake types from database
  const loadMistakeTypes = async () => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const response = await fetch(`${API_URL}/warnings/mistake-types/list?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setMistakeTypes(data.mistake_types || []);
      }
    } catch (error) {
      console.error('Error loading mistake types:', error);
    }
  };

  // Load warning actions from database
  const loadWarningActions = async () => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      const response = await fetch(`${API_URL}/warnings/warning-actions/list?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setWarningActions(data.warning_actions || []);
      }
    } catch (error) {
      console.error('Error loading warning actions:', error);
    }
  };

  // Load employees
  const loadEmployees = async () => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);

      // Use users API endpoint to get complete user data with designation
      const response = await fetch(`${API_URL}/users/?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        const usersList = data || [];
        
        // Map user data to employee format for dropdown
        const employeesList = usersList
          .filter(user => 
            user.employee_status === 'active' || 
            user.is_active === true || 
            user.employee_status === undefined
          )
          .map(user => ({
            id: user._id,
            employee_id: user.employee_id,
            user_id: user._id,
            name: `${user.first_name} ${user.last_name}`.trim(),
            email: user.email,
            designation: user.designation,
            department_id: user.department_id,
            department_name: user.department_name || 'Unknown Department'
          }));
        
        setEmployees(employeesList);
      } else {
        const errorData = await response.text();
      }
    } catch (error) {
    }
  };

  // Load departments
  const loadDepartments = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_URL}/departments/?user_id=${userId}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        const mappedDepartments = (data || []).map(dept => ({
          id: dept._id || dept.id,
          name: dept.name,
          ...dept
        }));
        setDepartments(mappedDepartments);
      } else {
        const errorData = await response.text();
      }
    } catch (error) {
    }
  };

  // Load warnings
  const loadWarnings = async () => {
    setLoading(true);
    try {
      const userId = getCurrentUserId();
      let queryParams = new URLSearchParams({
        page: page + 1,
        per_page: rowsPerPage,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => {
            if (value === null || value === '') return false;
            return true;
          }).map(([key, value]) => {
            if (value instanceof Date) {
              return [key, format(value, 'yyyy-MM-dd')];
            }
            return [key, value];
          })
        )
      });

      if (userId) queryParams.append('user_id', userId);

      // Determine what warnings to show based on selected tab and user role
      if (isSuperAdmin()) {
        // Super admin tabs
        if (selectedTab === 0) {
          // All warnings - no additional parameters needed
        } else if (selectedTab === 1) {
          // Rankings tab - no additional parameters needed
        }
      } else if (isManager()) {
        // Manager tabs
        if (selectedTab === 0) {
          // Team Warnings tab - show team warnings
          queryParams.append('team_warnings', 'true');
        } else if (selectedTab === 1) {
          // My Warnings tab - show only own warnings  
          queryParams.append('my_warnings', 'true');
        }
      } else {
        // Regular user with only "own" permissions
        if (selectedTab === 0) {
          // My Warnings tab - show only own warnings
          queryParams.append('my_warnings', 'true');
        }
      }

      const response = await fetch(`${API_URL}/warnings/?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        
        const warnings = data.warnings || [];
        setWarnings(warnings);
        setTotalWarnings(data.total || 0);
        
        // Check if API provided stats, if not calculate them
        let statsToUse = data.stats || {};
        
        // If stats are empty or incorrect, calculate from warnings data
        if (!statsToUse.total_warnings || !statsToUse.total_penalty) {
          
          const uniqueEmployees = new Set();
          let totalPenalty = 0;
          
          warnings.forEach(warning => {
            if (warning.issued_to || warning.employee_id) {
              uniqueEmployees.add(warning.issued_to || warning.employee_id);
            }
            
            const penalty = parseFloat(warning.penalty_amount) || 0;
            totalPenalty += penalty;
          });
          
          const calculatedStats = {
            total_warnings: warnings.length,
            total_employees: uniqueEmployees.size,
            total_penalty: totalPenalty,
            avg_penalty: warnings.length > 0 ? Math.round(totalPenalty / warnings.length) : 0
          };
          
          statsToUse = calculatedStats;
        }
        
        setStats(statsToUse);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  // Load rankings
  const loadRankings = async () => {
    try {
      const userId = getCurrentUserId();
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);
      if (filters.department_id) {
        queryParams.append('department_id', filters.department_id);
      }
      
      const response = await fetch(`${API_URL}/warnings/ranking/employees?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setRankings(data.rankings || []);
      }
    } catch (error) {
    }
  };

  // Handle form input change
  const handleFormChange = (field, value) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // Check for similar warnings when employee(s) or mistake type is selected
      if (field === 'issued_to' && value && value.length > 0) {
        // Call with all selected employees and current mistake type
        checkSimilarWarnings(null, newData.warning_type);
      } else if (field === 'warning_type' && value) {
        // Call with current employee selection and new mistake type
        checkSimilarWarnings(null, value);
      } else if ((field === 'issued_to' && (!value || value.length === 0)) || 
                 (field === 'warning_type' && !value)) {
        // Clear similar warnings when employees or mistake type is deselected
        setSimilarWarnings([]);
        setShowingSimilarWarnings(false);
      }
      
      return newData;
    });
  };

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      department_id: '',
      employee_id: '',
      warning_type: '',
      start_date: null,
      end_date: null,
      penalty_amount_min: '',
      penalty_amount_max: '',
      penalty_amount_sort: ''
    });
    setFilterSearchTerms({
      warningType: '',
      department: '',
      employee: ''
    });
    setFilterDropdownFocus({
      warningType: false,
      department: false,
      employee: false
    });
  };

  // Get warning type color
  const getWarningTypeColor = (type) => {
    const colors = {
      'Late Arrival': 'warning',
      'Late Lunch': 'info',
      'Abuse': 'error',
      'Early Leave': 'secondary'
    };
    return colors[type] || 'default';
  };

  // Get filtered employees based on selected department
  const getFilteredEmployees = () => {
    
    if (!selectedDepartmentForAdd || selectedDepartmentForAdd === '') {
      return employees;
    }
    
    const filtered = employees.filter(employee => {
      const matchesDept = employee.department_id === selectedDepartmentForAdd || 
                         employee.dept_id === selectedDepartmentForAdd ||
                         employee.departmentId === selectedDepartmentForAdd;
      return matchesDept;
    });
    
    return filtered;
  };

  // Check for similar warnings when employee(s) and mistake type are selected
  const checkSimilarWarnings = (employeeId = null, mistakeType = null) => {
    // Handle both single employee ID and multiple employees from formData or selectedEmployees state
    const currentEmployeeIds = employeeId ? 
      [employeeId] : 
      (selectedEmployees.length > 0 ? selectedEmployees : 
       (formData.issued_to && formData.issued_to.length > 0 ? formData.issued_to : []));
    const currentMistakeType = mistakeType || formData.warning_type;
    
    console.log('Checking similar warnings:', { currentEmployeeIds, currentMistakeType });
    
    // Clear similar warnings if either employees or mistake type is missing
    if (!currentEmployeeIds.length || !currentMistakeType) {
      console.log('Missing employeeIds or mistakeType, clearing similar warnings');
      setSimilarWarnings([]);
      setShowingSimilarWarnings(false);
      return;
    }

    // Only show previous warnings when BOTH employee(s) AND mistake type are selected
    if (currentEmployeeIds.length > 0 && currentMistakeType) {
      // Filter warnings for any of the selected employees with the same mistake type
      const employeesWarningsWithSameMistakeType = warnings.filter(warning => {
        const warningEmployeeId = warning.issued_to || warning.employee_id;
        const matchesAnyEmployee = warningEmployeeId && 
          currentEmployeeIds.some(empId => empId.toString() === warningEmployeeId.toString());
        const matchesMistakeType = warning.warning_type === currentMistakeType;
        
        console.log('Checking warning:', {
          warningId: warning._id,
          warningEmployeeId,
          warningType: warning.warning_type,
          matchesAnyEmployee,
          matchesMistakeType,
          overallMatch: matchesAnyEmployee && matchesMistakeType
        });
        
        return matchesAnyEmployee && matchesMistakeType;
      });

      console.log(`Found ${employeesWarningsWithSameMistakeType.length} previous warnings for selected employee(s) with mistake type "${currentMistakeType}"`);
      setSimilarWarnings(employeesWarningsWithSameMistakeType);
      setShowingSimilarWarnings(employeesWarningsWithSameMistakeType.length > 0);
      
      if (employeesWarningsWithSameMistakeType.length > 0) {
        const uniqueEmployeesWithWarnings = [...new Set(employeesWarningsWithSameMistakeType.map(w => w.issued_to_name))];
        const selectedEmployeeNames = currentEmployeeIds.map(empId => 
          employees.find(emp => emp._id === empId)?.name || 'Unknown'
        );
        
        if (currentEmployeeIds.length === 1) {
          // Single employee selected
          showNotification(`Found ${employeesWarningsWithSameMistakeType.length} previous "${currentMistakeType}" warning(s) for ${selectedEmployeeNames[0]}`, 'info');
        } else {
          // Multiple employees selected
          showNotification(`Found ${employeesWarningsWithSameMistakeType.length} previous "${currentMistakeType}" warning(s) across ${uniqueEmployeesWithWarnings.length} of the selected employees`, 'info');
        }
      }
    }
  };

  // Check similar warnings with specific employee IDs and mistake type (used for maintaining popup when adding employees)
  const checkSimilarWarningsWithEmployees = (employeeIds = [], mistakeType = null) => {
    const currentEmployeeIds = employeeIds || [];
    const currentMistakeType = mistakeType || formData.warning_type;
    
    console.log('Checking similar warnings with specific employees:', { currentEmployeeIds, currentMistakeType });
    
    // Clear similar warnings if either employees or mistake type is missing
    if (!currentEmployeeIds.length || !currentMistakeType) {
      console.log('Missing employeeIds or mistakeType, clearing similar warnings');
      setSimilarWarnings([]);
      setShowingSimilarWarnings(false);
      return;
    }

    // Only show previous warnings when BOTH employee(s) AND mistake type are selected
    if (currentEmployeeIds.length > 0 && currentMistakeType) {
      // Filter warnings for any of the selected employees with the same mistake type
      const employeesWarningsWithSameMistakeType = warnings.filter(warning => {
        const warningEmployeeId = warning.issued_to || warning.employee_id;
        const matchesAnyEmployee = warningEmployeeId && 
          currentEmployeeIds.some(empId => empId.toString() === warningEmployeeId.toString());
        const matchesMistakeType = warning.warning_type === currentMistakeType;
        
        console.log('Checking warning (specific employees):', {
          warningId: warning._id,
          warningEmployeeId,
          warningType: warning.warning_type,
          matchesAnyEmployee,
          matchesMistakeType,
          overallMatch: matchesAnyEmployee && matchesMistakeType
        });
        
        return matchesAnyEmployee && matchesMistakeType;
      });

      console.log(`Found ${employeesWarningsWithSameMistakeType.length} previous warnings for specific employee(s) with mistake type "${currentMistakeType}"`);
      setSimilarWarnings(employeesWarningsWithSameMistakeType);
      setShowingSimilarWarnings(employeesWarningsWithSameMistakeType.length > 0);
      
      if (employeesWarningsWithSameMistakeType.length > 0) {
        const uniqueEmployeesWithWarnings = [...new Set(employeesWarningsWithSameMistakeType.map(w => w.issued_to_name))];
        const selectedEmployeeNames = currentEmployeeIds.map(empId => 
          employees.find(emp => emp._id === empId)?.name || 'Unknown'
        );
        
        if (currentEmployeeIds.length === 1) {
          // Single employee selected
          showNotification(`Found ${employeesWarningsWithSameMistakeType.length} previous "${currentMistakeType}" warning(s) for ${selectedEmployeeNames[0]}`, 'info');
        } else {
          // Multiple employees selected
          showNotification(`Found ${employeesWarningsWithSameMistakeType.length} previous "${currentMistakeType}" warning(s) across ${uniqueEmployeesWithWarnings.length} of the selected employees`, 'info');
        }
      }
    }
  };

  // Check warnings for multiple selected employees
  const checkSelectedEmployeeWarnings = (employeeIds) => {
    if (!employeeIds || employeeIds.length === 0) {
      setSimilarWarnings([]);
      setShowingSimilarWarnings(false);
      return;
    }

    // Filter warnings for all selected employees
    const selectedWarnings = warnings.filter(warning => {
      const warningEmployeeId = warning.issued_to || warning.employee_id;
      return warningEmployeeId && employeeIds.includes(warningEmployeeId.toString());
    });

    console.log('Found warnings for selected employees:', selectedWarnings);
    console.log('Number of warnings found for all employees:', selectedWarnings.length);
    
    setSimilarWarnings(selectedWarnings);
    setShowingSimilarWarnings(selectedWarnings.length > 0);
    
    if (selectedWarnings.length > 0) {
      showNotification(`Found ${selectedWarnings.length} previous warning(s) for selected employee(s)`, 'info');
      console.log(`Found ${selectedWarnings.length} previous warnings for selected employees`);
    } else {
      console.log('No previous warnings found for selected employees');
    }
  };

  // Department search functions
  const getSearchableDepartments = () => {
    if (!departmentSearchTerm.trim()) {
      return departments;
    }
    
    return departments.filter(dept => {
      const deptName = dept.name || dept.department_name || '';
      return deptName.toLowerCase().includes(departmentSearchTerm.toLowerCase());
    });
  };

  const handleDepartmentSearch = (searchTerm) => {
    setDepartmentSearchTerm(searchTerm);
    setShowDepartmentDropdown(true);
  };

  const handleDepartmentSelect = (department) => {
    const deptId = department.id || department._id || department.department_id;
    const deptName = department.name || department.department_name || 'Unknown';
    
    setSelectedDepartmentForAdd(deptId);
    setSelectedDepartmentName(deptName);
    // Clear the search term instead of setting it to the selected value
    setDepartmentSearchTerm('');
    setShowDepartmentDropdown(false);
  };

  // Employee search functions
  const getSearchableEmployees = () => {
    const filteredEmployees = getFilteredEmployees();
    
    if (!employeeSearchTerm.trim()) {
      return filteredEmployees;
    }
    
    return filteredEmployees.filter(employee => {
      const employeeName = employee.name || employee.employee_name || employee.full_name || '';
      const employeeId = employee.employee_id || employee.id || employee._id || '';
      
      return (
        employeeName.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
        employeeId.toLowerCase().includes(employeeSearchTerm.toLowerCase())
      );
    });
  };

  const handleEmployeeSearch = (searchTerm) => {
    setEmployeeSearchTerm(searchTerm);
    setShowEmployeeDropdown(true);
  };

  const handleEmployeeSelect = (employee) => {
    // Prioritize _id over employee_id for API compatibility
    const employeeId = employee._id || employee.id || employee.user_id || employee.employee_id;
    const employeeName = employee.name || employee.employee_name || employee.full_name || 'Unknown';
    const employeeDesignation = employee.designation || employee.role || employee.position || employee.job_title || '';
    
    console.log('🔍 WarningPage - Selected employee:', { employee, selectedId: employeeId });
    
    // Check if employee is already selected
    if (selectedEmployees.includes(employeeId)) {
      console.log('Employee already selected:', employeeId);
      return;
    }
    
    // Create display name with designation if available
    const displayName = employeeDesignation 
      ? `${employeeName} (${employeeDesignation})`
      : employeeName;
    
    // Add to multi-select arrays
    const updatedEmployees = [...selectedEmployees, employeeId];
    const updatedNames = [...selectedEmployeeNames, { id: employeeId, name: displayName }];
    
    setSelectedEmployees(updatedEmployees);
    setSelectedEmployeeNames(updatedNames);
    setFormData(prev => ({ ...prev, issued_to: updatedEmployees }));
    setEmployeeSearchTerm(''); // Clear search term
    
    // Check for similar warnings with all selected employees (including newly added) and mistake type
    checkSimilarWarningsWithEmployees(updatedEmployees, formData.warning_type);
  };

  // Handle removing selected employee
  const handleRemoveEmployee = (employeeId) => {
    const updatedEmployees = selectedEmployees.filter(id => id !== employeeId);
    const updatedNames = selectedEmployeeNames.filter(emp => emp.id !== employeeId);
    
    setSelectedEmployees(updatedEmployees);
    setSelectedEmployeeNames(updatedNames);
    setFormData(prev => ({ ...prev, issued_to: updatedEmployees }));
    
    // Clear similar warnings if no employees selected, or check with remaining employees
    if (updatedEmployees.length === 0) {
      setSimilarWarnings([]);
      setShowingSimilarWarnings(false);
    } else {
      // Check warnings for all remaining employees with current mistake type
      checkSimilarWarningsWithEmployees(updatedEmployees, formData.warning_type);
    }
  };

  // Warning type search functions
  const getSearchableWarningTypes = () => {
    if (!warningTypeSearchTerm.trim()) {
      return warningTypes;
    }
    
    return warningTypes.filter(type => {
      const typeLabel = type.label || type.value || type;
      return typeLabel.toLowerCase().includes(warningTypeSearchTerm.toLowerCase());
    });
  };

  const handleWarningTypeSearch = (searchTerm) => {
    setWarningTypeSearchTerm(searchTerm);
    setShowWarningTypeDropdown(true);
  };

  const handleWarningTypeSelect = (type) => {
    const typeValue = type.value || type;
    const typeLabel = type.label || type;
    
    setFormData(prev => ({ ...prev, warning_type: typeValue }));
    setSelectedWarningTypeName(typeLabel);
    // Clear the search term instead of setting it to the selected value
    setWarningTypeSearchTerm('');
    setShowWarningTypeDropdown(false);
    
    // Check for similar warnings with ALL selected employees and new mistake type
    checkSimilarWarningsWithEmployees(selectedEmployees, typeValue);
  };

  const handleWarningActionSelect = (action) => {
    const actionValue = action.value || action;
    const actionLabel = action.label || action;
    
    setFormData(prev => ({ ...prev, warning_action: actionValue }));
    setSelectedWarningActionName(actionLabel);
    setShowWarningActionDropdown(false);
  };

  const resetAllSearchStates = () => {
    setEmployeeSearchTerm('');
    setSelectedEmployeeName('');
    setSelectedEmployees([]);
    setSelectedEmployeeNames([]);
    setDepartmentSearchTerm('');
    setSelectedDepartmentName('');
    setWarningTypeSearchTerm('');
    setSelectedWarningTypeName('');
    setSelectedWarningActionName('');
    closeAllDropdowns(); // Use the new helper function
  };

  // Waive/Reinstate penalty handlers
  const handleWaivePenalty = async (warningId) => {
    if (!window.confirm('Admin Action: Are you sure you want to completely waive off this penalty?')) return;
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_URL}/warnings/${warningId}/waive?user_id=${userId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        // Update local warnings state
        setWarnings(prev => prev.map(w => w.id === warningId ? { ...w, is_waived: true } : w));
        setWaivedPenalties(prev => ({ ...prev, [warningId]: true }));
        showNotification('Penalty successfully waived off!', 'success');
      } else {
        const err = await response.json().catch(() => ({}));
        showNotification(err.detail || 'Failed to waive penalty', 'error');
      }
    } catch (error) {
      console.error('Error waiving penalty:', error);
      showNotification('Error waiving penalty', 'error');
    }
  };

  const handleReinstatePenalty = async (warningId) => {
    if (!window.confirm('Admin Action: Are you sure you want to reinstate this penalty?')) return;
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_URL}/warnings/${warningId}/reinstate?user_id=${userId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        // Update local warnings state
        setWarnings(prev => prev.map(w => w.id === warningId ? { ...w, is_waived: false } : w));
        setWaivedPenalties(prev => {
          const updated = { ...prev };
          delete updated[warningId];
          return updated;
        });
        showNotification('Penalty successfully reinstated!', 'success');
      } else {
        const err = await response.json().catch(() => ({}));
        showNotification(err.detail || 'Failed to reinstate penalty', 'error');
      }
    } catch (error) {
      console.error('Error reinstating penalty:', error);
      showNotification('Error reinstating penalty', 'error');
    }
  };

  // Create Mistake Category
  const handleCreateMistakeCategory = async () => {
    if (!newMistakeTitle.trim()) {
      showNotification('Please enter a mistake title', 'error');
      return;
    }
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_URL}/warnings/mistake-types?user_id=${userId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          value: newMistakeTitle.trim(),
          label: newMistakeTitle.trim(),
          description: newMistakeDescription.trim()
        })
      });
      if (response.ok) {
        showNotification('New Mistake Category Created!', 'success');
        setCreateMistakeOpen(false);
        setNewMistakeTitle('');
        setNewMistakeDescription('');
        loadMistakeTypes();
      } else {
        const errData = await response.json().catch(() => ({}));
        showNotification(errData.detail || 'Error creating mistake category', 'error');
      }
    } catch (error) {
      console.error('Error creating mistake category:', error);
      showNotification('Error creating mistake category', 'error');
    }
  };

  // Edit Mistake Category
  const handleEditMistakeCategory = async () => {
    if (!editMistakeTitle.trim()) {
      showNotification('Please enter a mistake title', 'error');
      return;
    }
    try {
      const userId = getCurrentUserId();
      const typeId = editingMistakeType?._id || editingMistakeType?.id;
      const response = await fetch(`${API_URL}/warnings/mistake-types/${typeId}?user_id=${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          value: editMistakeTitle.trim(),
          label: editMistakeTitle.trim(),
          description: editMistakeDescription.trim()
        })
      });
      if (response.ok) {
        showNotification('Mistake Category Updated!', 'success');
        setEditMistakeOpen(false);
        setEditingMistakeType(null);
        loadMistakeTypes();
      } else {
        const errData = await response.json().catch(() => ({}));
        showNotification(errData.detail || 'Error updating mistake category', 'error');
      }
    } catch (error) {
      console.error('Error updating mistake category:', error);
      showNotification('Error updating mistake category', 'error');
    }
  };

  // Delete Mistake Category
  const handleDeleteMistakeCategory = async (mistakeType) => {
    const typeId = mistakeType?._id || mistakeType?.id;
    if (!typeId) {
      showNotification('Cannot delete this category (no ID found)', 'error');
      return;
    }
    if (!window.confirm(`Delete mistake category "${mistakeType.label || mistakeType.value}"? This cannot be undone.`)) return;
    try {
      const userId = getCurrentUserId();
      const response = await fetch(`${API_URL}/warnings/mistake-types/${typeId}?user_id=${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        showNotification('Mistake Category Deleted!', 'success');
        loadMistakeTypes();
      } else {
        const errData = await response.json().catch(() => ({}));
        showNotification(errData.detail || 'Error deleting mistake category', 'error');
      }
    } catch (error) {
      console.error('Error deleting mistake category:', error);
      showNotification('Error deleting mistake category', 'error');
    }
  };

  // Open edit mistake modal
  const openEditMistake = (mistakeType) => {
    setEditingMistakeType(mistakeType);
    setEditMistakeTitle(mistakeType.label || mistakeType.value || mistakeType);
    setEditMistakeDescription(mistakeType.description || '');
    setEditMistakeOpen(true);
  };

  // Get filtered mistake types for directory
  const getFilteredMistakeDirectory = () => {
    if (!mistakeDirectorySearch.trim()) return mistakeTypes;
    return mistakeTypes.filter(type => {
      const label = (type.label || type.value || '').toLowerCase();
      const desc = (type.description || '').toLowerCase();
      return label.includes(mistakeDirectorySearch.toLowerCase()) || desc.includes(mistakeDirectorySearch.toLowerCase());
    });
  };

  // Get warning status display
  const getWarningStatus = (warning) => {
    if (warning.is_acknowledged) return 'Acknowledged';
    return warning.status || warning.employee_status || 'Pending';
  };

  // Get employee remark
  const getEmployeeRemark = (warning) => {
    return warning.employee_remark || warning.employee_response || '';
  };

  // Handle form submit
  const handleSubmit = async () => {
    try {
      
      if (!formData.warning_type || !formData.issued_to.length || !formData.penalty_amount) {
        const missingFields = [];
        if (!formData.warning_type) missingFields.push('Warning Type');
        if (!formData.issued_to.length) missingFields.push('Employee(s)');
        if (!formData.penalty_amount) missingFields.push('Penalty Amount');
        
        const message = `Please fill in all required fields: ${missingFields.join(', ')}`;
        showNotification(message, 'error');
        return;
      }

      const userId = getCurrentUserId();
      
      // Create warnings for all selected employees
      const warningPromises = formData.issued_to.map(async (employeeId) => {
        const warningData = {
          warning_type: formData.warning_type,
          issued_to: employeeId, // Individual employee ID
          penalty_amount: parseFloat(formData.penalty_amount),
          warning_message: formData.warning_message || ''
        };
        
        console.log('🚀 WarningPage - Creating warning for employee:', employeeId, 'Data:', warningData);
        
        const response = await fetch(`${API_URL}/warnings/?user_id=${userId}`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(warningData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to create warning for employee ${employeeId}: ${errorData.detail || errorData.message || 'Unknown error'}`);
        }

        return response.json();
      });

      // Wait for all warnings to be created
      const results = await Promise.all(warningPromises);
      const successCount = results.filter(result => result.success).length;
      
      if (successCount === formData.issued_to.length) {
        showNotification(`Successfully created ${successCount} warning(s) for ${successCount} employee(s)`, 'success');
        setAddDialogOpen(false);
        setFormData({
          warning_type: '',
          issued_to: [],
          penalty_amount: '',
          warning_message: ''
        });
        setSelectedDepartmentForAdd('');
        setSelectedEmployees([]);
        setSelectedEmployeeNames([]);
        setSimilarWarnings([]);
        setShowingSimilarWarnings(false);
        resetAllSearchStates();
        loadWarnings();
      } else {
        const failedCount = formData.issued_to.length - successCount;
        showNotification(`Created ${successCount} warnings, but ${failedCount} failed`, 'warning');
        loadWarnings(); // Refresh to show successful ones
      }
    } catch (error) {
      console.error('❌ WarningPage - Network Error:', error);
      showNotification('Error creating warnings: ' + error.message, 'error');
    }
  };

  // Handle edit submit
  const handleEditSubmit = async () => {
    try {
      if (!editingWarning || !editingWarning.id) {
        showNotification('No warning selected for editing', 'error');
        return;
      }

      const userId = getCurrentUserId();
      
      const warningData = {
        warning_type: formData.warning_type,
        penalty_amount: parseFloat(formData.penalty_amount),
        warning_message: formData.warning_message || ''
      };

      const response = await fetch(`${API_URL}/warnings/${editingWarning.id}?user_id=${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(warningData)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showNotification('Warning updated successfully', 'success');
          setEditDialogOpen(false);
          setEditingWarning(null);
          setFormData({
            warning_type: '',
            issued_to: '',
            penalty_amount: '',
            warning_message: ''
          });
          loadWarnings();
        } else {
          showNotification(result.message || 'Failed to update warning', 'error');
        }
      } else {
        const errorData = await response.json();
        showNotification(errorData.detail || 'Failed to update warning', 'error');
      }
    } catch (error) {
      showNotification('Error updating warning', 'error');
    }
  };

  // Handle delete for DeleteButton component
  const handleDeleteWarning = async (warningId) => {
    try {
      const userId = getCurrentUserId();
      
      const response = await fetch(`${API_URL}/warnings/${warningId}?user_id=${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showNotification('Warning deleted successfully', 'success');
          loadWarnings();
          return true;
        } else {
          throw new Error(result.message || 'Failed to delete warning');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete warning');
      }
    } catch (error) {
      console.error('Error deleting warning:', error);
      throw error;
    }
  };

  // Select button handlers
  const handleShowCheckboxes = () => {
    setShowCheckboxes(!showCheckboxes);
    if (showCheckboxes) {
      setSelectedRows([]);
      setSelectAll(false);
    }
  };

  const handleRowSelect = (warningId) => {
    if (selectedRows.includes(warningId)) {
      setSelectedRows(selectedRows.filter(id => id !== warningId));
      setSelectAll(false);
    } else {
      setSelectedRows([...selectedRows, warningId]);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows([]);
    } else {
      setSelectedRows(paginatedWarnings.map(warning => warning.id));
    }
    setSelectAll(!selectAll);
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) {
      showNotification('No warnings selected for deletion', 'error');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete ${selectedRows.length} warning(s)?`);
    if (!confirmed) return;

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Show loading state
    setLoading(true);

    try {
      // Delete each selected warning
      for (const warningId of selectedRows) {
        try {
          await handleDeleteWarning(warningId);
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`Warning ${warningId}: ${error.message || 'Unknown error'}`);
          console.error('Error deleting warning:', warningId, error);
        }
      }

      // Show result message
      if (successCount > 0 && errorCount === 0) {
        showNotification(`Successfully deleted ${successCount} warning(s)`, 'success');
      } else if (successCount > 0 && errorCount > 0) {
        showNotification(`Deleted ${successCount} warning(s), but ${errorCount} failed. Check console for details.`, 'warning');
        console.error('Delete errors:', errors);
      } else if (errorCount > 0) {
        showNotification(`Failed to delete warnings. Check console for details.`, 'error');
        console.error('Delete errors:', errors);
      }

      // Reset selection state
      setSelectedRows([]);
      setSelectAll(false);
      setShowCheckboxes(false);

      // Reload warnings to reflect changes
      await loadWarnings();
    } catch (error) {
      console.error('Error in bulk delete operation:', error);
      showNotification('Error deleting warnings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSelection = () => {
    setSelectedRows([]);
    setSelectAll(false);
    setShowCheckboxes(false);
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      if (!warningToDelete || !warningToDelete.id) {
        showNotification('No warning selected for deletion', 'error');
        return;
      }

      const userId = getCurrentUserId();
      
      const response = await fetch(`${API_URL}/warnings/${warningToDelete.id}?user_id=${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showNotification('Warning deleted successfully', 'success');
          setDeleteDialogOpen(false);
          setWarningToDelete(null);
          loadWarnings();
        } else {
          showNotification(result.message || 'Failed to delete warning', 'error');
        }
      } else {
        const errorData = await response.json();
        showNotification(errorData.detail || 'Failed to delete warning', 'error');
      }
    } catch (error) {
      showNotification('Error deleting warning', 'error');
    }
  };

  // Handle form change with similar warnings check
  const handleFormChangeWithSimilarCheck = (field, value) => {
    handleFormChange(field, value);
    
    // Check for similar warnings when employee is set
    if (field === 'issued_to' && value) {
      checkSimilarWarnings(value);
    }
  };

  // Open add dialog with fresh state
  const openAddDialog = () => {
    setFormData({
      warning_type: '',
      issued_to: '',
      penalty_amount: '',
      warning_message: ''
    });
    setSelectedDepartmentForAdd('');
    setSimilarWarnings([]);
    setShowingSimilarWarnings(false);
    
    // Reset all search states
    resetAllSearchStates();
    
    setAddDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (warning) => {
    setEditingWarning(warning);
    setFormData({
      warning_type: warning.warning_type,
      issued_to: warning.issued_to,
      penalty_amount: warning.penalty_amount.toString(),
      warning_message: warning.warning_message || ''
    });
    setEditDialogOpen(true);
  };

  // Format date function
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Filter warnings based on search term and active filters
  const filteredWarnings = warnings.filter(warning => {
    // Apply warning type filter
    const typeFilter = !filters.warning_type || warning.warning_type === filters.warning_type;
    
    // Apply department filter
    const departmentFilter = !filters.department_id || warning.department_id === filters.department_id;
    
    // Apply employee filter
    const employeeFilter = !filters.employee_id || warning.issued_to === filters.employee_id;
    
    // Apply penalty amount filter
    let penaltyFilter = true;
    const penaltyAmount = parseFloat(warning.penalty_amount) || 0;
    if (filters.penalty_amount_min && filters.penalty_amount_min !== '') {
      penaltyFilter = penaltyFilter && penaltyAmount >= parseFloat(filters.penalty_amount_min);
    }
    if (filters.penalty_amount_max && filters.penalty_amount_max !== '') {
      penaltyFilter = penaltyFilter && penaltyAmount <= parseFloat(filters.penalty_amount_max);
    }
    
    // Apply search term filter
    const searchFilter = !searchTerm || 
      warning.issued_to_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warning.warning_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warning.department_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warning.issued_by_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Apply date range filters
    let dateFilter = true;
    if (filters.start_date) {
      const warningDate = new Date(warning.issued_date);
      const startDate = new Date(filters.start_date);
      dateFilter = dateFilter && warningDate >= startDate;
    }
    if (filters.end_date) {
      const warningDate = new Date(warning.issued_date);
      const endDate = new Date(filters.end_date);
      dateFilter = dateFilter && warningDate <= endDate;
    }
    
    return typeFilter && departmentFilter && employeeFilter && penaltyFilter && searchFilter && dateFilter;
  }).sort((a, b) => {
    // Apply penalty amount sorting
    if (filters.penalty_amount_sort === 'asc') {
      return parseFloat(a.penalty_amount || 0) - parseFloat(b.penalty_amount || 0);
    } else if (filters.penalty_amount_sort === 'desc') {
      return parseFloat(b.penalty_amount || 0) - parseFloat(a.penalty_amount || 0);
    }
    return 0; // No sorting
  });

  // Get warning type badge style
  const getWarningTypeBadge = (type) => {
    const styles = {
      'Late Arrival': 'bg-yellow-500',
      'Late Lunch': 'bg-blue-500',
      'Abuse': 'bg-red-500',
      'Early Leave': 'bg-purple-500'
    };
    return styles[type] || 'bg-gray-500';
  };

  // Error boundary pattern
  if (renderError) {
    return (
      <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h2>
          <p className="text-gray-400 mb-4">Please refresh the page to try again.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  try {
    return (
      <>
        <style>{stickyHeaderStyles}</style>
        <div className="min-h-screen bg-black text-white font-sans overflow-hidden">
      {/* Background Pattern */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: "20px 20px",
        }}
      ></div>

      <div className="relative z-10 flex h-screen">
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-8 space-y-8">
            {/* Header with Tabs & Action Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              {/* Tab Navigation */}
              <div className="flex p-1 bg-gray-800/60 rounded-lg w-fit">
                {isSuperAdmin() ? (
                  <>
                    <button
                      onClick={() => setSelectedTab(0)}
                      className={`px-5 py-2.5 text-sm font-bold rounded-md transition-all ${selectedTab === 0 ? 'bg-[#03b0f5] text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                      Warnings Log
                    </button>
                    {/* Mistakes Directory tab — only when explicit view_mistakes permission */}
                    {permissions.can_view_mistakes && (
                      <button
                        onClick={() => setSelectedTab(1)}
                        className={`px-5 py-2.5 text-sm font-bold rounded-md transition-all ${selectedTab === 1 ? 'bg-[#03b0f5] text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                      >
                        Mistakes Directory
                      </button>
                    )}
                  </>
                ) : permissions.can_view_mistakes ? (
                  <>
                    <button
                      onClick={() => setSelectedTab(0)}
                      className={`px-5 py-2.5 text-sm font-bold rounded-md transition-all ${selectedTab === 0 ? 'bg-[#03b0f5] text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                      Warnings Log
                    </button>
                    <button
                      onClick={() => setSelectedTab(1)}
                      className={`px-5 py-2.5 text-sm font-bold rounded-md transition-all ${selectedTab === 1 ? 'bg-[#03b0f5] text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                      Mistakes Directory
                    </button>
                  </>
                ) : isManager() ? (
                  <>
                    <button
                      onClick={() => setSelectedTab(0)}
                      className={`px-5 py-2.5 text-sm font-bold rounded-md transition-all ${selectedTab === 0 ? 'bg-[#03b0f5] text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                      Team Warnings
                    </button>
                    <button
                      onClick={() => setSelectedTab(1)}
                      className={`px-5 py-2.5 text-sm font-bold rounded-md transition-all ${selectedTab === 1 ? 'bg-[#03b0f5] text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                      My Warnings
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedTab(0)}
                    className="px-5 py-2.5 text-sm font-bold rounded-md bg-[#03b0f5] text-white shadow-sm"
                  >
                    My Warnings
                  </button>
                )}
              </div>

              {/* Contextual Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {/* Show Issue Warning button on warnings tabs — hide on Mistakes Directory tab */}
                {permissions.can_issue_warning && !(selectedTab === 1 && (isSuperAdmin() || permissions.can_view_mistakes)) && (
                  <button
                    className="px-5 py-2.5 bg-[#0891b2] hover:bg-[#0e7490] text-white text-sm font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
                    onClick={openAddDialog}
                  >
                    <Plus className="w-4 h-4" /> Issue New Warning
                  </button>
                )}
                {/* Show Create Mistake Category button when on Mistakes Directory tab */}
                {permissions.can_create_mistake_category && selectedTab === 1 && (
                  <button
                    className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
                    onClick={() => setCreateMistakeOpen(true)}
                  >
                    <FolderPlus className="w-4 h-4" /> Create Mistake Category
                  </button>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="bg-black rounded-xl shadow-lg border border-gray-800 overflow-hidden flex-1 flex flex-col">
              {/* Tab Content */}
              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                      <span className="ml-3 text-cyan-500 font-semibold mt-2">Loading...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Super Admin / Mistake Directory Access Tabs */}
                    {(isSuperAdmin() || permissions.can_view_mistakes) ? (
                      <>
                        {/* Tab 0: Warnings Log */}
                        {selectedTab === 0 && (
                          <div>
                            {/* Search and Filter Bar */}
                            <div className="p-4 border-b border-gray-800 bg-gray-900/50 rounded-t-lg flex flex-wrap gap-4 items-center mb-4">
                              <div className="relative flex-1 max-w-md">
                                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                                <input
                                  type="text"
                                  placeholder="Search employee or mistake..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-800 text-gray-300 border border-gray-700 rounded-lg outline-none focus:border-[#03b0f5] transition"
                                />
                                {searchTerm && (
                                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-gray-400 hover:text-gray-300">
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {/* Select/Delete Controls */}
                                {permissions?.can_delete && !showCheckboxes ? (
                                  <button onClick={handleShowCheckboxes} className="bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-600 transition">Select</button>
                                ) : permissions?.can_delete && showCheckboxes ? (
                                  <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-2">
                                    <label className="flex items-center cursor-pointer text-[#03B0F5] font-bold text-sm">
                                      <input type="checkbox" className="accent-blue-500 mr-2" checked={selectAll} onChange={handleSelectAll} style={{ width: 16, height: 16 }} />
                                      All
                                    </label>
                                    <span className="text-gray-300 text-sm">{selectedRows.length} selected</span>
                                    <button className="px-3 py-1 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700" onClick={handleDeleteSelected} disabled={selectedRows.length === 0}>Delete</button>
                                    <button className="px-3 py-1 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700" onClick={handleCancelSelection}>Cancel</button>
                                  </div>
                                ) : null}
                                <button
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${Object.values(filters).some(f => f && f !== '') ? 'bg-[#03b0f5] text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                  onClick={() => setFilterDialogOpen(true)}
                                >
                                  <Filter className="w-4 h-4" /> Filters
                                  {Object.values(filters).some(f => f && f !== '') && <span className="bg-white text-[#03b0f5] px-1.5 py-0.5 rounded-full text-[10px] font-bold">On</span>}
                                </button>
                              </div>
                            </div>

                            {/* Warnings Table */}
                            <div className="relative">
                              {canScrollLeft && (
                                <button onClick={() => scrollMainTable('left')} className="absolute left-2 top-1/2 -translate-y-1/2 z-50 text-white p-3 rounded-full shadow-lg opacity-20 hover:opacity-100 transition-all" style={{ backgroundColor: 'rgba(37, 99, 235, 1)' }}>
                                  <ChevronLeft className="w-7 h-7" />
                                </button>
                              )}
                              {canScrollRight && (
                                <button onClick={() => scrollMainTable('right')} className="absolute right-2 top-1/2 -translate-y-1/2 z-50 text-white p-3 rounded-full shadow-lg opacity-20 hover:opacity-100 transition-all" style={{ backgroundColor: 'rgba(37, 99, 235, 1)' }}>
                                  <ChevronRight className="w-7 h-7" />
                                </button>
                              )}
                              
                              <div ref={tableScrollRef} className="bg-black rounded-lg overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto" onScroll={() => updateScrollButtons(tableScrollRef, setCanScrollLeft, setCanScrollRight)}>
                                <table className="min-w-full w-full text-left text-sm whitespace-nowrap">
                                  <thead className="bg-gray-900 border-b border-gray-700 text-gray-400 font-medium sticky top-0 z-10">
                                    <tr>
                                      {showCheckboxes && (
                                        <th className="py-3 px-4 w-10">
                                          <input type="checkbox" checked={selectAll} onChange={handleSelectAll} className="rounded border-gray-600" />
                                        </th>
                                      )}
                                      <th className="py-3 px-4 w-12 text-center font-semibold">#</th>
                                      <th className="py-3 px-4 font-semibold">Date</th>
                                      <th className="py-3 px-4 font-semibold">Employee</th>
                                      <th className="py-3 px-4 font-semibold">Issued By</th>
                                      <th className="py-3 px-4 font-semibold">Mistake Type</th>
                                      <th className="py-3 px-4 font-semibold">Penalty</th>
                                      <th className="py-3 px-4 font-semibold min-w-[200px]">Employee Remark</th>
                                      <th className="py-3 px-4 text-center font-semibold">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-800">
                                    {filteredWarnings.length === 0 ? (
                                      <tr><td colSpan={showCheckboxes ? "9" : "8"} className="text-center py-10 text-gray-500">No warnings found</td></tr>
                                    ) : (
                                      filteredWarnings.map((warning, index) => {
                                        const isWaived = waivedPenalties[warning.id] || warning.is_waived;
                                        const status = getWarningStatus(warning);
                                        const empRemark = getEmployeeRemark(warning);
                                        const isPending = status === 'Pending';
                                        
                                        return (
                                          <tr key={warning.id} className="hover:bg-gray-800/50 transition-colors cursor-pointer group" onClick={() => { setSelectedWarning(warning); setViewDialogOpen(true); }}>
                                            {showCheckboxes && (
                                              <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                                <input type="checkbox" checked={selectedRows.includes(warning.id)} onChange={() => handleRowSelect(warning.id)} className="rounded border-gray-600" />
                                              </td>
                                            )}
                                            <td className="py-3 px-4 text-center text-gray-500 font-medium text-xs">{(page * rowsPerPage) + index + 1}</td>
                                            <td className="py-3 px-4 text-gray-400 text-xs">
                                              {new Date(warning.issued_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                                            </td>
                                            <td className="py-3 px-4 font-bold text-white">{warning.issued_to_name || 'N/A'}</td>
                                            <td className="py-3 px-4 text-gray-400 text-xs">
                                              <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-400">{(warning.issued_by_name || 'U').charAt(0)}</div>
                                                {warning.issued_by_name || 'Unknown'}
                                              </div>
                                            </td>
                                            <td className="py-3 px-4 text-gray-300 font-medium">{warning.warning_type || 'N/A'}</td>
                                            <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                              {warning.penalty_amount && Number(warning.penalty_amount) > 0 ? (
                                                isWaived ? (
                                                  <div className="flex items-center gap-2">
                                                    <div className="flex flex-col">
                                                      <span className="text-gray-500 line-through text-xs">₹{Number(warning.penalty_amount).toLocaleString('en-IN')}</span>
                                                      <span className="text-green-400 font-bold text-xs mt-0.5 flex items-center gap-1"><ShieldCheck className="w-3 h-3 inline" /> Waived Off</span>
                                                    </div>
                                                    {permissions?.can_edit && (
                                                      <button onClick={() => handleReinstatePenalty(warning.id)} className="text-amber-400 hover:text-white hover:bg-amber-600 border border-amber-700 p-1 rounded-md text-[10px] font-bold transition-colors" title="Reinstate Penalty">
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                      </button>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <div className="flex items-center justify-between gap-2 group/penalty">
                                                    <span className="font-bold text-red-400">₹{Number(warning.penalty_amount).toLocaleString('en-IN')}</span>
                                                    {permissions?.can_edit && (
                                                      <button onClick={() => handleWaivePenalty(warning.id)} className="text-purple-400 hover:text-white hover:bg-purple-600 border border-purple-700 p-1 rounded-md text-[10px] font-bold transition-colors" title="Waive Penalty">
                                                        <Edit className="w-3.5 h-3.5" />
                                                      </button>
                                                    )}
                                                  </div>
                                                )
                                              ) : (
                                                <span className="font-medium text-gray-500">-</span>
                                              )}
                                            </td>
                                            <td className="py-3 px-4 text-gray-400 text-xs max-w-[200px] truncate" title={empRemark || warning.warning_message || ''}>
                                              {isPending ? (
                                                <span className="italic text-gray-500">Waiting for response...</span>
                                              ) : (
                                                empRemark || warning.warning_message || '-'
                                              )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                              {isPending ? (
                                                <span className="bg-amber-900/30 text-amber-400 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-amber-700">Pending</span>
                                              ) : (
                                                <span className="bg-green-900/30 text-green-400 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-green-700">{status}</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Pagination */}
                            {totalWarnings > rowsPerPage && (
                              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                                <div className="text-gray-500 text-sm">Showing {Math.min((page * rowsPerPage) + 1, totalWarnings)} to {Math.min((page + 1) * rowsPerPage, totalWarnings)} of {totalWarnings}</div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-600 transition">Previous</button>
                                  <span className="px-3 py-1.5 text-gray-400 text-sm">Page {page + 1} of {Math.ceil(totalWarnings / rowsPerPage)}</span>
                                  <button onClick={() => setPage(Math.min(Math.ceil(totalWarnings / rowsPerPage) - 1, page + 1))} disabled={page >= Math.ceil(totalWarnings / rowsPerPage) - 1} className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-600 transition">Next</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab 1: Mistakes Directory — only for users with explicit view_mistakes permission */}
                        {selectedTab === 1 && permissions.can_view_mistakes && (
                          <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                              <div>
                                <h2 className="text-lg font-bold text-white">Master Mistakes Directory</h2>
                                <p className="text-sm text-gray-400">Manage all standardized mistake categories used for issuing warnings.</p>
                              </div>
                              <div className="relative w-80">
                                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                                <input
                                  type="text"
                                  placeholder="Search directory..."
                                  value={mistakeDirectorySearch}
                                  onChange={(e) => setMistakeDirectorySearch(e.target.value)}
                                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-800 text-gray-300 border border-gray-700 rounded-lg outline-none focus:border-[#03b0f5]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[calc(100vh-300px)] pr-2">
                              {getFilteredMistakeDirectory().length === 0 ? (
                                <div className="col-span-3 text-center py-10 text-gray-500">No mistake categories found</div>
                              ) : (
                                getFilteredMistakeDirectory().map((type, index) => {
                                  const title = type.label || type.value || type;
                                  const description = type.description || 'No description provided for this mistake category.';
                                  return (
                                    <div key={type.value || index} className="border border-gray-700 rounded-lg p-4 hover:border-[#03b0f5] hover:shadow-lg transition-all group bg-gray-900/50">
                                      <h3 className="font-bold text-white text-base mb-2">{title}</h3>
                                      <p className="text-sm text-gray-400 line-clamp-2">{description}</p>
                                      <div className="mt-4 pt-3 border-t border-gray-800 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {permissions.can_edit_mistake_category && (
                                          <button
                                            onClick={() => openEditMistake(type)}
                                            className="text-xs font-medium text-[#03b0f5] hover:underline"
                                          >
                                            Edit
                                          </button>
                                        )}
                                        {(type._id || type.id) && permissions.can_delete_mistake_category && (
                                          <button
                                            onClick={() => handleDeleteMistakeCategory(type)}
                                            className="text-xs font-medium text-red-400 hover:underline"
                                          >
                                            Delete
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}


                      </>
                    ) : isManager() ? (
                      /* Manager/Junior Permission Tabs */
                      <>
                        {/* Tab 0: Team Warnings (for managers) */}
                        {selectedTab === 0 && (
                          <div>
                            {/* Search and Filter Row */}
                            <div className="flex items-center justify-between gap-4 mb-6">
                              <div className="flex items-center gap-3">
                              </div>
                              
                              <div className="flex items-center gap-3">
                                {/* Select Button / Selection Controls */}

                                {permissions?.can_delete && !showCheckboxes ? (
                                  <button
                                    onClick={handleShowCheckboxes}
                                    className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
                                  >
                                    Select
                                  </button>
                                ) : permissions?.can_delete && showCheckboxes ? (
                                  <div className="flex items-center gap-6 bg-gray-900 rounded-lg p-3">
                                    <label className="flex items-center cursor-pointer text-[#03B0F5] font-bold">
                                      <input
                                        type="checkbox"
                                        className="accent-blue-500 mr-2 cursor-pointer"
                                        checked={selectAll}
                                        onChange={handleSelectAll}
                                        style={{ width: 18, height: 18 }}
                                      />
                                      Select All
                                    </label>
                                    <span className="text-white font-semibold">
                                      {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} selected
                                    </span>
                                    <button
                                      className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                                      onClick={handleDeleteSelected}
                                      disabled={selectedRows.length === 0}
                                    >
                                      Delete ({selectedRows.length})
                                    </button>
                                    <button
                                      className="px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                                      onClick={handleCancelSelection}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : null}

                                <button
                                  className={`px-4 py-2 rounded hover:bg-gray-700 transition flex items-center gap-2 ${
                                    Object.values(filters).some(f => f && f !== '') 
                                      ? 'bg-[#03b0f5] text-white' 
                                      : 'bg-gray-600 text-white'
                                  }`}
                                  onClick={() => setFilterDialogOpen(true)}
                                >
                                  <Filter className="w-4 h-4" />
                                  More Filters
                                  {Object.values(filters).some(f => f && f !== '') && (
                                    <span className="bg-white text-[#03b0f5] px-2 py-1 rounded-full text-xs font-bold">
                                      Active
                                    </span>
                                  )}
                                </button>
                                
                                <div className="relative w-[350px]">
                                  <input
                                    type="text"
                                    placeholder="Search by employee, type, department..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full py-3 pl-12 pr-4 bg-[#1b2230] text-gray-300 rounded-lg border border-gray-600 focus:outline-none focus:border-[#03b0f5] focus:ring-1 focus:ring-[#03b0f5] text-sm placeholder-gray-500"
                                  />
                                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Search className="w-5 h-5 text-gray-500" />
                                  </div>
                                  {searchTerm && (
                                    <button
                                      onClick={() => setSearchTerm('')}
                                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Warnings Table (same as Super Admin) */}
                            <div className="relative">
                              {/* Horizontal scroll buttons for Manager Team Warnings table */}
                              {canScrollLeft && (
                                <button
                                  onClick={() => scrollMainTable('left')}
                                  className="absolute left-2 top-1/2 transform -translate-y-1/2 z-50 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
                                  style={{ backgroundColor: 'rgba(37, 99, 235, 1)' }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(29, 78, 216, 1)'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(37, 99, 235, 1)'}
                                  aria-label="Scroll left"
                                >
                                  <ChevronLeft className="w-9 h-9" />
                                </button>
                              )}
                              
                              {canScrollRight && (
                                <button
                                  onClick={() => scrollMainTable('right')}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 z-50 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
                                  style={{ backgroundColor: 'rgba(37, 99, 235, 1)' }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(29, 78, 216, 1)'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(37, 99, 235, 1)'}
                                  aria-label="Scroll right"
                                >
                                  <ChevronRight className="w-9 h-9" />
                                </button>
                              )}
                              
                              <div 
                                ref={tableScrollRef}
                                className="bg-black rounded-lg overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto"
                                onScroll={() => updateScrollButtons(tableScrollRef, setCanScrollLeft, setCanScrollRight)}
                              >
                              <table className="w-full">
                                <thead className="bg-gray-900 border-b border-gray-700 text-gray-400 font-medium sticky top-0 z-10">
                                  <tr>
                                    {showCheckboxes && (
                                      <th className="py-3 px-4 w-10">
                                        <input type="checkbox" checked={selectAll} onChange={handleSelectAll} className="rounded border-gray-600" />
                                      </th>
                                    )}
                                    <th className="py-3 px-4 w-12 text-center font-semibold">#</th>
                                    <th className="py-3 px-4 font-semibold">Date</th>
                                    <th className="py-3 px-4 font-semibold">Employee</th>
                                    <th className="py-3 px-4 font-semibold">Issued By</th>
                                    <th className="py-3 px-4 font-semibold">Mistake Type</th>
                                    <th className="py-3 px-4 font-semibold">Penalty</th>
                                    <th className="py-3 px-4 font-semibold min-w-[200px]">Employee Remark</th>
                                    <th className="py-3 px-4 text-center font-semibold">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                  {filteredWarnings.length === 0 ? (
                                    <tr><td colSpan={showCheckboxes ? "9" : "8"} className="text-center py-10 text-gray-500">No warnings found</td></tr>
                                  ) : (
                                    filteredWarnings.map((warning, index) => {
                                      const isWaived = waivedPenalties[warning.id] || warning.is_waived;
                                      const status = getWarningStatus(warning);
                                      const empRemark = getEmployeeRemark(warning);
                                      const isPending = status === 'Pending';
                                      
                                      return (
                                        <tr key={warning.id} className="hover:bg-gray-800/50 transition-colors cursor-pointer group" onClick={() => { setSelectedWarning(warning); setViewDialogOpen(true); }}>
                                          {showCheckboxes && (
                                            <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                              <input type="checkbox" checked={selectedRows.includes(warning.id)} onChange={() => handleRowSelect(warning.id)} className="rounded border-gray-600" />
                                            </td>
                                          )}
                                          <td className="py-3 px-4 text-center text-gray-500 font-medium text-xs">{(page * rowsPerPage) + index + 1}</td>
                                          <td className="py-3 px-4 text-gray-400 text-xs">
                                            {new Date(warning.issued_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                                          </td>
                                          <td className="py-3 px-4 font-bold text-white">{warning.issued_to_name || 'N/A'}</td>
                                          <td className="py-3 px-4 text-gray-400 text-xs">
                                            <div className="flex items-center gap-1.5">
                                              <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-400">{(warning.issued_by_name || 'U').charAt(0)}</div>
                                              {warning.issued_by_name || 'Unknown'}
                                            </div>
                                          </td>
                                          <td className="py-3 px-4 text-gray-300 font-medium">{warning.warning_type || 'N/A'}</td>
                                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                            {warning.penalty_amount && Number(warning.penalty_amount) > 0 ? (
                                              isWaived ? (
                                                <div className="flex items-center gap-2">
                                                  <div className="flex flex-col">
                                                    <span className="text-gray-500 line-through text-xs">₹{Number(warning.penalty_amount).toLocaleString('en-IN')}</span>
                                                    <span className="text-green-400 font-bold text-xs mt-0.5 flex items-center gap-1"><ShieldCheck className="w-3 h-3 inline" /> Waived Off</span>
                                                  </div>
                                                  {permissions?.can_edit && (
                                                    <button onClick={() => handleReinstatePenalty(warning.id)} className="text-amber-400 hover:text-white hover:bg-amber-600 border border-amber-700 p-1 rounded-md text-[10px] font-bold transition-colors" title="Reinstate Penalty">
                                                      <RotateCcw className="w-3.5 h-3.5" />
                                                    </button>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="flex items-center justify-between gap-2 group/penalty">
                                                  <span className="font-bold text-red-400">₹{Number(warning.penalty_amount).toLocaleString('en-IN')}</span>
                                                  {permissions?.can_edit && (
                                                    <button onClick={() => handleWaivePenalty(warning.id)} className="text-purple-400 hover:text-white hover:bg-purple-600 border border-purple-700 p-1 rounded-md text-[10px] font-bold transition-colors" title="Waive Penalty">
                                                      <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                  )}
                                                </div>
                                              )
                                            ) : (
                                              <span className="font-medium text-gray-500">-</span>
                                            )}
                                          </td>
                                          <td className="py-3 px-4 text-gray-400 text-xs max-w-[200px] truncate" title={empRemark || warning.warning_message || ''}>
                                            {isPending ? (
                                              <span className="italic text-gray-500">Waiting for response...</span>
                                            ) : (
                                              empRemark || warning.warning_message || '-'
                                            )}
                                          </td>
                                          <td className="py-3 px-4 text-center">
                                            {isPending ? (
                                              <span className="bg-amber-900/30 text-amber-400 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-amber-700">Pending</span>
                                            ) : (
                                              <span className="bg-green-900/30 text-green-400 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-green-700">{status}</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                              </div>
                            </div>

                            {/* Pagination */}
                            {totalWarnings > rowsPerPage && (
                              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
                                <div className="text-gray-400">
                                  Showing {Math.min((page * rowsPerPage) + 1, totalWarnings)} to {Math.min((page + 1) * rowsPerPage, totalWarnings)} of {totalWarnings} warnings
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setPage(Math.max(0, page - 1))}
                                    disabled={page === 0}
                                    className="px-3 py-2 bg-gray-600 text-white rounded disabled:opacity-50 hover:bg-gray-700 transition"
                                  >
                                    Previous
                                  </button>
                                  <span className="px-3 py-2 text-white">
                                    Page {page + 1} of {Math.ceil(totalWarnings / rowsPerPage)}
                                  </span>
                                  <button
                                    onClick={() => setPage(Math.min(Math.ceil(totalWarnings / rowsPerPage) - 1, page + 1))}
                                    disabled={page >= Math.ceil(totalWarnings / rowsPerPage) - 1}
                                    className="px-3 py-2 bg-gray-600 text-white rounded disabled:opacity-50 hover:bg-gray-700 transition"
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab 1: My Warnings (for managers) */}
                        {selectedTab === 1 && (
                          <div>
                            {/* Search Row */}
                            <div className="flex items-center justify-between gap-4 mb-6">
                              <div className="flex items-center gap-3">
                              </div>
                              
                              <div className="flex items-center gap-3">
                                {/* Select Button / Selection Controls */}

                                {permissions?.can_delete && !showCheckboxes ? (
                                  <button
                                    onClick={handleShowCheckboxes}
                                    className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
                                  >
                                    Select
                                  </button>
                                ) : permissions?.can_delete && showCheckboxes ? (
                                  <div className="flex items-center gap-6 bg-gray-900 rounded-lg p-3">
                                    <label className="flex items-center cursor-pointer text-[#03B0F5] font-bold">
                                      <input
                                        type="checkbox"
                                        className="accent-blue-500 mr-2 cursor-pointer"
                                        checked={selectAll}
                                        onChange={handleSelectAll}
                                        style={{ width: 18, height: 18 }}
                                      />
                                      Select All
                                    </label>
                                    <span className="text-white font-semibold">
                                      {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} selected
                                    </span>
                                    <button
                                      className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                                      onClick={handleDeleteSelected}
                                      disabled={selectedRows.length === 0}
                                    >
                                      Delete ({selectedRows.length})
                                    </button>
                                    <button
                                      className="px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                                      onClick={handleCancelSelection}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : null}

                                <div className="relative w-[350px]">
                                  <input
                                    type="text"
                                    placeholder="Search my warnings..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full py-3 pl-12 pr-4 bg-[#1b2230] text-gray-300 rounded-lg border border-gray-600 focus:outline-none focus:border-[#03b0f5] focus:ring-1 focus:ring-[#03b0f5] text-sm placeholder-gray-500"
                                  />
                                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Search className="w-5 h-5 text-gray-500" />
                                  </div>
                                  {searchTerm && (
                                    <button
                                      onClick={() => setSearchTerm('')}
                                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* My Warnings Table */}
                            <div className="relative">
                              {/* Horizontal scroll buttons for My Warnings table */}
                              {myWarningsCanScrollLeft && (
                                <button
                                  onClick={() => scrollMyWarningsTable('left')}
                                  className="absolute left-2 top-1/2 transform -translate-y-1/2 z-50 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
                                  style={{ backgroundColor: 'rgba(37, 99, 235, 1)' }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(29, 78, 216, 1)'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(37, 99, 235, 1)'}
                                  aria-label="Scroll left"
                                >
                                  <ChevronLeft className="w-9 h-9" />
                                </button>
                              )}
                              
                              {myWarningsCanScrollRight && (
                                <button
                                  onClick={() => scrollMyWarningsTable('right')}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 z-50 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
                                  style={{ backgroundColor: 'rgba(37, 99, 235, 1)' }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(29, 78, 216, 1)'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(37, 99, 235, 1)'}
                                  aria-label="Scroll right"
                                >
                                  <ChevronRight className="w-9 h-9" />
                                </button>
                              )}
                              
                              <div 
                                ref={myWarningsTableScrollRef}
                                className="bg-black rounded-lg overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto"
                                onScroll={() => updateScrollButtons(myWarningsTableScrollRef, setMyWarningsCanScrollLeft, setMyWarningsCanScrollRight)}
                              >
                              <table className="w-full">
                                <thead className="bg-gray-900 border-b border-gray-700 text-gray-400 font-medium sticky top-0 z-10">
                                  <tr>
                                    {showCheckboxes && (
                                      <th className="py-3 px-4 w-10">
                                        <input type="checkbox" checked={selectAll} onChange={handleSelectAll} className="rounded border-gray-600" />
                                      </th>
                                    )}
                                    <th className="py-3 px-4 w-12 text-center font-semibold">#</th>
                                    <th className="py-3 px-4 font-semibold">Date</th>
                                    <th className="py-3 px-4 font-semibold">Mistake Type</th>
                                    <th className="py-3 px-4 font-semibold">Penalty</th>
                                    <th className="py-3 px-4 font-semibold">Issued By</th>
                                    <th className="py-3 px-4 font-semibold min-w-[200px]">Employee Remark</th>
                                    <th className="py-3 px-4 text-center font-semibold">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                  {filteredWarnings.length === 0 ? (
                                    <tr><td colSpan={showCheckboxes ? "8" : "7"} className="text-center py-10 text-gray-500">No warnings found</td></tr>
                                  ) : (
                                    filteredWarnings.map((warning, index) => {
                                      const isWaived = waivedPenalties[warning.id] || warning.is_waived;
                                      const status = getWarningStatus(warning);
                                      const empRemark = getEmployeeRemark(warning);
                                      const isPending = status === 'Pending';
                                      
                                      return (
                                        <tr key={warning.id} className="hover:bg-gray-800/50 transition-colors cursor-pointer group" onClick={() => { setSelectedWarning(warning); setViewDialogOpen(true); }}>
                                          {showCheckboxes && (
                                            <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                              <input type="checkbox" checked={selectedRows.includes(warning.id)} onChange={() => handleRowSelect(warning.id)} className="rounded border-gray-600" />
                                            </td>
                                          )}
                                          <td className="py-3 px-4 text-center text-gray-500 font-medium text-xs">{(page * rowsPerPage) + index + 1}</td>
                                          <td className="py-3 px-4 text-gray-400 text-xs">
                                            {new Date(warning.issued_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                                          </td>
                                          <td className="py-3 px-4 text-gray-300 font-medium">{warning.warning_type || 'N/A'}</td>
                                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                            {warning.penalty_amount && Number(warning.penalty_amount) > 0 ? (
                                              isWaived ? (
                                                <div className="flex items-center gap-2">
                                                  <div className="flex flex-col">
                                                    <span className="text-gray-500 line-through text-xs">₹{Number(warning.penalty_amount).toLocaleString('en-IN')}</span>
                                                    <span className="text-green-400 font-bold text-xs mt-0.5 flex items-center gap-1"><ShieldCheck className="w-3 h-3 inline" /> Waived Off</span>
                                                  </div>
                                                  {permissions?.can_edit && (
                                                    <button onClick={() => handleReinstatePenalty(warning.id)} className="text-amber-400 hover:text-white hover:bg-amber-600 border border-amber-700 p-1 rounded-md text-[10px] font-bold transition-colors" title="Reinstate Penalty">
                                                      <RotateCcw className="w-3.5 h-3.5" />
                                                    </button>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="flex items-center justify-between gap-2 group/penalty">
                                                  <span className="font-bold text-red-400">₹{Number(warning.penalty_amount).toLocaleString('en-IN')}</span>
                                                  {permissions?.can_edit && (
                                                    <button onClick={() => handleWaivePenalty(warning.id)} className="text-purple-400 hover:text-white hover:bg-purple-600 border border-purple-700 p-1 rounded-md text-[10px] font-bold transition-colors" title="Waive Penalty">
                                                      <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                  )}
                                                </div>
                                              )
                                            ) : (
                                              <span className="font-medium text-gray-500">-</span>
                                            )}
                                          </td>
                                          <td className="py-3 px-4 text-gray-400 text-xs">
                                            <div className="flex items-center gap-1.5">
                                              <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-400">{(warning.issued_by_name || 'U').charAt(0)}</div>
                                              {warning.issued_by_name || 'Unknown'}
                                            </div>
                                          </td>
                                          <td className="py-3 px-4 text-gray-400 text-xs max-w-[200px] truncate" title={empRemark || warning.warning_message || ''}>
                                            {isPending ? (
                                              <span className="italic text-gray-500">Waiting for response...</span>
                                            ) : (
                                              empRemark || warning.warning_message || '-'
                                            )}
                                          </td>
                                          <td className="py-3 px-4 text-center">
                                            {isPending ? (
                                              <span className="bg-amber-900/30 text-amber-400 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-amber-700">Pending</span>
                                            ) : (
                                              <span className="bg-green-900/30 text-green-400 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-green-700">{status}</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                              </div>
                            </div>

                            {/* Pagination */}
                            {totalWarnings > rowsPerPage && (
                              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
                                <div className="text-gray-400">
                                  Showing {Math.min((page * rowsPerPage) + 1, totalWarnings)} to {Math.min((page + 1) * rowsPerPage, totalWarnings)} of {totalWarnings} warnings
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setPage(Math.max(0, page - 1))}
                                    disabled={page === 0}
                                    className="px-3 py-2 bg-gray-600 text-white rounded disabled:opacity-50 hover:bg-gray-700 transition"
                                  >
                                    Previous
                                  </button>
                                  <span className="px-3 py-2 text-white">
                                    Page {page + 1} of {Math.ceil(totalWarnings / rowsPerPage)}
                                  </span>
                                  <button
                                    onClick={() => setPage(Math.min(Math.ceil(totalWarnings / rowsPerPage) - 1, page + 1))}
                                    disabled={page >= Math.ceil(totalWarnings / rowsPerPage) - 1}
                                    className="px-3 py-2 bg-gray-600 text-white rounded disabled:opacity-50 hover:bg-gray-700 transition"
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      /* Users with No Warnings Permission: Only My Warnings */
                      <div>
                        {/* Search Row */}
                        <div className="flex items-center justify-between gap-4 mb-6">
                          <div className="flex items-center gap-3">
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {/* Select Button / Selection Controls */}

                            {permissions?.can_delete && !showCheckboxes ? (
                              <button
                                onClick={handleShowCheckboxes}
                                className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
                              >
                                Select
                              </button>
                            ) : permissions?.can_delete && showCheckboxes ? (
                              <div className="flex items-center gap-6 bg-gray-900 rounded-lg p-3">
                                <label className="flex items-center cursor-pointer text-[#03B0F5] font-bold">
                                  <input
                                    type="checkbox"
                                    className="accent-blue-500 mr-2 cursor-pointer"
                                    checked={selectAll}
                                    onChange={handleSelectAll}
                                    style={{ width: 18, height: 18 }}
                                  />
                                  Select All
                                </label>
                                <span className="text-white font-semibold">
                                  {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} selected
                                </span>
                                <button
                                  className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                                  onClick={handleDeleteSelected}
                                  disabled={selectedRows.length === 0}
                                >
                                  Delete ({selectedRows.length})
                                </button>
                                <button
                                  className="px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                                  onClick={handleCancelSelection}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : null}
                            
                            <div className="relative w-[350px]">
                              <input
                                type="text"
                                placeholder="Search my warnings..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full py-3 pl-12 pr-4 bg-[#1b2230] text-gray-300 rounded-lg border border-gray-600 focus:outline-none focus:border-[#03b0f5] focus:ring-1 focus:ring-[#03b0f5] text-sm placeholder-gray-500"
                              />
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className="w-5 h-5 text-gray-500" />
                              </div>
                              {searchTerm && (
                                <button
                                  onClick={() => setSearchTerm('')}
                                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* My Warnings Table */}
                        <div className="relative">
                          {/* Horizontal scroll buttons for User My Warnings table */}
                          {myWarningsCanScrollLeft && (
                            <button
                              onClick={() => scrollMyWarningsTable('left')}
                              className="absolute left-2 top-1/2 transform -translate-y-1/2 z-50 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
                              style={{ backgroundColor: 'rgba(37, 99, 235, 1)' }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(29, 78, 216, 1)'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(37, 99, 235, 1)'}
                              aria-label="Scroll left"
                            >
                              <ChevronLeft className="w-9 h-9" />
                            </button>
                          )}
                          
                          {myWarningsCanScrollRight && (
                            <button
                              onClick={() => scrollMyWarningsTable('right')}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 z-50 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
                              style={{ backgroundColor: 'rgba(37, 99, 235, 1)' }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(29, 78, 216, 1)'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(37, 99, 235, 1)'}
                              aria-label="Scroll right"
                            >
                              <ChevronRight className="w-9 h-9" />
                            </button>
                          )}
                          
                          <div 
                            ref={myWarningsTableScrollRef}
                            className="bg-black rounded-lg overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto"
                            onScroll={() => updateScrollButtons(myWarningsTableScrollRef, setMyWarningsCanScrollLeft, setMyWarningsCanScrollRight)}
                          >
                          <table className="w-full">
                            <thead className="bg-gray-900 border-b border-gray-700 text-gray-400 font-medium sticky top-0 z-10">
                              <tr>
                                {showCheckboxes && (
                                  <th className="py-3 px-4 w-10">
                                    <input type="checkbox" checked={selectAll} onChange={handleSelectAll} className="rounded border-gray-600" />
                                  </th>
                                )}
                                <th className="py-3 px-4 w-12 text-center font-semibold">#</th>
                                <th className="py-3 px-4 font-semibold">Date</th>
                                <th className="py-3 px-4 font-semibold">Mistake Type</th>
                                <th className="py-3 px-4 font-semibold">Penalty</th>
                                <th className="py-3 px-4 font-semibold">Issued By</th>
                                <th className="py-3 px-4 font-semibold min-w-[200px]">Employee Remark</th>
                                <th className="py-3 px-4 text-center font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                              {filteredWarnings.length === 0 ? (
                                <tr><td colSpan={showCheckboxes ? "8" : "7"} className="text-center py-10 text-gray-500">No warnings found</td></tr>
                              ) : (
                                filteredWarnings.map((warning, index) => {
                                  const isWaived = waivedPenalties[warning.id] || warning.is_waived;
                                  const status = getWarningStatus(warning);
                                  const empRemark = getEmployeeRemark(warning);
                                  const isPending = status === 'Pending';
                                  
                                  return (
                                    <tr key={warning.id} className="hover:bg-gray-800/50 transition-colors cursor-pointer group" onClick={() => { setSelectedWarning(warning); setViewDialogOpen(true); }}>
                                      {showCheckboxes && (
                                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                          <input type="checkbox" checked={selectedRows.includes(warning.id)} onChange={() => handleRowSelect(warning.id)} className="rounded border-gray-600" />
                                        </td>
                                      )}
                                      <td className="py-3 px-4 text-center text-gray-500 font-medium text-xs">{(page * rowsPerPage) + index + 1}</td>
                                      <td className="py-3 px-4 text-gray-400 text-xs">
                                        {new Date(warning.issued_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                                      </td>
                                      <td className="py-3 px-4 text-gray-300 font-medium">{warning.warning_type || 'N/A'}</td>
                                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                        {warning.penalty_amount && Number(warning.penalty_amount) > 0 ? (
                                          isWaived ? (
                                            <div className="flex items-center gap-2">
                                              <div className="flex flex-col">
                                                <span className="text-gray-500 line-through text-xs">₹{Number(warning.penalty_amount).toLocaleString('en-IN')}</span>
                                                <span className="text-green-400 font-bold text-xs mt-0.5 flex items-center gap-1"><ShieldCheck className="w-3 h-3 inline" /> Waived Off</span>
                                              </div>
                                              {permissions?.can_edit && (
                                                <button onClick={() => handleReinstatePenalty(warning.id)} className="text-amber-400 hover:text-white hover:bg-amber-600 border border-amber-700 p-1 rounded-md text-[10px] font-bold transition-colors" title="Reinstate Penalty">
                                                  <RotateCcw className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-between gap-2 group/penalty">
                                              <span className="font-bold text-red-400">₹{Number(warning.penalty_amount).toLocaleString('en-IN')}</span>
                                              {permissions?.can_edit && (
                                                <button onClick={() => handleWaivePenalty(warning.id)} className="text-purple-400 hover:text-white hover:bg-purple-600 border border-purple-700 p-1 rounded-md text-[10px] font-bold transition-colors" title="Waive Penalty">
                                                  <Edit className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          )
                                        ) : (
                                          <span className="font-medium text-gray-500">-</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-gray-400 text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-400">{(warning.issued_by_name || 'U').charAt(0)}</div>
                                          {warning.issued_by_name || 'Unknown'}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 text-gray-400 text-xs max-w-[200px] truncate" title={empRemark || warning.warning_message || ''}>
                                        {isPending ? (
                                          <span className="italic text-gray-500">Waiting for response...</span>
                                        ) : (
                                          empRemark || warning.warning_message || '-'
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        {isPending ? (
                                          <span className="bg-amber-900/30 text-amber-400 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-amber-700">Pending</span>
                                        ) : (
                                          <span className="bg-green-900/30 text-green-400 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-green-700">{status}</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                          </div>
                        </div>

                        {/* Pagination */}
                        {totalWarnings > rowsPerPage && (
                          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
                            <div className="text-gray-400">
                              Showing {Math.min((page * rowsPerPage) + 1, totalWarnings)} to {Math.min((page + 1) * rowsPerPage, totalWarnings)} of {totalWarnings} warnings
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                                className="px-3 py-2 bg-gray-600 text-white rounded disabled:opacity-50 hover:bg-gray-700 transition"
                              >
                                Previous
                              </button>
                              <span className="px-3 py-2 text-white">
                                Page {page + 1} of {Math.ceil(totalWarnings / rowsPerPage)}
                              </span>
                              <button
                                onClick={() => setPage(Math.min(Math.ceil(totalWarnings / rowsPerPage) - 1, page + 1))}
                                disabled={page >= Math.ceil(totalWarnings / rowsPerPage) - 1}
                                className="px-3 py-2 bg-gray-600 text-white rounded disabled:opacity-50 hover:bg-gray-700 transition"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals will be added here */}
      {/* Add Warning Modal - UI matching CreateTask popup */}
      {addDialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden relative border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/80 shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-red-400" /> Issue New Warning
              </h2>
              <button
                onClick={() => {
                  setAddDialogOpen(false);
                  setFormData({
                    warning_type: '',
                    issued_to: '',
                    penalty_amount: '',
                    warning_message: ''
                  });
                  setSelectedDepartmentForAdd('');
                  setSelectedFiles([]);
                  setSimilarWarnings([]);
                  setShowingSimilarWarnings(false);
                  resetAllSearchStates();
                }}
                className="text-gray-400 hover:text-white hover:bg-gray-700 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[75vh] overflow-y-auto">
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">
                {/* Date & Time and Issued By Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-300">Issue Date <span className="text-red-500">*</span></label>
                    <div className="relative border border-gray-600 rounded-lg bg-gray-800 flex items-center">
                      <Calendar className="w-4 h-4 text-gray-500 absolute left-3" />
                      <input
                        type="text"
                        className="w-full text-sm text-gray-300 outline-none py-3 pl-9 pr-3 bg-transparent font-medium cursor-not-allowed"
                        value={new Date().toLocaleDateString('en-GB', { 
                          day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
                        })}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-300">Issued By <span className="text-red-500">*</span></label>
                    <div className="relative border border-gray-600 rounded-lg bg-gray-800 flex items-center">
                      <User className="w-4 h-4 text-gray-500 absolute left-3" />
                      <input
                        type="text"
                        className="w-full text-sm text-gray-300 outline-none py-3 pl-9 pr-3 bg-transparent font-medium cursor-not-allowed"
                        value={getCurrentUserFullName()}
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                {/* Department and Issued To Row */}
                <div className="bg-cyan-900/10 border border-cyan-900/30 p-4 rounded-xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative" ref={departmentDropdownRef}>
                    <label className="text-sm font-semibold text-gray-300">Department <span className="text-red-500">*</span></label>
                    <div 
                      className="w-full px-3 py-2.5 border border-gray-600 rounded-lg bg-gray-800 cursor-pointer flex justify-between items-center hover:border-cyan-500/50 transition-colors mt-1.5"
                      onClick={() => toggleDropdown('department')}
                    >
                      <span className={selectedDepartmentName ? 'text-gray-200' : 'text-gray-500'}>
                        {selectedDepartmentName || 'Select Departments'}
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                    
                    {showDepartmentDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg">
                        <div className="p-2 border-b border-gray-700 bg-gray-800/80 sticky top-0">
                          <div className="relative flex items-center">
                            <Search className="absolute left-3 w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              placeholder="Search departments..."
                              value={departmentSearchTerm}
                              onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-600 rounded-md bg-gray-700 text-white outline-none focus:border-cyan-500"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          <div
                            className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-gray-300"
                            onClick={() => {
                              setSelectedDepartmentForAdd('');
                              setSelectedDepartmentName('All Departments');
                              setDepartmentSearchTerm('');
                              setShowDepartmentDropdown(false);
                            }}
                          >
                            All Departments
                          </div>
                          {departments
                            .filter(dept => dept.name.toLowerCase().includes(departmentSearchTerm.toLowerCase()))
                            .map((dept) => (
                              <div
                                key={dept.id}
                                className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-gray-300"
                                onClick={() => {
                                  setSelectedDepartmentForAdd(dept.id);
                                  setSelectedDepartmentName(dept.name);
                                  setDepartmentSearchTerm('');
                                  setShowDepartmentDropdown(false);
                                }}
                              >
                                {dept.name}
                              </div>
                            ))}
                          {departments.filter(dept => dept.name.toLowerCase().includes(departmentSearchTerm.toLowerCase())).length === 0 && departmentSearchTerm && (
                            <div className="px-4 py-2 text-gray-500">No departments found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative" ref={employeeDropdownRef}>
                    <label className="text-sm font-semibold text-gray-300">
                      Issued To <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5 border border-gray-600 rounded-lg bg-gray-800 p-1.5 min-h-[42px] cursor-text mt-1.5">
                      {selectedEmployeeNames.length > 0 ? (
                        selectedEmployeeNames.map((emp) => {
                          const initials = emp.name.split(' ')
                            .map(part => part[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase();
                          return (
                            <div
                              key={emp.id}
                              className="bg-gray-700 border border-gray-600 text-gray-200 text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium"
                            >
                              {emp.name}
                              <button
                                type="button"
                                className="hover:text-red-400 transition-colors"
                                onClick={() => handleRemoveEmployee(emp.id)}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })
                      ) : null}
                      <button
                        type="button"
                        className="text-cyan-400 font-medium hover:text-cyan-300 text-sm ml-auto"
                        onClick={() => toggleDropdown('employee')}
                      >
                        {selectedEmployeeNames.length > 0 ? '+ Add more' : '+ Add employees'}
                      </button>
                    </div>
                    
                    {showEmployeeDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg">
                        <div className="p-2 border-b border-gray-700 bg-gray-800/80 sticky top-0">
                          <div className="relative flex items-center">
                            <Search className="absolute left-3 w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              placeholder="Search employees..."
                              value={employeeSearchTerm}
                              onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-600 rounded-md bg-gray-700 text-white outline-none focus:border-cyan-500"
                              autoFocus
                            />
                            {employeeSearchTerm && (
                              <button
                                className="absolute right-3 text-gray-400 hover:text-white"
                                onClick={() => setEmployeeSearchTerm("")}
                                type="button"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto divide-y divide-gray-700">
                          {getFilteredEmployees()
                            .filter(emp => 
                              emp.name && emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
                            )
                            .map(emp => {
                              const employeeId = emp._id || emp.id || emp.user_id || emp.employee_id;
                              const isSelected = selectedEmployees.includes(employeeId);
                              const displayName = emp.name || emp.employee_name || emp.full_name || 'Unknown';
                              const initials = displayName.split(' ')
                                .map(part => part[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase();
                              
                              return (
                                <div
                                  key={employeeId}
                                  className={`p-3 cursor-pointer text-gray-300 transition hover:bg-gray-700 flex items-center ${
                                    isSelected ? 'bg-gray-700/50' : ''
                                  }`}
                                  onClick={() => handleEmployeeSelect(emp)}
                                >
                                  <div className="w-8 h-8 rounded-full bg-cyan-600 text-white flex items-center justify-center mr-3 flex-shrink-0 text-xs font-medium">
                                    {initials}
                                  </div>
                                  <div className="flex flex-col flex-1">
                                    <span className="font-medium text-sm text-gray-200">{displayName}</span>
                                    <span className="text-xs text-gray-500">
                                      {emp.department_name || emp.department || 'Unknown Department'}
                                    </span>
                                  </div>
                                  <div className={`w-5 h-5 border rounded ${
                                    isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-gray-500'
                                  } flex items-center justify-center`}>
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                      </svg>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          {getFilteredEmployees().filter(emp => 
                            emp.name && emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
                          ).length === 0 && employeeSearchTerm && (
                            <div className="p-3 text-gray-500 text-center">No employees found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>

                {/* Mistake Type */}
                <div>
                  <div className="relative" ref={warningTypeDropdownRef}>
                    <label className="text-sm font-semibold text-gray-300 flex justify-between items-center">
                      <span>Mistake Type / Category <span className="text-red-500">*</span></span>
                    </label>
                    <div 
                      className="w-full px-3 py-2.5 border border-gray-600 rounded-lg bg-gray-800 cursor-pointer flex justify-between items-center hover:border-cyan-500/50 transition-colors mt-1.5"
                      onClick={() => toggleDropdown('warningType')}
                    >
                      <span className={selectedWarningTypeName ? 'text-gray-200 text-sm font-medium' : 'text-gray-500 text-sm'}>
                        {selectedWarningTypeName || 'Search and select the specific mistake...'}
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${showWarningTypeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                    
                    {showWarningTypeDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden">
                        <div className="p-2 border-b border-gray-700 bg-gray-800/80 sticky top-0">
                          <div className="relative flex items-center">
                            <Search className="absolute left-3 w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              placeholder="Search directory..."
                              value={warningTypeSearchTerm}
                              onChange={(e) => setWarningTypeSearchTerm(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-600 rounded-md bg-gray-700 text-white outline-none focus:border-cyan-500"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-gray-700/50">
                          {mistakeTypes
                            .filter(type => 
                              (type.label || type.value || '').toLowerCase().includes(warningTypeSearchTerm.toLowerCase())
                            )
                            .map((type) => (
                              <div
                                key={type.value}
                                className="p-3 hover:bg-gray-700 cursor-pointer transition-colors"
                                onClick={() => {
                                  handleFormChange('warning_type', type.value);
                                  setSelectedWarningTypeName(type.label || type.value);
                                  setWarningTypeSearchTerm('');
                                  setShowWarningTypeDropdown(false);
                                }}
                              >
                                <h4 className="text-sm font-bold text-gray-200">{type.label || type.value}</h4>
                                {type.description && (
                                  <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                                )}
                              </div>
                            ))}
                          {mistakeTypes.filter(type => 
                            (type.label || type.value || '').toLowerCase().includes(warningTypeSearchTerm.toLowerCase())
                          ).length === 0 && warningTypeSearchTerm && (
                            <div className="p-3 text-gray-500 text-center">No mistake types found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Penalty Amount */}
                <div className="w-full md:w-1/2 md:pr-2.5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-300">Penalty Amount (₹)</label>
                    <div className="relative border border-gray-600 rounded-lg bg-gray-800 flex items-center overflow-hidden mt-1.5">
                      <span className="px-3 py-3 text-gray-400 bg-gray-700 border-r border-gray-600 font-medium">₹</span>
                      <input
                        type="text"
                        value={formData.penalty_amount}
                        onChange={(e) => handleFormChange('penalty_amount', e.target.value)}
                        className="w-full text-sm text-gray-200 outline-none px-3 py-3 bg-transparent font-medium"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Attachments Section */}
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">Attachments</label>
                  <button
                    type="button"
                    onClick={() => document.getElementById('fileInput').click()}
                    className="bg-gray-700 text-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-600 transition border border-gray-600"
                  >
                    <FileText className="w-4 h-4" />
                    Photo/PDF
                  </button>
                  <input
                    id="fileInput"
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      setSelectedFiles(prev => [...prev, ...files]);
                    }}
                    className="hidden"
                  />
                  
                  {selectedFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-800 p-3 rounded-lg border border-gray-700">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-300">{file.name}</span>
                            <span className="text-xs text-green-400">Ready</span>
                            <span className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Warning Message */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-300">Warning Details & Expected Change <span className="text-red-500">*</span></label>
                  <textarea
                    value={formData.warning_message}
                    onChange={(e) => handleFormChange('warning_message', e.target.value)}
                    rows={4}
                    className="w-full text-sm text-gray-200 outline-none p-3 resize-none bg-gray-800 border border-gray-600 rounded-lg focus:border-cyan-500 transition-all leading-relaxed"
                    placeholder="Explain the exact incident and what improvement you expect..."
                  />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/80 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAddDialogOpen(false);
                  setFormData({ warning_type: '', issued_to: '', penalty_amount: '', warning_message: '' });
                  setSelectedDepartmentForAdd('');
                  setSelectedFiles([]);
                  setSimilarWarnings([]);
                  setShowingSimilarWarnings(false);
                  resetAllSearchStates();
                }}
                className="px-5 py-2.5 text-sm font-semibold text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md transition-all flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Send Warning
              </button>
            </div>

              {/* Smart Insights Panel - Same Mistake Repeated */}
              {showingSimilarWarnings && similarWarnings.length > 0 && (
                <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-5 mt-1 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-red-700/30 pb-3 gap-2">
                    <div className="flex items-center gap-2.5 text-red-400">
                      <div className="p-1.5 bg-red-900/40 rounded-md">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      </div>
                      <h3 className="font-bold text-base">Same Mistake Repeated</h3>
                    </div>
                    <span className="bg-red-600 text-white text-[11px] uppercase tracking-wider px-3 py-1 rounded-full font-bold shadow-sm w-fit">
                      {similarWarnings.length}{similarWarnings.length === 1 ? 'st' : similarWarnings.length === 2 ? 'nd' : similarWarnings.length === 3 ? 'rd' : 'th'} Time Offense
                    </span>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 mb-6 bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-sm">
                    <div className="flex-1 text-center border-r border-gray-700">
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">Total Penalty Given</p>
                      <p className="text-xl font-black text-red-400">
                        ₹{similarWarnings.reduce((total, w) => total + (parseFloat(w.penalty_amount) || 0), 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">Total Waived Off</p>
                      <p className="text-xl font-black text-green-400">
                        ₹{similarWarnings.filter(w => w.is_waived || waivedPenalties[w.id]).reduce((total, w) => total + (parseFloat(w.penalty_amount) || 0), 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  {/* Vertical Timeline */}
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[15px] before:w-0.5 before:bg-red-800/50">
                    {similarWarnings
                      .sort((a, b) => new Date(b.issued_date) - new Date(a.issued_date))
                      .map((warning, index) => (
                      <div key={warning.id || index} className="relative flex gap-4 items-start">
                        <div className="w-8 h-8 rounded-full bg-gray-800 border border-red-700/50 flex items-center justify-center shrink-0 z-10 text-red-400 shadow-sm">
                          <span className="text-xs font-bold">{similarWarnings.length - index}</span>
                        </div>
                        <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg shadow-sm p-4 hover:border-red-700/50 transition-all">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3 border-b border-gray-700 pb-2">
                            <h4 className="font-bold text-gray-200 text-sm flex items-center gap-2">
                              {warning.warning_type || 'Warning'}
                              <span className="text-gray-500 font-medium text-xs ml-2">
                                {new Date(warning.issued_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                              </span>
                            </h4>
                            <span className="bg-gray-700 text-gray-300 text-[11px] px-3 py-1 rounded-md font-bold border border-gray-600 mt-2 sm:mt-0">
                              Penalty: ₹{Number(warning.penalty_amount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="mb-3">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
                              Issued by {warning.issued_by_name || 'Unknown'}:
                            </span>
                            <p className="text-sm text-gray-300 bg-gray-900/60 p-3 rounded-lg border border-gray-700 font-medium leading-relaxed">
                              "{warning.warning_message || 'No message provided'}"
                            </p>
                          </div>
                          {(warning.employee_remark || warning.employee_response) ? (
                            <div className="bg-green-900/20 p-3 rounded-lg border border-green-700/30">
                              <span className="font-bold text-[10px] uppercase tracking-widest block mb-1 text-green-500 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Employee Remark (Accepted):
                              </span>
                              <p className="italic text-sm text-green-300">
                                "{warning.employee_remark || warning.employee_response}"
                              </p>
                            </div>
                          ) : (
                            <div className="bg-amber-900/20 p-3 rounded-lg border border-amber-700/30 text-amber-400 text-sm font-medium flex items-center gap-1.5">
                              <Clock className="w-4 h-4" /> Pending employee acknowledgement
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* View Warning Modal */}
      {viewDialogOpen && selectedWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden relative border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/80">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" /> Warning Record Details
              </h2>
              <button
                onClick={() => setViewDialogOpen(false)}
                className="text-gray-400 hover:text-white hover:bg-gray-700 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* 2x2 Grid: Employee, Issued By, Mistake Category, Penalty */}
              <div className="grid grid-cols-2 gap-4 bg-gray-800/60 p-4 rounded-xl border border-gray-700">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Employee Name</p>
                  <p className="text-sm font-bold text-white">{selectedWarning.issued_to_name || 'Unknown Employee'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Issued By</p>
                  <p className="text-sm font-bold text-white">{selectedWarning.issued_by_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Mistake Category</p>
                  <p className="text-sm font-bold text-red-400">{selectedWarning.warning_type || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Penalty Amount</p>
                  <p className="text-sm font-bold text-white">
                    {(waivedPenalties[selectedWarning.id] || selectedWarning.is_waived) ? (
                      <span className="flex items-center gap-2">
                        <span className="line-through text-gray-500">₹{Number(selectedWarning.penalty_amount).toLocaleString('en-IN')}</span>
                        <span className="text-green-400 text-xs font-bold">Waived Off</span>
                      </span>
                    ) : (
                      <span className="text-red-400">₹{Number(selectedWarning.penalty_amount).toLocaleString('en-IN')}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Extra Info Row */}
              <div className="grid grid-cols-2 gap-4 bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Date & Time</p>
                  <p className="text-sm font-medium text-gray-300">
                    {selectedWarning.issued_date ? new Date(selectedWarning.issued_date).toLocaleDateString('en-GB', { 
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
                    }).replace(',', '') : formatDate(selectedWarning.issued_date)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Department</p>
                  <p className="text-sm font-medium text-gray-300">{selectedWarning.department_name || 'N/A'}</p>
                </div>
              </div>

              {/* Manager's Remark */}
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Manager's Remark</p>
                <p className="text-sm text-gray-300 bg-gray-800 border border-gray-700 p-4 rounded-lg leading-relaxed">
                  "{selectedWarning.warning_message || 'No message provided'}"
                </p>
              </div>

              {/* Employee's Remark */}
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Employee's Remark</p>
                <div className="bg-green-900/30 border border-green-700/40 p-4 rounded-lg">
                  <p className="text-sm text-green-300 italic">
                    {getEmployeeRemark(selectedWarning) || 'Waiting for employee response...'}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Edit Warning Modal */}
      {editDialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden relative border border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/80">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-cyan-400" /> Edit Warning
              </h2>
              <button
                onClick={() => setEditDialogOpen(false)}
                className="text-gray-400 hover:text-white hover:bg-gray-700 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[75vh] overflow-y-auto">
            <form onSubmit={(e) => { e.preventDefault(); handleEditSubmit(); }} className="space-y-5">
              {/* Date & Time and Created By Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-300">Date & Time</label>
                  <div className="relative border border-gray-600 rounded-lg bg-gray-800 flex items-center">
                    <Calendar className="w-4 h-4 text-gray-500 absolute left-3" />
                    <input
                      type="text"
                      className="w-full text-sm text-gray-300 outline-none py-3 pl-9 pr-3 bg-transparent font-medium cursor-not-allowed"
                      value={editingWarning ? new Date(editingWarning.issue_date).toLocaleDateString('en-GB', { 
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
                      }).replace(',', '') : ''}
                      readOnly
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-300">Created By</label>
                  <div className="relative border border-gray-600 rounded-lg bg-gray-800 flex items-center">
                    <User className="w-4 h-4 text-gray-500 absolute left-3" />
                    <input
                      type="text"
                      className="w-full text-sm text-gray-300 outline-none py-3 pl-9 pr-3 bg-transparent font-medium cursor-not-allowed"
                      value={editingWarning ? editingWarning.issued_by_name || 'Unknown' : ''}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-300">Department</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border border-gray-600 rounded-lg bg-gray-800 text-gray-300 text-sm font-medium cursor-not-allowed"
                    value={editingWarning ? editingWarning.department_name || 'N/A' : ''}
                    readOnly
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-300">Employee</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border border-gray-600 rounded-lg bg-gray-800 text-gray-300 text-sm font-medium cursor-not-allowed"
                    value={editingWarning ? editingWarning.issued_to_name || 'Unknown Employee' : ''}
                    readOnly
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-300">Mistake Type <span className="text-red-500">*</span></label>
                  <select
                    value={formData.warning_type}
                    onChange={(e) => handleFormChange('warning_type', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 text-sm font-medium"
                    required
                  >
                    <option value="">Select Mistake Type</option>
                    {mistakeTypes.map((type) => {
                      const typeValue = type.value || type;
                      const typeLabel = type.label || type;
                      return (
                        <option key={typeValue} value={typeValue}>
                          {typeLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-300">Penalty Amount <span className="text-red-500">*</span></label>
                  <div className="relative border border-gray-600 rounded-lg bg-gray-800 flex items-center overflow-hidden">
                    <span className="px-3 py-2.5 text-gray-400 bg-gray-700 border-r border-gray-600 font-medium">₹</span>
                    <input
                      type="number"
                      value={formData.penalty_amount}
                      onChange={(e) => handleFormChange('penalty_amount', e.target.value)}
                      className="w-full text-sm text-gray-200 outline-none px-3 py-2.5 bg-transparent font-medium"
                      placeholder="0"
                      required
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Warning Message */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-300">Warning Message</label>
                <textarea
                  value={formData.warning_message}
                  onChange={(e) => handleFormChange('warning_message', e.target.value)}
                  rows={4}
                  className="w-full text-sm text-gray-200 outline-none p-3 resize-none bg-gray-800 border border-gray-600 rounded-lg focus:border-cyan-500 transition-all leading-relaxed"
                  placeholder="Enter detailed warning message..."
                />
              </div>
            </form>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/80 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditDialogOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleEditSubmit()}
                className="px-6 py-2.5 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-md transition-all"
              >
                Update Warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteDialogOpen && warningToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative border border-gray-700">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delete Warning</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-300 text-sm">
                Are you sure you want to delete the warning issued to <strong className="text-white">{warningToDelete.issued_to_name}</strong> for <strong className="text-white">{warningToDelete.warning_type}</strong>?
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/80 flex justify-end gap-3">
              <button
                onClick={() => setDeleteDialogOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md transition-all"
              >
                Delete Warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {filterDialogOpen && (
        <div className="bg-transparent fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-[#1b2230] border border-gray-600 rounded-xl shadow-2xl p-1 w-[700px] max-w-[90vw] h-[550px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Filter Warnings</h2>
              <button
                onClick={() => setFilterDialogOpen(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-3 gap-6 flex-1 overflow-hidden">
              {/* Left side - Filter Categories */}
              <div className="col-span-1 border-r border-gray-600 pr-4">
                <h3 className="text-base font-medium text-gray-300 mb-4">Filter Categories</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedFilterCategory('warningType')}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${selectedFilterCategory === 'warningType'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-[#2a3441]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-base">Warning Type</span>
                      </div>
                      {filters.warning_type && (
                        <span className="bg-red-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center">
                          1
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('department')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'department'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-[#2a3441]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        Department
                      </div>
                      {filters.department_id && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          1
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('employee')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'employee'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-[#2a3441]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Employee
                      </div>
                      {filters.employee_id && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          1
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('dateRange')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'dateRange'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-[#2a3441]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Issue Date and Time
                      </div>
                      {(filters.start_date || filters.end_date) && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          1
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('penalty_amount')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'penalty_amount'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-[#2a3441]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Penalty Amount
                      </div>
                      {(filters.penalty_amount_min || filters.penalty_amount_max || filters.penalty_amount_sort) && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          1
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Right side - Selected Category Options */}
              <div className="col-span-2 overflow-y-auto">
                <div className="h-full">
                  {/* Warning Type Filter */}
                  {selectedFilterCategory === 'warningType' && (
                    <div>
                      <h3 className="text-base font-medium text-gray-300 mb-4">Warning Type</h3>
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                          <input
                            type="text"
                            placeholder="Search and select warning type..."
                            value={filterSearchTerms.warningType}
                            onChange={(e) => setFilterSearchTerms(prev => ({ ...prev, warningType: e.target.value }))}
                            onFocus={() => setFilterDropdownFocus(prev => ({ ...prev, warningType: true }))}
                            onBlur={() => setTimeout(() => setFilterDropdownFocus(prev => ({ ...prev, warningType: false })), 200)}
                            className="w-full pl-10 pr-4 py-2 bg-[#1b2230] border border-gray-600 rounded text-gray-300 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        {(filterSearchTerms.warningType || filterDropdownFocus.warningType) && (
                          <div className="absolute top-full left-0 right-0 bg-[#1b2230] border border-gray-600 rounded-b mt-1 max-h-40 overflow-y-auto z-20">
                            {warningTypes
                              .filter(type => {
                                const typeLabel = type.label || type;
                                return filterSearchTerms.warningType 
                                  ? typeLabel.toLowerCase().includes(filterSearchTerms.warningType.toLowerCase())
                                  : true;
                              })
                              .map((type) => (
                                <div
                                  key={type.value || type}
                                  onClick={() => {
                                    handleFilterChange('warning_type', type.value || type);
                                    setFilterSearchTerms(prev => ({ ...prev, warningType: '' }));
                                    setFilterDropdownFocus(prev => ({ ...prev, warningType: false }));
                                  }}
                                  className="px-3 py-2 hover:bg-[#2a3441] cursor-pointer text-gray-300"
                                >
                                  {type.label || type}
                                </div>
                              ))}
                            {warningTypes
                              .filter(type => {
                                const typeLabel = type.label || type;
                                return filterSearchTerms.warningType 
                                  ? typeLabel.toLowerCase().includes(filterSearchTerms.warningType.toLowerCase())
                                  : true;
                              }).length === 0 && (
                              <div className="px-3 py-2 text-gray-500">No matching warning types</div>
                            )}
                          </div>
                        )}
                      </div>
                      {filters.warning_type && (
                        <div className="mt-3 px-3 py-2 bg-blue-600 text-white rounded text-sm">
                          Selected: {filters.warning_type}
                        </div>
                      )}
                      <button
                        onClick={() => handleFilterChange('warning_type', '')}
                        className="mt-4 text-xs text-blue-400 hover:text-blue-300"
                      >
                        Clear Warning Type
                      </button>
                    </div>
                  )}

                  {/* Department Filter */}
                  {selectedFilterCategory === 'department' && (
                    <div>
                      <h3 className="text-base font-medium text-gray-300 mb-4">Department</h3>
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                          <input
                            type="text"
                            placeholder="Search and select department..."
                            value={filterSearchTerms.department}
                            onChange={(e) => setFilterSearchTerms(prev => ({ ...prev, department: e.target.value }))}
                            onFocus={() => setFilterDropdownFocus(prev => ({ ...prev, department: true }))}
                            onBlur={() => setTimeout(() => setFilterDropdownFocus(prev => ({ ...prev, department: false })), 200)}
                            className="w-full pl-10 pr-4 py-2 bg-[#1b2230] border border-gray-600 rounded text-gray-300 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        {(filterSearchTerms.department || filterDropdownFocus.department) && (
                          <div className="absolute top-full left-0 right-0 bg-[#1b2230] border border-gray-600 rounded-b mt-1 max-h-40 overflow-y-auto z-20">
                            {departments
                              .filter(dept => 
                                filterSearchTerms.department
                                  ? dept.name.toLowerCase().includes(filterSearchTerms.department.toLowerCase())
                                  : true
                              )
                              .map((dept) => (
                                <div
                                  key={dept.id}
                                  onClick={() => {
                                    handleFilterChange('department_id', dept.id);
                                    setFilterSearchTerms(prev => ({ ...prev, department: '' }));
                                    setFilterDropdownFocus(prev => ({ ...prev, department: false }));
                                  }}
                                  className="px-3 py-2 hover:bg-[#2a3441] cursor-pointer text-gray-300"
                                >
                                  {dept.name}
                                </div>
                              ))}
                            {departments
                              .filter(dept => 
                                filterSearchTerms.department
                                  ? dept.name.toLowerCase().includes(filterSearchTerms.department.toLowerCase())
                                  : true
                              ).length === 0 && (
                              <div className="px-3 py-2 text-gray-500">No matching departments</div>
                            )}
                          </div>
                        )}
                      </div>
                      {filters.department_id && (
                        <div className="mt-3 px-3 py-2 bg-blue-600 text-white rounded text-sm">
                          Selected: {departments.find(d => d.id === parseInt(filters.department_id))?.name || 'Unknown'}
                        </div>
                      )}
                      <button
                        onClick={() => handleFilterChange('department_id', '')}
                        className="mt-4 text-xs text-blue-400 hover:text-blue-300"
                      >
                        Clear Department
                      </button>
                    </div>
                  )}

                  {/* Employee Filter */}
                  {selectedFilterCategory === 'employee' && (
                    <div>
                      <h3 className="text-base font-medium text-gray-300 mb-4">Employee</h3>
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                          <input
                            type="text"
                            placeholder="Search and select employee..."
                            value={filterSearchTerms.employee}
                            onChange={(e) => setFilterSearchTerms(prev => ({ ...prev, employee: e.target.value }))}
                            onFocus={() => setFilterDropdownFocus(prev => ({ ...prev, employee: true }))}
                            onBlur={() => setTimeout(() => setFilterDropdownFocus(prev => ({ ...prev, employee: false })), 200)}
                            className="w-full pl-10 pr-4 py-2 bg-[#1b2230] border border-gray-600 rounded text-gray-300 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        {(filterSearchTerms.employee || filterDropdownFocus.employee) && (
                          <div className="absolute top-full left-0 right-0 bg-[#1b2230] border border-gray-600 rounded-b mt-1 max-h-40 overflow-y-auto z-20">
                            {employees
                              .filter(emp => 
                                filterSearchTerms.employee
                                  ? emp.name.toLowerCase().includes(filterSearchTerms.employee.toLowerCase())
                                  : true
                              )
                              .map((emp) => (
                                <div
                                  key={emp.id}
                                  onClick={() => {
                                    handleFilterChange('employee_id', emp.id);
                                    setFilterSearchTerms(prev => ({ ...prev, employee: '' }));
                                    setFilterDropdownFocus(prev => ({ ...prev, employee: false }));
                                  }}
                                  className="px-3 py-2 hover:bg-[#2a3441] cursor-pointer text-gray-300"
                                >
                                  {emp.name}
                                </div>
                              ))}
                            {employees
                              .filter(emp => 
                                filterSearchTerms.employee
                                  ? emp.name.toLowerCase().includes(filterSearchTerms.employee.toLowerCase())
                                  : true
                              ).length === 0 && (
                              <div className="px-3 py-2 text-gray-500">No matching employees</div>
                            )}
                          </div>
                        )}
                      </div>
                      {filters.employee_id && (
                        <div className="mt-3 px-3 py-2 bg-blue-600 text-white rounded text-sm">
                          Selected: {employees.find(e => e.id === parseInt(filters.employee_id))?.name || 'Unknown'}
                        </div>
                      )}
                      <button
                        onClick={() => handleFilterChange('employee_id', '')}
                        className="mt-4 text-xs text-blue-400 hover:text-blue-300"
                      >
                        Clear Employee
                      </button>
                    </div>
                  )}

                  {/* Penalty Amount Filter */}
                  {selectedFilterCategory === 'penalty_amount' && (
                    <div>
                      <h3 className="text-base font-medium text-gray-300 mb-4">Penalty Amount</h3>
                      <div className="space-y-4">
                        {/* Amount Range */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-400 mb-2">Min Amount</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={filters.penalty_amount_min}
                              onChange={(e) => handleFilterChange('penalty_amount_min', e.target.value)}
                              className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-2">Max Amount</label>
                            <input
                              type="number"
                              placeholder="∞"
                              value={filters.penalty_amount_max}
                              onChange={(e) => handleFilterChange('penalty_amount_max', e.target.value)}
                              className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                        
                        {/* Sort Options */}
                        <div>
                          <label className="block text-xs text-gray-400 mb-2">Sort By</label>
                          <select
                            value={filters.penalty_amount_sort}
                            onChange={(e) => handleFilterChange('penalty_amount_sort', e.target.value)}
                            className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                          >
                            <option value="">No Sorting</option>
                            <option value="asc">Low to High</option>
                            <option value="desc">High to Low</option>
                          </select>
                        </div>
                        
                        <button
                          onClick={() => {
                            handleFilterChange('penalty_amount_min', '');
                            handleFilterChange('penalty_amount_max', '');
                            handleFilterChange('penalty_amount_sort', '');
                          }}
                          className="mt-4 text-xs text-blue-400 hover:text-blue-300"
                        >
                          Clear Penalty Amount Filter
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Date Range Filter */}
                  {selectedFilterCategory === 'dateRange' && (
                    <div>
                      <h3 className="text-base font-medium text-gray-300 mb-4">Issue Date and Time</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-gray-400 text-xs mb-1">From Date</label>
                          <input
                            type="date"
                            value={filters.start_date || ''}
                            onChange={(e) => handleFilterChange('start_date', e.target.value)}
                            className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 text-xs mb-1">To Date</label>
                          <input
                            type="date"
                            value={filters.end_date || ''}
                            onChange={(e) => handleFilterChange('end_date', e.target.value)}
                            className="w-full bg-[#1b2230] border border-gray-600 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleFilterChange('start_date', '');
                          handleFilterChange('end_date', '');
                        }}
                        className="mt-4 text-xs text-blue-400 hover:text-blue-300"
                      >
                        Clear Date Range
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-600">
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Clear All Filters
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setFilterDialogOpen(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setFilterDialogOpen(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Mistake Category Modal */}
      {createMistakeOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative border border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/80">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-cyan-400" /> Create Mistake Category
              </h2>
              <button
                onClick={() => { setCreateMistakeOpen(false); setNewMistakeTitle(''); setNewMistakeDescription(''); }}
                className="text-gray-400 hover:text-white hover:bg-gray-700 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-300">Short Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newMistakeTitle}
                  onChange={(e) => setNewMistakeTitle(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 outline-none focus:border-cyan-500 transition-all"
                  placeholder="e.g. Late Arrival, Uninformed Leave..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-300">Detailed Description</label>
                <textarea
                  value={newMistakeDescription}
                  onChange={(e) => setNewMistakeDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 outline-none focus:border-cyan-500 transition-all resize-none leading-relaxed"
                  placeholder="Describe when this mistake type should be used..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/80 flex justify-end gap-3">
              <button
                onClick={() => { setCreateMistakeOpen(false); setNewMistakeTitle(''); setNewMistakeDescription(''); }}
                className="px-5 py-2.5 text-sm font-semibold text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMistakeCategory}
                className="px-6 py-2.5 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-md transition-all"
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mistake Category Modal */}
      {editMistakeOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative border border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/80">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-cyan-400" /> Edit Mistake Category
              </h2>
              <button
                onClick={() => { setEditMistakeOpen(false); setEditingMistakeType(null); }}
                className="text-gray-400 hover:text-white hover:bg-gray-700 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-300">Short Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editMistakeTitle}
                  onChange={(e) => setEditMistakeTitle(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 outline-none focus:border-cyan-500 transition-all"
                  placeholder="Mistake title..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-300">Detailed Description</label>
                <textarea
                  value={editMistakeDescription}
                  onChange={(e) => setEditMistakeDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 outline-none focus:border-cyan-500 transition-all resize-none leading-relaxed"
                  placeholder="Describe when this mistake type should be used..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/80 flex justify-end gap-3">
              <button
                onClick={() => { setEditMistakeOpen(false); setEditingMistakeType(null); }}
                className="px-5 py-2.5 text-sm font-semibold text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditMistakeCategory}
                className="px-6 py-2.5 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-md transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification.open && (
        <div className="fixed top-4 right-4 z-[1100]">
          <div className={`p-4 rounded-xl shadow-2xl ${
            notification.severity === 'success' ? 'bg-green-600' :
            notification.severity === 'error' ? 'bg-red-600' :
            notification.severity === 'warning' ? 'bg-yellow-600' : 'bg-blue-600'
          } text-white font-bold`}>
            <div className="flex items-center gap-3">
              <span>{notification.message}</span>
              <button
                onClick={() => setNotification(prev => ({ ...prev, open: false }))}
                className="text-white hover:text-gray-200 text-xl font-bold"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
  } catch (error) {
    console.error('WarningPage render error:', error);
    // NOTE: do NOT call setRenderError here — calling setState during render
    // causes React to synchronously re-render, which re-throws the same error,
    // which calls setRenderError again → infinite recursive re-render → stack overflow.
    return (
      <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-400 mb-4">Rendering Error</h2>
          <p className="text-gray-400 mb-4">Please refresh the page to try again.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
});

export default WarningPage;
