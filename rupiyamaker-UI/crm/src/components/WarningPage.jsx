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
  ChevronRight
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
  getCurrentUserId
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
    warning_message: '',
    warning_action: ''
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
      const userPermissions = JSON.parse(localStorage.getItem('userPermissions') || '[]');
      if (Array.isArray(userPermissions)) {
        for (const perm of userPermissions) {
          if (perm && (perm.page === 'warnings' || perm.page === 'Warnings')) {
            if (Array.isArray(perm.actions)) {
              // Check for explicit delete OR all permission
              return perm.actions.includes('delete') || perm.actions.includes('all');
            } else if (perm.actions === 'delete' || perm.actions === 'all') {
              return true;
            }
          }
        }
      }
      return false;
    };
    
    const permissions = {
      can_view_own: true, // Everyone can view their own records
      can_view_all: canUserViewAll(),
      can_view_team: canUserViewJunior(),
      can_add: canUserCreate(),
      can_edit: canUserViewJunior(), // Junior and All can edit
      can_delete: hasDeletePermission(), // Check explicit delete permission
      can_export: canUserViewJunior(), // Junior and All can export
      permission_level: permLevel // Store the permission level for use elsewhere
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
        const employeesList = usersList.map(user => ({
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

  // Handle form submit
  const handleSubmit = async () => {
    try {
      
      if (!formData.warning_type || !formData.issued_to.length || !formData.penalty_amount || !formData.warning_action) {
        const missingFields = [];
        if (!formData.warning_type) missingFields.push('Warning Type');
        if (!formData.issued_to.length) missingFields.push('Employee(s)');
        if (!formData.penalty_amount) missingFields.push('Penalty Amount');
        if (!formData.warning_action) missingFields.push('Warning Action');
        
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
          warning_message: formData.warning_message || '',
          warning_action: formData.warning_action
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
          warning_message: '',
          warning_action: ''
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
            warning_message: '',
            warning_action: ''
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

    try {
      const deletePromises = selectedRows.map(id => handleDeleteWarning(id));
      await Promise.all(deletePromises);
      
      setSelectedRows([]);
      setSelectAll(false);
      showNotification(`${selectedRows.length} warning(s) deleted successfully`, 'success');
    } catch (error) {
      showNotification('Error deleting some warnings', 'error');
    }
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
      warning_message: '',
      warning_action: ''
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
      warning_message: warning.warning_message || '',
      warning_action: warning.warning_action || ''
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
        day: 'numeric'
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                {/* <h1 className="text-2xl font-bold flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6" /> Warning Management
                </h1> */}
                {/* <p className="text-gray-300 mt-1">Manage employee warnings and track compliance</p> */}
              </div>
              <div className="flex flex-wrap gap-3">
                {permissions.can_add && (
                  <button
                    className="bg-[#03b0f5] hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2"
                    onClick={openAddDialog}
                  >
                    <Plus className="w-4 h-4" />
                    Issue Warning
                  </button>
                )}
              </div>
            </div>

            {/* Stats Cards - Commented Out */}
            {/* <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg">
                <div className="flex justify-between items-center">
                  <AlertTriangle className="w-6 h-6 text-white" />
                  <span className="text-xl font-bold text-white">{stats.total_warnings || 0}</span>
                </div>
                <p className="mt-4 text-md text-white font-medium uppercase tracking-wide">Total Warnings</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-green-600 to-green-700 shadow-lg">
                <div className="flex justify-between items-center">
                  <Users className="w-6 h-6 text-white" />
                  <span className="text-xl font-bold text-white">{stats.total_employees || 0}</span>
                </div>
                <p className="mt-4 text-md text-white font-medium uppercase tracking-wide">Employees Warned</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-700 shadow-lg">
                <div className="flex justify-between items-center">
                  <DollarSign className="w-6 h-6 text-white" />
                  <span className="text-xl font-bold text-white">₹{Number(stats.total_penalty || 0).toLocaleString('en-IN')}</span>
                </div>
                <p className="mt-4 text-md text-white font-medium uppercase tracking-wide">Total Penalty</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 shadow-lg">
                <div className="flex justify-between items-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                  <span className="text-xl font-bold text-white">₹{Number(stats.avg_penalty || 0).toLocaleString('en-IN')}</span>
                </div>
                <p className="mt-4 text-md text-white font-medium uppercase tracking-wide">Avg Penalty</p>
              </div>
            </div> */}

            {/* Main Content */}
            <div className="bg-black rounded-xl shadow-lg">
              {/* Tab Navigation - Based on Permissions */}
              <div className="flex flex-wrap items-center gap-3 px-7 mt-4 mb-6">
                {/* Super Admin: Show All Warnings + Warnings Ranking */}
                {isSuperAdmin() ? (
                  <>
                    <button
                      onClick={() => setSelectedTab(0)}
                      className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-base shadow transition-all duration-200 ${selectedTab === 0
                          ? "bg-[#03b0f5] text-white"
                          : "bg-white text-[#03b0f5] hover:bg-blue-50"}
                      `}
                      style={{
                        minWidth: 144,
                        justifyContent: "center",
                        fontSize: "1.18rem",
                      }}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      All Warnings
                    </button>
                    <button
                      onClick={() => setSelectedTab(1)}
                      className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-base shadow transition-all duration-200 ${selectedTab === 1
                          ? "bg-[#03b0f5] text-white"
                          : "bg-white text-[#03b0f5] hover:bg-blue-50"}
                      `}
                      style={{
                        minWidth: 144,
                        justifyContent: "center",
                        fontSize: "1.18rem",
                      }}
                    >
                      <BarChart3 className="w-4 h-4" />
                      Warnings Ranking
                    </button>
                  </>
                ) : isManager() ? (
                  /* Users with junior permissions: Team Warnings + My Warnings */
                  <>
                    <button
                      onClick={() => setSelectedTab(0)}
                      className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-base shadow transition-all duration-200 ${selectedTab === 0
                          ? "bg-[#03b0f5] text-white"
                          : "bg-white text-[#03b0f5] hover:bg-blue-50"}
                      `}
                      style={{
                        minWidth: 144,
                        justifyContent: "center",
                        fontSize: "1.18rem",
                      }}
                    >
                      <Users className="w-4 h-4" />
                      Team Warnings
                    </button>
                    <button
                      onClick={() => setSelectedTab(1)}
                      className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-base shadow transition-all duration-200 ${selectedTab === 1
                          ? "bg-[#03b0f5] text-white"
                          : "bg-white text-[#03b0f5] hover:bg-blue-50"}
                      `}
                      style={{
                        minWidth: 144,
                        justifyContent: "center",
                        fontSize: "1.18rem",
                      }}
                    >
                      <User className="w-4 h-4" />
                      My Warnings
                    </button>
                  </>
                ) : (
                  /* Users with only own permission or no specific permissions: Only My Warnings */
                  <button
                    onClick={() => setSelectedTab(0)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-base shadow
                      ${selectedTab === 0
                        ? "bg-[#03b0f5] text-white"
                        : "bg-white text-[#03b0f5]"}
                    `}
                    style={{
                      minWidth: 144,
                      justifyContent: "center",
                      fontSize: "1.18rem",
                    }}
                  >
                    <User className="w-4 h-4" />
                    My Warnings
                  </button>
                )}
              </div>

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
                    {/* Super Admin Tabs */}
                    {isSuperAdmin() ? (
                      <>
                        {/* Tab 0: All Warnings */}
                        {selectedTab === 0 && (
                          <div>
                            {/* Search and Filter Row */}
                            <div className="flex items-center justify-between gap-4 mb-6">
                              <div className="flex items-center gap-3">
                                {/* Select Button / Selection Controls */}
                                {(() => {
                                  console.log('🔍 Warnings Delete Button Check (Tab 0):', {
                                    'permissions': permissions,
                                    'permissions.can_delete': permissions?.can_delete,
                                    'showCheckboxes': showCheckboxes,
                                    'should_show_button': permissions?.can_delete && !showCheckboxes
                                  });
                                  return null;
                                })()}
                                {permissions?.can_delete && !showCheckboxes ? (
                                  <button
                                    onClick={handleShowCheckboxes}
                                    className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
                                  >
                                    {selectedRows.length > 0
                                      ? `Select (${selectedRows.length})`
                                      : "Select"}
                                  </button>
                                ) : permissions?.can_delete && showCheckboxes ? (
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
                                      {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} selected
                                    </span>
                                    <button
                                      className={`px-3 py-1 text-white rounded font-bold transition ${
                                        selectedRows.length > 0 
                                          ? 'bg-red-600 hover:bg-red-700 cursor-pointer' 
                                          : 'bg-red-400 cursor-not-allowed opacity-75'
                                      }`}
                                      onClick={selectedRows.length > 0 ? handleDeleteSelected : undefined}
                                      disabled={selectedRows.length === 0}
                                    >
                                      Delete ({selectedRows.length})
                                    </button>
                                    <button
                                      className="px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                                      onClick={handleShowCheckboxes}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : null}

                                <div className="text-base text-gray-300 bg-[#1b2230] px-4 py-2 rounded-lg border border-gray-600">
                                  {filteredWarnings.length} of {warnings.length} warnings
                                  {searchTerm && (
                                    <span className="ml-2">
                                      matching "<span className="text-[#03b0f5] font-semibold">{searchTerm}</span>"
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
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

                            {/* Warnings Table */}
                            <div className="relative">
                              {/* Horizontal scroll buttons - exactly from LeadCRM.jsx */}
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
                                className="bg-black rounded-lg overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto px-2"
                                onScroll={() => updateScrollButtons(tableScrollRef, setCanScrollLeft, setCanScrollRight)}
                              >
                              <table className="min-w-[616px] w-full rounded-xl overflow-hidden">
                                <thead className="bg-white sticky top-0 z-10 sticky-header">
                                  <tr>
                                    {showCheckboxes && (
                                      <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">
                                        <input
                                          type="checkbox"
                                          checked={selectAll}
                                          onChange={handleSelectAll}
                                          className="rounded border-gray-300"
                                        />
                                      </th>
                                    )}
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">#</th>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">DATE & TIME</th>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">ISSUED BY</th>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">DEPARTMENT</th>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">ISSUED TO</th>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">MISTAKE TYPE</th>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">WARNING ACTION</th>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">PENALTY AMOUNT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredWarnings.length === 0 ? (
                                    <tr>
                                      <td colSpan={showCheckboxes ? "9" : "8"} className="text-center py-10 text-gray-500">
                                        No warnings found
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredWarnings.map((warning, index) => (
                                      <tr
                                        key={warning.id}
                                        className="border-b border-gray-800 hover:bg-gray-800 transition cursor-pointer"
                                        onClick={() => { setSelectedWarning(warning); setViewDialogOpen(true); }}
                                      >
                                        {showCheckboxes && (
                                          <td className="text-left py-3 px-3 text-md whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <input
                                              type="checkbox"
                                              checked={selectedRows.includes(warning.id)}
                                              onChange={() => handleRowSelect(warning.id)}
                                              className="rounded border-gray-300"
                                            />
                                          </td>
                                        )}
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap text-white font-semibold">
                                          {(page * rowsPerPage) + index + 1}
                                        </td>
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap text-gray-300">
                                          {new Date(warning.issued_date).toLocaleDateString('en-GB', { 
                                            day: '2-digit', 
                                            month: 'short', 
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: true
                                          }).replace(',', '')}
                                        </td>
                                        {/* ISSUED BY */}
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-md">
                                              {warning.issued_by_name?.charAt(0)?.toUpperCase() || 'U'}
                                            </div>
                                            <div className="text-white font-semibold">{warning.issued_by_name || 'Unknown'}</div>
                                          </div>
                                        </td>
                                        {/* DEPARTMENT */}
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap text-gray-300">
                                          {warning.department_name || 'N/A'}
                                        </td>
                                        {/* ISSUED TO */}
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-md">
                                              {warning.issued_to_name?.charAt(0)?.toUpperCase() || 'U'}
                                            </div>
                                            <div className="text-white font-semibold">{warning.issued_to_name || 'N/A'}</div>
                                          </div>
                                        </td>
                                        {/* MISTAKE TYPE */}
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap">
                                          <span className={`px-2 py-1 rounded text-sm font-medium text-white ${getWarningTypeBadge(warning.warning_type)}`}>
                                            {warning.warning_type || 'N/A'}
                                          </span>
                                        </td>
                                        {/* WARNING ACTION */}
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap">
                                          <span className="px-2 py-1 rounded text-sm font-medium text-white bg-blue-600">
                                            {warning.warning_action || 'No Action'}
                                          </span>
                                        </td>
                                        {/* PENALTY AMOUNT */}
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap text-red-400 font-semibold">
                                          <span>₹{Number(warning.penalty_amount || 0).toLocaleString('en-IN')}</span>
                                        </td>
                                      </tr>
                                    ))
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

                        {/* Tab 1: Warnings Ranking */}
                        {selectedTab === 1 && (
                          <div>
                            <div className="flex items-center justify-between mb-6">
                              <h2 className="text-xl font-bold text-white">Employee Rankings</h2>
                              <div className="text-base text-gray-300 bg-[#1b2230] px-4 py-2 rounded-lg border border-gray-600">
                                Top {rankings.length} employees by warnings
                              </div>
                            </div>
                            {/* Rankings Table */}
                            <div className="relative">
                              {/* Horizontal scroll buttons for Rankings table */}
                              {rankingCanScrollLeft && (
                                <button
                                  onClick={() => scrollRankingTable('left')}
                                  className="absolute left-2 top-1/2 transform -translate-y-1/2 z-50 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-20 hover:opacity-100"
                                  style={{ backgroundColor: 'rgba(37, 99, 235, 1)' }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(29, 78, 216, 1)'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(37, 99, 235, 1)'}
                                  aria-label="Scroll left"
                                >
                                  <ChevronLeft className="w-9 h-9" />
                                </button>
                              )}
                              
                              {rankingCanScrollRight && (
                                <button
                                  onClick={() => scrollRankingTable('right')}
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
                                ref={rankingTableScrollRef}
                                className="overflow-auto max-h-[600px]"
                                onScroll={() => updateScrollButtons(rankingTableScrollRef, setRankingCanScrollLeft, setRankingCanScrollRight)}
                              >
                              <table className="w-full">
                                <thead className="bg-white sticky top-0 z-5">
                                  <tr>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap">RANK</th>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap">EMPLOYEE</th>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap">DEPARTMENT</th>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap">TOTAL WARNINGS</th>
                                    <th className="py-1 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap">TOTAL PENALTY</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rankings.map((ranking, index) => (
                                    <tr
                                      key={ranking.employee_id}
                                      className="border-b border-gray-800 hover:bg-gray-800 transition cursor-pointer"
                                    >
                                      <td className="text-left py-3 px-3 text-md whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-md ${ranking.rank <= 3 ? 'bg-yellow-500' : 'bg-gray-600'}`}>
                                            {ranking.rank}
                                          </div>
                                          {ranking.rank <= 3 && <span className="text-lg">🏆</span>}
                                        </div>
                                      </td>
                                      <td className="text-left py-3 px-3 text-md whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center text-white font-bold text-md">
                                            {ranking.employee_name?.charAt(0)?.toUpperCase() || 'U'}
                                          </div>
                                          <span className="text-white">{ranking.employee_name}</span>
                                        </div>
                                      </td>
                                      <td className="text-left py-3 px-3 text-md whitespace-nowrap text-white">{ranking.department_name}</td>
                                      <td className="text-left py-3 px-3 text-md whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded text-sm font-medium ${ranking.total_warnings > 5 ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                                          {ranking.total_warnings}
                                        </span>
                                      </td>
                                      <td className="text-left py-3 px-3 text-md whitespace-nowrap text-red-400 font-semibold">₹{Number(ranking.total_penalty).toLocaleString('en-IN')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              </div>
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
                                <div className="text-base text-gray-300 bg-[#1b2230] px-4 py-2 rounded-lg border border-gray-600">
                                  {filteredWarnings.length} of {warnings.length} warnings
                                  {searchTerm && (
                                    <span className="ml-2">
                                      matching "<span className="text-[#03b0f5] font-semibold">{searchTerm}</span>"
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                {/* Select Button / Selection Controls */}
                                {(() => {
                                  console.log('🔍 Warnings Delete Button Check (Junior Tab):', {
                                    'permissions': permissions,
                                    'permissions.can_delete': permissions?.can_delete,
                                    'showCheckboxes': showCheckboxes,
                                    'should_show_button': permissions?.can_delete && !showCheckboxes
                                  });
                                  return null;
                                })()}
                                {permissions?.can_delete && !showCheckboxes ? (
                                  <button
                                    onClick={handleShowCheckboxes}
                                    className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
                                  >
                                    {selectedRows.length > 0
                                      ? `Select (${selectedRows.length})`
                                      : "Select"}
                                  </button>
                                ) : permissions?.can_delete && showCheckboxes ? (
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
                                      {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} selected
                                    </span>
                                    {selectedRows.length > 0 && (
                                      <button
                                        className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                                        onClick={handleDeleteSelected}
                                      >
                                        Delete ({selectedRows.length})
                                      </button>
                                    )}
                                    <button
                                      className="px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                                      onClick={handleShowCheckboxes}
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
                                className="overflow-auto max-h-[600px] sticky-table-container"
                                onScroll={() => updateScrollButtons(tableScrollRef, setCanScrollLeft, setCanScrollRight)}
                              >
                              <table className="w-full">
                                <thead className="bg-white sticky top-0 z-10 sticky-header">
                                  <tr>
                                    {showCheckboxes && (
                                      <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">
                                        <input
                                          type="checkbox"
                                          checked={selectAll}
                                          onChange={handleSelectAll}
                                          className="rounded border-gray-300"
                                        />
                                      </th>
                                    )}
                                    <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">#</th>
                                    <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">DATE & TIME</th>
                                    <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">EMPLOYEE</th>
                                    <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">WARNING TYPE</th>
                                    <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">PENALTY</th>
                                    <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-center whitespace-nowrap sticky-th">ACTIONS</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredWarnings.length === 0 ? (
                                    <tr>
                                      <td colSpan={showCheckboxes ? "7" : "6"} className="text-center py-10 text-gray-500">
                                        No warnings found
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredWarnings.map((warning, index) => (
                                      <tr
                                        key={warning.id}
                                        className="border-b border-gray-800 hover:bg-gray-800 transition cursor-pointer"
                                        onClick={() => { setSelectedWarning(warning); setViewDialogOpen(true); }}
                                      >
                                        {showCheckboxes && (
                                          <td className="text-left py-3 px-3 text-md whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <input
                                              type="checkbox"
                                              checked={selectedRows.includes(warning.id)}
                                              onChange={() => handleRowSelect(warning.id)}
                                              className="rounded border-gray-300"
                                            />
                                          </td>
                                        )}
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap text-white font-semibold">
                                          {(page * rowsPerPage) + index + 1}
                                        </td>
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap text-gray-300">
                                          {new Date(warning.issued_date).toLocaleDateString('en-GB', { 
                                            day: '2-digit', 
                                            month: 'short', 
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: true
                                          }).replace(',', '')}
                                        </td>
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-md">
                                              {warning.issued_to_name?.charAt(0)?.toUpperCase() || 'U'}
                                            </div>
                                            <div>
                                              <div className="text-white font-semibold">{warning.issued_to_name}</div>
                                              <div className="text-gray-400 text-sm">{warning.department_name}</div>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap">
                                          <span className={`px-2 py-1 rounded text-sm font-medium text-white ${getWarningTypeBadge(warning.warning_type)}`}>
                                            {warning.warning_type}
                                          </span>
                                        </td>
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap text-red-400 font-semibold">₹{Number(warning.penalty_amount).toLocaleString('en-IN')}</td>
                                        <td className="text-center py-3 px-3 whitespace-nowrap">
                                          <div className="flex items-center justify-center gap-2">
                                           
                                            {permissions.can_delete && (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); setWarningToDelete(warning); setDeleteDialogOpen(true); }}
                                                className="p-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))
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
                                <div className="text-base text-gray-300 bg-[#1b2230] px-4 py-2 rounded-lg border border-gray-600">
                                  {filteredWarnings.length} of {warnings.length} warnings
                                  {searchTerm && (
                                    <span className="ml-2">
                                      matching "<span className="text-[#03b0f5] font-semibold">{searchTerm}</span>"
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                {/* Select Button / Selection Controls */}
                                {(() => {
                                  console.log('🔍 Warnings Delete Button Check (My Warnings Tab):', {
                                    'permissions': permissions,
                                    'permissions.can_delete': permissions?.can_delete,
                                    'showCheckboxes': showCheckboxes,
                                    'should_show_button': permissions?.can_delete && !showCheckboxes
                                  });
                                  return null;
                                })()}
                                {permissions?.can_delete && !showCheckboxes ? (
                                  <button
                                    onClick={handleShowCheckboxes}
                                    className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
                                  >
                                    {selectedRows.length > 0
                                      ? `Select (${selectedRows.length})`
                                      : "Select"}
                                  </button>
                                ) : permissions?.can_delete && showCheckboxes ? (
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
                                      {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} selected
                                    </span>
                                    {selectedRows.length > 0 && (
                                      <button
                                        className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                                        onClick={handleDeleteSelected}
                                      >
                                        Delete ({selectedRows.length})
                                      </button>
                                    )}
                                    <button
                                      className="px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                                      onClick={handleShowCheckboxes}
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
                                className="overflow-auto max-h-[600px] sticky-table-container"
                                onScroll={() => updateScrollButtons(myWarningsTableScrollRef, setMyWarningsCanScrollLeft, setMyWarningsCanScrollRight)}
                              >
                              <table className="w-full">
                                <thead className="bg-white sticky top-0 z-10 sticky-header">
                                  <tr>
                                    {showCheckboxes && (
                                      <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">
                                        <input
                                          type="checkbox"
                                          checked={selectAll}
                                          onChange={handleSelectAll}
                                          className="rounded border-gray-300"
                                        />
                                      </th>
                                    )}
                                    <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">#</th>
                                    <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">DATE & TIME</th>
                                    <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">WARNING TYPE</th>
                                    <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">PENALTY</th>
                                    <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">ISSUED BY</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredWarnings.length === 0 ? (
                                    <tr>
                                      <td colSpan={showCheckboxes ? "6" : "5"} className="text-center py-10 text-gray-500">
                                        No warnings found
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredWarnings.map((warning, index) => (
                                      <tr
                                        key={warning.id}
                                        className="border-b border-gray-800 hover:bg-gray-800 transition cursor-pointer"
                                        onClick={() => { setSelectedWarning(warning); setViewDialogOpen(true); }}
                                      >
                                        {showCheckboxes && (
                                          <td className="text-left py-3 px-3 text-md whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <input
                                              type="checkbox"
                                              checked={selectedRows.includes(warning.id)}
                                              onChange={() => handleRowSelect(warning.id)}
                                              className="rounded border-gray-300"
                                            />
                                          </td>
                                        )}
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap text-white font-semibold">
                                          {(page * rowsPerPage) + index + 1}
                                        </td>
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap text-gray-300">
                                          {new Date(warning.issued_date).toLocaleDateString('en-GB', { 
                                            day: '2-digit', 
                                            month: 'short', 
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: true
                                          }).replace(',', '')}
                                        </td>
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap">
                                          <span className={`px-2 py-1 rounded text-sm font-medium text-white ${getWarningTypeBadge(warning.warning_type)}`}>
                                            {warning.warning_type}
                                          </span>
                                        </td>
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap text-red-400 font-semibold">₹{Number(warning.penalty_amount).toLocaleString('en-IN')}</td>
                                        <td className="text-left py-3 px-3 text-md whitespace-nowrap text-white">{warning.issued_by_name}</td>
                                      </tr>
                                    ))
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
                            <div className="text-base text-gray-300 bg-[#1b2230] px-4 py-2 rounded-lg border border-gray-600">
                              {filteredWarnings.length} of {warnings.length} warnings
                              {searchTerm && (
                                <span className="ml-2">
                                  matching "<span className="text-[#03b0f5] font-semibold">{searchTerm}</span>"
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {/* Select Button / Selection Controls */}
                            {(() => {
                              console.log('🔍 Warnings Delete Button Check (Own Warnings Only):', {
                                'permissions': permissions,
                                'permissions.can_delete': permissions?.can_delete,
                                'showCheckboxes': showCheckboxes,
                                'should_show_button': permissions?.can_delete && !showCheckboxes
                              });
                              return null;
                            })()}
                            {permissions?.can_delete && !showCheckboxes ? (
                              <button
                                onClick={handleShowCheckboxes}
                                className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
                              >
                                {selectedRows.length > 0
                                  ? `Select (${selectedRows.length})`
                                  : "Select"}
                              </button>
                            ) : permissions?.can_delete && showCheckboxes ? (
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
                                  {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} selected
                                </span>
                                {selectedRows.length > 0 && (
                                  <button
                                    className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                                    onClick={handleDeleteSelected}
                                  >
                                    Delete ({selectedRows.length})
                                  </button>
                                )}
                                <button
                                  className="px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                                  onClick={handleShowCheckboxes}
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
                            className="overflow-auto max-h-[600px] sticky-table-container"
                            onScroll={() => updateScrollButtons(myWarningsTableScrollRef, setMyWarningsCanScrollLeft, setMyWarningsCanScrollRight)}
                          >
                          <table className="w-full">
                            <thead className="bg-white sticky top-0 z-10 sticky-header">
                              <tr>
                                {showCheckboxes && (
                                  <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">
                                    <input
                                      type="checkbox"
                                      checked={selectAll}
                                      onChange={handleSelectAll}
                                      className="rounded border-gray-300"
                                    />
                                  </th>
                                )}
                                <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">#</th>
                                <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">DATE & TIME</th>
                                <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">WARNING TYPE</th>
                                <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">PENALTY</th>
                                <th className="py-3 px-3 text-lg font-extrabold text-[#03b0f5] text-left whitespace-nowrap sticky-th">ISSUED BY</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredWarnings.length === 0 ? (
                                <tr>
                                  <td colSpan={showCheckboxes ? "6" : "5"} className="text-center py-10 text-gray-500">
                                    No warnings found
                                  </td>
                                </tr>
                              ) : (
                                filteredWarnings.map((warning, index) => (
                                  <tr
                                    key={warning.id}
                                    className="border-b border-gray-800 hover:bg-gray-800 transition cursor-pointer"
                                    onClick={() => { setSelectedWarning(warning); setViewDialogOpen(true); }}
                                  >
                                    {showCheckboxes && (
                                      <td className="text-left py-3 px-3 text-md whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={selectedRows.includes(warning.id)}
                                          onChange={() => handleRowSelect(warning.id)}
                                          className="rounded border-gray-300"
                                        />
                                      </td>
                                    )}
                                    <td className="text-left py-3 px-3 text-md whitespace-nowrap text-white font-semibold">
                                      {(page * rowsPerPage) + index + 1}
                                    </td>
                                    <td className="text-left py-3 px-3 text-md whitespace-nowrap text-gray-300">
                                      {new Date(warning.issued_date).toLocaleDateString('en-GB', { 
                                        day: '2-digit', 
                                        month: 'short', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                      }).replace(',', '')}
                                    </td>
                                    <td className="text-left py-3 px-3 text-md whitespace-nowrap">
                                      <span className={`px-2 py-1 rounded text-sm font-medium text-white ${getWarningTypeBadge(warning.warning_type)}`}>
                                        {warning.warning_type}
                                      </span>
                                    </td>
                                    <td className="text-left py-3 px-3 text-md whitespace-nowrap text-red-400 font-semibold">₹{Number(warning.penalty_amount).toLocaleString('en-IN')}</td>
                                    <td className="text-left py-3 px-3 text-md whitespace-nowrap text-white">{warning.issued_by_name}</td>
                                  </tr>
                                ))
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
        <div className="bg-transparent fixed inset-0 z-50 flex items-center justify-center">
          <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-4xl mx-auto space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
              onClick={() => {
                setAddDialogOpen(false);
                setFormData({
                  warning_type: '',
                  issued_to: '',
                  penalty_amount: '',
                  warning_message: '',
                  warning_action: ''
                });
                setSelectedDepartmentForAdd('');
                setSelectedFiles([]);
                setSimilarWarnings([]);
                setShowingSimilarWarnings(false);
                resetAllSearchStates();
              }}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
                {/* Date & Time and Issued By Row */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block font-bold text-gray-700 mb-1">
                      Date & Time
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                      value={new Date().toLocaleDateString('en-GB', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      }).replace(',', '')}
                      readOnly
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block font-bold text-gray-700 mb-1">
                      Issued By
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                      value={getCurrentUserFullName()}
                      readOnly
                    />
                  </div>
                </div>

                {/* Department and Issued To Row */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1" ref={departmentDropdownRef}>
                    <label className="block font-bold text-gray-700 mb-1">Department</label>
                    <div 
                      className="w-full px-3 py-2 border border-cyan-400 rounded bg-white cursor-pointer flex justify-between items-center"
                      onClick={() => toggleDropdown('department')}
                    >
                      <span className={selectedDepartmentName ? 'text-black' : 'text-gray-500'}>
                        {selectedDepartmentName || 'Select Departments'}
                      </span>
                      <svg className={`w-4 h-4 transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                    
                    {showDepartmentDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                        <div className="p-2">
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            <input
                              type="text"
                              placeholder="Search departments..."
                              value={departmentSearchTerm}
                              onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-black"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          <div
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-black"
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
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-black"
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

                  <div className="relative flex-1" ref={employeeDropdownRef}>
                    <label className="block font-bold text-gray-700 mb-1">
                      Issued To (Select multiple employees) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-2 border border-cyan-400 rounded-md bg-white p-1 pr-2 min-h-[42px]">
                      {/* Display all selected employees as pills */}
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
                              className="bg-blue-100 text-blue-800 py-1 px-3 rounded-md flex items-center"
                            >
                              {/* Profile icon with initials */}
                              <div className="w-6 h-6 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-2 text-xs flex-shrink-0">
                                {initials}
                              </div>
                              <span>{emp.name}</span>
                              <button
                                type="button"
                                className="ml-2 text-blue-500 hover:text-blue-700"
                                onClick={() => handleRemoveEmployee(emp.id)}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-gray-500 py-1 px-2">Select the Employees</span>
                      )}
                      <button
                        type="button"
                        className="text-blue-600 font-medium hover:text-blue-800 ml-auto"
                        onClick={() => toggleDropdown('employee')}
                      >
                        {selectedEmployeeNames.length > 0 ? '+ Add more' : '+ Add employees'}
                      </button>
                    </div>
                    
                    {showEmployeeDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                        <div className="p-3 bg-white bg-opacity-90 rounded-t-md">
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                              </svg>
                            </div>
                            <input
                              type="text"
                              placeholder="Search employees..."
                              value={employeeSearchTerm}
                              onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-4 py-2 border border-cyan-400 rounded text-black font-bold focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                            {employeeSearchTerm && (
                              <button
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                onClick={() => setEmployeeSearchTerm("")}
                                type="button"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto mb-4 border rounded-lg bg-white bg-opacity-90">
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
                                  className={`p-3 border-b last:border-b-0 cursor-pointer text-black transition hover:bg-gray-100 flex items-center ${
                                    isSelected ? 'bg-blue-50' : ''
                                  }`}
                                  onClick={() => handleEmployeeSelect(emp)}
                                >
                                  {/* Profile icon with initials */}
                                  <div className="w-10 h-10 rounded-full bg-[#03B0F5] text-white flex items-center justify-center mr-3 flex-shrink-0 text-sm font-medium">
                                    {initials}
                                  </div>
                                  <div className="flex flex-col flex-1">
                                    <span className="font-medium text-sm">{displayName}</span>
                                    <span className="text-xs text-gray-600">
                                      {emp.department_name || emp.department || 'Unknown Department'}
                                    </span>
                                  </div>
                                  {/* Selection indicator */}
                                  <div className={`w-5 h-5 border rounded ${
                                    isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
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

                {/* Mistake Type and Warning Action Row */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1" ref={warningTypeDropdownRef}>
                    <label className="block font-bold text-gray-700 mb-1">
                      Mistake Type <span className="text-red-500">*</span>
                    </label>
                    <div 
                      className="w-full px-3 py-2 border border-cyan-400 rounded bg-white cursor-pointer flex justify-between items-center"
                      onClick={() => toggleDropdown('warningType')}
                    >
                      <span className={selectedWarningTypeName ? 'text-black' : 'text-gray-500'}>
                        {selectedWarningTypeName || 'Select Warning Type'}
                      </span>
                      <svg className={`w-4 h-4 transition-transform ${showWarningTypeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                    
                    {showWarningTypeDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                        <div className="p-2">
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            <input
                              type="text"
                              placeholder="Search warning types..."
                              value={warningTypeSearchTerm}
                              onChange={(e) => setWarningTypeSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-black"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {[
                            { value: 'Late Arrival', label: 'Late Arrival' },
                            { value: 'Late Lunch', label: 'Late Lunch' },
                            { value: 'Abuse', label: 'Abuse' },
                            { value: 'Early Leave', label: 'Early Leave' }
                          ]
                            .filter(type => type.label.toLowerCase().includes(warningTypeSearchTerm.toLowerCase()))
                            .map((type) => (
                              <div
                                key={type.value}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-black"
                                onClick={() => {
                                  console.log('Selected warning type:', type.value);
                                  handleFormChange('warning_type', type.value);
                                  setSelectedWarningTypeName(type.label);
                                  setWarningTypeSearchTerm('');
                                  setShowWarningTypeDropdown(false);
                                }}
                              >
                                {type.label}
                              </div>
                            ))}
                          {[
                            { value: 'Late Arrival', label: 'Late Arrival' },
                            { value: 'Late Lunch', label: 'Late Lunch' },
                            { value: 'Abuse', label: 'Abuse' },
                            { value: 'Early Leave', label: 'Early Leave' }
                          ].filter(type => type.label.toLowerCase().includes(warningTypeSearchTerm.toLowerCase())).length === 0 && warningTypeSearchTerm && (
                            <div className="px-4 py-2 text-gray-500">No warning types found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative flex-1" ref={warningActionDropdownRef}>
                    <label className="block font-bold text-gray-700 mb-1">
                      Warning Action <span className="text-red-500">*</span>
                    </label>
                    <div 
                      className="w-full px-3 py-2 border border-cyan-400 rounded bg-white cursor-pointer flex justify-between items-center"
                      onClick={() => toggleDropdown('warningAction')}
                    >
                      <span className={selectedWarningActionName ? 'text-black' : 'text-gray-500'}>
                        {selectedWarningActionName || 'Select Warning Action'}
                      </span>
                      <svg className={`w-4 h-4 transition-transform ${showWarningActionDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                    
                    {showWarningActionDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                        <div className="p-2">
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            <input
                              type="text"
                              placeholder="Search warning actions..."
                              value={warningActionSearchTerm}
                              onChange={(e) => setWarningActionSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-black"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {[
                            { value: 'verbal warning', label: 'Verbal Warning' },
                            { value: 'written warning', label: 'Written Warning' },
                            { value: 'final warning', label: 'Final Warning' },
                            { value: 'financial penalty', label: 'Financial Penalty' }
                          ]
                            .filter(action => action.label.toLowerCase().includes(warningActionSearchTerm.toLowerCase()))
                            .map((action) => (
                              <div
                                key={action.value}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-black"
                                onClick={() => {
                                  handleFormChange('warning_action', action.value);
                                  setSelectedWarningActionName(action.label);
                                  setWarningActionSearchTerm('');
                                  setShowWarningActionDropdown(false);
                                }}
                              >
                                {action.label}
                              </div>
                            ))}
                          {[
                            { value: 'verbal warning', label: 'Verbal Warning' },
                            { value: 'written warning', label: 'Written Warning' },
                            { value: 'final warning', label: 'Final Warning' },
                            { value: 'financial penalty', label: 'Financial Penalty' }
                          ].filter(action => action.label.toLowerCase().includes((selectedWarningActionName || '').toLowerCase())).length === 0 && selectedWarningActionName && (
                            <div className="px-4 py-2 text-gray-500">No warning actions found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Penalty Amount */}
                <div className="mt-4">
                  <label className="block font-bold text-gray-700 mb-1">Penalty Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="text"
                      value={formData.penalty_amount}
                      onChange={(e) => handleFormChange('penalty_amount', e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-cyan-400 rounded text-black font-bold"
                      placeholder="Enter penalty amount"
                    />
                  </div>
                </div>

                {/* Attachments Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
                  <button
                    type="button"
                    onClick={() => document.getElementById('fileInput').click()}
                    className="bg-blue-500 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-600 transition"
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
                  
                  {/* File List */}
                  {selectedFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded border">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">{file.name}</span>
                            <span className="text-xs text-green-600">Ready to upload</span>
                            <span className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Warning Message */}
                <div className="mt-4">
                  <label className="block font-bold text-gray-700 mb-1">Warning Message</label>
                  <textarea
                    value={formData.warning_message}
                    onChange={(e) => handleFormChange('warning_message', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none"
                    placeholder="Enter warning message..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg shadow hover:bg-cyan-700 transition text-lg"
                  >
                    Issue Warning
                  </button>
                </div>
              </form>

              {/* Enhanced Similar Warnings Section */}
              {showingSimilarWarnings && similarWarnings.length > 0 && (
                <div className="mt-8 border-t pt-6">
                  {/* Enhanced Alert Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-6 w-6 text-orange-600" />
                      <div>
                        <h3 className="font-bold text-gray-800">
                          {formData.warning_type && selectedEmployees.length > 0 
                            ? `Similar "${formData.warning_type}" Warnings Found`
                            : 'Previous Warnings Found'
                          }
                        </h3>
                        <p className="text-sm text-gray-600">
                          {formData.warning_type && selectedEmployees.length > 0 
                            ? `Showing all employees who have received "${formData.warning_type}" warnings`
                            : `Showing previous warnings for selected employee(s)`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="bg-blue-100 px-3 py-1 rounded-full">
                      <span className="text-sm font-medium text-blue-800">
                        {similarWarnings.length} warning{similarWarnings.length !== 1 ? 's' : ''} found
                      </span>
                    </div>
                  </div>

                  {/* Statistics Section */}
                  {formData.warning_type && selectedEmployees.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {[...new Set(similarWarnings.map(w => w.issued_to_name))].length}
                        </div>
                        <div className="text-sm text-gray-600">Affected Employees</div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-600">
                          ₹{similarWarnings.reduce((total, w) => total + (parseFloat(w.penalty_amount) || 0), 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-sm text-gray-600">Total Penalties</div>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          ₹{Math.round(similarWarnings.reduce((total, w) => total + (parseFloat(w.penalty_amount) || 0), 0) / similarWarnings.length).toLocaleString('en-IN')}
                        </div>
                        <div className="text-sm text-gray-600">Avg. Penalty</div>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Warnings Table */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-lg">
                          {formData.warning_type ? `"${formData.warning_type}" Warning History` : 'Warning History'}
                        </h4>
                        <span className="bg-white bg-opacity-20 px-2 py-1 rounded text-sm">
                          {similarWarnings.length} record{similarWarnings.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">#</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">DATE & TIME</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">ISSUED BY</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">EMPLOYEE</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">DEPARTMENT</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">MISTAKE TYPE</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">ACTION</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">PENALTY</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-600">MESSAGE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {similarWarnings
                            .sort((a, b) => new Date(b.issued_date) - new Date(a.issued_date))
                            .map((warning, index) => (
                            <tr 
                              key={`${warning.id || index}`} 
                              className={`border-b similar-warnings-row`}
                            >
                              <td className="px-4 py-3 text-center">
                                <div className="w-8 h-8 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="font-medium">
                                  {new Date(warning.issued_date).toLocaleDateString('en-GB', { 
                                    day: '2-digit', 
                                    month: 'short', 
                                    year: 'numeric' 
                                  })}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(warning.issued_date).toLocaleTimeString('en-GB', { 
                                    hour: '2-digit', 
                                    minute: '2-digit', 
                                    hour12: true 
                                  })}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-bold text-white">
                                      {(warning.issued_by_name || 'U').charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="font-medium text-gray-700">{warning.issued_by_name || 'Unknown'}</div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-bold text-white">
                                      {(warning.issued_to_name || 'U').charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="font-medium text-gray-700">{warning.issued_to_name || 'Unknown'}</div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {warning.department_name || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded text-xs font-medium text-white ${
                                  warning.warning_type === 'Late Arrival' ? 'bg-yellow-500' :
                                  warning.warning_type === 'Late Lunch' ? 'bg-blue-500' :
                                  warning.warning_type === 'Abuse' ? 'bg-red-500' :
                                  warning.warning_type === 'Early Leave' ? 'bg-purple-500' : 'bg-gray-500'
                                }`}>
                                  {warning.warning_type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs font-medium">
                                  {warning.warning_action || 'No Action'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-red-600">
                                ₹{Number(warning.penalty_amount || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                                <div className="truncate" title={warning.warning_message || 'No message provided'}>
                                  {warning.warning_message || 'No message provided'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Summary Footer */}
                    <div className="bg-gray-50 px-4 py-3 border-t">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                        <div>
                          {formData.warning_type ? (
                            <span>
                              <strong>{[...new Set(similarWarnings.map(w => w.issued_to_name))].length}</strong> different employee(s) 
                              have received <strong>"{formData.warning_type}"</strong> warnings
                            </span>
                          ) : (
                            <span>
                              Showing <strong>{similarWarnings.length}</strong> warning(s) 
                              for selected employee(s)
                            </span>
                          )}
                        </div>
                        <div>
                          Most recent: <strong>
                            {new Date(Math.max(...similarWarnings.map(w => new Date(w.issued_date)))).toLocaleDateString('en-GB')}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* View Warning Modal */}
      {viewDialogOpen && selectedWarning && (
        <div className="bg-transparent fixed inset-0 z-50 flex items-center justify-center">
          <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl mx-auto space-y-2 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setViewDialogOpen(false)}
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-blue-500 mb-4">WARNING DETAILS</h2>
            
            {/* Date & Time and Created By Row */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block font-bold text-gray-700 mb-1">
                  Date & Time
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={selectedWarning.issued_date ? new Date(selectedWarning.issued_date).toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  }).replace(',', '') : formatDate(selectedWarning.issued_date)}
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
                  value={selectedWarning.issued_by_name || 'Unknown'}
                  readOnly
                />
              </div>
            </div>

            {/* Two Column Layout for Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Department */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={selectedWarning.department_name || 'N/A'}
                  readOnly
                />
              </div>

              {/* Employee */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Employee</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={selectedWarning.issued_to_name || 'Unknown Employee'}
                  readOnly
                />
              </div>

              {/* Warning Type */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Mistake Type</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={selectedWarning.warning_type || 'N/A'}
                  readOnly
                />
              </div>

              {/* Warning Action */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Warning Action</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={selectedWarning.warning_action || 'N/A'}
                  readOnly
                />
              </div>
            </div>

            {/* Penalty Amount - Full Width */}
            <div className="mt-4">
              <label className="block font-bold text-gray-700 mb-1">Penalty Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-black font-bold">₹</span>
                <input
                  type="text"
                  className="w-full pl-8 pr-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                  value={Number(selectedWarning.penalty_amount).toLocaleString('en-IN')}
                  readOnly
                />
              </div>
            </div>

            {/* Warning Message - Full Width */}
            <div className="mt-4">
              <label className="block font-bold text-gray-700 mb-1">Warning Message</label>
              <textarea
                value={selectedWarning.warning_message || 'No message provided'}
                rows={4}
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100 resize-none"
                readOnly
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 mt-6">
              <button
                onClick={() => setViewDialogOpen(false)}
                className="px-6 py-3 bg-cyan-600 text-white rounded-xl shadow hover:bg-cyan-700 transition font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Warning Modal */}
      {editDialogOpen && (
        <div className="bg-transparent fixed inset-0 z-50 flex items-center justify-center">
          <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl mx-auto space-y-2 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditDialogOpen(false)}
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-blue-500 mb-4">EDIT WARNING</h2>
            
            <form onSubmit={(e) => { e.preventDefault(); handleEditSubmit(); }}>
              {/* Date & Time and Created By Row */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block font-bold text-gray-700 mb-1">
                    Date & Time
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value={editingWarning ? new Date(editingWarning.issue_date).toLocaleDateString('en-GB', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }).replace(',', '') : ''}
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
                    value={editingWarning ? editingWarning.issued_by_name || 'Unknown' : ''}
                    readOnly
                  />
                </div>
              </div>

              {/* Two Column Layout for Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Department Display */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value={editingWarning ? editingWarning.department_name || 'N/A' : ''}
                    readOnly
                  />
                </div>

                {/* Employee Display */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Employee</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                    value={editingWarning ? editingWarning.issued_to_name || 'Unknown Employee' : ''}
                    readOnly
                  />
                </div>

                {/* Warning Type Selection */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Mistake Type *</label>
                  <select
                    value={formData.warning_type}
                    onChange={(e) => handleFormChange('warning_type', e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    required
                  >
                    <option value="">Select Mistake Type</option>
                    {warningTypes.map((type) => {
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

                {/* Penalty Amount */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Penalty Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-black font-bold">₹</span>
                    <input
                      type="number"
                      value={formData.penalty_amount}
                      onChange={(e) => handleFormChange('penalty_amount', e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-cyan-400 rounded text-black font-bold"
                      placeholder="Enter penalty amount"
                      required
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Warning Message - Full Width */}
              <div className="mt-4">
                <label className="block font-bold text-gray-700 mb-1">Warning Message</label>
                <textarea
                  value={formData.warning_message}
                  onChange={(e) => handleFormChange('warning_message', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold resize-none"
                  placeholder="Enter detailed warning message..."
                />
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={() => setEditDialogOpen(false)}
                  className="px-6 py-3 bg-gray-400 text-white rounded-xl shadow hover:bg-gray-500 transition font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-cyan-600 text-white rounded-xl shadow hover:bg-cyan-700 transition font-bold"
                >
                  Update Warning
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteDialogOpen && warningToDelete && (
        <div className="bg-transparent fixed inset-0 z-50 flex items-center justify-center">
          <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-md mx-auto space-y-2">
            <button
              onClick={() => setDeleteDialogOpen(false)}
              className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-red-600 mb-4">CONFIRM DELETE</h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Delete Warning</h3>
                  <p className="text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-700">
                Are you sure you want to delete the warning issued to <strong>{warningToDelete.issued_to_name}</strong> for <strong>{warningToDelete.warning_type}</strong>?
              </p>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 mt-6">
              <button
                onClick={() => setDeleteDialogOpen(false)}
                className="px-6 py-3 bg-gray-400 text-white rounded-xl shadow hover:bg-gray-500 transition font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-3 bg-red-600 text-white rounded-xl shadow hover:bg-red-700 transition font-bold"
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
    setRenderError(error);
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
