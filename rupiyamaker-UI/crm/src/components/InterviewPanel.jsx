"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from "../lib/utils.js";
import EditInterview from './EditInterview';
import DuplicateInterviewModal from './DuplicateInterviewModal';
import API, { interviewSettingsAPI } from '../services/api';
import { formatDate as formatDateUtil, formatDateTime, calculateAge } from '../utils/dateUtils';
import { hasPermission, getUserPermissions } from '../utils/permissions';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// Tab configuration
const TABS = [
  { id: 'all', label: 'All', count: 0 },
  { id: 'today', label: 'Today Interview', count: 0 },
  { id: 'upcoming', label: 'Upcoming Interview', count: 0 },
  { id: 'result', label: 'Complete Interview', count: 0 }
];

const InterviewPanel = () => {
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
  `;

  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [filteredInterviews, setFilteredInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusCounts, setStatusCounts] = useState([]);
  const [tabCounts, setTabCounts] = useState(TABS);
  const [selectedInterview, setSelectedInterview] = useState(null);

  // Table scroll state
  const tableScrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Selection state for bulk operations
  const [selectedInterviews, setSelectedInterviews] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [checkboxVisible, setCheckboxVisible] = useState(false);

  // Reassignment panel state
  const [showReassignmentPanel, setShowReassignmentPanel] = useState(false);
  const [reassignmentRequests, setReassignmentRequests] = useState([]);
  const [loadingReassignments, setLoadingReassignments] = useState(false);

  // Filter popup state
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('status');
  const [filterOptions, setFilterOptions] = useState({
    status: [],
    dateFrom: '',
    dateTo: '',
    hrManagerAdmin: '',
    interviewType: [],
    jobOpening: []
  });

  // Job Opening Options from backend settings
  const [jobOpeningOptions, setJobOpeningOptions] = useState([]);

  // Interview Type Options from localStorage
  const [interviewTypeOptions, setInterviewTypeOptions] = useState([]);
  
  // Force refresh trigger for filtering
  const [filterRefreshTrigger, setFilterRefreshTrigger] = useState(0);

  // Source/Portal Options from backend
  const [sourcePortalOptions, setSourcePortalOptions] = useState([]);

  // HR Managers and Admins for filter dropdown
  const [hrManagersAndAdmins, setHrManagersAndAdmins] = useState([]);

  // Permission state for interview module (like Tickets/Warnings)
  const [permissions, setPermissions] = useState({
    can_view_all: false,
    can_delete: false,
    can_add: false,
    can_edit: false
  });

  // Check user permissions for interviews (like Tickets/Warnings)
  const checkInterviewPermissions = () => {
    const userPermissions = JSON.parse(localStorage.getItem('userPermissions') || '[]');
    
    console.log('🔍 Checking Interview Permissions:', userPermissions);
    
    // Check for explicit delete OR all permission
    const hasDeletePermission = () => {
      if (Array.isArray(userPermissions)) {
        for (const perm of userPermissions) {
          if (perm && (perm.page === 'interview' || perm.page === 'Interview' || perm.page === 'interviews' || perm.page === 'Interviews')) {
            if (Array.isArray(perm.actions)) {
              // Check for explicit delete OR all permission
              return perm.actions.includes('delete') || perm.actions.includes('all');
            } else if (perm.actions === 'delete' || perm.actions === 'all' || perm.actions === '*') {
              return true;
            }
          }
        }
      }
      return false;
    };

    // Check for all permission (show all interviews)
    const hasAllPermission = () => {
      if (Array.isArray(userPermissions)) {
        for (const perm of userPermissions) {
          if (perm && (perm.page === 'interview' || perm.page === 'Interview' || perm.page === 'interviews' || perm.page === 'Interviews')) {
            if (Array.isArray(perm.actions)) {
              return perm.actions.includes('all') || perm.actions.includes('*');
            } else if (perm.actions === 'all' || perm.actions === '*') {
              return true;
            }
          }
        }
      }
      return false;
    };

    const calculatedPermissions = {
      can_view_all: hasAllPermission(),
      can_delete: hasDeletePermission(),
      can_add: true, // Default to true for now
      can_edit: true  // Default to true for now
    };

    console.log('📋 Interview Permissions:', calculatedPermissions);
    return calculatedPermissions;
  };

  // Load job opening and interview type options from backend
  useEffect(() => {
    loadDropdownOptions();
  }, []);

  // Load permissions on mount (like Tickets/Warnings)
  useEffect(() => {
    const userPermissions = checkInterviewPermissions();
    setPermissions(userPermissions);
  }, []);

  // Listen for permission changes (like Tickets/Warnings)
  useEffect(() => {
    const handlePermissionUpdate = () => {
      console.log('🔄 Interviews - Permissions updated, reloading...');
      const userPermissions = checkInterviewPermissions();
      setPermissions(userPermissions);
    };
    
    window.addEventListener('permissionsUpdated', handlePermissionUpdate);
    
    return () => {
      window.removeEventListener('permissionsUpdated', handlePermissionUpdate);
    };
  }, []);

  // Refresh dropdown options when window gains focus (user comes back from settings)
  useEffect(() => {
    const handleFocus = () => {
      loadDropdownOptions();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Check if user has permission to access interview settings
  const canAccessSettings = () => {
    const userPermissions = getUserPermissions();
    
    // Check for specific interview settings permission
    const hasSpecificPermission = hasPermission(userPermissions, 'interview', 'settings');
    
    // Check for superadmin permission (page "*" and actions "*")
    const hasSuperAdminPermission = hasPermission(userPermissions, '*', '*');
    
    return hasSpecificPermission || hasSuperAdminPermission;
  };

  const loadDropdownOptions = async () => {
    try {
      
      // Load Job Opening Options
      try {
        const jobOpeningsResponse = await interviewSettingsAPI.getJobOpenings();
        
        if (jobOpeningsResponse.success && jobOpeningsResponse.data && jobOpeningsResponse.data.length > 0) {
          const apiOptions = jobOpeningsResponse.data.map(item => {
            // Handle both object format {name: "value"} and string format
            if (typeof item === 'object' && item.name) {
              return item.name;
            } else if (typeof item === 'string') {
              return item;
            } else if (item.value) {
              return item.value;
            } else if (item.title) {
              return item.title;
            } else {
              return String(item);
            }
          });
          setJobOpeningOptions(apiOptions);
        } else {
          // Fallback to default options only if API returns no data
          const defaultJobOpenings = [
            'Software Engineer',
            'Frontend Developer', 
            'Backend Developer',
            'Full Stack Developer',
            'Data Analyst',
            'Business Analyst',
            'Project Manager',
            'UI/UX Designer',
            'DevOps Engineer',
            'Quality Assurance',
            'Sales Executive',
            'Marketing Executive',
            'Customer Support',
            'Human Resources',
            'Finance Executive',
            'Operations Manager',
            'Content Writer',
            'Digital Marketing',
            'Business Development',
            'Other'
          ];
          setJobOpeningOptions(defaultJobOpenings);
        }
      } catch (error) {
        console.error('Error loading job openings from API:', error);
        // Fallback to default options only if API call fails
        const defaultJobOpenings = [
          'Software Engineer',
          'Frontend Developer', 
          'Backend Developer',
          'Full Stack Developer',
          'Data Analyst',
          'Business Analyst',
          'Project Manager',
          'UI/UX Designer',
          'DevOps Engineer',
          'Quality Assurance',
          'Sales Executive',
          'Marketing Executive',
          'Customer Support',
          'Human Resources',
          'Other'
        ];
        setJobOpeningOptions(defaultJobOpenings);
      }

      // Load Interview Type Options
      try {
        const interviewTypesResponse = await interviewSettingsAPI.getInterviewTypes();
        
        if (interviewTypesResponse.success && interviewTypesResponse.data && interviewTypesResponse.data.length > 0) {
          const apiOptions = interviewTypesResponse.data.map(item => item.name || item.value || item);
          setInterviewTypeOptions(apiOptions);
        } else {
          // Fallback to default options
          const defaultTypes = [
            'Technical Interview',
            'HR Interview', 
            'Management Round',
            'Final Round',
            'Phone Screening',
            'Video Interview',
            'Walk-in Interview',
            'Group Discussion',
            'Coding Assessment',
            'Behavioral Interview'
          ];
          setInterviewTypeOptions(defaultTypes);
        }
      } catch (error) {
        const defaultTypes = [
          'Technical Interview',
          'HR Interview',
          'Management Round', 
          'Final Round',
          'Phone Screening',
          'Video Interview',
          'Walk-in Interview',
          'Group Discussion'
        ];
        setInterviewTypeOptions(defaultTypes);
      }

      // Load Source/Portal Options
      try {
        const sourcePortalsResponse = await interviewSettingsAPI.getSourcePortals();
        
        if (sourcePortalsResponse.success && sourcePortalsResponse.data && sourcePortalsResponse.data.length > 0) {
          const apiOptions = sourcePortalsResponse.data.map(item => item.name || item.value || item);
          setSourcePortalOptions(apiOptions);
        } else {
          // Fallback to default options
          const defaultSourcePortals = [
            'LinkedIn',
            'Naukri.com',
            'Indeed',
            'Monster.com',
            'Glassdoor',
            'AngelList',
            'Referral',
            'Company Website',
            'Job Fair',
            'Campus Placement',
            'Social Media',
            'Walk-in',
            'Consultant',
            'Other'
          ];
          setSourcePortalOptions(defaultSourcePortals);
        }
      } catch (error) {
        const defaultSourcePortals = [
          'LinkedIn',
          'Naukri.com',
          'Indeed',
          'Monster.com',
          'Referral',
          'Walk-in',
          'Other'
        ];
        setSourcePortalOptions(defaultSourcePortals);
      }

      // Load Status Options with Sub-Statuses
      try {
        const statusesResponse = await interviewSettingsAPI.getStatuses();
        if (statusesResponse.success && statusesResponse.data) {
          // Load sub-statuses for each status
          const statusesWithSubStatuses = [];
          for (const status of statusesResponse.data) {
            try {
              const subStatusResponse = await interviewSettingsAPI.getSubStatuses(status._id);
              const statusWithSubs = {
                ...status,
                sub_statuses: subStatusResponse.success ? subStatusResponse.data : []
              };
              statusesWithSubStatuses.push(statusWithSubs);
          } catch (error) {
            statusesWithSubStatuses.push({
              ...status,
              sub_statuses: []
            });
          }
        }
        
        // Set both the original format for backward compatibility and the new hierarchical format
        const apiStatusOptions = statusesResponse.data.map(item => item.name || item.value || item);
        
        // Ensure "rescheduled" is always included in status options
        if (!apiStatusOptions.includes('rescheduled')) {
          apiStatusOptions.push('rescheduled');
        }
        
        setStatusOptions(apiStatusOptions);
        setStatusOptionsWithSubs(statusesWithSubStatuses);
      } else {
        // Fallback to default options
        const defaultStatuses = [
          'new_interview',
          'selected', 
          'rejected',
          'no_show',
          'not_relevant',
          'rescheduled'
        ];
        setStatusOptions(defaultStatuses);
        setStatusOptionsWithSubs([]);
      }
      } catch (error) {
        const defaultStatuses = [
          'new_interview',
          'selected', 
          'rejected',
          'no_show',
          'not_relevant',
          'rescheduled'
        ];
        setStatusOptions(defaultStatuses);
        setStatusOptionsWithSubs([]);
      }
      
    } catch (error) {
      console.error('Error in loadDropdownOptions:', error);
      // Fallback to default options if entire API loading fails
      // Note: We don't reset jobOpeningOptions here since it has its own error handling
      setInterviewTypeOptions([
        'Technical Interview',
        'HR Interview',
        'Management Round',
        'Final Round',
        'Phone Screening',
        'Video Interview',
        'Coding Assessment',
        'System Design',
        'Behavioral Interview'
      ]);
      setStatusOptions([
        'new_interview',
        'selected', 
        'rejected',
        'no_show',
        'not_relevant',
        'rescheduled'
      ]);
    }
  };

  // Load actual interview creators for filter dropdown
  const loadHrManagersAndAdmins = async () => {
    try {
      // Get unique creators from interviews data
      const uniqueCreators = [...new Set(interviews
        .map(interview => interview.created_by)
        .filter(creator => creator && creator.trim() !== '')
      )];

      // If we have interviews data, use it to populate the creators list
      if (uniqueCreators.length > 0) {
        const formattedUsers = uniqueCreators.map(creator => ({
          id: creator,
          username: creator,
          role: 'Interview Creator',
          displayName: creator
        }));
        
        setHrManagersAndAdmins(formattedUsers);
      } else {
        // Fallback: Try to get users from API if no interviews exist yet
        const response = await API.get('/users');
        if (response.data) {
          // Filter users with role 'hr_manager' or 'super admin'
          const filteredUsers = response.data.filter(user => 
            user.role && (
              user.role.toLowerCase().includes('hr_manager') || 
              user.role.toLowerCase().includes('super admin') ||
              user.role.toLowerCase().includes('hr manager') ||
              user.role.toLowerCase().includes('admin')
            )
          );
          
          // Map to display format: "Full Name (role)"
          const formattedUsers = filteredUsers.map(user => ({
            id: user._id || user.id,
            username: user.username,
            role: user.role,
            displayName: `${user.username} (${user.role})`
          }));
          
          setHrManagersAndAdmins(formattedUsers);
        }
      }
    } catch (error) {
      // If API fails, set empty array
      setHrManagersAndAdmins([]);
    }
  };

  // Status dropdown state for table
  const [showStatusDropdown, setShowStatusDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, maxHeight: 350 });
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  
  // Hierarchical navigation states (matching LeadCRM)
  const [showMainStatuses, setShowMainStatuses] = useState(true);
  const [selectedMainStatus, setSelectedMainStatus] = useState(null);
  const [clickedStatusOption, setClickedStatusOption] = useState(null);
  
  // Filter popup hierarchical navigation states
  const [filterShowMainStatuses, setFilterShowMainStatuses] = useState(true);
  const [filterSelectedMainStatus, setFilterSelectedMainStatus] = useState(null);
  const [filterStatusSearchTerm, setFilterStatusSearchTerm] = useState('');

  // Available status options for interviews - loaded from API
  const [statusOptions, setStatusOptions] = useState([
    'new_interview',
    'selected', 
    'rejected',
    'no_show',
    'not_relevant',
    'rescheduled'
  ]);

  // Hierarchical status options with sub-statuses
  const [statusOptionsWithSubs, setStatusOptionsWithSubs] = useState([]);

  // Count active filters (matching LeadCRM functionality)
  const getActiveFilterCount = () => {
    let count = 0;
    if (filterOptions.status && filterOptions.status.length > 0) count++;
    if (filterOptions.dateFrom || filterOptions.dateTo) count++;
    if (filterOptions.hrManagerAdmin && filterOptions.hrManagerAdmin.trim() !== '') count++;
    if (filterOptions.interviewType && Array.isArray(filterOptions.interviewType) && filterOptions.interviewType.length > 0) count++;
    if (filterOptions.jobOpening && Array.isArray(filterOptions.jobOpening) && filterOptions.jobOpening.length > 0) count++;
    if (searchTerm && searchTerm.trim() !== '') count++;
    return count;
  };

  // Get filter count for specific category (matching LeadCRM)
  const getFilterCategoryCount = (category) => {
    switch (category) {
      case 'status':
        return filterOptions.status && filterOptions.status.length > 0 ? 1 : 0;
      case 'date':
        return (filterOptions.dateFrom || filterOptions.dateTo) ? 1 : 0;
      case 'hrManagerAdmin':
        return filterOptions.hrManagerAdmin && filterOptions.hrManagerAdmin.trim() !== '' ? 1 : 0;
      case 'interviewType':
        return filterOptions.interviewType && Array.isArray(filterOptions.interviewType) && filterOptions.interviewType.length > 0 ? 1 : 0;
      case 'jobOpening':
        return filterOptions.jobOpening && Array.isArray(filterOptions.jobOpening) && filterOptions.jobOpening.length > 0 ? 1 : 0;
      default:
        return 0;
    }
  };

  // Load interviews data
  const loadInterviews = useCallback(async () => {
    try {
      setLoading(true);
      
      // Call getInterviews with error handling for 404
      const data = await API.interviews.getInterviews(1, 1000).catch(error => {
        if (error.message && error.message.includes('404')) {
          throw new Error('Interviews endpoint not found. Please check if the backend server is running with the interviews module enabled.');
        }
        throw error;
      });
      
      console.log("📊 loadInterviews - Raw data from API:", data);
      console.log("📊 loadInterviews - First interview sample:", data?.[0]);
      console.log("📊 loadInterviews - Total interviews loaded:", data?.length);
      
      setInterviews(data || []); // Backend returns array directly
    } catch (error) {
      alert(`Failed to load interviews: ${error.message}`);
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInterviews();
  }, [loadInterviews]);

  // Load reassignment requests
  const loadReassignmentRequests = async () => {
    try {
      setLoadingReassignments(true);
      const response = await API.interviews.getAllReassignments();
      
      if (response.success && response.data) {
        // Get all users to resolve names for "Unknown" users
        let usersMap = {};
        try {
          const usersResponse = await API.users.getUsers();
          if (usersResponse && usersResponse.length > 0) {
            usersMap = usersResponse.reduce((acc, user) => {
              acc[user._id] = `${user.first_name} ${user.last_name}`.trim();
              return acc;
            }, {});
          }
        } catch (userError) {
          console.warn('Could not fetch users for name resolution:', userError);
        }

        // Transform the data to match the expected format
        const transformedData = response.data.map(request => {
          const requestedByName = request.reassignment_requested_by_name === 'Unknown' 
            ? (usersMap[request.reassignment_requested_by] || 'Unknown')
            : request.reassignment_requested_by_name || 'Unknown';
          
          const targetUserName = request.reassignment_target_user_name === 'Unknown'
            ? (usersMap[request.reassignment_target_user] || 'Unknown') 
            : request.reassignment_target_user_name || 'Unknown';

          return {
            ...request,
            // Map API field names to expected field names
            requested_by: requestedByName,
            requested_by_id: request.reassignment_requested_by,
            target_user: targetUserName, 
            target_user_id: request.reassignment_target_user,
            current_assignee: request.current_user_name || 'Current User',
            current_assignee_id: request.current_user_id,
            reason: request.reassignment_reason,
            requested_at: request.reassignment_requested_at,
            // Use the status from the API response
            reassignment_status: request.reassignment_status || 'pending',
            pending_reassignment: request.reassignment_status === 'pending',
            interview_date: request.interview_date || request.created_at
          };
        });

        console.log('📋 Loaded all reassignment requests:', transformedData);
        setReassignmentRequests(transformedData);
      } else {
        setReassignmentRequests([]);
      }
    } catch (error) {
      console.error('Error loading reassignment requests:', error);
      setReassignmentRequests([]);
    } finally {
      setLoadingReassignments(false);
    }
  };

  // Load HR managers/creators when interviews data changes
  useEffect(() => {
    if (interviews.length > 0) {
      loadHrManagersAndAdmins();
    }
  }, [interviews]);

  // Add a refresh trigger for when the component becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page became visible, refreshing interviews...');
        loadInterviews();
      }
    };

    const handleFocus = () => {
      console.log('🔄 Window focused, refreshing interviews...');
      loadInterviews();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadInterviews]);

  // Helper function to get status type from status name
  const getStatusType = useCallback((statusName) => {
    if (!statusName) return 'Open';
    
    // Enhanced fallback logic that works both with and without loaded statusOptions
    const statusLower = statusName.toLowerCase();
    
    // Define patterns for different status types
    const completePatterns = [
      'select', 'hired', 'approved', 'confirmed_hired', 'final_select',
      'reject', 'denied', 'cancelled', 'not_interested', 'declined',
      'completed', 'finished', 'closed', 'done', 'final'
    ];
    
    const openPatterns = [
      'new', 'created', 'initial', 'scheduled', 'rescheduled', 
      'pending', 'waiting', 'hold', 'process', 'progress', 'ongoing',
      'review', 'evaluation', 'interview', 'assessment', 'test'
    ];
    
    // Check against patterns first (works without statusOptionsWithSubs)
    const isComplete = completePatterns.some(pattern => statusLower.includes(pattern));
    const isOpen = openPatterns.some(pattern => statusLower.includes(pattern));
    
    let statusType;
    if (isComplete) {
      statusType = 'Complete';
    } else if (isOpen) {
      statusType = 'Open';
    } else if (statusOptionsWithSubs.length > 0) {
      // If statusOptions are loaded, try to use them
      const mainStatusName = statusName.includes(':') ? statusName.split(':')[0] : statusName;
      const statusOption = statusOptionsWithSubs.find(option => 
        option && option.name && option.name.toLowerCase() === mainStatusName.toLowerCase()
      );
      statusType = statusOption?.statusType || 'Open';
    } else {
      // Default fallback when nothing matches and statusOptions not loaded
      statusType = 'Open';
    }
    
    console.log('🔍 getStatusType Debug:', {
      statusName,
      statusLower,
      isComplete,
      isOpen,
      statusOptionsLoaded: statusOptionsWithSubs.length > 0,
      resultType: statusType
    });
    
    return statusType;
  }, [statusOptionsWithSubs]);

  // Calculate status and tab counts
  const updateCounts = useCallback(() => {
    // Use ALL interviews for counting, not filtered ones to avoid circular dependency
    const interviewsToCount = interviews || [];
    
    // If no interviews, set all counts to 0
    if (interviewsToCount.length === 0) {
      const newTabCounts = TABS.map(tab => ({ ...tab, count: 0 }));
      setTabCounts(newTabCounts);
      setStatusCounts([]);
      return;
    }

    const today = new Date().toDateString();
    
    // Function to get status-specific colors
    const getStatusColor = (status) => {
      const statusLower = status.toLowerCase();
      
      // Specific color assignments based on status keywords
      if (statusLower.includes('reject') || statusLower.includes('denied') || statusLower.includes('cancelled')) {
        return 'bg-red-500';
      } else if (statusLower.includes('select') || statusLower.includes('hired') || statusLower.includes('approved') || statusLower.includes('confirmed')) {
        return 'bg-green-500';
      } else if (statusLower.includes('reschedule') || statusLower.includes('postpone') || statusLower.includes('delay')) {
        return 'bg-purple-500';
      } else if (statusLower.includes('pending') || statusLower.includes('waiting') || statusLower.includes('hold')) {
        return 'bg-yellow-500';
      } else if (statusLower.includes('new') || statusLower.includes('created') || statusLower.includes('initial')) {
        return 'bg-blue-500';
      } else if (statusLower.includes('process') || statusLower.includes('progress') || statusLower.includes('ongoing')) {
        return 'bg-indigo-500';
      } else if (statusLower.includes('review') || statusLower.includes('evaluation')) {
        return 'bg-orange-500';
      } else {
        // Default colors for other statuses - cycle through remaining colors
        const defaultColors = ['bg-gray-500', 'bg-pink-500', 'bg-teal-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500'];
        const hash = status.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        return defaultColors[Math.abs(hash) % defaultColors.length];
      }
    };
    
    // Update status counts based on dynamic status options using ALL interviews
    const newStatusCounts = statusOptions.map((status, index) => {
      const matchingInterviews = interviewsToCount.filter(interview => interview.status === status);
      
      const statusCard = {
        label: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), // Convert to title case
        count: matchingInterviews.length,
        color: getStatusColor(status) // Use intelligent color assignment
      };
      
      return statusCard;
    });
    
    setStatusCounts(newStatusCounts);

    // Update tab counts using ALL interviews (not filtered)
    const newTabCounts = TABS.map(tab => {
      let count = 0;
      if (tab.id === 'today') {
        count = interviewsToCount.filter(interview => 
          new Date(interview.interview_date).toDateString() === today &&
          getStatusType(interview.status) === 'Open'
        ).length;
      } else if (tab.id === 'upcoming') {
        count = interviewsToCount.filter(interview => 
          new Date(interview.interview_date) > new Date() &&
          getStatusType(interview.status) === 'Open'
        ).length;
      } else if (tab.id === 'result') {
        count = interviewsToCount.filter(interview => 
          getStatusType(interview.status) === 'Complete'
        ).length;
      } else if (tab.id === 'all') {
        count = interviewsToCount.length;
      }
      return { ...tab, count };
    });
    setTabCounts(newTabCounts);
  }, [interviews, statusOptionsWithSubs, getStatusType]);

  useEffect(() => {
    updateCounts();
  }, [interviews, updateCounts]);

  // Update counts when status options change
  useEffect(() => {
    if (statusOptionsWithSubs.length > 0 && interviews.length > 0) {
      updateCounts();
    }
  }, [statusOptionsWithSubs, updateCounts, interviews]);

  // Update scroll buttons when table content changes
  useEffect(() => {
    updateScrollButtons();
  }, [filteredInterviews]);

  // Debug useEffect to track activeTab changes
  useEffect(() => {
    console.log(`🎯 ACTIVE TAB CHANGED TO: ${activeTab}`);
  }, [activeTab]);

  // Filter interviews based on active tab, search term, and filter options
  useEffect(() => {
    console.log('🔥 FILTERING useEffect TRIGGERED:', {
      activeTab,
      interviewsLength: interviews.length,
      statusOptionsWithSubsLength: statusOptionsWithSubs.length,
      searchTerm,
      filterOptionsStatus: filterOptions.status
    });
    
    // Always proceed with filtering, even if statusOptions aren't fully loaded
    // The getStatusType function has fallback logic to handle this
    
    let filtered = [...interviews];
    const today = new Date().toDateString();

    console.log('🔍 Filter Debug: Starting filter with', {
      activeTab,
      interviewsCount: interviews.length,
      statusOptionsCount: statusOptions.length,
      searchTerm,
      filterOptions
    });

    // Log some sample interview data for debugging
    if (interviews.length > 0) {
      const sampleInterview = interviews[interviews.length - 1]; // Get the most recently added interview
      console.log('🔍 Filter Debug: Sample interview data (most recent):', {
        candidate_name: sampleInterview.candidate_name,
        status: sampleInterview.status,
        interview_date: sampleInterview.interview_date,
        statusType: getStatusType(sampleInterview.status)
      });
    }

    // Filter by active tab
    console.log('🔍 Tab Filter Debug: Applying tab filter for', activeTab);
    
    if (activeTab === 'today') {
      // Today tab: Only Open status types with today's date
      const beforeCount = filtered.length;
      filtered = filtered.filter(interview => {
        const interviewDate = new Date(interview.interview_date);
        const isToday = interviewDate.toDateString() === today;
        const statusType = getStatusType(interview.status);
        const isOpen = statusType === 'Open';
        
        console.log('🔍 Today Filter:', {
          candidate: interview.candidate_name,
          date: interview.interview_date,
          parsedDate: interviewDate.toDateString(),
          isToday,
          status: interview.status,
          statusType,
          isOpen,
          passes: isToday && isOpen
        });
        
        return isToday && isOpen;
      });
      console.log(`🔍 Today tab filtered: ${beforeCount} -> ${filtered.length} interviews`);
    } else if (activeTab === 'upcoming') {
      // Upcoming tab: Only Open status types with future dates
      const beforeCount = filtered.length;
      const now = new Date();
      filtered = filtered.filter(interview => {
        const interviewDate = new Date(interview.interview_date);
        const isFuture = interviewDate > now;
        const statusType = getStatusType(interview.status);
        const isOpen = statusType === 'Open';
        
        console.log('🔍 Upcoming Filter:', {
          candidate: interview.candidate_name,
          date: interview.interview_date,
          parsedDate: interviewDate,
          now: now,
          isFuture,
          status: interview.status,
          statusType,
          isOpen,
          passes: isFuture && isOpen
        });
        
        return isFuture && isOpen;
      });
      console.log(`🔍 Upcoming tab filtered: ${beforeCount} -> ${filtered.length} interviews`);
    } else if (activeTab === 'result') {
      // Complete tab: Only Complete status types (any date)
      const beforeCount = filtered.length;
      filtered = filtered.filter(interview => {
        const statusType = getStatusType(interview.status);
        const isComplete = statusType === 'Complete';
        
        console.log('🔍 Result Filter:', {
          candidate: interview.candidate_name,
          status: interview.status,
          statusType,
          isComplete,
          passes: isComplete
        });
        
        return isComplete;
      });
      console.log(`🔍 Result tab filtered: ${beforeCount} -> ${filtered.length} interviews`);
    } else if (activeTab === 'all') {
      // All tab: Show everything (Open + Complete, all dates including overdue)
      console.log('🔍 All tab: No filtering applied, showing all interviews');
    }

    // Filter by status (from filter popup) - supports hierarchical status values
    if (filterOptions.status && filterOptions.status.length > 0) {
      filtered = filtered.filter(interview => {
        const interviewStatus = interview.status?.toLowerCase();
        return filterOptions.status.some(filterStatus => {
          const filterStatusLower = filterStatus.toLowerCase();
          // Check exact match
          if (interviewStatus === filterStatusLower) return true;
          // Check hierarchical match (for sub-statuses like "selected:final review")
          if (interviewStatus && interviewStatus.includes(':')) {
            const [mainStatus, subStatus] = interviewStatus.split(':');
            const expectedHierarchical = `${mainStatus}:${subStatus}`;
            return expectedHierarchical === filterStatusLower;
          }
          return false;
        });
      });
    }

    // Filter by date range
    if (filterOptions.dateFrom || filterOptions.dateTo) {
      filtered = filtered.filter(interview => {
        const interviewDate = new Date(interview.interview_date);
        const fromDate = filterOptions.dateFrom ? new Date(filterOptions.dateFrom) : null;
        const toDate = filterOptions.dateTo ? new Date(filterOptions.dateTo) : null;
        
        let withinRange = true;
        if (fromDate) withinRange = withinRange && interviewDate >= fromDate;
        if (toDate) withinRange = withinRange && interviewDate <= toDate;
        
        return withinRange;
      });
    }

    // Filter by HR manager/admin
    if (filterOptions.hrManagerAdmin && filterOptions.hrManagerAdmin.trim() !== '') {
      filtered = filtered.filter(interview =>
        interview.created_by?.toLowerCase() === filterOptions.hrManagerAdmin.toLowerCase() ||
        interview.created_by_name?.toLowerCase() === filterOptions.hrManagerAdmin.toLowerCase()
      );
    }

    // Filter by interview type
    if (filterOptions.interviewType && Array.isArray(filterOptions.interviewType) && filterOptions.interviewType.length > 0) {
      filtered = filtered.filter(interview =>
        filterOptions.interviewType.some(type => 
          interview.interview_type?.toLowerCase().includes(type.toLowerCase())
        )
      );
    }

    // Filter by job opening
    if (filterOptions.jobOpening && Array.isArray(filterOptions.jobOpening) && filterOptions.jobOpening.length > 0) {
      filtered = filtered.filter(interview =>
        filterOptions.jobOpening.some(job => 
          interview.job_opening?.toLowerCase().includes(job.toLowerCase())
        )
      );
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(interview =>
        interview.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        interview.mobile_number?.includes(searchTerm) ||
        interview.job_opening?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        interview.city?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    console.log('🔍 Filter Debug: Filtering completed', {
      originalCount: interviews.length,
      filteredCount: filtered.length,
      activeTab,
      removedCount: interviews.length - filtered.length
    });

    // If we filtered out interviews, log why
    if (interviews.length > filtered.length) {
      const removedInterviews = interviews.filter(interview => !filtered.includes(interview));
      console.log('🔍 Filter Debug: Removed interviews:', removedInterviews.map(interview => ({
        candidate_name: interview.candidate_name,
        status: interview.status,
        interview_date: interview.interview_date,
        statusType: getStatusType(interview.status),
        reason: 'Check tab filtering logic'
      })));
    }

    console.log('🎯 FINAL FILTER RESULT:', {
      activeTab,
      originalCount: interviews.length,
      filteredCount: filtered.length,
      finalInterviews: filtered.map(i => ({ 
        name: i.candidate_name, 
        status: i.status, 
        date: i.interview_date,
        statusType: getStatusType(i.status)
      }))
    });
    
    setFilteredInterviews(filtered);
  }, [interviews, activeTab, searchTerm, filterOptions, getStatusType, filterRefreshTrigger, statusOptionsWithSubs]);

  const handleCreateInterview = async () => {
    try {
      
      // Refresh dropdown options before opening modal to ensure latest data
      await loadDropdownOptions();
      
      setShowCreateModal(true);
      
    } catch (error) {
      alert(`Failed to open create interview modal: ${error.message}`);
    }
  };

  const handleInterviewCreated = async (newInterview) => {
    console.log("handleInterviewCreated called with:", newInterview);
    
    try {
      // Close the modal first
      setShowCreateModal(false);
      
      // Reload the complete list from server to ensure consistency and get the latest data
      console.log("Reloading interviews list from server...");
      await loadInterviews();
      
      // Also refresh dropdown options in case new data was added
      console.log("Refreshing dropdown options after interview creation...");
      await loadDropdownOptions();
      
      // Switch to 'all' tab to ensure the new interview is visible
      // (in case user was on a filtered tab that might not show the new interview)
      setActiveTab('all');
      
      // Clear any search filters that might hide the new interview
      setSearchTerm('');
      
      // Reset filter options to show all interviews
      setFilterOptions({
        status: [],
        dateFrom: '',
        dateTo: '',
        hrManagerAdmin: '',
        interviewType: [],
        jobOpening: []
      });
      
      console.log("✅ Interview creation completed and view reset to show all interviews");
      
    } catch (error) {
      console.error("❌ Error in handleInterviewCreated:", error);
      // If reloading fails, still try to add the interview locally
      setInterviews(prev => {
        const updated = [...prev, newInterview];
        console.log("Fallback: Updated interviews list after creation:", updated);
        return updated;
      });
    }
  };

  // Handle row click to show EditInterview
  const handleRowClick = async (interview) => {
    try {
      console.log("handleRowClick called with interview:", interview);
      console.log("Interview Family & Living fields:", {
        living_arrangement: interview.living_arrangement,
        primary_earning_member: interview.primary_earning_member,
        type_of_business: interview.type_of_business,
        banking_experience: interview.banking_experience,
        experience_type: interview.experience_type,
        total_experience: interview.total_experience
      });
      
      // Validate interview data before passing to EditInterview
      if (!interview) {
        throw new Error("No interview data provided");
      }
      
      // Always allow opening the interview for editing
      // The EditInterview component will handle ID generation if needed
      setSelectedInterview(interview);
    } catch (error) {
      alert("Failed to open interview details: " + error.message);
    }
  };

  // Handle save interview from EditInterview
  const handleSaveInterview = async (interviewId, updatedData) => {
    try {
      console.log("🔧 Parent handleSaveInterview called with:", { interviewId, updatedData });
      
      // First, actually save the data to the backend using the API
      console.log("🔧 Calling API to update interview...");
      const result = await API.interviews.updateInterview(interviewId, updatedData);
      
      console.log("🔧 API update result:", result);
      
      if (!result) {
        throw new Error("Failed to update interview - no response from server");
      }
      
      // After successful API call, refresh the data from server to ensure we show the latest data
      console.log("🔄 Refreshing interviews data after save...");
      
      // Add a small delay to ensure backend processing is complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await loadInterviews();
      
      // Also refresh dropdown options in case new statuses were added
      console.log("🔄 Refreshing dropdown options...");
      await loadDropdownOptions();
      
      // Update the selectedInterview with fresh data from the API result if available
      // This ensures the EditInterview modal shows the latest data if it's still open
      if (result && selectedInterview) {
        console.log("🔄 Updating selectedInterview with fresh data from API result");
        console.log("🔄 API result data:", result);
        setSelectedInterview(result);
      }
      
      // Force a re-render of the interviews list to ensure the table shows updated data
      console.log("🔄 Triggering interviews list re-render");
      setInterviews(prevInterviews => {
        if (result) {
          // Update the specific interview in the list with the new data
          return prevInterviews.map(interview => 
            (interview._id === interviewId || interview.id === interviewId) ? result : interview
          );
        }
        return [...prevInterviews]; // Force re-render even if no specific update
      });
      
      console.log("✅ Interview updated and data refreshed successfully");
      return result;
    } catch (error) {
      console.error("🔧 Error in handleSaveInterview:", error);
      // Still try to refresh even if there was an error
      try {
        await loadInterviews();
        await loadDropdownOptions();
      } catch (refreshError) {
        console.error("Error refreshing data:", refreshError);
      }
      throw error;
    }
  };

  // Handle cancel from EditInterview
  const handleCancelEdit = () => {
    setSelectedInterview(null);
  };

  // Table horizontal scroll functions
  const scrollTable = (direction) => {
    if (tableScrollRef.current) {
      const scrollAmount = 300;
      const currentScroll = tableScrollRef.current.scrollLeft;
      const newScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      tableScrollRef.current.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
    }
  };

  const updateScrollButtons = () => {
    if (tableScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  // Selection handler functions for bulk operations
  const handleSelectInterview = (interviewId) => {
    setSelectedInterviews(prev => {
      if (prev.includes(interviewId)) {
        return prev.filter(id => id !== interviewId);
      } else {
        return [...prev, interviewId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedInterviews([]);
      setSelectAll(false);
    } else {
      const allIds = filteredInterviews.map(interview => interview._id);
      setSelectedInterviews(allIds);
      setSelectAll(true);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInterviews.length === 0) {
      toast.warning('Please select interviews to delete');
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedInterviews.length} interview(s)? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Delete interviews one by one
      for (const interviewId of selectedInterviews) {
        await fetch(`${API_BASE_URL}/interviews/${interviewId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }

      toast.success(`Successfully deleted ${selectedInterviews.length} interview(s)`);
      
      // Reset selection
      setSelectedInterviews([]);
      setSelectAll(false);
      
      // Reload interviews
      await loadInterviews();
    } catch (error) {
      toast.error('Failed to delete interviews');
    } finally {
      setLoading(false);
    }
  };

  const handleShowCheckboxes = () => {
    setCheckboxVisible(true);
  };

  const handleCancelSelection = () => {
    setSelectedInterviews([]);
    setSelectAll(false);
    setCheckboxVisible(false);
  };

  // Reassignment handlers
  const handleApproveReassignment = async (requestId) => {
    try {
      const userId = localStorage.getItem('userId');
      const response = await API.interviews.approveReassignment(requestId, userId);
      
      if (response.success) {
        alert('Reassignment request approved successfully!');
        // Refresh the reassignment requests list
        await loadReassignmentRequests();
        // Refresh interviews to show updated assignee
        await loadInterviews();
      } else {
        alert('Failed to approve reassignment: ' + (response.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error approving reassignment:', error);
      alert('Error approving reassignment: ' + error.message);
    }
  };

  const handleRejectReassignment = async (requestId) => {
    try {
      const remarks = prompt('Please provide a reason for rejection (optional):');
      const userId = localStorage.getItem('userId');
      
      const response = await API.interviews.rejectReassignment(requestId, userId, remarks || '');
      
      if (response.success) {
        alert('Reassignment request rejected successfully!');
        // Refresh the reassignment requests list
        await loadReassignmentRequests();
      } else {
        alert('Failed to reject reassignment: ' + (response.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error rejecting reassignment:', error);
      alert('Error rejecting reassignment: ' + error.message);
    }
  };

  // Status dropdown functions
  const handleStatusDropdownClick = (rowIdx, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (showStatusDropdown === rowIdx) {
      setShowStatusDropdown(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = 350;

    let top = rect.bottom + window.scrollY;
    let maxHeight = dropdownHeight;

    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      top = rect.top + window.scrollY - dropdownHeight;
      maxHeight = Math.min(dropdownHeight, spaceAbove - 10);
    } else {
      maxHeight = Math.min(dropdownHeight, spaceBelow - 10);
    }

    setDropdownPosition({
      top: top,
      left: rect.left + window.scrollX,
      maxHeight: maxHeight
    });
    
    setShowStatusDropdown(rowIdx);
    setStatusSearchTerm('');
    
    // Reset hierarchical navigation state
    setShowMainStatuses(true);
    setSelectedMainStatus(null);
    setClickedStatusOption(null);
  };

  const handleStatusChange = async (rowIdx, newStatus, shouldTreatAsMainStatus = false) => {
    try {
      
      // Check if this is a navigation to sub-statuses
      if (shouldTreatAsMainStatus) {
        const subStatuses = getSubStatusesForMainStatus(newStatus);
        if (subStatuses.length > 0) {
          setSelectedMainStatus(newStatus);
          setShowMainStatuses(false);
          setStatusSearchTerm('');
          return; // Don't close dropdown, just navigate
        }
      }
      
      // Update the interview status
      const interview = filteredInterviews[rowIdx];
      
      // Extract the actual status value if it's an object
      let statusValue = newStatus;
      if (typeof newStatus === 'object' && newStatus !== null) {
        if (newStatus.name) {
          statusValue = newStatus.name;
        } else if (newStatus.value) {
          statusValue = newStatus.value;
        } else {
          statusValue = String(newStatus);
        }
      }
      
      
      const updatedInterview = await API.interviews.updateInterview(interview._id, { status: statusValue });
      
      console.log('🔍 Status Update Debug:', {
        interviewId: interview._id,
        candidateName: interview.candidate_name,
        oldStatus: interview.status,
        newStatus: statusValue,
        newStatusType: getStatusType(statusValue)
      });
      
      // Update the interviews list immediately for quick UI update
      setInterviews(prev => prev.map(int => 
        int._id === interview._id ? { ...int, status: statusValue } : int
      ));
      
      // Trigger filter refresh
      setFilterRefreshTrigger(prev => prev + 1);

      // Close dropdown and reset navigation state
      setShowStatusDropdown(null);
      setShowMainStatuses(true);
      setSelectedMainStatus(null);
      setStatusSearchTerm('');

      // Reload interviews to ensure status cards update
      setTimeout(() => {
        loadInterviews();
      }, 100);
      
    } catch (error) {
      
      // Comprehensive error message extraction
      let errorMessage = 'Unknown error occurred';
      
      // Handle different error formats
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      } else if (error?.detail) {
        errorMessage = error.detail;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (typeof error === 'object') {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = 'Error occurred but could not extract details';
        }
      }
      
      alert('Failed to update interview status: ' + errorMessage);
    }
  };

  // Get hierarchical status options (main statuses + sub-statuses) for dropdown
  const getFilteredStatusOptionsHierarchical = () => {
    const hierarchicalOptions = [];
    
    // Add main statuses first (backward compatibility)
    statusOptions.forEach(status => {
      if (!statusSearchTerm || 
          status.toLowerCase().includes(statusSearchTerm.toLowerCase()) ||
          status.replace('_', ' ').toLowerCase().includes(statusSearchTerm.toLowerCase())) {
        hierarchicalOptions.push({
          type: 'status',
          data: status,
          parentStatus: status
        });
      }
    });
    
    // Add sub-statuses under their parent statuses
    statusOptionsWithSubs.forEach(statusWithSubs => {
      const parentStatusName = statusWithSubs.name;
      
      if (statusWithSubs.sub_statuses && statusWithSubs.sub_statuses.length > 0) {
        statusWithSubs.sub_statuses.forEach(subStatus => {
          const subStatusName = subStatus.name || subStatus;
          if (!statusSearchTerm || 
              subStatusName.toLowerCase().includes(statusSearchTerm.toLowerCase()) ||
              parentStatusName.toLowerCase().includes(statusSearchTerm.toLowerCase())) {
            hierarchicalOptions.push({
              type: 'sub-status',
              data: subStatus,
              parentStatus: parentStatusName
            });
          }
        });
      }
    });
    
    return hierarchicalOptions;
  };

  // Get filtered status options based on current navigation state (matching LeadCRM)
  const getFilteredStatusOptions = () => {
    if (statusSearchTerm) {
      // When searching, show all matching options
      const searchResults = [];
      
      // Add matching main statuses
      statusOptions.forEach(status => {
        if (status.toLowerCase().includes(statusSearchTerm.toLowerCase()) ||
            status.replace('_', ' ').toLowerCase().includes(statusSearchTerm.toLowerCase())) {
          searchResults.push(status);
        }
      });
      
      // Add matching sub-statuses
      statusOptionsWithSubs.forEach(statusWithSubs => {
        if (statusWithSubs.sub_statuses && statusWithSubs.sub_statuses.length > 0) {
          statusWithSubs.sub_statuses.forEach(subStatus => {
            const subStatusName = subStatus.name || subStatus;
            if (subStatusName.toLowerCase().includes(statusSearchTerm.toLowerCase()) ||
                statusWithSubs.name.toLowerCase().includes(statusSearchTerm.toLowerCase())) {
              searchResults.push(subStatus);
            }
          });
        }
      });
      
      return searchResults;
    }

    if (showMainStatuses) {
      // Show main statuses
      return statusOptions;
    } else if (selectedMainStatus) {
      // Show sub-statuses for selected main status
      const mainStatusData = statusOptionsWithSubs.find(s => s.name === selectedMainStatus);
      if (mainStatusData && mainStatusData.sub_statuses) {
        return mainStatusData.sub_statuses;
      }
    }
    
    return statusOptions; // Fallback
  };

  // Handle navigation back to main statuses
  const handleBackToMainStatuses = () => {
    setShowMainStatuses(true);
    setSelectedMainStatus(null);
    setStatusSearchTerm('');
  };

  // Get sub-statuses for a specific main status
  const getSubStatusesForMainStatus = (mainStatusName) => {
    const mainStatusData = statusOptionsWithSubs.find(s => s.name === mainStatusName);
    return mainStatusData?.sub_statuses || [];
  };

  // Get dynamic filter options including main statuses and sub-statuses
  const getDynamicFilterOptions = () => {
    const filterOptions = {
      status: [],
      interviewType: [...interviewTypeOptions],
      jobOpening: [...jobOpeningOptions]
    };

    // Add main statuses
    statusOptions.forEach(status => {
      filterOptions.status.push({
        type: 'main',
        value: status,
        label: status.replace('_', ' ').toUpperCase(),
        isHierarchical: getSubStatusesForMainStatus(status).length > 0
      });
    });

    // Add sub-statuses with their hierarchical values
    statusOptionsWithSubs.forEach(statusWithSubs => {
      if (statusWithSubs.sub_statuses && statusWithSubs.sub_statuses.length > 0) {
        statusWithSubs.sub_statuses.forEach(subStatus => {
          const hierarchicalValue = `${statusWithSubs.name}:${subStatus.name}`;
          filterOptions.status.push({
            type: 'sub',
            value: hierarchicalValue,
            label: `${statusWithSubs.name.replace('_', ' ').toUpperCase()} → ${subStatus.name}`,
            mainStatus: statusWithSubs.name,
            subStatusName: subStatus.name
          });
        });
      }
    });

    return filterOptions;
  };

  // Update filter options when settings change
  useEffect(() => {
    // This will refresh filter options when status options change
    const dynamicOptions = getDynamicFilterOptions();
  }, [statusOptions, statusOptionsWithSubs, interviewTypeOptions, jobOpeningOptions]);

  // Filter hierarchical navigation functions
  const getFilterStatusOptions = () => {
    if (filterStatusSearchTerm) {
      // When searching, show all matching options
      const searchResults = [];
      
      // Add matching main statuses
      statusOptions.forEach(status => {
        if (status.toLowerCase().includes(filterStatusSearchTerm.toLowerCase()) ||
            status.replace('_', ' ').toLowerCase().includes(filterStatusSearchTerm.toLowerCase())) {
          searchResults.push({
            type: 'main',
            value: status,
            label: status.replace('_', ' ').toUpperCase(),
            isHierarchical: getSubStatusesForMainStatus(status).length > 0
          });
        }
      });
      
      // Add matching sub-statuses
      statusOptionsWithSubs.forEach(statusWithSubs => {
        if (statusWithSubs.sub_statuses && statusWithSubs.sub_statuses.length > 0) {
          statusWithSubs.sub_statuses.forEach(subStatus => {
            const subStatusName = subStatus.name || subStatus;
            if (subStatusName.toLowerCase().includes(filterStatusSearchTerm.toLowerCase()) ||
                statusWithSubs.name.toLowerCase().includes(filterStatusSearchTerm.toLowerCase())) {
              const hierarchicalValue = `${statusWithSubs.name}:${subStatusName}`;
              searchResults.push({
                type: 'sub',
                value: hierarchicalValue,
                label: `${statusWithSubs.name.replace('_', ' ').toUpperCase()} → ${subStatusName}`,
                mainStatus: statusWithSubs.name,
                subStatusName: subStatusName
              });
            }
          });
        }
      });
      
      return searchResults;
    }

    if (filterShowMainStatuses) {
      // Show main statuses
      return statusOptions.map(status => ({
        type: 'main',
        value: status,
        label: status.replace('_', ' ').toUpperCase(),
        isHierarchical: getSubStatusesForMainStatus(status).length > 0
      }));
    } else if (filterSelectedMainStatus) {
      // Show sub-statuses for selected main status
      const mainStatusData = statusOptionsWithSubs.find(s => s.name === filterSelectedMainStatus);
      if (mainStatusData && mainStatusData.sub_statuses) {
        return mainStatusData.sub_statuses.map(subStatus => {
          const hierarchicalValue = `${filterSelectedMainStatus}:${subStatus.name}`;
          return {
            type: 'sub',
            value: hierarchicalValue,
            label: subStatus.name,
            mainStatus: filterSelectedMainStatus,
            subStatusName: subStatus.name
          };
        });
      }
    }
    
    return []; // Fallback
  };

  // Handle navigation back to main statuses in filter
  const handleFilterBackToMainStatuses = () => {
    setFilterShowMainStatuses(true);
    setFilterSelectedMainStatus(null);
    setFilterStatusSearchTerm('');
  };

  // Handle filter status selection/navigation
  const handleFilterStatusSelection = (statusOption) => {
    
    // Check if this is a navigation to sub-statuses
    if (statusOption.type === 'main' && statusOption.isHierarchical && filterShowMainStatuses && !filterStatusSearchTerm) {
      // Navigate to sub-statuses
      setFilterSelectedMainStatus(statusOption.value);
      setFilterShowMainStatuses(false);
      setFilterStatusSearchTerm('');
      return; // Don't toggle checkbox, just navigate
    }
    
    // Handle checkbox toggle for actual selection
    const statusValue = statusOption.value;
    if (filterOptions.status.includes(statusValue)) {
      setFilterOptions(prev => ({
        ...prev,
        status: prev.status.filter(s => s !== statusValue)
      }));
    } else {
      setFilterOptions(prev => ({
        ...prev,
        status: [...prev.status, statusValue]
      }));
    }
  };

  // Format status display to handle hierarchical status values
  const formatStatusDisplay = (status) => {
    if (!status) return 'Select Status';
    
    // Check if it's a hierarchical status (contains colon)
    if (status.includes(':')) {
      const [mainStatus, subStatus] = status.split(':');
      return `${mainStatus.replace('_', ' ').toUpperCase()} → ${subStatus}`;
    }
    
    // Regular status formatting
    return status.replace('_', ' ').toUpperCase();
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showStatusDropdown !== null && 
          !event.target.closest('.status-dropdown-container') &&
          !event.target.closest('.status-dropdown-menu')) {
        setShowStatusDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showStatusDropdown]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading interviews...</div>
      </div>
    );
  }

  return (
    <>
      <style>{stickyHeaderStyles}</style>
      <div className="p-6 bg-black min-h-screen">
      {/* Header with Create Button and Settings */}
      <div className="flex justify-end items-center mb-6 gap-3">
        {canAccessSettings() && (
          <>
            <button
              onClick={() => navigate('/interview-settings')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              title="Manage Job Opening Options"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              Settings
            </button>
            <button
              onClick={async () => {
                setShowReassignmentPanel(true);
                await loadReassignmentRequests();
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              title="View Reassignment Requests"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Reassignments
            </button>
          </>
        )}
        <button
          onClick={handleCreateInterview}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Create Interview
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mb-6">
        {statusCounts.map((status, index) => (
          <div
            key={index}
            className={cn(
              "p-3 sm:p-4 rounded-lg text-white shadow-lg",
              status.color
            )}
          >
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold truncate">{status.label}</h3>
            <p className="text-xl sm:text-2xl font-bold">{status.count}</p>
          </div>
        ))}
      </div>

      {/* Filters and Search Row - Matching LeadCRM styling */}
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Select Button */}
          {(() => {
            console.log('🔍 Interview Delete Button Check:', {
              'permissions': permissions,
              'permissions.can_delete': permissions?.can_delete,
              'checkboxVisible': checkboxVisible,
              'should_show_button': permissions?.can_delete && !checkboxVisible
            });
            return null;
          })()}
          {permissions?.can_delete && !checkboxVisible ? (
            <button
              className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
              onClick={handleShowCheckboxes}
            >
              {selectedInterviews.length > 0
                ? `Select (${selectedInterviews.length})`
                : "Select"}
            </button>
          ) : permissions?.can_delete && checkboxVisible ? (
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
                {selectedInterviews.length} interview{selectedInterviews.length !== 1 ? "s" : ""} selected
              </span>
              <button
                className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                onClick={handleBulkDelete}
                disabled={selectedInterviews.length === 0}
              >
                Delete ({selectedInterviews.length})
              </button>
              <button
                className="px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                onClick={handleCancelSelection}
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {/* Filter Button - Matching LeadCRM exactly */}
          <button
            className={`px-5 py-3 rounded-lg font-bold shadow transition relative flex items-center gap-3 text-base ${getActiveFilterCount() > 0
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            onClick={() => {
              setShowFilterPopup(true);
              // Reset filter navigation state when opening popup
              setFilterShowMainStatuses(true);
              setFilterSelectedMainStatus(null);
              setFilterStatusSearchTerm('');
            }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filter
            {getActiveFilterCount() > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center">
                {getActiveFilterCount()}
              </span>
            )}
          </button>

          {/* Search Box - Matching LeadCRM styling */}
          <div className="relative w-[320px]">
            <input
              type="text"
              placeholder="Search interviews..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-3 pl-10 pr-4 bg-[#1b2230] text-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-base placeholder-gray-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-gray-600">
        {tabCounts.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              console.log(`🔥 TAB CLICKED: ${tab.id} (was: ${activeTab})`);
              setActiveTab(tab.id);
            }}
            className={cn(
              "px-4 py-2 font-medium transition-colors border-b-2",
              activeTab === tab.id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Interview Table */}
      <InterviewTable 
        interviews={filteredInterviews} 
        onRowClick={handleRowClick}
        showStatusDropdown={showStatusDropdown}
        handleStatusDropdownClick={handleStatusDropdownClick}
        dropdownPosition={dropdownPosition}
        statusSearchTerm={statusSearchTerm}
        setStatusSearchTerm={setStatusSearchTerm}
        handleStatusChange={handleStatusChange}
        getFilteredStatusOptions={getFilteredStatusOptions}
        formatStatusDisplay={formatStatusDisplay}
        showMainStatuses={showMainStatuses}
        selectedMainStatus={selectedMainStatus}
        handleBackToMainStatuses={handleBackToMainStatuses}
        getSubStatusesForMainStatus={getSubStatusesForMainStatus}
        clickedStatusOption={clickedStatusOption}
        setClickedStatusOption={setClickedStatusOption}
        selectedInterviews={selectedInterviews}
        selectAll={selectAll}
        onSelectInterview={handleSelectInterview}
        onSelectAll={handleSelectAll}
        checkboxVisible={checkboxVisible}
        scrollTable={scrollTable}
        updateScrollButtons={updateScrollButtons}
        tableScrollRef={tableScrollRef}
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
      />

      {/* Create Interview Modal */}
      {showCreateModal && (
        <React.Suspense fallback={<div>Loading modal...</div>}>
          <CreateInterviewModal
            onClose={() => {
              setShowCreateModal(false);
            }}
            onInterviewCreated={handleInterviewCreated}
            jobOpeningOptions={jobOpeningOptions}
            interviewTypeOptions={interviewTypeOptions}
            statusOptions={statusOptions}
            statusOptionsWithSubs={statusOptionsWithSubs}
            sourcePortalOptions={sourcePortalOptions}
            existingInterviews={interviews}
          />
        </React.Suspense>
      )}

      {/* Edit Interview Modal */}
      {selectedInterview && (
        <div className="fixed inset-0 z-[1000] flex items-center bg-transparent justify-center" style={{ backdropFilter: "blur(3px)" }}>
          <div className="w-full max-w-4xl mx-auto">
            <EditInterview
              interview={selectedInterview}
              onSave={handleSaveInterview}
              onClose={handleCancelEdit}
              jobOpeningOptions={jobOpeningOptions}
              interviewTypeOptions={interviewTypeOptions}
              sourcePortalOptions={sourcePortalOptions}
            />
          </div>
        </div>
      )}

      {/* Filter Popup - Matching LeadCRM Style */}
      {showFilterPopup && (
        <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-[1000]">
          <div className="bg-[#1b2230] border border-gray-600 rounded-lg p-6 w-[700px] max-w-[90vw] h-[560px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Filter Interviews</h2>
              <button
                onClick={() => setShowFilterPopup(false)}
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
                    onClick={() => {
                      setSelectedFilterCategory('status');
                      // Reset navigation state when switching to status category
                      setFilterShowMainStatuses(true);
                      setFilterSelectedMainStatus(null);
                      setFilterStatusSearchTerm('');
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${selectedFilterCategory === 'status'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-[#2a3441]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span className="text-base">Status</span>
                      </div>
                      {getFilterCategoryCount('status') > 0 && (
                        <span className="bg-red-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center">
                          {getFilterCategoryCount('status')}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('date')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'date'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-[#2a3441]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        Interview Date
                      </div>
                      {getFilterCategoryCount('date') > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {getFilterCategoryCount('date')}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('hrManagerAdmin')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'hrManagerAdmin'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-[#2a3441]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                        Interview Creator
                      </div>
                      {getFilterCategoryCount('hrManagerAdmin') > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {getFilterCategoryCount('hrManagerAdmin')}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('interviewType')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'interviewType'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-[#2a3441]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                        </svg>
                        Interview Type
                      </div>
                      {getFilterCategoryCount('interviewType') > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {getFilterCategoryCount('interviewType')}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('jobOpening')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'jobOpening'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-[#2a3441]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6"></path>
                        </svg>
                        Job Opening
                      </div>
                      {getFilterCategoryCount('jobOpening') > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {getFilterCategoryCount('jobOpening')}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Right side - Filter Options */}
              <div className="col-span-2 pl-4 overflow-y-auto">
                <h3 className="text-base font-medium text-gray-300 mb-4">
                  {selectedFilterCategory === 'status' && 'Interview Status'}
                  {selectedFilterCategory === 'date' && 'Interview Date Range'}
                  {selectedFilterCategory === 'hrManagerAdmin' && 'Interview Creator'}
                  {selectedFilterCategory === 'interviewType' && 'Interview Type'}
                  {selectedFilterCategory === 'jobOpening' && 'Job Opening'}
                </h3>
                
                <div className="space-y-4">
                  {/* Status Filter Options */}
                  {selectedFilterCategory === 'status' && (
                    <div className="space-y-3">
                      {/* Navigation header for hierarchical navigation */}
                      {!filterShowMainStatuses && filterSelectedMainStatus && (
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-600">
                          <button
                            onClick={handleFilterBackToMainStatuses}
                            className="flex items-center text-blue-400 hover:text-blue-300 text-sm font-medium"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Main Statuses
                          </button>
                          <span className="text-xs text-gray-400 font-medium">
                            {filterSelectedMainStatus.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      )}
                      
                      {/* Search input for status filter */}
                      <div className="relative mb-4">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          className="w-full pl-10 pr-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                          placeholder={
                            filterShowMainStatuses ? "Search statuses and sub-statuses..." : "Search sub-statuses..."
                          }
                          value={filterStatusSearchTerm}
                          onChange={(e) => setFilterStatusSearchTerm(e.target.value)}
                        />
                      </div>

                      {/* Status options list */}
                      {getFilterStatusOptions().map((statusOption) => {
                        const isMainStatusView = filterShowMainStatuses && !filterStatusSearchTerm;
                        const shouldTreatAsNavigation = statusOption.type === 'main' && statusOption.isHierarchical && isMainStatusView;
                        
                        return (
                          <div
                            key={statusOption.value}
                            className={`flex items-center space-x-3 cursor-pointer hover:bg-[#2a3441] p-2 rounded-lg transition-colors ${
                              shouldTreatAsNavigation ? 'hover:bg-blue-900/20' : ''
                            }`}
                            onClick={() => handleFilterStatusSelection(statusOption)}
                          >
                            {!shouldTreatAsNavigation && (
                              <input
                                type="checkbox"
                                checked={filterOptions.status.includes(statusOption.value)}
                                onChange={() => {}} // Handled by parent div click
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 pointer-events-none"
                              />
                            )}
                            <div className="flex items-center justify-between w-full">
                              <span className={`text-gray-300 ${statusOption.type === 'sub' ? 'text-sm' : ''}`}>
                                {statusOption.type === 'main' && statusOption.isHierarchical && '📋 '}
                                {statusOption.type === 'sub' && '↳ '}
                                {statusOption.label}
                                {statusOption.type === 'sub' && !filterShowMainStatuses && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Main Status: {statusOption.mainStatus.replace('_', ' ').toUpperCase()}
                                  </div>
                                )}
                              </span>
                              {/* Show arrow for main statuses with sub-statuses */}
                              {shouldTreatAsNavigation && (
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </div>
                            {/* Show sub-status count for main statuses */}
                            {shouldTreatAsNavigation && getSubStatusesForMainStatus(statusOption.value).length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                {getSubStatusesForMainStatus(statusOption.value).length} sub-status{getSubStatusesForMainStatus(statusOption.value).length !== 1 ? 'es' : ''}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {getFilterStatusOptions().length === 0 && (
                        <p className="text-gray-400 text-sm text-center py-4">
                          {filterStatusSearchTerm ? 
                            `No results found for "${filterStatusSearchTerm}"` : 
                            'No status options available'
                          }
                        </p>
                      )}
                    </div>
                  )}

                  {/* Date Filter Options */}
                  {selectedFilterCategory === 'date' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">From Date</label>
                        <input
                          type="date"
                          value={filterOptions.dateFrom}
                          onChange={(e) => setFilterOptions(prev => ({
                            ...prev,
                            dateFrom: e.target.value
                          }))}
                          className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">To Date</label>
                        <input
                          type="date"
                          value={filterOptions.dateTo}
                          onChange={(e) => setFilterOptions(prev => ({
                            ...prev,
                            dateTo: e.target.value
                          }))}
                          className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* HR Manager/Admin Filter Options */}
                  {selectedFilterCategory === 'hrManagerAdmin' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Select Interview Creator</label>
                      <select
                        value={filterOptions.hrManagerAdmin}
                        onChange={(e) => setFilterOptions(prev => ({
                          ...prev,
                          hrManagerAdmin: e.target.value
                        }))}
                        className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">All Interview Creators</option>
                        {hrManagersAndAdmins.map((user) => (
                          <option key={user.username} value={user.username}>
                            {user.username}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Interview Type Filter Options */}
                  {selectedFilterCategory === 'interviewType' && (
                    <div className="space-y-3">
                      {getDynamicFilterOptions().interviewType.map((interviewType) => (
                        <label key={interviewType} className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={filterOptions.interviewType.includes && filterOptions.interviewType.includes(interviewType)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilterOptions(prev => ({
                                  ...prev,
                                  interviewType: Array.isArray(prev.interviewType) 
                                    ? [...prev.interviewType, interviewType]
                                    : [interviewType]
                                }));
                              } else {
                                setFilterOptions(prev => ({
                                  ...prev,
                                  interviewType: Array.isArray(prev.interviewType)
                                    ? prev.interviewType.filter(t => t !== interviewType)
                                    : []
                                }));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-gray-300">
                            {interviewType}
                          </span>
                        </label>
                      ))}
                      {getDynamicFilterOptions().interviewType.length === 0 && (
                        <p className="text-gray-400 text-sm">No interview types available. Add them in settings.</p>
                      )}
                    </div>
                  )}

                  {/* Job Opening Filter Options */}
                  {selectedFilterCategory === 'jobOpening' && (
                    <div className="space-y-3">
                      {jobOpeningOptions.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-gray-400 text-sm">Loading job openings...</p>
                        </div>
                      ) : (
                        jobOpeningOptions.map((jobOpening) => (
                          <label key={jobOpening} className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={filterOptions.jobOpening && Array.isArray(filterOptions.jobOpening) && filterOptions.jobOpening.includes(jobOpening)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterOptions(prev => ({
                                    ...prev,
                                    jobOpening: Array.isArray(prev.jobOpening) 
                                      ? [...prev.jobOpening, jobOpening]
                                      : [jobOpening]
                                  }));
                                } else {
                                  setFilterOptions(prev => ({
                                    ...prev,
                                    jobOpening: Array.isArray(prev.jobOpening)
                                      ? prev.jobOpening.filter(j => j !== jobOpening)
                                      : []
                                  }));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-gray-300">
                              {jobOpening}
                            </span>
                          </label>
                        ))
                      )}
                      {jobOpeningOptions.length === 0 && (
                        <div className="text-center py-4">
                          <p className="text-gray-400 text-sm">No job openings available.</p>
                          <p className="text-gray-500 text-xs mt-1">Add job openings in settings to see them here.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-600">
              <button
                onClick={() => {
                  setFilterOptions({
                    status: [],
                    dateFrom: '',
                    dateTo: '',
                    hrManagerAdmin: '',
                    interviewType: [],
                    jobOpening: []
                  });
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Clear All Filters
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowFilterPopup(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowFilterPopup(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassignment Modal */}
      {showReassignmentPanel && (
        <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a2332] rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-purple-600 text-white flex items-center justify-between">
              <h2 className="text-xl font-semibold">Interview Reassignment Requests</h2>
              <div className="flex gap-3">
                <button
                  onClick={loadReassignmentRequests}
                  className="px-4 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors font-medium"
                  disabled={loadingReassignments}
                >
                  {loadingReassignments ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  onClick={() => setShowReassignmentPanel(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              {loadingReassignments ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-lg">Loading reassignment requests...</div>
                </div>
              ) : reassignmentRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6M9 16h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"></path>
                  </svg>
                  <p className="text-lg">No reassignment requests found</p>
                  <p className="text-sm">Reassignment requests will appear here when users request interview reassignments.</p>
                </div>
              ) : (
                <div className="bg-[#2a3441] rounded-lg border border-gray-600 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-white">
                      <thead className="bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Interview</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Current Assignee</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Requested By</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Target User</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Reason</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Requested At</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Status</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {reassignmentRequests.map((request, index) => (
                          <tr key={request._id} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-4">
                              <div>
                                <div className="font-medium text-white">{request.candidate_name}</div>
                                <div className="text-sm text-gray-400">{request.mobile_number}</div>
                                <div className="text-xs text-gray-500">
                                  {request.job_opening} • {request.status}
                                  {request.sub_status && ` • ${request.sub_status}`}
                                </div>
                                {request.interview_date && (
                                  <div className="text-xs text-blue-400">
                                    {new Date(request.interview_date).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-white">{request.current_assignee}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-white">{request.requested_by}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-white">{request.target_user}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-gray-300 max-w-xs">
                                {request.reason || 'No reason provided'}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-gray-400">
                                {request.requested_at ? new Date(request.requested_at).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'Unknown'}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-center">
                                {request.reassignment_status === 'pending' ? (
                                  <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded-full">
                                    Pending
                                  </span>
                                ) : request.reassignment_status === 'approved' ? (
                                  <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                                    Approved
                                  </span>
                                ) : request.reassignment_status === 'rejected' ? (
                                  <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full">
                                    Rejected
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded-full">
                                    {request.reassignment_status || 'Pending'}
                                  </span>
                                )}
                                {request.reassignment_remarks && (
                                  <div className="text-xs text-gray-400 mt-1" title={request.reassignment_remarks}>
                                    {request.reassignment_remarks.length > 20 
                                      ? `${request.reassignment_remarks.substring(0, 20)}...` 
                                      : request.reassignment_remarks}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex justify-center gap-2">
                                {request.reassignment_status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleApproveReassignment(request._id)}
                                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                                      title="Approve reassignment"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleRejectReassignment(request._id)}
                                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                                      title="Reject reassignment"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {request.reassignment_status !== 'pending' && (
                                  <span className="text-xs text-gray-500">
                                    {request.reassignment_status === 'approved' ? 'Already Approved' : 'Already Rejected'}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

// Interview Table Component
const InterviewTable = ({ 
  interviews, 
  onRowClick, 
  showStatusDropdown, 
  handleStatusDropdownClick, 
  dropdownPosition, 
  statusSearchTerm, 
  setStatusSearchTerm, 
  handleStatusChange, 
  getFilteredStatusOptions,
  formatStatusDisplay,
  showMainStatuses,
  selectedMainStatus,
  handleBackToMainStatuses,
  getSubStatusesForMainStatus,
  clickedStatusOption,
  setClickedStatusOption,
  selectedInterviews,
  selectAll,
  onSelectInterview,
  onSelectAll,
  checkboxVisible,
  scrollTable,
  updateScrollButtons,
  tableScrollRef,
  canScrollLeft,
  canScrollRight
}) => {
  if (interviews.length === 0) {
    return (
      <div className="overflow-x-auto bg-black rounded-lg">
        <div className="py-20 text-center text-gray-400 text-lg bg-black">
          <p className="text-xl font-semibold">No interviews found</p>
        </div>
      </div>
    );
  }

  // Format date in IST timezone format
  const formatDate = (date) => {
    if (!date) return '-';
    return formatDateUtil(date);
  };

  // Calculate days old from current date (matching LeadCRM)
  const calculateDaysOld = (date) => {
    if (!date) return 0;
    const currentDate = new Date();
    const interviewDate = new Date(date);
    const timeDifference = currentDate.getTime() - interviewDate.getTime();
    const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24));
    return daysDifference;
  };

  // Format date with days old (matching LeadCRM)
  const formatDateWithAge = (date) => {
    if (!date) return '-';
    const formattedDate = formatDate(date);
    const daysOld = calculateDaysOld(date);
    return (
      <div className="text-left">
        <div>{formattedDate}</div>
        <div className="text-sm text-gray-400">
          {daysOld === 0 ? 'Today' :
            daysOld === 1 ? '1 day old' :
              `${daysOld} days old`}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-black" style={{ marginLeft: 0 }}>
      <div className="relative">
        {/* Horizontal scroll buttons */}
        {canScrollLeft && (
          <button
            onClick={() => scrollTable('left')}
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
            onClick={() => scrollTable('right')}
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
          className="bg-black rounded-lg overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto"
          onScroll={updateScrollButtons}
        >
          <table className="min-w-[2400px] w-full bg-black relative">
        <thead className="bg-white sticky top-0 z-50 shadow-lg border-b-2 border-gray-200">
          <tr>
            {checkboxVisible && (
              <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={onSelectAll}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
              </th>
            )}
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              #
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Date & Time
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Created By
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Candidate Name
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Status
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Gender
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Qualification
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Job Applied
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Age
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Experience Type
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Source/Portal
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Monthly Salary Offered
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Interview Date
            </th>
            <th className="bg-white px-4 py-3 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider sticky top-0 z-50 shadow-sm border-b border-gray-200">
              Interview Time
            </th>
          </tr>
        </thead>
        <tbody className="bg-black">
          {interviews.map((interview, index) => (
            <tr 
              key={interview._id || index} 
              className="border-b border-gray-800 hover:bg-gray-900/50 transition bg-black cursor-pointer"
              onClick={() => onRowClick(interview)}
            >
              {checkboxVisible && (
                <td 
                  className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedInterviews.includes(interview._id)}
                    onChange={() => onSelectInterview(interview._id)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </td>
              )}
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                {index + 1}
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                {interview.created_at ? formatDateTime(interview.created_at) : 'N/A'}
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    {interview.created_by ? interview.created_by.charAt(0).toUpperCase() : "?"}
                  </div>
                  <span className='text-md'>{interview.created_by || "-"}</span>
                </div>
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {interview.candidate_name ? interview.candidate_name.charAt(0).toUpperCase() : "?"}
                  </div>
                  <div>
                    <div className="text-md font-semibold">{interview.candidate_name || "-"}</div>
                  </div>
                </div>
              </td>
              <td 
                className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative status-dropdown-container">
                  <button
                    className="bg-gray-800 text-white py-2 px-3 rounded-md border border-gray-600 hover:bg-gray-700 transition-colors w-full min-w-[150px] flex justify-between items-center status-dropdown-button"
                    onClick={(e) => handleStatusDropdownClick(index, e)}
                  >
                    <div className="font-medium text-white truncate w-full text-sm text-left">
                      {(() => {
                        // Check if interview has hierarchical status (MainStatus:SubStatus)
                        if (interview.status && interview.status.includes(':')) {
                          const [mainStatus, subStatus] = interview.status.split(':');
                          return (
                            <div>
                              <div>{subStatus}</div>
                              <div className="text-xs text-gray-400">
                                {mainStatus.replace('_', ' ').toUpperCase()}
                              </div>
                            </div>
                          );
                        } else {
                          // Regular status display
                          return interview.status ? interview.status.replace('_', ' ').toUpperCase() : 'Select Status';
                        }
                      })()}
                    </div>
                    <svg
                      className={`w-5 h-5 transition-transform ${showStatusDropdown === index ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                
                {showStatusDropdown === index && (
                  <div
                    className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[9999] status-dropdown-menu flex flex-col"
                    style={{
                      top: `${dropdownPosition.top}px`,
                      left: `${dropdownPosition.left}px`,
                      minWidth: '280px',
                      maxWidth: '400px',
                      maxHeight: `${dropdownPosition.maxHeight}px`,
                      backgroundColor: 'white',
                      zIndex: 9999,
                      overflowY: 'hidden'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                    }}
                  >
                    {/* Header with search */}
                    <div className="p-3 border-b border-gray-200 bg-white sticky top-0 z-10 rounded-t-lg">
                      {/* Navigation header for hierarchical navigation */}
                      {!showMainStatuses && selectedMainStatus && (
                        <div className="flex items-center justify-between mb-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBackToMainStatuses();
                            }}
                            className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Main Statuses
                          </button>
                          <span className="text-xs text-gray-600 font-medium">
                            {selectedMainStatus.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      )}
                      
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:border-sky-400"
                          placeholder={
                            showMainStatuses ? "Search statuses and sub-statuses..." : "Search sub-statuses..."
                          }
                          value={statusSearchTerm}
                          onChange={(e) => setStatusSearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Options list */}
                    <div 
                      className="overflow-y-auto bg-white rounded-b-lg flex-1"
                      style={{ 
                        overflowY: 'auto',
                        maxHeight: 'calc(100% - 80px)',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#888 transparent'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {getFilteredStatusOptions().length > 0 ? (
                        getFilteredStatusOptions().map((status, statusIndex) => {
                          const statusName = typeof status === 'object' ? status.name : status;
                          
                          // Enhanced logic to detect navigation state
                          const isMainStatusView = showMainStatuses && !statusSearchTerm;
                          const isSubStatusView = !showMainStatuses || statusSearchTerm;
                          const isDirectSearchResult = statusSearchTerm;
                          
                          // Check if this status is a main status (has sub-statuses)
                          const isActualMainStatus = getSubStatusesForMainStatus(statusName).length > 0;
                          
                          // Check if current status matches interview's status
                          const isCurrentStatus = (
                            interview.status === statusName ||
                            (interview.status && interview.status.includes(':') && (
                              interview.status.split(':')[0] === statusName ||
                              interview.status.split(':')[1] === statusName
                            ))
                          );
                          
                          // Determine if this should be treated as a main status click
                          const shouldTreatAsMainStatus = isMainStatusView && !isDirectSearchResult && isActualMainStatus;
                          
                          
                          return (
                            <div
                              key={`status-${statusIndex}-${statusName}`}
                              className={`px-4 py-3 cursor-pointer text-black hover:bg-blue-200 transition-colors border-b border-gray-100 last:border-b-0 text-left ${
                                clickedStatusOption === statusName ? 'font-bold shadow-lg' : ''
                              }`}
                              style={{
                                backgroundColor: clickedStatusOption === statusName ? '#FFFF00' : (isCurrentStatus ? '#FFFF00' : ''),
                                color: clickedStatusOption === statusName ? '#000000' : (isCurrentStatus ? '#000000' : '#000000'),
                                fontWeight: isCurrentStatus ? 'bold' : 'normal'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                e.nativeEvent.stopImmediatePropagation();
                                
                                // Set the clicked status option for visual feedback
                                setClickedStatusOption(statusName);
                                
                                // Use setTimeout to allow the visual feedback to show before processing
                                setTimeout(() => {
                                  // For sub-statuses, create hierarchical value; for main statuses use statusName
                                  let statusValue = statusName;
                                  if (isSubStatusView && selectedMainStatus && !shouldTreatAsMainStatus) {
                                    statusValue = `${selectedMainStatus}:${statusName}`;
                                  }
                                  handleStatusChange(index, statusValue, shouldTreatAsMainStatus);
                                  // Clear the clicked status option after processing
                                  setTimeout(() => {
                                    setClickedStatusOption(null);
                                  }, 100);
                                }, 150);
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium text-left select-none">
                                  {statusName.replace('_', ' ').toUpperCase()}
                                  {isSubStatusView && selectedMainStatus && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      Main Status: {selectedMainStatus.replace('_', ' ').toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                {/* Show arrow for main statuses with sub-statuses */}
                                {shouldTreatAsMainStatus && (
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </div>
                              {/* Show sub-status count for main statuses */}
                              {shouldTreatAsMainStatus && getSubStatusesForMainStatus(statusName).length > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {getSubStatusesForMainStatus(statusName).length} sub-status{getSubStatusesForMainStatus(statusName).length !== 1 ? 'es' : ''}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-4 py-6 text-gray-500 text-center text-sm">
                          {statusSearchTerm ? (
                            <div>
                              <div className="mb-2">No results found for "<span className="font-semibold text-gray-700">{statusSearchTerm}</span>"</div>
                              <div className="text-xs text-gray-400">
                                Try searching with different terms or clear the search
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="mb-2">No status options available</div>
                              <div className="text-xs text-gray-400">
                                Status data may still be loading...
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                {interview.gender || "-"}
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                {interview.qualification || "-"}
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                {interview.job_opening || "-"}
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                {interview.age || "-"}
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                {interview.experience_type || "-"}
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                {interview.source_portal || "-"}
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                {interview.monthly_salary_offered || "-"}
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                {interview.interview_date ? new Date(interview.interview_date).toLocaleDateString() : "-"}
              </td>
              <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                {interview.interview_time || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
        </div>
      </div>
    </div>
  );
};

// Searchable Select Component for dropdowns with search functionality
const SearchableSelect = ({ 
  value, 
  onChange, 
  options, 
  placeholder = "Select option", 
  className = "", 
  required = false,
  name,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option => 
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange({ target: { name, value: option } });
    setIsOpen(false);
    setSearchTerm('');
  };

  const displayValue = value || placeholder;

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold cursor-pointer flex justify-between items-center ${className} ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={value ? 'text-black' : 'text-gray-500'}>
          {displayValue}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-black focus:outline-none focus:ring-2 focus:ring-cyan-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={index}
                  className="px-3 py-2 cursor-pointer hover:bg-cyan-50 hover:text-cyan-700 text-black"
                  onClick={() => handleSelect(option)}
                >
                  {option}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-gray-500 text-sm">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Create Interview Modal Component
const CreateInterviewModal = ({ onClose, onInterviewCreated, jobOpeningOptions, interviewTypeOptions, statusOptions, statusOptionsWithSubs = [], sourcePortalOptions = [], existingInterviews = [] }) => {
  // Get current date and time in the required format for datetime-local input
  const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Qualification options
  const qualificationOptions = [
    "BELOW 10TH",
    "10TH PASS",
    "12TH PASS",
    "ITI - INDUSTRIAL TRAINING INSTITUTE",
    "D.ED - DIPLOMA IN EDUCATION",
    "D.PHARM - DIPLOMA IN PHARMACY",
    "GNM / ANM - DIPLOMA IN NURSING",
    "B.A - BACHELOR OF ARTS",
    "B.SC - BACHELOR OF SCIENCE",
    "B.COM - BACHELOR OF COMMERCE",
    "B.E / B.TECH - BACHELOR OF ENGINEERING / TECHNOLOGY",
    "BBA - BACHELOR OF BUSINESS ADMINISTRATION",
    "BCA - BACHELOR OF COMPUTER APPLICATIONS",
    "LLB - BACHELOR OF LAWS",
    "MBBS - BACHELOR OF MEDICINE, BACHELOR OF SURGERY",
    "BDS - BACHELOR OF DENTAL SURGERY",
    "BAMS - BACHELOR OF AYURVEDIC MEDICINE AND SURGERY",
    "BHMS - BACHELOR OF HOMEOPATHIC MEDICINE AND SURGERY",
    "B.PHARM - BACHELOR OF PHARMACY",
    "B.ARCH - BACHELOR OF ARCHITECTURE",
    "B.DES - BACHELOR OF DESIGN",
    "BHM - BACHELOR OF HOTEL MANAGEMENT",
    "B.ED - BACHELOR OF EDUCATION",
    "B.P.ED - BACHELOR OF PHYSICAL EDUCATION",
    "BFA - BACHELOR OF FINE ARTS",
    "M.A - MASTER OF ARTS",
    "M.SC - MASTER OF SCIENCE",
    "M.COM - MASTER OF COMMERCE",
    "M.E / M.TECH - MASTER OF ENGINEERING / TECHNOLOGY",
    "MBA - MASTER OF BUSINESS ADMINISTRATION",
    "PGDM - POST GRADUATE DIPLOMA IN MANAGEMENT",
    "MCA - MASTER OF COMPUTER APPLICATIONS",
    "LLM - MASTER OF LAWS",
    "MD - DOCTOR OF MEDICINE",
    "MS - MASTER OF SURGERY",
    "M.PHARM - MASTER OF PHARMACY",
    "M.ARCH - MASTER OF ARCHITECTURE",
    "M.DES - MASTER OF DESIGN",
    "M.ED - MASTER OF EDUCATION",
    "M.PHIL - MASTER OF PHILOSOPHY",
    "PHD - DOCTOR OF PHILOSOPHY",
    "CA - CHARTERED ACCOUNTANT",
    "CS - COMPANY SECRETARY",
    "CMA - COST AND MANAGEMENT ACCOUNTANT",
    "OTHER QUALIFICATION"
  ];

  // Extended formData to match HTML structure
  const [formData, setFormData] = useState({
    candidate_name: '',
    mobile_number: '',
    alternate_number: '',
    gender: '',
    qualification: '',
    job_opening: '',
    marital_status: '',
    age: '',
    city: '',
    state: '', // Add state field for backend compatibility
    experience_type: 'fresher', // Use lowercase for backend compatibility
    total_experience: '',
    old_salary: '', // Changed from last_salary to match backend
    offer_salary: '', // Added for backend compatibility
    living_arrangement: '',
    primary_earning_member: '',
    type_of_business: '',
    banking_experience: '',
    interview_type: '',
    source_portal: '',
    monthly_salary_offered: '',
    interview_date: getCurrentDateTime().split('T')[0],
    interview_time: getCurrentDateTime().split('T')[1],
    date_time: getCurrentDateTime(),
    created_by: localStorage.getItem('userName') || localStorage.getItem('user_name') || 'User'
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Duplicate check state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInterviews, setDuplicateInterviews] = useState([]);
  const [duplicatePhoneNumber, setDuplicatePhoneNumber] = useState('');
  const [pendingInterviewData, setPendingInterviewData] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);

  // Load available users for reassignment
  useEffect(() => {
    const loadAvailableUsers = async () => {
      try {
        const response = await API.users.getUsers();
        if (response.success && response.data) {
          setAvailableUsers(response.data);
        }
      } catch (error) {
        // Handle error silently or with minimal logging
      }
    };
    loadAvailableUsers();
  }, []);

  // Format status display for CreateInterviewModal dropdown
  const formatStatusDisplayForModal = (status, subStatus = null) => {
    if (subStatus) {
      return `${status} → ${subStatus}`;
    }
    return status;
  };

  // Get all status options including sub-statuses for the dropdown
  const getAllStatusOptionsForModal = () => {
    const options = [];
    
    statusOptionsWithSubs?.forEach(statusObj => {
      // Add main status
      options.push({
        value: statusObj.name || statusObj.value || statusObj,
        label: `📋 ${statusObj.name || statusObj.value || statusObj}`,
        isMainStatus: true
      });
      
      // Add sub-statuses if they exist
      if (statusObj.sub_statuses && statusObj.sub_statuses.length > 0) {
        statusObj.sub_statuses.forEach(subStatus => {
          options.push({
            value: `${statusObj.name || statusObj.value || statusObj}→${subStatus.name}`,
            label: `     ↳ ${subStatus.name}`,
            isSubStatus: true,
            parentStatus: statusObj.name || statusObj.value || statusObj,
            subStatusName: subStatus.name
          });
        });
      }
    });
    
    return options;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Special handling for job_opening
    if (name === 'job_opening') {
      // Field-specific logic can go here if needed
    }

    // Fields that should not be converted to uppercase (numeric, phone numbers, salaries, dropdowns)
    const excludeFromUppercase = [
      'mobile_number', 'alternate_number', 'total_experience', 
      'old_salary', 'monthly_salary_offered', 'experience_type', 'gender',
      'interview_type', 'status', 'qualification', 'marital_status',
      'living_arrangement', 'primary_earning_member', 'type_of_business',
      'banking_experience', 'source_portal', 'age', 'interview_date', 
      'interview_time', 'date_time', 'job_opening'
    ];

    // Convert to uppercase if it's a text field (names, addresses, etc.)
    const processedValue = excludeFromUppercase.includes(name) || typeof value !== 'string'
      ? value
      : value.toUpperCase();

    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.candidate_name?.trim()) newErrors.candidate_name = 'Candidate name is required';
    
    // Mobile number validation
    if (!formData.mobile_number?.trim()) {
      newErrors.mobile_number = 'Mobile number is required';
    } else if (formData.mobile_number.trim().length !== 10) {
      newErrors.mobile_number = 'Mobile number must be 10 digits';
    }
    
    // Alternate number validation
    if (formData.alternate_number?.trim()) {
      // Check if alternate number is same as mobile number
      if (formData.alternate_number.trim() === formData.mobile_number?.trim()) {
        newErrors.alternate_number = 'Alternate number cannot be same as mobile number';
      } else if (formData.alternate_number.trim().length !== 10) {
        newErrors.alternate_number = 'Alternate number must be 10 digits';
      }
    }
    
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.qualification) newErrors.qualification = 'Qualification is required';
    if (!formData.job_opening?.trim()) newErrors.job_opening = 'Job opening is required';
    if (!formData.interview_type) newErrors.interview_type = 'Interview type is required';
    if (!formData.date_time) newErrors.date_time = 'Date and time is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper function to get input CSS classes with error highlighting
  const getInputClasses = (fieldName, baseClasses = "w-full px-3 py-2 border rounded text-black font-bold") => {
    const hasError = errors[fieldName];
    return hasError 
      ? `${baseClasses} border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-200` 
      : `${baseClasses} border-cyan-400 focus:border-cyan-500 focus:ring-cyan-200`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if form validates
    const isValid = validateForm();
    
    if (!isValid) {
      alert('Please fill all required fields');
      return;
    }
    
    setLoading(true);
    
    try {
      // Get user data from localStorage
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const userId = userData.user_id || localStorage.getItem('userId') || '';
      const userName = userData.name || userData.username || localStorage.getItem('userName') || 'User';
      
      if (!userId) {
        alert('Please login first');
        setLoading(false);
        return;
      }

      // Create complete interview data matching backend expectations
      const interviewData = {
        // Required fields
        candidate_name: formData.candidate_name,
        mobile_number: formData.mobile_number,
        gender: formData.gender,
        job_opening: formData.job_opening,
        interview_type: formData.interview_type,
        
        // Optional contact fields
        alternate_number: formData.alternate_number || '',
        
        // Location fields - backend requires at least 1 character
        city: formData.city?.trim() || 'Not Specified',
        state: formData.state?.trim() || 'Not Specified',
        
        // Professional fields
        qualification: formData.qualification || '',
        experience_type: formData.experience_type || 'fresher',
        total_experience: formData.total_experience || '',
        
        // Salary fields - backend expects numbers, send null if empty
        old_salary: formData.old_salary?.trim() ? parseFloat(formData.old_salary) : null,
        offer_salary: formData.offer_salary?.trim() ? parseFloat(formData.offer_salary) : null,
        monthly_salary_offered: formData.monthly_salary_offered?.trim() ? parseFloat(formData.monthly_salary_offered) : null,
        
        // Personal fields
        marital_status: formData.marital_status || '',
        age: formData.age || '',
        living_arrangement: formData.living_arrangement || '',
        primary_earning_member: formData.primary_earning_member || '',
        type_of_business: formData.type_of_business || '',
        banking_experience: formData.banking_experience || '',
        
        // Interview scheduling
        interview_date: new Date(formData.date_time).toISOString().split('T')[0],
        interview_time: formData.date_time.split('T')[1] || '10:00',
        date_time: formData.date_time,
        
        // Source and status
        source_portal: formData.source_portal || '',
        status: 'new_interview',
        
        // System fields
        created_by: userName,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Remove null values for optional numeric fields to avoid backend issues
      if (interviewData.old_salary === null) delete interviewData.old_salary;
      if (interviewData.offer_salary === null) delete interviewData.offer_salary;
      if (interviewData.monthly_salary_offered === null) delete interviewData.monthly_salary_offered;
      
      // Check for duplicate phone numbers before creating interview
      const phoneNumbers = [formData.mobile_number];
      if (formData.alternate_number?.trim()) {
        phoneNumbers.push(formData.alternate_number.trim());
      }
      
      let duplicateFound = false;
      let allDuplicates = [];
      
      // Enhanced duplicate checking: check both mobile_number and alternate_number fields
      // against both the primary and alternate numbers being submitted
      for (const phoneNumber of phoneNumbers) {
        try {
          // Check if this phone number exists as mobile_number in any existing interview
          const mobileResponse = await API.interviews.checkDuplicatePhone(phoneNumber);
          if (mobileResponse.success && mobileResponse.data && mobileResponse.data.length > 0) {
            duplicateFound = true;
            allDuplicates = [...allDuplicates, ...mobileResponse.data];
          }
          
          // Also check against local existingInterviews for comprehensive duplicate checking
          // This covers cases where the API might not return all matches or for alternate numbers
          if (existingInterviews && existingInterviews.length > 0) {
            const localMatches = existingInterviews.filter(interview => {
              // Check both mobile_number and alternate_number fields
              const interviewMobile = interview.mobile_number?.trim();
              const interviewAlternate = interview.alternate_number?.trim();
              const currentPhone = phoneNumber.trim();
              
              return (interviewMobile && interviewMobile === currentPhone) ||
                     (interviewAlternate && interviewAlternate === currentPhone);
            });
            
            if (localMatches.length > 0) {
              duplicateFound = true;
              allDuplicates = [...allDuplicates, ...localMatches];
            }
          }
        } catch (error) {
          console.warn(`Failed to check duplicates for phone ${phoneNumber}:`, error);
          // Continue with creation if duplicate check fails
        }
      }
      
      if (duplicateFound && allDuplicates.length > 0) {
        // Remove duplicates from the array (same interview might be found via multiple phones)
        const uniqueDuplicates = allDuplicates.filter((interview, index, self) => 
          index === self.findIndex(i => (i._id || i.id) === (interview._id || interview.id))
        );
        
        // Store interview data for later creation and show duplicate modal
        setPendingInterviewData(interviewData);
        setDuplicateInterviews(uniqueDuplicates);
        setDuplicatePhoneNumber(phoneNumbers.join(', '));
        setShowDuplicateModal(true);
        setLoading(false);
        
        console.log('Duplicate phone numbers found:', {
          submittedNumbers: phoneNumbers,
          duplicatesFound: uniqueDuplicates.length,
          duplicateInterviews: uniqueDuplicates.map(d => ({
            id: d._id || d.id,
            name: d.candidate_name,
            mobile: d.mobile_number,
            alternate: d.alternate_number
          }))
        });
        
        return;
      }
      
      // No duplicates found, proceed with direct creation
      await createInterviewDirectly(interviewData);
      
    } catch (error) {
      alert(`Failed to create interview: ${error.message}`);
      setLoading(false);
    }
  };

  const createInterviewDirectly = async (interviewData) => {
    try {
      // Use API service instead of direct fetch to ensure proper history creation
      const newInterview = await API.interviews.createInterview(interviewData);
      
      // Show success message - using the same pattern as the main component
      alert(`Interview created successfully for ${interviewData.candidate_name}!`);
      
      onInterviewCreated(newInterview);
      onClose(); // Close modal after success
    } catch (error) {
      alert('Error creating interview: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleProceedWithDuplicate = async () => {
    if (pendingInterviewData) {
      setShowDuplicateModal(false);
      try {
        await createInterviewDirectly(pendingInterviewData);
      } catch (error) {
        alert(`Failed to create interview: ${error.message}`);
      }
      setPendingInterviewData(null);
      setDuplicateInterviews([]);
      setDuplicatePhoneNumber('');
    }
  };

  const handleCloseDuplicateModal = () => {
    setShowDuplicateModal(false);
    setPendingInterviewData(null);
    setDuplicateInterviews([]);
    setDuplicatePhoneNumber('');
    setLoading(false);
  };

  return (
    <div className="bg-transparent bg-opacity-50 fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-4xl mx-auto space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          ×
        </button>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Validation Error Summary */}
          {Object.keys(errors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <h3 className="text-red-800 font-bold">Please fix the following errors:</h3>
              </div>
              <ul className="list-disc list-inside space-y-1">
                {Object.entries(errors).map(([field, message]) => (
                  <li key={field} className="text-red-700 text-sm">
                    <span className="font-medium">{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span> {message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Header Section with Date & Time and Created By */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                name="date_time"
                value={formData.date_time}
                onChange={handleInputChange}
                className={getInputClasses('date_time')}
                required
              />
              {errors.date_time && (
                <p className="text-red-500 text-sm mt-1 font-medium">{errors.date_time}</p>
              )}
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Created By
              </label>
              <input
                type="text"
                name="created_by"
                value={formData.created_by}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                readOnly
              />
            </div>
          </div>

          {/* Candidate Details Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-cyan-600">Candidate Details</h3>
            </div>
            
            {/* Row 1: Name, Mobile, Alternate Number */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Candidate Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="candidate_name"
                  value={formData.candidate_name}
                  onChange={handleInputChange}
                  className={getInputClasses('candidate_name')}
                  placeholder="Enter candidate name"
                  required
                />
                {errors.candidate_name && (
                  <p className="text-red-500 text-sm mt-1 font-medium">{errors.candidate_name}</p>
                )}
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="mobile_number"
                  value={formData.mobile_number}
                  onChange={handleInputChange}
                  className={getInputClasses('mobile_number')}
                  placeholder="Enter mobile number"
                  required
                />
                {errors.mobile_number && (
                  <p className="text-red-500 text-sm mt-1 font-medium">{errors.mobile_number}</p>
                )}
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Alternate Number
                </label>
                <input
                  type="tel"
                  name="alternate_number"
                  value={formData.alternate_number}
                  onChange={handleInputChange}
                  className={getInputClasses('alternate_number')}
                  placeholder="Enter alternate number"
                />
                {errors.alternate_number && (
                  <p className="text-red-500 text-sm mt-1 font-medium">{errors.alternate_number}</p>
                )}
              </div>
            </div>

            {/* Row 2: Gender, Qualification, Job Applied */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  options={['Male', 'Female', 'Other']}
                  placeholder="Select Gender"
                  className={getInputClasses('gender')}
                  required
                />
                {errors.gender && (
                  <p className="text-red-500 text-sm mt-1 font-medium">{errors.gender}</p>
                )}
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Qualification <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleInputChange}
                  options={qualificationOptions}
                  placeholder="Select Qualification"
                  className={getInputClasses('qualification')}
                  required
                />
                {errors.qualification && (
                  <p className="text-red-500 text-sm mt-1 font-medium">{errors.qualification}</p>
                )}
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Job Applied <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  name="job_opening"
                  value={formData.job_opening}
                  onChange={handleInputChange}
                  options={jobOpeningOptions}
                  placeholder="Select Job Applied"
                  className={getInputClasses('job_opening')}
                  required
                />
                {errors.job_opening && (
                  <p className="text-red-500 text-sm mt-1 font-medium">{errors.job_opening}</p>
                )}
              </div>
            </div>

            {/* Row 3: Marital Status, Age, City */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Marital Status
                </label>
                <SearchableSelect
                  name="marital_status"
                  value={formData.marital_status}
                  onChange={handleInputChange}
                  options={['Single', 'Married', 'Divorced', 'Widowed']}
                  placeholder="Select status"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                  placeholder="Enter age"
                  min="18"
                  max="65"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                  placeholder="Enter city"
                />
              </div>
            </div>

            {/* Row 4: Experience Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Experience Type
                </label>
                <SearchableSelect
                  name="experience_type"
                  value={formData.experience_type}
                  onChange={handleInputChange}
                  options={['fresher', 'experienced']}
                  placeholder="Select Experience Type"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                />
              </div>
            </div>
          </div>

          {/* Family & Living Situation Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-cyan-600">Family & Living Situation</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Living Arrangement
                </label>
                <SearchableSelect
                  name="living_arrangement"
                  value={formData.living_arrangement}
                  onChange={handleInputChange}
                  options={['With Family', 'PG/Hostel', 'Rented Alone', 'Shared Apartment', 'Own House']}
                  placeholder="Select living arrangement"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Primary Earning Member
                </label>
                <SearchableSelect
                  name="primary_earning_member"
                  value={formData.primary_earning_member}
                  onChange={handleInputChange}
                  options={['Father', 'Mother', 'Both Parents', 'Self', 'Spouse', 'Sibling', 'Other']}
                  placeholder="Select primary earner"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Type of Business/Work
                </label>
                <SearchableSelect
                  name="type_of_business"
                  value={formData.type_of_business}
                  onChange={handleInputChange}
                  options={['Salaried Job', 'Government Job', 'Private Business', 'Shop/Retail Business', 'Manufacturing Business', 'Service Business', 'Farming/Agriculture', 'Professional Practice', 'Other']}
                  placeholder="Select work type"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Banking/Finance Experience
                </label>
                <SearchableSelect
                  name="banking_experience"
                  value={formData.banking_experience}
                  onChange={handleInputChange}
                  options={['No Experience', 'Loan Sales', 'Credit Card Sales', 'Collection/Recovery', 'Bank Operations', 'Insurance Sales', 'Investment/Mutual Funds', 'Other Finance']}
                  placeholder="Select experience"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                />
              </div>
            </div>
          </div>

          {/* Interview Details Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-cyan-600">Interview Details</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Interview Type <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  name="interview_type"
                  value={formData.interview_type}
                  onChange={handleInputChange}
                  options={interviewTypeOptions}
                  placeholder="Select Interview Type"
                  className={getInputClasses('interview_type')}
                  required
                />
                {errors.interview_type && (
                  <p className="text-red-500 text-sm mt-1 font-medium">{errors.interview_type}</p>
                )}
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Source/Portal
                </label>
                <SearchableSelect
                  name="source_portal"
                  value={formData.source_portal}
                  onChange={handleInputChange}
                  options={sourcePortalOptions}
                  placeholder="Select Source/Portal"
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Monthly Salary Offered
                </label>
                <input
                  type="number"
                  name="monthly_salary_offered"
                  value={formData.monthly_salary_offered}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                  placeholder="Enter monthly salary"
                  step="0.1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Interview Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="interview_date"
                  value={formData.interview_date}
                  onChange={handleInputChange}
                  className={getInputClasses('date_time')}
                  required
                />
                {errors.date_time && (
                  <p className="text-red-500 text-sm mt-1 font-medium">{errors.date_time}</p>
                )}
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Interview Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="interview_time"
                  value={formData.interview_time}
                  onChange={handleInputChange}
                  className={getInputClasses('date_time')}
                  required
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-500 text-white font-bold rounded shadow-md hover:bg-gray-600 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 px-6 py-3 bg-cyan-500 text-white font-bold rounded shadow-md transition-colors duration-200",
                loading 
                  ? "opacity-50 cursor-not-allowed bg-cyan-400" 
                  : "hover:bg-cyan-600"
              )}
            >
              {loading ? 'Creating Interview...' : 'Create Interview'}
            </button>
          </div>
        </form>
      </div>

      {/* Duplicate Interview Modal */}
      <DuplicateInterviewModal
        visible={showDuplicateModal}
        onClose={handleCloseDuplicateModal}
        duplicateInterviews={duplicateInterviews}
        phoneNumber={duplicatePhoneNumber}
        onProceed={handleProceedWithDuplicate}
        onCloseCreateModal={onClose}
      />
    </div>
  );
};

export default InterviewPanel;
