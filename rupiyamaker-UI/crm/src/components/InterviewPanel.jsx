
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useTabWithHistory from '../hooks/useTabWithHistory';
import useModalHistory from '../hooks/useModalHistory';
import { ChevronLeft, ChevronRight, ChevronDown, X, MoreVertical, Calendar, History, RefreshCw, ArrowRightLeft, CheckCircle, Plus, Search, Settings, Briefcase, User, FileText, XCircle, PhoneOff, PlayCircle, Info, Circle, ShieldAlert, TrendingUp, Bell, BarChart3, Users, Lock, Upload, Download, Trash2, Filter } from 'lucide-react';
import { cn } from "../lib/utils.js";
import EditInterview from './EditInterview';
import DuplicateInterviewModal from './DuplicateInterviewModal';
import API, { interviewSettingsAPI } from '../services/api';
import { formatDate as formatDateUtil, formatDateTime, calculateAge, toISTDateYMD, getISTDateYMD, getCurrentISTDate, getISTToday } from '../utils/dateUtils';
import { hasPermission, getUserPermissions, isSuperAdmin as utilIsSuperAdmin } from '../utils/permissions';
import { fetchFreshPermissions } from '../utils/immediatePermissionRefresh';
import InterviewSettings from './InterviewSettings';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// Tab configuration - Pipeline stages matching interview module.html
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'interview', label: 'Interview', count: 0 },
  { id: 'job_offered', label: 'Job Offered', count: 0 },
  { id: 'training', label: 'Training', count: 0 },
  { id: 'hired', label: 'Hired', count: 0 },
  { id: 'rejected', label: 'Rejected', count: 0 },
  { id: 'audit_logs', label: 'Audit Logs', icon: '📋' }
];

const INTERVIEW_SUB_TABS = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'no_show', label: 'No-Show' },
  { id: 'round2', label: 'Round 2 Qualified' }
];

// Map backend status to pipeline stage
const getStageFromStatus = (status) => {
  if (!status) return 'Interview';
  const s = status.toLowerCase().replace(/[:\s]/g, '_');
  if (s.includes('hired') || s.includes('confirmed_hired') || s.includes('final_select')) return 'Hired';
  if (s.includes('reject') || s.includes('denied') || s.includes('declined') || s.includes('cancelled') || s.includes('not_interested') || s.includes('not_relevant')) return 'Rejected';
  if (s.includes('training') || s.includes('onboard')) return 'Training';
  if (s.includes('offer') || s.includes('job_offered')) return 'Job Offered';
  if (s.includes('round_2') || s.includes('round2') || s.includes('second_round')) return 'Round 2';
  if (s.includes('no_show') || s.includes('noshow') || s.includes('no-show')) return 'No-Show';
  return 'Interview';
};

// Get forward button config for a given stage
const getForwardButton = (stage) => {
  switch (stage) {
    case 'Interview': return { text: 'Move to Round 2', targetStage: 'Round 2' };
    case 'Round 2': return { text: 'Offer Job', targetStage: 'Job Offered' };
    case 'Job Offered': return { text: 'Start Training', targetStage: 'Training' };
    case 'Training': return { text: 'Hire Candidate', targetStage: 'Hired' };
    default: return null;
  }
};

// Map pipeline stage to a backend status string
const getStatusForStage = (stage) => {
  switch (stage) {
    case 'Interview': return 'interview';
    case 'Round 2': return 'round_2';
    case 'Job Offered': return 'job_offered';
    case 'Training': return 'training';
    case 'Hired': return 'hired';
    case 'Rejected': return 'rejected';
    case 'No-Show': return 'no_show';
    default: return stage.toLowerCase().replace(/\s/g, '_');
  }
};

// Parse date strings like "16 Feb 2026" or ISO dates
const parseFormattedDate = (str) => {
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d)) return d;
  const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
  const parts = str.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (parts) return new Date(+parts[3], months[parts[2]] || 0, +parts[1]);
  return null;
};

const getISTDateKey = (value) => toISTDateYMD(value);

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

    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    @keyframes scaleIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;

  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [filteredInterviews, setFilteredInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useTabWithHistory('stage', 'interview', { localStorageKey: 'interviewPanelTab' });
  const [activeSubTab, setActiveSubTab] = useTabWithHistory('sub', 'today', { localStorageKey: 'interviewPanelSubTab' });
  const [searchTerm, setSearchTerm] = useState('');
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusCounts, setStatusCounts] = useState([]);
  const [tabCounts, setTabCounts] = useState(TABS);
  const [selectedInterview, setSelectedInterview] = useState(null);

  // Browser back button closes interview edit modal
  useModalHistory(!!selectedInterview, () => setSelectedInterview(null));

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

  // Pipeline action modals state
  const [isForwardRemarkOpen, setIsForwardRemarkOpen] = useState(false);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyModalTab, setHistoryModalTab] = useState('full');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRound1ModalOpen, setIsRound1ModalOpen] = useState(false);
  const [auditSubTab, setAuditSubTab] = useState('Pending');
  const [reasonFilter, setReasonFilter] = useState('All');

  // Company settings for WhatsApp messages
  const [companySettings, setCompanySettings] = useState({
    companyName: '', jobDescription: '', officeTiming: '', workingDays: '',
    interviewTiming: '', officeAddress: '', officeNearby: '',
    hrName: '', hrMobile: '', hrDesignation: '', interviewFormBaseUrl: ''
  });
  // HR Head fetched from employees (for WhatsApp messages)
  const [hrHead, setHrHead] = useState({ name: '', phone: '', designation: 'HR Head' });

  // Decline reason options
  const [declineReasons, setDeclineReasons] = useState([
    'Not Qualified', 'No Show', 'Salary Mismatch', 'Location Issue',
    'Poor Communication', 'Overqualified', 'Underqualified', 'Position Filled',
    'Candidate Withdrew', 'Failed Assessment', 'Background Check Failed', 'Other'
  ]);

  // Pipeline cooldown days
  const [cooldownDays, setCooldownDays] = useState(7);

  // Filter popup state
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('status');
  const [filterOptions, setFilterOptions] = useState({
    status: [],
    dateFrom: '',
    dateTo: '',
    hrManagerAdmin: '',
    interviewType: [],
    jobOpening: [],
    sourcePortal: []
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
  // Initialize as empty object, will be populated in useEffect
  const [permissions, setPermissions] = useState({});

  // Check user permissions for interviews (like Tickets/Warnings)
  const checkInterviewPermissions = () => {
    const userPermissions = getUserPermissions();
    
    console.log('🔍 checkInterviewPermissions - userPermissions:', userPermissions);
    
    // Use the utility-based super admin check (permission-based, NOT string matching)
    const isAdmin = utilIsSuperAdmin(userPermissions);
    console.log('🔍 checkInterviewPermissions - isAdmin:', isAdmin);
    
    // If super admin, grant all permissions
    if (isAdmin) {
      console.log('✅ Super Admin detected - granting all permissions');
      return {
        can_view_all: true,
        can_view_team: true,
        can_delete: true,
        can_add: true,
        can_edit: true,
        can_settings: true
      };
    }
    
    // Use hasPermission utility which handles both array and object formats
    const hasShowPerm = hasPermission(userPermissions, 'interview', 'show');
    const hasDeletePerm = hasPermission(userPermissions, 'interview', 'delete');
    const hasAllPerm = hasPermission(userPermissions, 'interview', 'view_all');
    const hasTeamPerm = hasPermission(userPermissions, 'interview', 'view_team');
    const hasSettingsPerm = hasPermission(userPermissions, 'interview', 'interview_setting');

    const calculatedPermissions = {
      can_view_all: hasAllPerm,
      can_view_team: hasTeamPerm,
      can_delete: hasDeletePerm,
      can_add: hasShowPerm || hasAllPerm || hasTeamPerm,
      can_edit: hasShowPerm || hasAllPerm || hasTeamPerm,
      can_settings: hasSettingsPerm
    };

    console.log('📋 Calculated Permissions:', calculatedPermissions);
    return calculatedPermissions;
  };

  // Check if user is super admin (can see and do everything)
  const isSuperAdmin = () => {
    const designation = localStorage.getItem('designation')?.toLowerCase();
    const roleName = localStorage.getItem('roleName')?.toLowerCase();
    const userRole = localStorage.getItem('userRole')?.toLowerCase();
    const role = localStorage.getItem('role')?.toLowerCase();
    
    // Check if user has admin designation or role
    if (
      designation === 'admin' || 
      designation === 'super admin' || 
      designation === 'superadmin' ||
      designation === 'administrator' ||
      roleName === 'admin' ||
      roleName === 'super admin' ||
      roleName === 'superadmin' ||
      roleName === 'administrator' ||
      userRole === 'admin' ||
      userRole === 'super admin' ||
      userRole === 'superadmin' ||
      role === 'admin' ||
      role === 'super admin' ||
      role === 'superadmin'
    ) {
      return true;
    }
    
    // Use utility isSuperAdmin which handles both array and object formats
    const userPermissions = getUserPermissions();
    return utilIsSuperAdmin(userPermissions);
  };

  // Load job opening and interview type options from backend
  useEffect(() => {
    loadDropdownOptions();
    loadGlobalSettingsFromDB(); // HR info (hr_name, hr_mobile, hr_designation) comes from global settings
    // Fetch HR Head from employees for WhatsApp messages
    interviewSettingsAPI.getHrHead().then(res => {
      if (res?.success && res?.data?.name) {
        setHrHead(res.data);
      }
    }).catch(() => {});
  }, []);

  // Tab persistence is now handled by useTabWithHistory hook

  // Load permissions on mount — always fetch fresh from backend to avoid stale localStorage
  useEffect(() => {
    const loadPermissions = async () => {
      // First set from localStorage (instant)
      const cached = checkInterviewPermissions();
      setPermissions(cached);

      // Then fetch fresh from backend and override
      try {
        const userId = localStorage.getItem('userId') || localStorage.getItem('user_id');
        if (userId) {
          const fresh = await fetchFreshPermissions(userId);
          if (fresh) {
            localStorage.setItem('userPermissions', JSON.stringify(fresh));
            const updated = checkInterviewPermissions();
            setPermissions(updated);
          }
        }
      } catch (e) {
        // If fetch fails, keep using cached
        console.warn('Could not refresh permissions from backend:', e);
      }
    };
    loadPermissions();
  }, []);

  // Listen for permission changes (like Tickets/Warnings)
  useEffect(() => {
    const handlePermissionUpdate = () => {
      console.log('🔄 Interviews - Permissions updated, reloading...');
      const userPermissions = checkInterviewPermissions();
      console.log('📋 Reloaded Permissions:', userPermissions);
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
    
    // Check for specific interview settings permission (supports both old 'settings' and new 'interview_setting' action names)
    const hasSpecificPermission = hasPermission(userPermissions, 'interview', 'settings') || hasPermission(userPermissions, 'interview', 'interview_setting');
    
    // Check for superadmin permission (page "*" and actions "*")
    const hasSuperAdminPermission = hasPermission(userPermissions, '*', '*');
    
    return hasSpecificPermission || hasSuperAdminPermission;
  };

  // Load global settings (company info, cooldown, decline reasons) from DB
  const loadGlobalSettingsFromDB = async () => {
    try {
      const res = await interviewSettingsAPI.getGlobalSettings();
      if (res?.success && res?.data) {
        const d = res.data;
        setCompanySettings({
          companyName: d.company_name || '',
          jobDescription: d.job_description || '',
          officeTiming: d.office_timing || '',
          workingDays: d.working_days || '',
          interviewTiming: d.interview_timing || '',
          officeAddress: d.office_address || '',
          officeNearby: d.office_nearby || '',
          hrName: d.hr_name || '',
          hrMobile: d.hr_mobile || '',
          hrDesignation: d.hr_designation || '',
          interviewFormBaseUrl: d.interview_form_base_url || '',
        });
        if (d.cooldown_days !== undefined) setCooldownDays(d.cooldown_days);
        if (d.decline_reasons?.length) setDeclineReasons(d.decline_reasons);
      }
    } catch (e) {
      console.warn('Could not load global settings from DB:', e);
    }
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
          setJobOpeningOptions([]);
        }
      } catch (error) {
        console.error('Error loading job openings from API:', error);
        setJobOpeningOptions([]);
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
          setSourcePortalOptions([]);
        }
      } catch (error) {
        setSourcePortalOptions([]);
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
    if (filterOptions.sourcePortal && Array.isArray(filterOptions.sourcePortal) && filterOptions.sourcePortal.length > 0) count++;
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
  // Skip refresh if create modal is open to prevent form from resetting on tab switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !showCreateModal && !isSettingsOpen) {
        console.log('🔄 Page became visible, refreshing interviews...');
        loadInterviews();
      }
    };

    const handleFocus = () => {
      if (!showCreateModal && !isSettingsOpen) {
        console.log('🔄 Window focused, refreshing interviews...');
        loadInterviews();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadInterviews, showCreateModal, isSettingsOpen]);

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
    
    // Count by pipeline stages
    const stageCounts = {};
    interviewsToCount.forEach(interview => {
      const stage = getStageFromStatus(interview.status);
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });
    
    // Status counts for legacy compatibility
    const newStatusCounts = Object.entries(stageCounts).map(([stage, count]) => ({
      label: stage,
      count,
      color: stage === 'Hired' ? 'bg-green-500' : stage === 'Rejected' ? 'bg-red-500' : stage === 'Interview' ? 'bg-blue-500' : stage === 'Round 2' ? 'bg-indigo-500' : stage === 'Job Offered' ? 'bg-orange-500' : stage === 'Training' ? 'bg-yellow-500' : 'bg-gray-500'
    }));
    setStatusCounts(newStatusCounts);

    // Update tab counts using pipeline stages
    const newTabCounts = TABS.map(tab => {
      let count = 0;
      if (tab.id === 'dashboard') {
        count = interviewsToCount.length;
      } else if (tab.id === 'interview') {
        // Interview tab includes: Interview + Round 2 + No-Show
        count = (stageCounts['Interview'] || 0) + (stageCounts['Round 2'] || 0) + (stageCounts['No-Show'] || 0);
      } else if (tab.id === 'job_offered') {
        count = stageCounts['Job Offered'] || 0;
      } else if (tab.id === 'training') {
        count = stageCounts['Training'] || 0;
      } else if (tab.id === 'hired') {
        count = stageCounts['Hired'] || 0;
      } else if (tab.id === 'rejected') {
        count = stageCounts['Rejected'] || 0;
      } else if (tab.id === 'audit_logs') {
        count = interviewsToCount.filter(i => (i.reassign_count || 0) > 0 || !!i.is_audited).length;
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
    const todayIST = getISTDateYMD();

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

    // Filter by active pipeline tab
    console.log('🔍 Tab Filter Debug: Applying pipeline tab filter for', activeTab, 'sub:', activeSubTab);
    
    if (activeTab === 'dashboard') {
      // Dashboard shows all — no filtering
      console.log('🔍 Dashboard tab: No filtering applied');
    } else if (activeTab === 'interview') {
      // Interview tab: filter by sub-tab (today / upcoming / no_show / round2)
      filtered = filtered.filter(interview => {
        const stage = getStageFromStatus(interview.status);
        const interviewDateKey = getISTDateKey(interview.interview_date);
        if (!interviewDateKey && activeSubTab !== 'round2') {
          return false;
        }
        if (activeSubTab === 'today') {
          // Only show interviews scheduled for exactly TODAY in IST
          return interviewDateKey === todayIST && stage === 'Interview';
        } else if (activeSubTab === 'upcoming') {
          return interviewDateKey > todayIST && stage === 'Interview';
        } else if (activeSubTab === 'no_show') {
          // Past-dated interviews still in Interview stage (didn't show up) + explicitly marked No-Show, all by IST date
          return stage === 'No-Show' || (stage === 'Interview' && interviewDateKey < todayIST);
        } else if (activeSubTab === 'round2') {
          return stage === 'Round 2';
        }
        return stage === 'Interview' || stage === 'Round 2' || stage === 'No-Show';
      });
    } else if (activeTab === 'job_offered') {
      filtered = filtered.filter(i => getStageFromStatus(i.status) === 'Job Offered');
    } else if (activeTab === 'training') {
      filtered = filtered.filter(i => getStageFromStatus(i.status) === 'Training');
    } else if (activeTab === 'hired') {
      filtered = filtered.filter(i => getStageFromStatus(i.status) === 'Hired');
    } else if (activeTab === 'rejected') {
      filtered = filtered.filter(i => getStageFromStatus(i.status) === 'Rejected');
      // Apply rejection reason filter
      if (reasonFilter && reasonFilter !== 'All') {
        filtered = filtered.filter(i => i.decline_reason === reasonFilter || i.sub_status === reasonFilter);
      }
    } else if (activeTab === 'audit_logs') {
      // Audit logs: only show interviews with actual reassignment/audit activity
      filtered = filtered.filter(i => (i.reassign_count || 0) > 0 || !!i.is_audited);
      if (auditSubTab === 'Pending') {
        filtered = filtered.filter(i => !i.is_audited);
      } else if (auditSubTab === 'Audited') {
        filtered = filtered.filter(i => !!i.is_audited);
      }
    }
    
    // Global search mode: if isGlobalSearch, override tab filtering — show all matching search
    if (isGlobalSearch && searchTerm) {
      filtered = [...interviews]; // reset to all, search filter below will apply
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
        const interviewDate = getISTDateKey(interview.interview_date);
        const fromDate = filterOptions.dateFrom || null;
        const toDate = filterOptions.dateTo || null;
        if (!interviewDate) return false;
        
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

    // Filter by source portal
    if (filterOptions.sourcePortal && Array.isArray(filterOptions.sourcePortal) && filterOptions.sourcePortal.length > 0) {
      filtered = filtered.filter(interview =>
        filterOptions.sourcePortal.some(portal =>
          interview.source_portal?.toLowerCase() === portal.toLowerCase()
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
  }, [interviews, activeTab, activeSubTab, auditSubTab, reasonFilter, isGlobalSearch, searchTerm, filterOptions, getStatusType, filterRefreshTrigger, statusOptionsWithSubs]);

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
      
      // Switch to 'interview' tab and pick the correct sub-tab based on the new interview's date
      setActiveTab('interview');
      if (newInterview?.interview_date) {
        const interviewDateKey = getISTDateKey(newInterview.interview_date);
        const todayKey = getISTDateYMD();
        setActiveSubTab(interviewDateKey && interviewDateKey > todayKey ? 'upcoming' : 'today');
      } else {
        setActiveSubTab('today');
      }
      
      // Clear any search filters that might hide the new interview
      setSearchTerm('');
      
      // Reset filter options to show all interviews
      setFilterOptions({
        status: [],
        dateFrom: '',
        dateTo: '',
        hrManagerAdmin: '',
        interviewType: [],
        jobOpening: [],
        sourcePortal: []
      });
      
      // Ensure the newly created interview is always visible even if API reload was slow
      if (newInterview) {
        setInterviews(prev => {
          const newId = newInterview._id || newInterview.id;
          const alreadyExists = prev.some(i => (i._id || i.id) === newId);
          return alreadyExists ? prev : [newInterview, ...prev];
        });
      }
      
      console.log("✅ Interview creation completed and view reset to show all interviews");
      
    } catch (error) {
      console.error("❌ Error in handleInterviewCreated:", error);
      // If reloading fails, still add the interview locally so it's immediately visible
      if (newInterview) {
        setInterviews(prev => {
          const updated = [newInterview, ...prev];
          console.log("Fallback: Updated interviews list after creation:", updated);
          return updated;
        });
      }
      setActiveTab('interview');
      if (newInterview?.interview_date) {
        const interviewDateKey = getISTDateKey(newInterview.interview_date);
        const todayKey = getISTDateYMD();
        setActiveSubTab(interviewDateKey && interviewDateKey > todayKey ? 'upcoming' : 'today');
      } else {
        setActiveSubTab('today');
      }
    }
  };

  // Handle row click to show EditInterview
  const handleRowClick = async (interview) => {
    try {
      if (!interview) throw new Error('No interview data provided');
      setSelectedCandidate(interview);
      setIsDetailModalOpen(true);
    } catch (error) {
      alert('Failed to open interview details: ' + error.message);
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

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Delete all interviews in parallel
      const results = await Promise.all(
        selectedInterviews.map(async (interviewId) => {
          try {
            const response = await fetch(`${API_BASE_URL}/interviews/${interviewId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });
            return { ok: response.ok, id: interviewId, status: response.statusText };
          } catch (error) {
            return { ok: false, id: interviewId, status: error.message };
          }
        })
      );
      results.forEach(r => {
        if (r.ok) successCount++;
        else { errorCount++; errors.push(`Interview ${r.id}: ${r.status}`); }
      });

      // Show result message
      if (successCount > 0 && errorCount === 0) {
        toast.success(`Successfully deleted ${successCount} interview(s)`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`Deleted ${successCount} interview(s), but ${errorCount} failed. Check console for details.`);
        console.error('Delete errors:', errors);
      } else if (errorCount > 0) {
        toast.error('Failed to delete interviews. Check console for details.');
        console.error('Delete errors:', errors);
      }
      
      // Reset selection
      setSelectedInterviews([]);
      setSelectAll(false);
      setCheckboxVisible(false);
      
      // Reload interviews
      await loadInterviews();
    } catch (error) {
      toast.error('Failed to delete interviews');
      console.error('Bulk delete error:', error);
      setSelectedInterviews([]);
      setSelectAll(false);
      setCheckboxVisible(false);
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

  // === PIPELINE STAGE HANDLERS (matching interview module.html) ===

  // Forward action - opens remark modal
  const handleForwardAction = (interview, targetStage) => {
    const stage = getStageFromStatus(interview.status);
    setForwardTarget({
      candidateId: interview._id,
      currentStage: stage,
      targetStage: targetStage,
      interview: interview
    });
    setIsForwardRemarkOpen(true);
  };

  // Forward with remark confirmed
  const handleForwardWithRemark = async (candidateId, currentStage, remark) => {
    try {
      const targetStage = forwardTarget?.targetStage;
      if (!targetStage) return;
      const newStatus = getStatusForStage(targetStage);
      await API.interviews.updateInterview(candidateId, { 
        status: newStatus,
        status_remark: remark,
        forward_remark: remark,
        previous_stage: currentStage 
      });
      setIsForwardRemarkOpen(false);
      setForwardTarget(null);
      await loadInterviews();
    } catch (error) {
      alert('Failed to forward candidate: ' + (error.message || error));
    }
  };

  // Direct job offer (skip Round 2)
  const handleForwardToJobOffer = async (candidateId, currentStage, remark) => {
    try {
      await API.interviews.updateInterview(candidateId, { 
        status: 'job_offered',
        status_remark: remark,
        forward_remark: remark,
        previous_stage: currentStage 
      });
      setIsForwardRemarkOpen(false);
      setForwardTarget(null);
      await loadInterviews();
    } catch (error) {
      alert('Failed to offer job: ' + (error.message || error));
    }
  };

  // Decline/Reject
  const handleDeclineSubmit = async (candidateId, reason, remarks) => {
    try {
      await API.interviews.updateInterview(candidateId, { 
        status: 'rejected',
        status_remark: remarks,
        decline_reason: reason,
        decline_remarks: remarks 
      });
      setIsDeclineModalOpen(false);
      setSelectedCandidate(null);
      await loadInterviews();
    } catch (error) {
      alert('Failed to decline candidate: ' + (error.message || error));
    }
  };

  // Reschedule
  const handleRescheduleSubmit = async (candidateId, newDate, reason) => {
    try {
      await API.interviews.updateInterview(candidateId, { 
        interview_date: newDate,
        reschedule_reason: reason,
        status_remark: reason,
        status: selectedCandidate?.status || 'rescheduled'
      });
      setIsRescheduleOpen(false);
      setSelectedCandidate(null);
      await loadInterviews();
    } catch (error) {
      alert('Failed to reschedule: ' + (error.message || error));
    }
  };

  // Mark No-Show
  const handleMarkNoShow = async (interview) => {
    if (!window.confirm(`Mark ${interview.candidate_name} as No-Show?`)) return;
    try {
      const noShowRemark = prompt('Add status remark for No-Show (optional):') || '';
      await API.interviews.updateInterview(interview._id, { status: 'no_show', status_remark: noShowRemark.trim() });
      await loadInterviews();
    } catch (error) {
      alert('Failed to mark no-show: ' + (error.message || error));
    }
  };

  // WhatsApp handler
  const handleWhatsApp = (interview) => {
    const hrName = hrHead.name || companySettings.hrName || '';
    const hrPhone = hrHead.phone || companySettings.hrMobile || '';
    const hrDesig = hrHead.designation || companySettings.hrDesignation || 'HR';
    const msg = encodeURIComponent(
      `*INTERVIEW INVITATION*\n\nHi *${interview.candidate_name || ''}*,\n\nYour interview has been scheduled with our company.\n\n*Company Name:* ${companySettings.companyName}\n*Position:* ${interview.job_opening || ''}\n\n*Job Description:*\n${companySettings.jobDescription}\n\n*Office Timing:* ${companySettings.officeTiming}\n*Working Days:* ${companySettings.workingDays}\n\n*INTERVIEW DETAILS*\n\n*Interview Date:* ${interview.interview_date ? new Date(interview.interview_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : ''}\n*Interview Timing:* ${companySettings.interviewTiming}\n*Please do not be late. Be on time.*\n\n*Office Address:*\n${companySettings.officeAddress}\nNearby: ${companySettings.officeNearby}\n\nFor any query:\n*${hrName}*\nMobile: ${hrPhone}\n${hrDesig}`
    );
    const phone = (interview.mobile_number || '').replace(/\D/g, '');
    const url = `https://wa.me/91${phone}?text=${msg}`;
    window.open(url, '_blank');
    // Mark as sent
    API.interviews.updateInterview(interview._id, { wa_sent: true }).catch(() => {});
  };

  const handleToggleAudit = async (interview) => {
    try {
      const newAuditState = !interview.is_audited;
      await API.interviews.updateInterview(interview._id, { is_audited: newAuditState });
      // Update local state
      setInterviews(prev => prev.map(i => i._id === interview._id ? { ...i, is_audited: newAuditState } : i));
    } catch (err) {
      console.error('Failed to toggle audit status:', err);
    }
  };

  if (loading && !isDetailModalOpen && !isHistoryModalOpen && !isSettingsOpen) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 min-h-screen">
        <div className="text-lg text-slate-600">Loading interviews...</div>
      </div>
    );
  }

  return (
    <>
      <style>{stickyHeaderStyles}</style>
      <div className="bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* LEFT: Search bar (hidden on Dashboard) */}
          <div className="flex items-center gap-3">
            {activeTab !== 'dashboard' && (
            <div className="relative w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Search by name, mobile, owner, role..."
                value={searchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchTerm(val);
                  // If searching by phone number (digits only, 3+ chars), find the candidate and switch to their tab
                  if (val.length >= 3 && /^\d+$/.test(val)) {
                    const match = interviews.find(i => i.mobile_number?.includes(val));
                    if (match) {
                      const matchStage = getStageFromStatus(match.status);
                      const stageToTab = { 'Interview': 'interview', 'Round 2': 'interview', 'No-Show': 'interview', 'Job Offered': 'job_offered', 'Training': 'training', 'Hired': 'hired', 'Rejected': 'rejected' };
                      const targetTab = stageToTab[matchStage] || 'interview';
                      if (targetTab !== activeTab) {
                        setActiveTab(targetTab);
                        if (targetTab === 'interview') {
                          if (matchStage === 'No-Show') setActiveSubTab('no_show');
                          else if (matchStage === 'Round 2') setActiveSubTab('round2');
                          else setActiveSubTab('today');
                        }
                      }
                      setIsGlobalSearch(false);
                    } else {
                      setIsGlobalSearch(true);
                    }
                  } else {
                    setIsGlobalSearch(val.length > 0);
                  }
                }}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(''); setIsGlobalSearch(false); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
            )}
            {activeTab === 'rejected' && (
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All Rejection Reasons</option>
                {declineReasons.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}

            {/* Filter Button */}
            {activeTab !== 'dashboard' && (
              <div className="relative">
                <button
                  onClick={() => setShowFilterPopup(prev => !prev)}
                  className={`px-3 py-2 border rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    (filterOptions.sourcePortal?.length > 0 || filterOptions.jobOpening?.length > 0)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Filter size={14} />
                  Filter
                  {((filterOptions.sourcePortal?.length || 0) + (filterOptions.jobOpening?.length || 0)) > 0 && (
                    <span className="bg-white text-blue-600 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                      {(filterOptions.sourcePortal?.length || 0) + (filterOptions.jobOpening?.length || 0)}
                    </span>
                  )}
                </button>

                {showFilterPopup && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Filters</span>
                      <button
                        onClick={() => setFilterOptions(prev => ({ ...prev, sourcePortal: [], jobOpening: [] }))}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
                      {/* Source Portal */}
                      <div>
                        <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">Source Portal</div>
                        {sourcePortalOptions.length === 0 ? (
                          <div className="text-xs text-slate-400 italic">No sources configured in settings.</div>
                        ) : (
                          <div className="space-y-1.5">
                            {sourcePortalOptions.map(portal => (
                              <label key={portal} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filterOptions.sourcePortal?.includes(portal) || false}
                                  onChange={() => setFilterOptions(prev => {
                                    const list = prev.sourcePortal || [];
                                    return { ...prev, sourcePortal: list.includes(portal) ? list.filter(p => p !== portal) : [...list, portal] };
                                  })}
                                  className="w-3.5 h-3.5 rounded border-slate-300 accent-blue-600"
                                />
                                <span className="text-xs text-slate-700 group-hover:text-blue-700">{portal}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Role / Job Opening */}
                      <div>
                        <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">Role</div>
                        {jobOpeningOptions.length === 0 ? (
                          <div className="text-xs text-slate-400 italic">No roles configured in settings.</div>
                        ) : (
                          <div className="space-y-1.5">
                            {jobOpeningOptions.map(role => (
                              <label key={role} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={filterOptions.jobOpening?.includes(role) || false}
                                  onChange={() => setFilterOptions(prev => {
                                    const list = prev.jobOpening || [];
                                    return { ...prev, jobOpening: list.includes(role) ? list.filter(r => r !== role) : [...list, role] };
                                  })}
                                  className="w-3.5 h-3.5 rounded border-slate-300 accent-blue-600"
                                />
                                <span className="text-xs text-slate-700 group-hover:text-blue-700">{role}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
                      <button
                        onClick={() => setShowFilterPopup(false)}
                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* SELECT / BULK DELETE controls */}
          {activeTab !== 'dashboard' && (
            <div className="flex items-center gap-2">
              {permissions.can_delete && !checkboxVisible && (
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-blue-500 transition text-sm"
                  onClick={handleShowCheckboxes}
                >
                  Select
                </button>
              )}
              {permissions.can_delete && checkboxVisible && (
                <div className="flex items-center gap-3 bg-slate-100 rounded-lg px-3 py-2">
                  <label className="flex items-center cursor-pointer text-blue-600 font-bold text-sm">
                    <input
                      type="checkbox"
                      className="accent-blue-500 mr-1.5 cursor-pointer"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      style={{ width: 16, height: 16 }}
                    />
                    Select All
                  </label>
                  <span className="text-slate-700 font-semibold text-sm">{selectedInterviews.length} selected</span>
                  <button
                    className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition text-sm disabled:opacity-50"
                    onClick={handleBulkDelete}
                    disabled={selectedInterviews.length === 0}
                  >
                    Delete ({selectedInterviews.length})
                  </button>
                  <button
                    className="px-3 py-1 bg-slate-500 text-white rounded font-bold hover:bg-slate-600 transition text-sm"
                    onClick={handleCancelSelection}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* RIGHT: Action buttons */}
          <div className="flex items-center gap-2">
            {permissions.can_settings && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Settings size={14} /> <span className="hidden sm:inline">Settings</span>
              </button>
            )}
            {permissions.can_add && (
            <button
              onClick={handleCreateInterview}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-lg shadow-blue-900/20"
            >
              <Plus size={14} /> Create Interview
            </button>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Tabs - Horizontal scroll */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex items-center gap-1 overflow-x-auto py-0 -mb-px" style={{ scrollbarWidth: 'none' }}>
          {TABS.map((tab) => {
            const tabCount = tabCounts.find(t => t.id === tab.id)?.count;
            const isActive = activeTab === tab.id;
            const tabColors = {
              dashboard: 'border-slate-500 text-slate-700',
              interview: 'border-blue-500 text-blue-700',
              job_offered: 'border-orange-500 text-orange-700',
              training: 'border-yellow-500 text-yellow-700',
              hired: 'border-emerald-500 text-emerald-700',
              rejected: 'border-red-500 text-red-700',
              audit_logs: 'border-indigo-500 text-indigo-700'
            };
            const activeColor = tabColors[tab.id] || 'border-blue-500 text-blue-700';
            return (
              <button
                key={tab.id}
                onClick={() => { 
                  setActiveTab(tab.id);
                  if (tab.id === 'interview') setActiveSubTab('today');
                  if (tab.id === 'audit_logs') setAuditSubTab('Pending');
                  setReasonFilter('All');
                  setIsGlobalSearch(false);
                  setSearchTerm('');
                  setCheckboxVisible(false);
                  setSelectedInterviews([]);
                  setSelectAll(false);
                }}
                className={`pb-3 px-3 text-sm font-bold transition-all relative whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  isActive ? activeColor : 'border-transparent text-slate-500 hover:text-slate-800'
                } ${isActive ? '' : ''}`}
                style={isActive ? {} : {}}
              >
                {tab.id === 'audit_logs' && <ShieldAlert size={14} className="inline mr-0.5" />}
                {tab.icon && <span>{tab.icon}</span>}
                {tab.label} {tab.id !== 'audit_logs' && tab.id !== 'dashboard' && tabCount !== undefined ? `(${tabCount})` : ''}
                {isActive && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-md" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interview Sub-tabs (only when Interview tab is active) */}
      {activeTab === 'interview' && !isGlobalSearch && (
        <div className="bg-white border-b border-slate-100 px-6">
          <div className="flex overflow-x-auto tabs-scroll space-x-2 py-2 pb-1">
            {INTERVIEW_SUB_TABS.map(sub => {
              // Calculate sub-tab counts
              const todayKey = getISTDateYMD();
              const subCount = (interviews || []).filter(interview => {
                const stage = getStageFromStatus(interview.status);
                const interviewDateKey = getISTDateKey(interview.interview_date);
                if (!interviewDateKey) return false;
                if (sub.id === 'today') {
                  return interviewDateKey === todayKey && stage === 'Interview';
                } else if (sub.id === 'upcoming') {
                  return interviewDateKey > todayKey && stage === 'Interview';
                } else if (sub.id === 'no_show') {
                  return stage === 'No-Show' || (stage === 'Interview' && interviewDateKey < todayKey);
                } else if (sub.id === 'round2') {
                  return stage === 'Round 2';
                }
                return false;
              }).length;
              return (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    activeSubTab === sub.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sub.label} <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-xs text-slate-700">{subCount}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Audit Logs Sub-tabs (Pending / Audited) */}
      {activeTab === 'audit_logs' && !isGlobalSearch && (
        <div className="bg-white border-b border-slate-100 px-6">
          <div className="flex space-x-4 py-2">
            {['Pending', 'Audited'].map(item => {
              const count = (interviews || []).filter(i => {
                if (item === 'Pending') return !i.is_audited;
                return !!i.is_audited;
              }).length;
              return (
                <button
                  key={item}
                  onClick={() => setAuditSubTab(item)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    auditSubTab === item
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item} <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-xs text-slate-700">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Global Search Indicator */}
      {isGlobalSearch && searchTerm && (
        <div className="mx-6 mt-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-orange-600" />
            <span className="text-sm font-bold text-orange-800">
              Searching across ALL pipeline stages for "{searchTerm}"
            </span>
            <span className="text-xs text-orange-600">({filteredInterviews.length} results)</span>
          </div>
          <button onClick={() => { setSearchTerm(''); setIsGlobalSearch(false); }} className="text-orange-600 hover:text-orange-800 text-xs font-bold flex items-center gap-1">
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-6">
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <DashboardView interviews={interviews} />
        )}

        {/* Pipeline Table View for all non-dashboard tabs */}
        {activeTab !== 'dashboard' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {filteredInterviews.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <Search size={24} className="text-slate-400" />
                </div>
                <p className="text-lg font-bold text-slate-700">No candidates found</p>
                <p className="text-sm text-slate-500 mt-1">
                  {isGlobalSearch ? 'Try a different search term' : `No candidates in ${activeTab.replace('_', ' ')} stage`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto" ref={tableScrollRef} onScroll={updateScrollButtons}>
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {checkboxVisible && (
                        <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap w-10">
                          <input
                            type="checkbox"
                            className="accent-blue-500 cursor-pointer"
                            checked={selectAll}
                            onChange={handleSelectAll}
                            style={{ width: 16, height: 16 }}
                          />
                        </th>
                      )}
                      <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">#</th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Created</th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Owner</th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Candidate</th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Exp & Gender</th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Role & Source</th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Accept & Offer</th>
                      <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Interview Date & Alerts</th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInterviews.map((interview, index) => {
                      const stage = getStageFromStatus(interview.status);
                      const primaryBtn = getForwardButton(stage);
                      const isNoShow = stage === 'No-Show';
                      return (
                        <CandidateTableRow
                          key={interview._id || index}
                          interview={interview}
                          index={index + 1}
                          stage={stage}
                          primaryBtn={primaryBtn}
                          isNoShow={isNoShow}
                          activeTab={activeTab}
                          activeSubTab={activeSubTab}
                          isGlobalSearch={isGlobalSearch}
                          checkboxVisible={checkboxVisible}
                          isSelected={selectedInterviews.includes(interview._id)}
                          onSelect={() => handleSelectInterview(interview._id)}
                          onForward={(targetStage) => handleForwardAction(interview, targetStage)}
                          onDecline={() => { setSelectedCandidate(interview); setIsDeclineModalOpen(true); }}
                          onReschedule={() => { setSelectedCandidate(interview); setIsRescheduleOpen(true); }}
                          onMarkNoShow={() => handleMarkNoShow(interview)}
                          onViewHistory={() => { setSelectedCandidate(interview); setHistoryModalTab('full'); setIsHistoryModalOpen(true); }}
                          onViewReassignHistory={() => { setSelectedCandidate(interview); setHistoryModalTab('reassign'); setIsHistoryModalOpen(true); }}
                          onViewRescheduleHistory={() => { setSelectedCandidate(interview); setHistoryModalTab('reschedule'); setIsHistoryModalOpen(true); }}
                          onViewDetails={() => { setSelectedCandidate(interview); setIsDetailModalOpen(true); }}
                          onWhatsApp={() => handleWhatsApp(interview)}
                          onRowClick={() => handleRowClick(interview)}
                          onToggleAudit={() => handleToggleAudit && handleToggleAudit(interview)}
                          onViewRound1={() => { setSelectedCandidate(interview); setIsRound1ModalOpen(true); }}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Interview Modal */}
      {showCreateModal && (
        <React.Suspense fallback={<div>Loading modal...</div>}>
          <CreateInterviewModal
            onClose={() => setShowCreateModal(false)}
            onInterviewCreated={handleInterviewCreated}
            jobOpeningOptions={jobOpeningOptions}
            interviewTypeOptions={interviewTypeOptions}
            statusOptions={statusOptions}
            statusOptionsWithSubs={statusOptionsWithSubs}
            sourcePortalOptions={sourcePortalOptions}
            existingInterviews={interviews}
            cooldownDays={cooldownDays}
          />
        </React.Suspense>
      )}

      {/* Edit Interview Modal */}
      {selectedInterview && (
        <div className="fixed inset-0 z-[9999] flex items-center bg-transparent justify-center" style={{ backdropFilter: "blur(3px)" }}>
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

      {/* Forward Remark Modal */}
      {isForwardRemarkOpen && forwardTarget && (
        <ForwardRemarkModal
          target={forwardTarget}
          onClose={() => { setIsForwardRemarkOpen(false); setForwardTarget(null); }}
          onConfirmForward={handleForwardWithRemark}
          onConfirmJobOffer={handleForwardToJobOffer}
        />
      )}

      {/* Decline Modal */}
      {isDeclineModalOpen && selectedCandidate && (
        <DeclineModal
          candidate={selectedCandidate}
          options={declineReasons}
          onClose={() => { setIsDeclineModalOpen(false); setSelectedCandidate(null); }}
          onSubmit={handleDeclineSubmit}
        />
      )}

      {/* Reschedule Modal */}
      {isRescheduleOpen && selectedCandidate && (
        <RescheduleModal
          candidate={selectedCandidate}
          onClose={() => { setIsRescheduleOpen(false); setSelectedCandidate(null); }}
          onSubmit={handleRescheduleSubmit}
        />
      )}

      {/* Candidate Detail Modal */}
      {isDetailModalOpen && selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          onClose={() => { setIsDetailModalOpen(false); setSelectedCandidate(null); loadInterviews(); }}
          onSaved={() => loadInterviews()}
          jobOpeningOptions={jobOpeningOptions}
          sourcePortalOptions={sourcePortalOptions}
          canEditContactNumbers={permissions.can_view_all || utilIsSuperAdmin(getUserPermissions())}
        />
      )}

      {/* Audit History Modal */}
      {isHistoryModalOpen && selectedCandidate && (
        <AuditHistoryModal
          candidate={selectedCandidate}
          initialTab={historyModalTab}
          onClose={() => { setIsHistoryModalOpen(false); setSelectedCandidate(null); }}
        />
      )}

      {/* Round 1 Info Modal */}
      {isRound1ModalOpen && selectedCandidate && (
        <Round1InfoModal
          candidate={selectedCandidate}
          onClose={() => { setIsRound1ModalOpen(false); setSelectedCandidate(null); }}
        />
      )}

      {/* Reassignment modal removed */}
    </div>

    {/* ── Interview Settings Modal (white, centered, like HTML reference) ── */}
    {isSettingsOpen && (
      <SettingsModal
        onCompanySettingsChange={setCompanySettings}
        onDeclineReasonsChange={setDeclineReasons}
        onCooldownChange={setCooldownDays}
        onRolesChange={loadDropdownOptions}
        onSourcesChange={loadDropdownOptions}
        onClose={() => setIsSettingsOpen(false)}
      />
    )}

    </>
  );
};

// ── SETTINGS MODAL (white, matches interview module.html) ──
const SettingsModal = ({ onCompanySettingsChange, onDeclineReasonsChange, onCooldownChange, onRolesChange, onSourcesChange, onClose }) => {
  const [tab, setTab] = React.useState('company');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [cs, setCs] = React.useState({ companyName: '', jobDescription: '', officeTiming: '', workingDays: '', interviewTiming: '', officeAddress: '', officeNearby: '', hrName: '', hrMobile: '', hrDesignation: '', interviewFormBaseUrl: '' });
  const [reasons, setReasons] = React.useState([]);
  const [newReason, setNewReason] = React.useState('');
  const [days, setDays] = React.useState(7);
  // Roles & Sources state
  const [rolesList, setRolesList] = React.useState([]);
  const [sourcesList, setSourcesList] = React.useState([]);
  const [newRole, setNewRole] = React.useState('');
  const [newSource, setNewSource] = React.useState('');
  const [rolesLoading, setRolesLoading] = React.useState(false);
  const [sourcesLoading, setSourcesLoading] = React.useState(false);

  // Map backend snake_case → frontend camelCase
  const fromBackend = (doc) => {
    setCs({
      companyName: doc.company_name || '',
      jobDescription: doc.job_description || '',
      officeTiming: doc.office_timing || '',
      workingDays: doc.working_days || '',
      interviewTiming: doc.interview_timing || '',
      officeAddress: doc.office_address || '',
      officeNearby: doc.office_nearby || '',
      hrName: doc.hr_name || '',
      hrMobile: doc.hr_mobile || '',
      hrDesignation: doc.hr_designation || '',
      interviewFormBaseUrl: doc.interview_form_base_url || '',
    });
    setDays(doc.cooldown_days ?? 7);
    setReasons(doc.decline_reasons || []);
  };

  // Load on mount
  React.useEffect(() => {
    (async () => {
      try {
        const res = await interviewSettingsAPI.getGlobalSettings();
        if (res?.success && res?.data) fromBackend(res.data);
      } catch (e) {
        console.error('Failed to load global settings:', e);
      } finally {
        setLoading(false);
      }
    })();
    // Load roles
    (async () => {
      setRolesLoading(true);
      try {
        const res = await interviewSettingsAPI.getJobOpenings();
        if (res?.success && res?.data) setRolesList(res.data);
      } catch (e) { console.error('Failed to load roles:', e); }
      finally { setRolesLoading(false); }
    })();
    // Load sources
    (async () => {
      setSourcesLoading(true);
      try {
        const res = await interviewSettingsAPI.getSourcePortals();
        if (res?.success && res?.data) setSourcesList(res.data);
      } catch (e) { console.error('Failed to load sources:', e); }
      finally { setSourcesLoading(false); }
    })();
  }, []);

  const handleAddRole = async () => {
    const name = newRole.trim();
    if (!name) return;
    if (rolesList.some(r => (r.name || '').toLowerCase() === name.toLowerCase())) return;
    try {
      const res = await interviewSettingsAPI.createJobOpening({ name });
      if (res?.success && res?.data) {
        setRolesList(prev => [...prev, res.data]);
        setNewRole('');
        if (onRolesChange) onRolesChange();
      } else {
        alert('Failed to add role: ' + (res?.message || 'Already exists'));
      }
    } catch (e) { alert('Error adding role: ' + e.message); }
  };

  const handleDeleteRole = async (id) => {
    try {
      const res = await interviewSettingsAPI.deleteJobOpening(id);
      if (res?.success) {
        setRolesList(prev => prev.filter(r => r._id !== id));
        if (onRolesChange) onRolesChange();
      }
    } catch (e) { alert('Error deleting role: ' + e.message); }
  };

  const handleAddSource = async () => {
    const name = newSource.trim();
    if (!name) return;
    if (sourcesList.some(s => (s.name || '').toLowerCase() === name.toLowerCase())) return;
    try {
      const res = await interviewSettingsAPI.createSourcePortal({ name });
      if (res?.success && res?.data) {
        setSourcesList(prev => [...prev, res.data]);
        setNewSource('');
        if (onSourcesChange) onSourcesChange();
      } else {
        alert('Failed to add source: ' + (res?.message || 'Already exists'));
      }
    } catch (e) { alert('Error adding source: ' + e.message); }
  };

  const handleDeleteSource = async (id) => {
    try {
      const res = await interviewSettingsAPI.deleteSourcePortal(id);
      if (res?.success) {
        setSourcesList(prev => prev.filter(s => s._id !== id));
        if (onSourcesChange) onSourcesChange();
      }
    } catch (e) { alert('Error deleting source: ' + e.message); }
  };

  const tabs = [
    { id: 'company', label: '🏢 Company' },
    { id: 'pipeline', label: '⚙️ Pipeline' },
    { id: 'reasons', label: '📋 Reasons' },
    { id: 'roles', label: '💼 Roles' },
    { id: 'sources', label: '📡 Sources' },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        company_name: cs.companyName,
        job_description: cs.jobDescription,
        office_timing: cs.officeTiming,
        working_days: cs.workingDays,
        interview_timing: cs.interviewTiming,
        office_address: cs.officeAddress,
        office_nearby: cs.officeNearby,
        hr_name: cs.hrName,
        hr_mobile: cs.hrMobile,
        hr_designation: cs.hrDesignation,
        interview_form_base_url: cs.interviewFormBaseUrl,
        cooldown_days: days,
        decline_reasons: reasons,
      };
      const res = await interviewSettingsAPI.saveGlobalSettings(payload);
      if (!res?.success) throw new Error(res?.message || 'Save failed');
      // Propagate to parent state
      if (onCompanySettingsChange) onCompanySettingsChange(cs);
      if (onDeclineReasonsChange) onDeclineReasonsChange(reasons);
      if (onCooldownChange) onCooldownChange(days);
      onClose();
    } catch (e) {
      alert('❌ Failed to save settings: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between bg-gradient-to-r from-slate-50 to-blue-50/50">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Settings size={18} className="text-blue-600" /> Global CRM Settings
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Company profile, pipeline rules, and interview configuration</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-1.5 rounded-lg hover:bg-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <svg className="animate-spin w-6 h-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              Loading settings...
            </div>
          ) : null}
          {!loading && tab === 'company' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Company Name</label>
                  <input value={cs.companyName} onChange={e => setCs({...cs, companyName: e.target.value})}
                    className="w-full border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Office Timing</label>
                  <input placeholder="e.g. 10:00 AM – 7:00 PM" value={cs.officeTiming} onChange={e => setCs({...cs, officeTiming: e.target.value})}
                    className="w-full border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Working Days</label>
                  <input placeholder="e.g. Monday to Saturday" value={cs.workingDays} onChange={e => setCs({...cs, workingDays: e.target.value})}
                    className="w-full border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Interview Timing</label>
                  <input placeholder="e.g. 10:00 AM to 6:00 PM" value={cs.interviewTiming} onChange={e => setCs({...cs, interviewTiming: e.target.value})}
                    className="w-full border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Job Description (JD) — shown in WhatsApp invite</label>
                <textarea value={cs.jobDescription} onChange={e => setCs({...cs, jobDescription: e.target.value})} rows={3}
                  placeholder="Describe the job role, responsibilities, and requirements..."
                  className="w-full border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none resize-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Office Address</label>
                <input value={cs.officeAddress} onChange={e => setCs({...cs, officeAddress: e.target.value})} placeholder="Full office address"
                  className="w-full border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Nearby Landmark</label>
                <input value={cs.officeNearby} onChange={e => setCs({...cs, officeNearby: e.target.value})} placeholder="e.g. Electronic City Metro Station"
                  className="w-full border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none transition-all" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Interview Form Base URL</label>
                <input value={cs.interviewFormBaseUrl} onChange={e => setCs({...cs, interviewFormBaseUrl: e.target.value})} placeholder="https://yourcrm.app/interview-form"
                  className="w-full border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none font-mono transition-all" />
                <p className="text-xs text-slate-400 mt-1">This link is inserted in WhatsApp messages and shared with candidates.</p>
              </div>
            </div>
          )}

          {!loading && tab === 'pipeline' && (
            <div>
              <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider mb-3">Lead Hoarding Protection</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Cooldown Period (Days)</label>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  <strong className="text-slate-700">Lock-in period:</strong> If a lead is active and was updated within this many days, other HRs cannot steal or reassign it.
                </p>
                <input type="number" min={0} value={days} onChange={e => setDays(Number(e.target.value))}
                  className="w-24 bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 font-bold outline-none focus:border-blue-500" />
              </div>
            </div>
          )}

          {!loading && tab === 'reasons' && (
            <div>
              <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider mb-3">Decline &amp; Drop Reasons</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-4">Manage reasons HRs can select when declining a candidate.</p>
                <div className="flex gap-2 mb-4">
                  <input value={newReason} onChange={e => setNewReason(e.target.value)}
                    onKeyPress={e => { if (e.key === 'Enter' && newReason.trim() && !reasons.includes(newReason.trim())) { setReasons([...reasons, newReason.trim()]); setNewReason(''); } }}
                    placeholder="Add new reason..."
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
                  <button onClick={() => { if (newReason.trim() && !reasons.includes(newReason.trim())) { setReasons([...reasons, newReason.trim()]); setNewReason(''); } }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold">Add</button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                  {reasons.map(r => (
                    <span key={r} className="bg-white border border-slate-300 text-slate-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                      {r}
                      <button onClick={() => setReasons(reasons.filter(item => item !== r))} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {reasons.length === 0 && <p className="text-slate-400 text-sm">No reasons added yet.</p>}
                </div>
              </div>
            </div>
          )}

          {!loading && tab === 'roles' && (
            <div>
              <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider mb-3">Job Roles / Openings</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-4">Manage roles that appear in the Role dropdown when creating or editing interviews.</p>
                <div className="flex gap-2 mb-4">
                  <input value={newRole} onChange={e => setNewRole(e.target.value)}
                    onKeyPress={e => { if (e.key === 'Enter') handleAddRole(); }}
                    placeholder="Add new role..."
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
                  <button onClick={handleAddRole}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold">Add</button>
                </div>
                {rolesLoading ? (
                  <div className="flex items-center justify-center py-8 text-slate-400 text-sm">Loading roles...</div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                    {rolesList.map(r => (
                      <span key={r._id} className="bg-white border border-slate-300 text-slate-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                        {r.name}
                        <button onClick={() => handleDeleteRole(r._id)} className="text-slate-400 hover:text-red-500 transition-colors">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {rolesList.length === 0 && <p className="text-slate-400 text-sm">No roles added yet. Add roles to populate the Role dropdown.</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && tab === 'sources' && (
            <div>
              <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider mb-3">Source / Portals</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-4">Manage sources that appear in the Source dropdown when creating or editing interviews.</p>
                <div className="flex gap-2 mb-4">
                  <input value={newSource} onChange={e => setNewSource(e.target.value)}
                    onKeyPress={e => { if (e.key === 'Enter') handleAddSource(); }}
                    placeholder="Add new source..."
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
                  <button onClick={handleAddSource}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold">Add</button>
                </div>
                {sourcesLoading ? (
                  <div className="flex items-center justify-center py-8 text-slate-400 text-sm">Loading sources...</div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                    {sourcesList.map(s => (
                      <span key={s._id} className="bg-white border border-slate-300 text-slate-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                        {s.name}
                        <button onClick={() => handleDeleteSource(s._id)} className="text-slate-400 hover:text-red-500 transition-colors">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {sourcesList.length === 0 && <p className="text-slate-400 text-sm">No sources added yet. Add sources to populate the Source dropdown.</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-5 py-2 text-sm text-slate-500 hover:text-slate-900 font-medium disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || loading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white text-sm font-black rounded-xl shadow-md shadow-blue-600/25 flex items-center gap-2">
            {saving ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Saving...</>
            ) : (
              <><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Settings</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Interview Table Component
// --- Tag helper ---
const Tag = ({ icon, text, color }) => {
  const colors = { blue: "bg-blue-100 text-blue-700", pink: "bg-pink-100 text-pink-700", purple: "bg-purple-100 text-purple-700", green: "bg-emerald-100 text-emerald-700", orange: "bg-orange-100 text-orange-700", red: "bg-red-100 text-red-700" };
  return <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${colors[color] || "bg-slate-100 text-slate-700"}`}>{icon && icon}<span>{text}</span></span>;
};

// --- CANDIDATE TABLE ROW (matching interview module.html) ---
const CandidateTableRow = ({ interview, index, stage, primaryBtn, isNoShow, activeTab, activeSubTab, isGlobalSearch, checkboxVisible, isSelected, onSelect, onForward, onDecline, onReschedule, onMarkNoShow, onViewHistory, onViewReassignHistory, onViewRescheduleHistory, onViewDetails, onWhatsApp, onRowClick, onToggleAudit, onViewRound1 }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState(null);
  const dropdownRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          btnRef.current && !btnRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    function handleScroll() { setIsDropdownOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isDropdownOpen]);

  const handleToggleDropdown = (e) => {
    e.stopPropagation();
    if (!isDropdownOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownHeight = 160; // approximate max height of dropdown
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openAbove = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
      setDropdownPos({
        top: openAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setIsDropdownOpen(prev => !prev);
  };

  const formatInterviewDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  };

  // Audit Log view
  if (activeTab === 'audit_logs') {
    return (
      <tr className={`hover:bg-slate-50/80 transition-colors group ${isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''}`}>
        {checkboxVisible && (
          <td className="px-3 py-3 border-r border-slate-100">
            <input type="checkbox" className="accent-blue-500 cursor-pointer" checked={!!isSelected} onChange={() => onSelect && onSelect()} onClick={(e) => e.stopPropagation()} style={{ width: 16, height: 16 }} />
          </td>
        )}
        <td className="px-4 py-3 text-center font-bold text-slate-400 text-xs border-r border-slate-100">{index}</td>
        <td className="px-4 py-3 border-r border-slate-100">
          <div className="text-xs font-semibold text-slate-700">{interview.created_at ? new Date(interview.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'N/A'}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">{interview.created_at ? <>{new Date(interview.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })} <span className="text-[9px] font-semibold text-indigo-400 bg-indigo-50 px-1 rounded">IST</span></> : ''}</div>
        </td>
        <td className="px-4 py-3 border-r border-slate-100" colSpan={3}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-semibold text-xs shrink-0">{(interview.candidate_name || '?').charAt(0)}</div>
            <div>
              <div className="font-semibold text-slate-800 text-xs whitespace-nowrap">{interview.candidate_name || '-'}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 border-r border-slate-100">
          <div className="text-xs font-medium text-slate-700 whitespace-nowrap">{interview.job_opening || '-'}</div>
          <div className="text-[10px] text-slate-500 whitespace-nowrap">{interview.source_portal || '-'}</div>
        </td>
        <td className="px-4 py-3 border-r border-slate-100" colSpan={2}>
          <span className="text-[10px] text-slate-400 italic">—</span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <button onClick={onWhatsApp} title={interview.wa_sent ? 'WhatsApp Sent' : 'Send WhatsApp Invite'} className={`p-1.5 rounded-lg border transition-all ${interview.wa_sent ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50'}`}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill={interview.wa_sent ? '#16a34a' : '#64748b'}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.858L.057 23.47a.5.5 0 0 0 .609.61l5.701-1.493A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.869 0-3.628-.49-5.153-1.346l-.375-.213-3.834 1.004 1.022-3.74-.227-.381A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            </button>
            <button onClick={onToggleAudit} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all group/audit" style={interview.is_audited ? {background:'#d1fae5',borderColor:'#6ee7b7'} : {background:'#f8fafc',borderColor:'#e2e8f0'}}>
              {interview.is_audited ? (
                <><CheckCircle size={15} className="text-emerald-600" /> <span className="text-emerald-700 font-black text-xs">Audited</span></>
              ) : (
                <><Circle size={15} className="text-slate-400 group-hover/audit:text-emerald-500 transition-colors" /> <span className="text-slate-500 text-xs group-hover/audit:text-slate-800">Pending</span></>
              )}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // Standard Pipeline Row
  return (
    <tr className={`hover:bg-slate-50/70 transition-colors group cursor-pointer ${isNoShow ? 'bg-amber-50/60' : ''} ${isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''}`}>
      {checkboxVisible && (
        <td className="px-3 py-3 border-r border-slate-100">
          <input type="checkbox" className="accent-blue-500 cursor-pointer" checked={!!isSelected} onChange={() => onSelect && onSelect()} onClick={(e) => e.stopPropagation()} style={{ width: 16, height: 16 }} />
        </td>
      )}
      <td className="px-4 py-3 text-center font-bold text-slate-400 text-xs border-r border-slate-100" onClick={onRowClick}>{index}</td>

      <td className="px-4 py-3 border-r border-slate-100" onClick={onRowClick}>
        <div className="text-xs font-medium text-slate-600 whitespace-nowrap">{interview.created_at ? new Date(interview.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'N/A'}</div>
        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">{interview.created_at ? <>{new Date(interview.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })} <span className="text-[9px] font-semibold text-indigo-400 bg-indigo-50 px-1 rounded">IST</span></> : 'Added'}</div>
      </td>

      <td className="px-4 py-3 border-r border-slate-100" onClick={onRowClick}>
        <div className="text-xs font-medium text-slate-700 whitespace-nowrap">{interview.created_by || '-'}</div>
        <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">{interview.hr_address || 'Desk N/A'}</div>
      </td>

      <td className="px-4 py-3 border-r border-slate-100" onClick={onRowClick}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">{(interview.candidate_name || '?').charAt(0)}</div>
          <div>
            <button onClick={(e) => { e.stopPropagation(); onRowClick(); }} className="font-semibold text-slate-800 text-xs hover:text-blue-700 transition-colors text-left leading-tight whitespace-nowrap">{interview.candidate_name || '-'}</button>
          </div>
        </div>
        {isGlobalSearch && <Tag text={stage} color="orange" />}
      </td>

      <td className="px-4 py-3 border-r border-slate-100" onClick={onRowClick}>
        <div className="flex flex-col gap-1">
          <Tag icon={<Briefcase size={9} />} text={interview.experience_type || 'Fresher'} color={(!interview.experience_type || interview.experience_type === 'Fresher') ? 'green' : 'purple'} />
          <Tag icon={<User size={9} />} text={interview.gender || '-'} color={interview.gender === 'Female' ? 'pink' : 'blue'} />
        </div>
      </td>

      <td className="px-4 py-3 border-r border-slate-100" onClick={onRowClick}>
        <div className="text-xs font-medium text-slate-700 whitespace-nowrap">{interview.job_opening || '-'}</div>
        <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">{interview.source_portal || '-'}</div>
      </td>

      <td className="px-2 py-3 border-r border-slate-100" onClick={onRowClick}>
        <div className="flex flex-col gap-1">
          <div className="bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 inline-flex items-center gap-0.5 w-fit whitespace-nowrap">
            <span className="text-[9px] font-bold text-emerald-700">Expected: INR {interview.offer_salary ? Number(interview.offer_salary).toLocaleString('en-IN') : 'Pending'}</span>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 inline-flex items-center gap-0.5 w-fit whitespace-nowrap">
            <span className="text-[9px] font-bold text-blue-700">Final Offer: {interview.monthly_salary_offered ? 'INR ' + Number(interview.monthly_salary_offered).toLocaleString('en-IN') : 'Pending'}</span>
          </div>
        </div>
      </td>

      <td className="px-5 py-3 border-r border-slate-100" onClick={onRowClick}>
        <div className="text-xs font-medium text-blue-600 mb-1.5 whitespace-nowrap">{formatInterviewDate(interview.interview_date)}</div>
        <div className="flex flex-col gap-1 items-start">
          {(stage === 'Round 2' && interview.round1_feedback) && (
            <button onClick={(e) => { e.stopPropagation(); onViewRound1 && onViewRound1(); }} className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors">
              <Info size={11}/> R1 Notes
            </button>
          )}
          {activeTab === 'rejected' && interview.decline_reason && <span className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">{interview.decline_reason}</span>}
          {interview.reassign_count > 0 && (
            <button onClick={(e) => { e.stopPropagation(); onViewReassignHistory && onViewReassignHistory(); }} className="bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-md px-2 py-0.5 text-[11px] text-orange-600 font-semibold flex items-center gap-1 transition-colors">
              <RefreshCw size={9}/> Reassigned: {interview.reassign_count}x
            </button>
          )}
          {interview.reschedule_count > 0 && (
            <button onClick={(e) => { e.stopPropagation(); onViewRescheduleHistory && onViewRescheduleHistory(); }} className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md px-2 py-0.5 text-[11px] text-indigo-600 font-semibold flex items-center gap-1 transition-colors">
              <Calendar size={9}/> Rescheduled: {interview.reschedule_count}x
            </button>
          )}
          {(!interview.reassign_count && !interview.reschedule_count && activeTab !== 'rejected' && stage !== 'Round 2') && (
            <span className="text-[10px] text-slate-400 italic">No alerts</span>
          )}
        </div>
      </td>

      <td className="px-4 py-3 text-right relative">
        <div className="flex items-center justify-end gap-1.5">
          
          {activeTab !== 'rejected' && activeTab !== 'hired' && !isNoShow && primaryBtn && (
            <button onClick={(e) => { e.stopPropagation(); onForward(primaryBtn.targetStage); }} className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold px-3 py-2 rounded-lg shadow-sm shadow-blue-600/20 transition-all flex items-center gap-1.5 whitespace-nowrap">
              <ChevronRight size={14} /> {primaryBtn.text}
            </button>
          )}
          
          {isNoShow && (
            <button onClick={(e) => { e.stopPropagation(); onReschedule(); }} className="bg-amber-500/20 text-amber-700 border border-amber-300 text-[11px] font-bold px-3 py-2 rounded-lg transition-all">
              Revive Lead
            </button>
          )}

          {activeTab !== 'rejected' && activeTab !== 'hired' && (
            <div className="relative">
              <button ref={btnRef} onClick={handleToggleDropdown} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors border border-slate-200">
                <MoreVertical size={15} />
              </button>
              {isDropdownOpen && dropdownPos && createPortal(
                <div
                  ref={dropdownRef}
                  style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}
                  className="w-52 bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 overflow-hidden text-left"
                >
                  {(stage === 'Interview' || stage === 'Round 2') && (
                    <>
                      <button onClick={() => { onReschedule(); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Calendar size={14}/> Reschedule Date</button>
                      {!isNoShow && stage === 'Interview' && activeSubTab !== 'no_show' && (
                        <button onClick={() => { onMarkNoShow(); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2"><PhoneOff size={14}/> Mark No-Show</button>
                      )}
                    </>
                  )}
                  <div className="my-1 border-t border-slate-100"/>
                  <button onClick={() => { onDecline(); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><XCircle size={14}/> Decline / Reject</button>
                </div>,
                document.body
              )}
            </div>
          )}

          {/* Three-dots menu for Hired stage */}
          {activeTab === 'hired' && (
            <div className="relative">
              <button ref={btnRef} onClick={handleToggleDropdown} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors border border-slate-200">
                <MoreVertical size={15} />
              </button>
              {isDropdownOpen && dropdownPos && createPortal(
                <div
                  ref={dropdownRef}
                  style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}
                  className="w-52 bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 overflow-hidden text-left"
                >
                  <button onClick={() => { onDecline(); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><XCircle size={14}/> Reject / Decline</button>
                </div>,
                document.body
              )}
            </div>
          )}

          <button onClick={(e) => { e.stopPropagation(); onWhatsApp(); }} title={interview.wa_sent ? 'WhatsApp Invite Sent' : 'Send WhatsApp Invite'} className={`p-2 rounded-lg border transition-all flex-shrink-0 ${interview.wa_sent ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50'}`}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill={interview.wa_sent ? '#16a34a' : '#94a3b8'}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.858L.057 23.47a.5.5 0 0 0 .609.61l5.701-1.493A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.869 0-3.628-.49-5.153-1.346l-.375-.213-3.834 1.004 1.022-3.74-.227-.381A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
          </button>

          {(activeTab === 'hired' || activeTab === 'rejected') && (
            <button onClick={(e) => { e.stopPropagation(); onViewHistory(); }} className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5">
              <History size={12}/> Full Track
            </button>
          )}
          {activeTab === 'hired' && <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-2 rounded-lg">✅ Hired</span>}
        </div>
      </td>
    </tr>
  );
};

// --- DASHBOARD VIEW ---
const DashboardView = ({ interviews }) => {
  const [dateFilter, setDateFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const _ist = getISTToday();
  const today = new Date(_ist.year, _ist.month - 1, _ist.day);

  const getRange = () => {
    const now = new Date(today); now.setHours(0,0,0,0);
    if (dateFilter === 'today') return { start: now, end: now };
    if (dateFilter === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return { start, end };
    }
    if (dateFilter === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    if (dateFilter === 'custom' && customFrom && customTo) {
      return { start: new Date(customFrom), end: new Date(customTo) };
    }
    return { start: now, end: now };
  };

  const inRange = (dateStr, range) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d)) return false;
    const s = new Date(range.start); s.setHours(0,0,0,0);
    const e = new Date(range.end); e.setHours(23,59,59,999);
    return d >= s && d <= e;
  };

  const range = getRange();
  const hrList = [...new Set((interviews || []).map(c => c.created_by).filter(Boolean))].sort();

  const getMetrics = (hrName) => {
    const h = (interviews || []).filter(c => c.created_by === hrName);
    return {
      created: h.filter(c => inRange(c.created_at, range)).length,
      conducted: h.filter(c => inRange(c.interview_date, range)).length,
      round2: h.filter(c => getStageFromStatus(c.status) === 'Round 2').length,
      jobOffered: h.filter(c => getStageFromStatus(c.status) === 'Job Offered').length,
      training: h.filter(c => getStageFromStatus(c.status) === 'Training').length,
      hired: h.filter(c => getStageFromStatus(c.status) === 'Hired').length,
      rejected: h.filter(c => getStageFromStatus(c.status) === 'Rejected').length,
      rescheduled: h.reduce((s, c) => s + (c.reschedule_count || 0), 0),
      reassigned: h.filter(c => c.reassign_count > 0).length,
      total: h.length
    };
  };

  const allMetrics = hrList.map(hr => ({ hr, ...getMetrics(hr) }));
  const T = (key) => allMetrics.reduce((s, m) => s + (m[key] || 0), 0);

  const MC = ({ v, cls }) => (
    <td className={`px-3 py-3.5 text-center text-sm font-bold ${v > 0 ? cls : 'text-slate-300'}`}>{v}</td>
  );

  const stages = ['Interview', 'Round 2', 'Job Offered', 'Training', 'Hired', 'Rejected'];
  const stageColors = {
    Interview: 'bg-blue-50 border-blue-200 text-blue-700',
    'Round 2': 'bg-indigo-50 border-indigo-200 text-indigo-700',
    'Job Offered': 'bg-orange-50 border-orange-200 text-orange-700',
    Training: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    Hired: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    Rejected: 'bg-red-50 border-red-200 text-red-700'
  };

  const stageCounts = {};
  stages.forEach(s => { stageCounts[s] = 0; });
  (interviews || []).forEach(i => {
    const s = getStageFromStatus(i.status);
    if (stageCounts[s] !== undefined) stageCounts[s]++;
    else stageCounts['Interview']++;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">HR Performance Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">Real-time hiring pipeline overview by recruiter</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {[['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['custom', 'Custom']].map(([val, label]) => (
              <button key={val} onClick={() => setDateFilter(val)}
                className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${dateFilter === val ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>
                {label}
              </button>
            ))}
          </div>
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-xl px-3 py-1.5">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="text-xs border-0 outline-none text-slate-700 bg-transparent"/>
              <span className="text-slate-400 text-xs">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="text-xs border-0 outline-none text-slate-700 bg-transparent"/>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Pipeline', value: (interviews || []).length, bg: 'from-blue-500 to-blue-700', icon: Users },
          { label: `Created (${dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'Week' : 'Month'})`, value: T('created'), bg: 'from-indigo-500 to-indigo-700', icon: Plus },
          { label: 'Total Hired', value: T('hired'), bg: 'from-emerald-500 to-emerald-700', icon: CheckCircle },
          { label: 'Total Rejected', value: T('rejected'), bg: 'from-red-500 to-red-700', icon: XCircle }
        ].map(({ label, value, bg, icon: Icon }) => (
          <div key={label} className={`bg-gradient-to-br ${bg} rounded-xl p-5 text-white shadow-lg shadow-slate-900/10`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</span>
              <Icon size={18} className="opacity-70" />
            </div>
            <div className="text-4xl font-black">{value}</div>
          </div>
        ))}
      </div>

      {/* Main Performance Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3">
          <BarChart3 size={20} className="text-blue-600" />
          <div>
            <h3 className="font-black text-slate-900">HR-wise Performance</h3>
            <p className="text-xs text-slate-500">Stage counts = current pipeline totals; Created & Conducted = date range filtered</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50">
                <th className="px-5 py-3 text-xs font-black text-slate-700 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">Recruiter</th>
                <th className="px-3 py-3 text-xs font-black text-blue-700 uppercase tracking-wider text-center whitespace-nowrap">📥 Created</th>
                <th className="px-3 py-3 text-xs font-black text-indigo-700 uppercase tracking-wider text-center whitespace-nowrap">🎯 Conducted</th>
                <th className="px-3 py-3 text-xs font-black text-purple-700 uppercase tracking-wider text-center">R2</th>
                <th className="px-3 py-3 text-xs font-black text-orange-700 uppercase tracking-wider text-center whitespace-nowrap">Job Offer</th>
                <th className="px-3 py-3 text-xs font-black text-yellow-700 uppercase tracking-wider text-center">Train</th>
                <th className="px-3 py-3 text-xs font-black text-emerald-700 uppercase tracking-wider text-center">✅ Hired</th>
                <th className="px-3 py-3 text-xs font-black text-red-700 uppercase tracking-wider text-center">❌ Rejected</th>
                <th className="px-3 py-3 text-xs font-black text-cyan-700 uppercase tracking-wider text-center">↩ Resched</th>
                <th className="px-3 py-3 text-xs font-black text-rose-700 uppercase tracking-wider text-center">🔄 Reassign</th>
                <th className="px-3 py-3 text-xs font-black text-slate-600 uppercase tracking-wider text-center">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allMetrics.map((m, i) => (
                <tr key={m.hr} className={`hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  <td className="px-5 py-4 sticky left-0 bg-inherit z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-md">
                        {m.hr.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{m.hr}</div>
                        <div className="text-xs text-slate-500">HR Desk</div>
                      </div>
                    </div>
                  </td>
                  <MC v={m.created} cls="text-blue-700 bg-blue-50 rounded px-1" />
                  <MC v={m.conducted} cls="text-indigo-700" />
                  <MC v={m.round2} cls="text-purple-700" />
                  <MC v={m.jobOffered} cls="text-orange-700" />
                  <MC v={m.training} cls="text-yellow-700" />
                  <MC v={m.hired} cls="text-emerald-700 font-black" />
                  <MC v={m.rejected} cls="text-red-700" />
                  <MC v={m.rescheduled} cls="text-cyan-700" />
                  <MC v={m.reassigned} cls="text-rose-700" />
                  <td className="px-3 py-4 text-center text-sm font-black text-slate-800">{m.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300">
                <td className="px-5 py-3.5 text-xs font-black text-slate-800 uppercase tracking-wider">All HRs</td>
                <td className="px-3 py-3.5 text-center text-sm font-black text-blue-800">{T('created')}</td>
                <td className="px-3 py-3.5 text-center text-sm font-black text-indigo-800">{T('conducted')}</td>
                <td className="px-3 py-3.5 text-center text-sm font-black text-purple-800">{T('round2')}</td>
                <td className="px-3 py-3.5 text-center text-sm font-black text-orange-800">{T('jobOffered')}</td>
                <td className="px-3 py-3.5 text-center text-sm font-black text-yellow-800">{T('training')}</td>
                <td className="px-3 py-3.5 text-center text-sm font-black text-emerald-800">{T('hired')}</td>
                <td className="px-3 py-3.5 text-center text-sm font-black text-red-800">{T('rejected')}</td>
                <td className="px-3 py-3.5 text-center text-sm font-black text-cyan-800">{T('rescheduled')}</td>
                <td className="px-3 py-3.5 text-center text-sm font-black text-rose-800">{T('reassigned')}</td>
                <td className="px-3 py-3.5 text-center text-sm font-black text-slate-900">{(interviews || []).length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Pipeline Funnel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-600" /> Current Pipeline Snapshot
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {stages.map(stage => (
            <div key={stage} className={`border rounded-xl p-4 text-center ${stageColors[stage]}`}>
              <div className="text-3xl font-black">{stageCounts[stage]}</div>
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-70 mt-1">{stage}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- FORWARD REMARK MODAL ---
const ForwardRemarkModal = ({ target, onClose, onConfirmForward, onConfirmJobOffer }) => {
  const [remark, setRemark] = useState('');
  const stageLabels = { 'Round 2': 'Round 2', 'Job Offered': 'Job Offered', 'Training': 'Training', 'Hired': 'Hired' };
  const nextLabel = stageLabels[target.targetStage] || target.targetStage;
  const canJobOffer = target.currentStage === 'Interview';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ChevronRight size={18} className="text-blue-600" /> Forward Candidate
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Moving to: <span className="font-bold text-blue-700">{nextLabel}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-1 rounded-lg hover:bg-white/80 transition-colors"><X size={18}/></button>
        </div>
        <div className="p-5">
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Remark / Note <span className="text-red-500">*</span>
            <span className="text-slate-400 font-normal ml-1 text-xs">(mandatory — reason for forwarding)</span>
          </label>
          <textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="e.g. Candidate performed well in Round 1. Communication is strong." className="w-full h-28 bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-xl p-3 text-sm text-slate-900 outline-none resize-none transition-colors placeholder:text-slate-400" />
          <div className="flex justify-end mt-1 mb-4">
            <span className={`text-xs ${remark.trim().length < 10 ? 'text-red-400' : 'text-emerald-600'}`}>{remark.trim().length} chars {remark.trim().length < 10 ? '(min 10)' : '✓'}</span>
          </div>
          <div className="flex flex-col gap-2">
            <button disabled={remark.trim().length < 10} onClick={() => { onConfirmForward(target.candidateId, target.currentStage, remark.trim()); onClose(); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all ${remark.trim().length >= 10 ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
              <ChevronRight size={16} /> Move to {nextLabel}
            </button>
            {canJobOffer && (
              <button disabled={remark.trim().length < 10} onClick={() => { onConfirmJobOffer(target.candidateId, target.currentStage, remark.trim()); onClose(); }} className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all ${remark.trim().length >= 10 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                <CheckCircle size={16} /> Direct Job Offer (Skip Round 2)
              </button>
            )}
            <button onClick={onClose} className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- DECLINE MODAL ---
const DeclineModal = ({ candidate, options, onClose, onSubmit }) => {
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  if (!candidate) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-red-600 mb-5">Decline Candidate</h2>
        <p className="text-xs text-slate-600 mb-4">Declining: <span className="font-bold">{candidate.candidate_name}</span></p>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-4 py-3 text-slate-900 mb-4 outline-none focus:border-red-500">
          <option value="" disabled>Select Reason...</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Mandatory Remarks..." className="w-full h-24 bg-white border border-slate-300 rounded-md p-3 text-slate-900 mb-6 outline-none focus:border-red-500 resize-none text-sm" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-md text-sm">Cancel</button>
          <button disabled={!reason || !remarks} onClick={() => onSubmit(candidate._id, reason, remarks)} className={`flex-1 py-2.5 rounded-md text-sm font-bold ${reason && remarks ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500'}`}>Confirm Reject</button>
        </div>
      </div>
    </div>
  );
};

// --- RESCHEDULE MODAL ---
const RescheduleModal = ({ candidate, onClose, onSubmit }) => {
  const [customDate, setCustomDate] = useState('');
  const [reason, setReason] = useState('');
  if (!candidate) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Reschedule Date</h2>
        <p className="text-xs text-slate-600 mb-5">For {candidate.candidate_name}</p>
        <label className="block text-sm text-slate-700 mb-1">New Date</label>
        <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-4 py-2 text-slate-900 mb-4 outline-none focus:border-blue-500" />
        <label className="block text-sm text-slate-700 mb-1">Reason <span className="text-red-600">*</span></label>
        <input type="text" placeholder="Mandatory reschedule reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-4 py-2 text-slate-900 mb-6 text-sm outline-none focus:border-blue-500" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-100 border border-slate-300 text-slate-700 rounded-md text-sm">Cancel</button>
          <button disabled={!customDate || !reason.trim()} onClick={() => onSubmit(candidate._id, customDate, reason.trim())} className={`flex-1 py-2 rounded-md text-sm font-bold ${customDate && reason.trim() ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

// --- CANDIDATE DETAIL / EDIT MODAL (Editable with auto-save + Attachments) ---
const CandidateDetailModal = ({ candidate, onClose, onSaved, jobOpeningOptions = [], sourcePortalOptions = [], canEditContactNumbers = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimerRef = useRef(null);
  const dataRef = useRef(null);
  const originalRef = useRef(null);
  const [histTab, setHistTab] = useState('details');
  const [rightTab, setRightTab] = useState('interview_remark');
  const [quickRemark, setQuickRemark] = useState('');
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [manualInterviewRemarks, setManualInterviewRemarks] = useState([]);
  const [statusRemarks, setStatusRemarks] = useState([]);

  // Attachments
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null); // {type:'success'|'error', text}
  const fileInputRef = useRef(null);
  // Viewer
  const [viewerDoc, setViewerDoc] = useState(null); // {blobUrl, downloadUrl, name, isPdf, isImage, loading, error}
  // Rename
  const [editingAttId, setEditingAttId] = useState(null);
  const [editingAttName, setEditingAttName] = useState('');

  // Qualification
  const qualCatalog = [
    { level: 'School Level', entries: ['10th Pass', '12th Pass'] },
    { level: 'Diploma Level', entries: ['ITI', 'Polytechnic Diploma', 'Diploma in Engineering', 'Diploma in Pharmacy (D.Pharm)', 'Diploma in Computer Applications', 'Diploma in Hotel Management', 'Diploma in Fashion Designing', 'Diploma in Nursing', 'Diploma in Agriculture', 'Diploma in Architecture', 'Diploma in Education (D.Ed)', 'Diploma in Physiotherapy', 'Diploma in Lab Technology'] },
    { level: "Bachelor's Degree", entries: ['BA', 'BA (Hons)', 'B.Com', 'B.Com (Hons)', 'B.Sc', 'B.Sc (Hons)', 'BBA', 'BCA', 'BMS', 'BSW', 'BFA', 'BJMC', 'BHM', 'BTTM', 'B.Des', 'B.Voc', 'B.Lib', 'B.Tech', 'BE', 'B.Arch', 'B.Plan', 'MBBS', 'BDS', 'BAMS', 'BHMS', 'BUMS', 'BPT', 'B.Pharm', 'B.Sc Nursing', 'BVSc', 'LLB (3 Year)', 'BA LLB', 'BBA LLB', 'B.Com LLB', 'B.Ed', 'B.El.Ed', 'CA', 'CS', 'CMA'] },
    { level: "Master's Degree", entries: ['MA', 'M.Com', 'M.Sc', 'MBA', 'PGDM', 'MCA', 'M.Tech', 'ME', 'M.Pharm', 'MS', 'LLM', 'M.Ed', 'MSW', 'M.Des', 'M.Lib', 'M.Plan'] },
    { level: 'Doctorate Level', entries: ['PhD', 'MPhil', 'D.Litt', 'DM', 'MCh'] }
  ];
  const [qualSearch, setQualSearch] = useState('');
  const [qualOpen, setQualOpen] = useState(false);
  const qualRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) { if (qualRef.current && !qualRef.current.contains(e.target)) setQualOpen(false); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredQualGroups = qualCatalog.map(g => ({ ...g, entries: g.entries.filter(e => e.toLowerCase().includes((qualSearch || '').toLowerCase())) })).filter(g => g.entries.length > 0);

  // Load data
  useEffect(() => {
    const id = candidate?._id || candidate?.id;
    if (!id) { setLoading(false); return; }
    (async () => {
      try {
        const res = await API.interviews.getInterviewById(id);
        const d = res || candidate;
        setData(d);
        dataRef.current = d;
        originalRef.current = JSON.parse(JSON.stringify(d));
        // Use attachments from the interview response; also fetch separately as fallback
        if (d.attachments && d.attachments.length > 0) {
          setAttachments(d.attachments);
        } else {
          try {
            const attRes = await API.interviews.getAttachments(id);
            setAttachments(attRes?.data || []);
          } catch {
            setAttachments([]);
          }
        }
        await loadHistoryRemarks(id);
      } catch (e) {
        setData(candidate);
        dataRef.current = candidate;
        originalRef.current = JSON.parse(JSON.stringify(candidate));
        // Try to fetch attachments even if main load failed
        try {
          const attRes = await API.interviews.getAttachments(id);
          setAttachments(attRes?.data || candidate.attachments || []);
        } catch {
          setAttachments(candidate.attachments || []);
        }
        await loadHistoryRemarks(id);
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  if (!candidate) return null;
  const d = data || candidate;
  const interviewId = d._id || d.id;

  const formatISTDateTime = (value) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  };

  const loadHistoryRemarks = async (targetInterviewId) => {
    try {
      const historyRes = await API.interviews.getHistory(targetInterviewId);
      const rawHistory = Array.isArray(historyRes?.data)
        ? historyRes.data
        : (Array.isArray(historyRes) ? historyRes : []);

      const parsedInterviewRemarks = rawHistory
        .filter((entry) => entry?.action_type === 'remark_added')
        .map((entry) => ({
          id: entry.id || `${entry.created_at}-${entry.created_by}`,
          type: 'interview_remark',
          by: entry.created_by_name || 'User',
          reason: entry?.details?.remark_text || entry?.details?.remark || entry.description || '',
          dateRaw: entry.created_at,
          dateLabel: formatISTDateTime(entry.created_at)
        }))
        .filter((entry) => !!entry.reason);

      const parsedStatusRemarks = rawHistory
        .filter((entry) => entry?.action_type === 'status_changed')
        .map((entry) => ({
          id: entry.id || `${entry.created_at}-${entry.created_by}`,
          by: entry.created_by_name || 'User',
          oldStatus: entry?.details?.old_status || '',
          newStatus: entry?.details?.new_status || '',
          remark: entry?.details?.remark || entry?.details?.status_remark || entry?.details?.remarks || '',
          dateRaw: entry.created_at,
          dateLabel: formatISTDateTime(entry.created_at)
        }))
        .filter((entry) => !!entry.remark)
        .sort((a, b) => new Date(b.dateRaw || 0) - new Date(a.dateRaw || 0));

      setManualInterviewRemarks(parsedInterviewRemarks);
      setStatusRemarks(parsedStatusRemarks);
    } catch (historyError) {
      console.warn('Failed to load interview history remarks:', historyError);
      setManualInterviewRemarks([]);
      setStatusRemarks([]);
    }
  };

  // Auto-save on field change (debounced 1.5s)
  const handleFieldChange = (field, value) => {
    setData(prev => {
      const updated = { ...prev, [field]: value };
      // Sync date_time
      if (field === 'interview_date' || field === 'interview_time') {
        const dt = field === 'interview_date' ? value : (prev.interview_date || '');
        const tm = field === 'interview_time' ? value : (prev.interview_time || '');
        if (dt && tm) updated.date_time = `${dt}T${tm}`;
      }
      dataRef.current = updated; // keep ref in sync with latest data
      return updated;
    });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => triggerSave(), 1500);
  };

  const triggerSave = async () => {
    const currentData = dataRef.current;
    const currentId = currentData?._id || currentData?.id || interviewId;
    if (!currentId || !currentData) return;
    setSaving(true);
    try {
      const saveData = { ...currentData };
      delete saveData._id;
      delete saveData.id;
      delete saveData.attachments;
      // Convert salary fields to numbers
      ['old_salary', 'offer_salary', 'monthly_salary_offered'].forEach(f => {
        if (saveData[f] !== undefined && saveData[f] !== null && saveData[f] !== '') {
          saveData[f] = parseFloat(saveData[f]);
        } else {
          delete saveData[f];
        }
      });
      await API.interviews.updateInterview(currentId, saveData, originalRef.current);
      originalRef.current = JSON.parse(JSON.stringify(currentData));
      setLastSaved(new Date());
    } catch (e) {
      console.warn('Auto-save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  // Attachment handlers
  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadMsg(null);
    let uploadError = null;
    let uploadedCount = 0;
    try {
      for (const file of Array.from(files)) {
        const res = await API.interviews.uploadAttachment(interviewId, file, file.name);
        if (res?.success && res.data) {
          setAttachments(prev => [...prev, res.data]);
          uploadedCount++;
        } else {
          uploadError = 'Upload failed: unexpected response';
        }
      }
    } catch (e) {
      uploadError = e?.message || 'Upload failed';
      console.warn('Upload failed:', e);
    } finally {
      setUploading(false);
    }
    if (uploadError) {
      setUploadMsg({ type: 'error', text: 'Upload failed: ' + uploadError });
    } else if (uploadedCount > 0) {
      setUploadMsg({ type: 'success', text: `${uploadedCount} file${uploadedCount > 1 ? 's' : ''} uploaded successfully` });
      setTimeout(() => setUploadMsg(null), 3000);
    }
  };

  const handleDeleteAttachment = async (attId) => {
    try {
      await API.interviews.deleteAttachment(interviewId, attId);
      setAttachments(prev => prev.filter(a => a.id !== attId));
    } catch (e) {
      console.warn('Delete failed:', e);
    }
  };

  const handleAddInterviewRemark = async () => {
    const remarkText = quickRemark.trim();
    if (!remarkText || !interviewId) return;

    setRemarkSaving(true);
    try {
      await API.interviews.addHistoryEntry(interviewId, {
        action_type: 'remark_added',
        action: 'Interview Remark Added',
        description: 'Interview remark added',
        details: { remark_text: remarkText }
      });

      const currentUserName = localStorage.getItem('fullName') || localStorage.getItem('userName') || 'Current User';
      const nowIso = new Date().toISOString();
      setManualInterviewRemarks((prev) => [
        {
          id: `local-${Date.now()}`,
          type: 'interview_remark',
          by: currentUserName,
          reason: remarkText,
          dateRaw: nowIso,
          dateLabel: formatISTDateTime(nowIso)
        },
        ...prev
      ]);
      setQuickRemark('');
    } catch (error) {
      alert('Failed to save remark: ' + (error.message || error));
    } finally {
      setRemarkSaving(false);
    }
  };

  const handleViewAttachment = async (att) => {
    const name = att.label || att.original_name || 'File';
    const fname = (att.original_name || att.label || '').toLowerCase();
    const ext = fname.split('.').pop();
    const isPdf = ext === 'pdf';
    const isImage = ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext);
    const downloadUrl = API.interviews.getAttachmentDownloadUrl(interviewId, att.id);
    setViewerDoc({ blobUrl: null, downloadUrl, name, isPdf, isImage, loading: true, error: null });
    try {
      const userId = localStorage.getItem('userId') || localStorage.getItem('user_id') || '';
      const res = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      const mimeType = isPdf ? 'application/pdf'
        : isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
        : 'application/octet-stream';
      const typedBlob = new Blob([arrayBuf], { type: mimeType });
      const blobUrl = URL.createObjectURL(typedBlob);
      setViewerDoc({ blobUrl, downloadUrl, name, isPdf, isImage, loading: false, error: null });
    } catch (err) {
      setViewerDoc(prev => prev ? { ...prev, loading: false, error: err.message } : null);
    }
  };

  const handleRenameAttachment = async (attId, newLabel) => {
    const trimmed = (newLabel || '').trim();
    if (!trimmed) { setEditingAttId(null); setEditingAttName(''); return; }
    try {
      await API.interviews.renameAttachment(interviewId, attId, trimmed);
      setAttachments(prev => prev.map(a => a.id === attId ? { ...a, label: trimmed } : a));
    } catch (e) {
      console.warn('Rename failed:', e);
    } finally {
      setEditingAttId(null);
      setEditingAttName('');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const inputCls = "w-full bg-white border border-slate-200 focus:bg-white focus:border-[#03B0F5] rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder-slate-400 shadow-sm";
  const reassigns = (data || candidate)?.reassign_history || (data || candidate)?.reassignHistory || [];
  const reschedules = (data || candidate)?.reschedule_history || (data || candidate)?.rescheduleHistory || [];
  // Combine all remarks from reassign + reschedule into single timeline for right panel
  const allRemarks = [
    ...reassigns.map(r => ({ type: 'reassign', date: formatISTDateTime(r.date), dateRaw: r.date, reason: r.reason, by: r.toHr || r.to_hr || r.fromHr || r.from_hr || 'HR', fromHr: r.fromHr || r.from_hr, toHr: r.toHr || r.to_hr })),
    ...reschedules.map(r => ({ type: 'reschedule', date: formatISTDateTime(r.date), dateRaw: r.date, reason: r.reason, by: r.rescheduled_by || r.hr_name || 'HR', from: r.from, to: r.to }))
  ].sort((a, b) => new Date(b.dateRaw || 0) - new Date(a.dateRaw || 0));

  const interviewRemarksTimeline = [
    ...manualInterviewRemarks,
    ...allRemarks
  ].sort((a, b) => new Date(b.dateRaw || 0) - new Date(a.dateRaw || 0));

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black text-white">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={onClose} className="mr-4 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{d.candidate_name || 'Candidate Details'}</h1>
              <p className="text-gray-400">
                📱 {d.mobile_number} | {d.city || ''} | <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                  { Interview:'bg-blue-600', 'Round 2':'bg-indigo-600', 'Job Offered':'bg-orange-500', Training:'bg-yellow-500', Hired:'bg-emerald-600', Rejected:'bg-red-600' }[getStageFromStatus(d.status)] || 'bg-slate-600'
                } text-white`}>{getStageFromStatus(d.status)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {saving && <span className="text-xs text-amber-300 animate-pulse">💾 Saving...</span>}
            {!saving && lastSaved && <span className="text-xs text-emerald-300">✓ Saved {lastSaved.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
            <div className="text-right">
              <div className="text-sm text-gray-400">Status</div>
              <div className="text-white font-semibold">{getStageFromStatus(d.status)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two‑column body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT column */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Pill tab bar — Details | Reassignment | Reschedule */}
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 bg-black border-b border-[#232c3a] w-full overflow-x-auto shrink-0">
            {[
              { id: 'details', label: '📋 INTERVIEW DETAILS' },
              { id: 'reassign', label: '🔄 REASSIGNMENT', count: reassigns.length },
              { id: 'reschedule', label: '📅 RESCHEDULE', count: reschedules.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setHistTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 sm:px-6 py-2 sm:py-3 rounded-3xl font-extrabold text-sm sm:text-base transition border shadow-md whitespace-nowrap focus:outline-none ${histTab===tab.id ? 'bg-[#03B0F5] text-white border-cyan-400 shadow-lg scale-105' : 'bg-white text-[#03B0F5] border-slate-200 hover:bg-cyan-50 hover:text-cyan-500'}`}
                style={{ boxShadow: histTab===tab.id ? '0 4px 16px 0 #1cb5e080' : undefined, letterSpacing: '0.01em' }}
              >
                {tab.label}
                {tab.count !== undefined && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${histTab===tab.id ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-700'}`}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {/* Tab content area (scrollable) */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">

          {/* DETAILS tab — form fields */}
          {histTab === 'details' && (
          <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
              <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              Loading...
            </div>
          ) : (
            <>
              {/* ── Basic Info ── */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-slate-50 flex items-center gap-2">
                  <span className="text-base">👤</span>
                  <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">Basic Info</span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Candidate Name</label>
                    <input value={d.candidate_name || ''} onChange={e => handleFieldChange('candidate_name', e.target.value.toUpperCase())} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Interview Date</label>
                    <input type="date" value={d.interview_date ? toISTDateYMD(d.interview_date) : ''} onChange={e => handleFieldChange('interview_date', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Phone</label>
                    <input
                      value={d.mobile_number || ''}
                      onChange={e => canEditContactNumbers && handleFieldChange('mobile_number', e.target.value.replace(/\D/g, '').slice(0,10))}
                      className={`${inputCls} ${canEditContactNumbers ? '' : '!bg-slate-100 cursor-not-allowed'}`}
                      readOnly={!canEditContactNumbers}
                      maxLength="10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Alt. Phone</label>
                    <input
                      value={d.alternate_number || ''}
                      onChange={e => canEditContactNumbers && handleFieldChange('alternate_number', e.target.value.replace(/\D/g, '').slice(0,10))}
                      className={`${inputCls} ${canEditContactNumbers ? '' : '!bg-slate-100 cursor-not-allowed'}`}
                      readOnly={!canEditContactNumbers}
                      maxLength="10"
                    />
                    {!canEditContactNumbers && (
                      <p className="text-[10px] text-slate-500 mt-1">Only Super Admin can edit contact numbers</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Source</label>
                    <SearchableSelect
                      name="source_portal"
                      value={d.source_portal || ''}
                      onChange={e => handleFieldChange('source_portal', e.target.value)}
                      options={sourcePortalOptions}
                      placeholder="Select source..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Age</label>
                    <input type="number" value={d.age || ''} onChange={e => handleFieldChange('age', e.target.value)} className={inputCls} min="18" max="65" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">City</label>
                    <input value={d.city || ''} onChange={e => handleFieldChange('city', e.target.value.toUpperCase())} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Gender</label>
                    <div className="flex gap-2">
                      {['Male', 'Female'].map(g => (
                        <label key={g} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border-2 cursor-pointer transition-all font-bold text-xs ${d.gender === g ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                          <input type="radio" checked={d.gender === g} onChange={() => handleFieldChange('gender', g)} className="hidden" />
                          {g === 'Male' ? '👨' : '👩'} {g}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Education & Background ── */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-slate-50 flex items-center gap-2">
                  <span className="text-base">🎓</span>
                  <span className="text-xs font-black text-purple-700 uppercase tracking-wider">Education & Background</span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Marital Status</label>
                    <select value={d.marital_status || ''} onChange={e => handleFieldChange('marital_status', e.target.value)} className={inputCls}>
                      <option value="">Select...</option><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Living Arrangement</label>
                    <select value={d.living_arrangement || ''} onChange={e => handleFieldChange('living_arrangement', e.target.value)} className={inputCls}>
                      <option value="">Select...</option><option>With Family</option><option>PG/Hostel</option><option>Rented Alone</option><option>Shared Apartment</option><option>Own House</option>
                    </select>
                  </div>
                  <div className="col-span-2 grid grid-cols-[1fr_auto] gap-3 items-start">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Highest Qualification</label>
                      <div className="relative" ref={qualRef}>
                        <input value={qualOpen ? qualSearch : (d.qualification || '')} onChange={e => { setQualSearch(e.target.value); setQualOpen(true); }} onFocus={() => { setQualSearch(''); setQualOpen(true); }} placeholder="Type to search..." className={inputCls} />
                        {qualOpen && filteredQualGroups.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto">
                            {filteredQualGroups.map(g => (
                              <div key={g.level}>
                                <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100 sticky top-0">{g.level}</div>
                                {g.entries.map(entry => (
                                  <button type="button" key={entry} onClick={() => { handleFieldChange('qualification', entry); setQualSearch(''); setQualOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">{entry}</button>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-36">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                      <select value={d.qualification_status || ''} onChange={e => handleFieldChange('qualification_status', e.target.value)} className={inputCls}>
                        <option value="">Select...</option>
                        <option value="Pursuing">Pursuing</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Banking Experience</label>
                    <div className="flex gap-2">
                      {['Yes', 'No'].map(opt => (
                        <label key={opt} className={`flex-1 flex items-center justify-center py-2 rounded-xl border-2 cursor-pointer transition-all font-bold text-xs ${d.banking_experience === opt ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                          <input type="radio" checked={d.banking_experience === opt} onChange={() => handleFieldChange('banking_experience', opt)} className="hidden" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Professional Details ── */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 flex items-center gap-2">
                  <span className="text-base">💼</span>
                  <span className="text-xs font-black text-blue-700 uppercase tracking-wider">Professional Details</span>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Role</label>
                    <SearchableSelect
                      name="job_opening"
                      value={d.job_opening || ''}
                      onChange={e => handleFieldChange('job_opening', e.target.value)}
                      options={jobOpeningOptions.length > 0 ? jobOpeningOptions : ['Sales Executive', 'Back Office Exec', 'Telecaller', 'Floor Manager']}
                      placeholder="Select role..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Work Experience</label>
                    <div className="flex gap-2 p-1 bg-slate-100 border border-slate-200 rounded-xl">
                      {['fresher', 'experienced'].map(type => (
                        <button type="button" key={type} onClick={() => handleFieldChange('experience_type', type)} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all capitalize ${d.experience_type === type ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>{type}</button>
                      ))}
                    </div>
                  </div>
                  {d.experience_type === 'experienced' && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Total Experience</label>
                        <input value={d.total_experience || ''} onChange={e => handleFieldChange('total_experience', e.target.value)} className={inputCls} placeholder="e.g. 2 years 3 months" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Proof of Experience</label>
                        <div className="flex gap-2 flex-wrap">
                          {[['has_salary_slip', '💰 Salary Slip'], ['has_bank_statement', '🏦 Bank Statement'], ['has_experience_letter', '📄 Exp. Letter']].map(([doc, lbl]) => (
                            <label key={doc} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all text-xs font-bold ${d[doc] ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                              <input type="checkbox" checked={!!d[doc]} onChange={() => handleFieldChange(doc, !d[doc])} className="hidden" />
                              {lbl}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Salary Information ── */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-slate-50 flex items-center gap-2">
                  <span className="text-base">💵</span>
                  <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">Salary Information</span>
                </div>
                <div className="p-4 grid grid-cols-1 gap-3">
                  {[
                    { label: 'Last Salary (Monthly CTC)', field: 'old_salary' },
                    { label: 'Salary Expectation (Monthly CTC)', field: 'offer_salary' },
                    { label: 'Final Offered Salary', field: 'monthly_salary_offered' }
                  ].map(({ label, field }) => (
                    <div key={field}>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-sm font-bold pointer-events-none">₹</span>
                        <input type="number" value={d[field] ?? ''} onChange={e => handleFieldChange(field, e.target.value)} className={inputCls + ' pl-7'} placeholder="0" min="0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Attachments ── */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📎</span>
                    <span className="text-xs font-black text-amber-700 uppercase tracking-wider">Attachments</span>
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{attachments.length}</span>
                  </div>
                  <label htmlFor={`attach-upload-${interviewId}`} className={`cursor-pointer text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Plus size={14}/> {uploading ? 'Uploading...' : 'Add Files'}
                  </label>
                  <input id={`attach-upload-${interviewId}`} type="file" multiple className="hidden" onChange={e => { handleUploadFiles(e.target.files); e.target.value = ''; }} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx" disabled={uploading} />
                </div>
                <div className="p-4">
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      Uploading...
                    </div>
                  )}
                  {uploadMsg && (
                    <div className={`flex items-center gap-2 text-xs font-semibold mb-3 px-3 py-2 rounded-lg ${uploadMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {uploadMsg.type === 'success' ? '✓' : '✗'} {uploadMsg.text}
                      <button onClick={() => setUploadMsg(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
                    </div>
                  )}
                  {attachments.length === 0 && !uploading ? (
                    <div className="text-center py-6 text-slate-400">
                      <FileText size={28} className="mx-auto mb-2 opacity-30"/>
                      <p className="text-xs">No attachments yet. Upload offer letters, documents, etc.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((att, idx) => (
                        <div key={att.id || idx} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 group">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <FileText size={14}/>
                          </div>
                          <div className="flex-1 min-w-0">
                            {editingAttId === att.id ? (
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={editingAttName}
                                  onChange={e => setEditingAttName(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleRenameAttachment(att.id, editingAttName); }
                                    else if (e.key === 'Escape') { setEditingAttId(null); setEditingAttName(''); }
                                  }}
                                  onBlur={() => handleRenameAttachment(att.id, editingAttName)}
                                  className="text-xs font-bold text-slate-800 bg-blue-50 border border-blue-400 rounded px-1.5 py-0.5 outline-none flex-1 min-w-0"
                                />
                              </div>
                            ) : (
                              <div className="text-xs font-bold text-slate-800 truncate">{att.label || att.original_name || 'File'}</div>
                            )}
                            <div className="text-[10px] text-slate-500 flex items-center gap-2">
                              <span>{formatFileSize(att.file_size)}</span>
                              {att.uploaded_by && <span>• {att.uploaded_by}</span>}
                              {att.uploaded_at && <span>• {new Date(att.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}</span>}
                            </div>
                          </div>
                          {/* Rename button */}
                          <button
                            onClick={e => { e.stopPropagation(); setEditingAttId(att.id); setEditingAttName(att.label || att.original_name || ''); }}
                            className="p-1.5 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Rename"
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          {/* View button */}
                          <button
                            onClick={() => handleViewAttachment(att)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="View"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          </button>
                          {/* Download button */}
                          <a href={API.interviews.getAttachmentDownloadUrl(interviewId, att.id)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100" title="Download">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </a>
                          {/* Delete button */}
                          <button onClick={() => handleDeleteAttachment(att.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                            <X size={14}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          </div>)}

          {/* REASSIGNMENT tab */}
          {histTab === 'reassign' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-slate-50 flex items-center gap-2">
                  <span className="text-base">🔄</span>
                  <span className="text-xs font-black text-orange-700 uppercase tracking-wider">Reassignment History</span>
                  <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{reassigns.length}</span>
                </div>
                <div className="p-4">
                  {reassigns.length > 0 ? (
                    <div className="relative">
                      <div className="absolute left-[7px] top-3 bottom-3 w-[2px] bg-orange-200 rounded-full" />
                      <div className="space-y-4">
                        {reassigns.map((r, i) => (
                          <div key={i} className="relative pl-7">
                            <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-orange-500 shadow-sm" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 text-sm">{r.reassigned_by_name || r.reassigned_by || 'Unknown'}</span>
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">🔄 Reassigned</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mb-1">{r.reassigned_at ? new Date(r.reassigned_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : ''}</div>
                              {r.reason && <p className="text-xs text-slate-600 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 leading-relaxed">{r.reason}</p>}
                              {(r.from_hr_name || r.to_hr_name) && (
                                <div className="text-[10px] text-slate-500 mt-1">
                                  {r.from_hr_name && <span>{r.from_hr_name}</span>}
                                  {r.from_hr_name && r.to_hr_name && <span className="mx-1 text-slate-400">→</span>}
                                  {r.to_hr_name && <span className="text-slate-700 font-semibold">{r.to_hr_name}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                      <div className="text-3xl mb-2 opacity-40">🔄</div>
                      <p className="text-xs font-medium">No reassignment history</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* RESCHEDULE tab */}
          {histTab === 'reschedule' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-slate-50 flex items-center gap-2">
                  <span className="text-base">📅</span>
                  <span className="text-xs font-black text-sky-700 uppercase tracking-wider">Reschedule History</span>
                  <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">{reschedules.length}</span>
                </div>
                <div className="p-4">
                  {reschedules.length > 0 ? (
                    <div className="relative">
                      <div className="absolute left-[7px] top-3 bottom-3 w-[2px] bg-sky-200 rounded-full" />
                      <div className="space-y-4">
                        {reschedules.map((r, i) => (
                          <div key={i} className="relative pl-7">
                            <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-sky-500 shadow-sm" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 text-sm">{r.rescheduled_by_name || r.rescheduled_by || 'Unknown'}</span>
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600">📅 Rescheduled</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mb-1">{r.rescheduled_at ? new Date(r.rescheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : ''}</div>
                              {r.reason && <p className="text-xs text-slate-600 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2 leading-relaxed">{r.reason}</p>}
                              {(r.from_date || r.to_date) && (
                                <div className="text-[10px] text-slate-500 mt-1">
                                  {r.from_date && <span>From: <strong className="text-slate-700">{new Date(r.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</strong></span>}
                                  {r.from_date && r.to_date && <span className="mx-1 text-slate-400">→</span>}
                                  {r.to_date && <span>To: <strong className="text-slate-700">{new Date(r.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</strong></span>}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                      <div className="text-3xl mb-2 opacity-40">📅</div>
                      <p className="text-xs font-medium">No reschedule history</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>{/* end LEFT scrollable content */}
        </div>{/* end LEFT column */}

        {/* RIGHT: Remarks panel */}
        <div className="w-[360px] flex flex-col bg-white border-l border-slate-200 shrink-0">
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
            <button
              onClick={() => setRightTab('interview_remark')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl font-extrabold text-xs border transition-all ${rightTab === 'interview_remark' ? 'bg-[#03B0F5] text-white border-cyan-400 shadow' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
            >
              Interview Remark
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${rightTab === 'interview_remark' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>{interviewRemarksTimeline.length}</span>
            </button>
            <button
              onClick={() => setRightTab('status_remark')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl font-extrabold text-xs border transition-all ${rightTab === 'status_remark' ? 'bg-[#03B0F5] text-white border-cyan-400 shadow' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
            >
              Status Remark
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${rightTab === 'status_remark' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>{statusRemarks.length}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-white">
            {rightTab === 'interview_remark' && (
              <div className="mb-4 border border-slate-200 rounded-xl p-3 bg-slate-50">
                <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wide mb-2">Add Interview Remark</label>
                <textarea
                  value={quickRemark}
                  onChange={(e) => setQuickRemark(e.target.value)}
                  placeholder="Type interview remark here..."
                  className="w-full h-24 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 resize-none outline-none focus:border-[#03B0F5]"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={handleAddInterviewRemark}
                    disabled={remarkSaving || !quickRemark.trim()}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${remarkSaving || !quickRemark.trim() ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-[#03B0F5] text-white hover:bg-sky-600'}`}
                  >
                    {remarkSaving ? 'Saving...' : 'Save Remark'}
                  </button>
                </div>
              </div>
            )}

            {rightTab === 'interview_remark' && interviewRemarksTimeline.length > 0 ? (
              <div className="relative">
                <div className="absolute left-[7px] top-3 bottom-3 w-[2px] bg-blue-200 rounded-full" />
                <div className="space-y-4">
                  {interviewRemarksTimeline.map((r, i) => (
                    <div key={r.id || i} className="relative pl-7">
                      <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${r.type === 'reassign' ? 'bg-orange-500' : r.type === 'reschedule' ? 'bg-sky-500' : 'bg-blue-600'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 text-sm">{r.by}</span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${r.type === 'reassign' ? 'bg-orange-100 text-orange-600' : r.type === 'reschedule' ? 'bg-sky-100 text-sky-600' : 'bg-blue-100 text-blue-700'}`}>
                            {r.type === 'reassign' ? '🔄 Reassign' : r.type === 'reschedule' ? '📅 Reschedule' : '📝 Interview'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mb-1">{r.dateLabel || r.date || ''}</div>
                        {r.reason && <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 leading-relaxed">{r.reason}</p>}
                        {r.type === 'reassign' && (r.fromHr || r.toHr) && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            {r.fromHr && <span>{r.fromHr}</span>}
                            {r.fromHr && r.toHr && <span className="mx-1 text-slate-400">→</span>}
                            {r.toHr && <span className="text-slate-700 font-semibold">{r.toHr}</span>}
                          </div>
                        )}
                        {r.type === 'reschedule' && (r.from || r.to) && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            {r.from && <span>From: <strong className="text-slate-700">{r.from}</strong></span>}
                            {r.from && r.to && <span className="mx-1 text-slate-400">→</span>}
                            {r.to && <span>To: <strong className="text-slate-700">{r.to}</strong></span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : rightTab === 'status_remark' && statusRemarks.length > 0 ? (
              <div className="relative">
                <div className="absolute left-[7px] top-3 bottom-3 w-[2px] bg-indigo-200 rounded-full" />
                <div className="space-y-4">
                  {statusRemarks.map((item, idx) => (
                    <div key={item.id || idx} className="relative pl-7">
                      <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-indigo-600 shadow-sm" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 text-sm">{item.by}</span>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Status Change</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mb-1">{item.dateLabel}</div>
                        <p className="text-xs text-slate-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 leading-relaxed">{item.remark}</p>
                        <div className="text-[10px] text-slate-500 mt-1">
                          <span>{item.oldStatus || 'Unknown'}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span className="font-semibold text-slate-700">{item.newStatus || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400">
                <div className="text-4xl mb-3 opacity-40">📝</div>
                <p className="text-xs font-medium text-slate-400">No remarks yet</p>
                <p className="text-[10px] mt-1 text-slate-500">
                  {rightTab === 'status_remark'
                    ? 'Status-change remarks will appear here'
                    : 'Add an interview remark or view reassign/reschedule remarks'}
                </p>
              </div>
            )}
          </div>
        </div>{/* end RIGHT remarks panel */}
      </div>{/* end two-column body */}

      {/* ── Inline File Viewer Modal ── */}
      {viewerDoc && (
        <div
          className="fixed inset-0 z-[99999] flex flex-col bg-black/85"
          onClick={() => { if (viewerDoc.blobUrl) URL.revokeObjectURL(viewerDoc.blobUrl); setViewerDoc(null); }}
        >
          <div
            className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-white text-sm font-bold truncate max-w-[55vw]">
              <i className="fa-solid fa-file mr-2 text-blue-400"></i>{viewerDoc.name}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={viewerDoc.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded transition flex items-center gap-1.5"
                onClick={e => e.stopPropagation()}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button
                onClick={() => { if (viewerDoc.blobUrl) URL.revokeObjectURL(viewerDoc.blobUrl); setViewerDoc(null); }}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold px-3 py-1.5 rounded transition flex items-center gap-1.5"
              >
                <X size={12}/> Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {viewerDoc.loading ? (
              <div className="flex flex-col items-center gap-3 text-white">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
                <span className="text-sm text-gray-300">Loading file...</span>
              </div>
            ) : viewerDoc.error ? (
              <div className="flex flex-col items-center gap-4 text-white">
                <div className="text-5xl text-yellow-400">⚠</div>
                <p className="text-sm text-gray-300">Failed to load: {viewerDoc.error}</p>
                <a href={viewerDoc.downloadUrl} target="_blank" rel="noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded transition flex items-center gap-2">
                  Download Instead
                </a>
              </div>
            ) : (viewerDoc.isPdf || viewerDoc.isImage) ? (
              <iframe src={viewerDoc.blobUrl} title={viewerDoc.name} className="w-full h-full border-0 bg-white" style={{ display: 'block' }}/>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white gap-5">
                <FileText size={56} className="text-gray-400"/>
                <p className="text-base font-medium text-gray-300">Preview not available for this file type.</p>
                <a href={viewerDoc.downloadUrl} target="_blank" rel="noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded transition flex items-center gap-2">
                  Download to View
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- ROUND 1 CONTEXT MODAL ---
const Round1InfoModal = ({ candidate, onClose }) => {
  if (!candidate) return null;
  const fb = candidate.round1_feedback || candidate.round1Feedback;
  if (!fb) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-indigo-700 flex items-center gap-2"><Info size={18}/> Round 1 Context</h2>
            <p className="text-xs text-slate-600 mt-1">Previous interview feedback for {candidate.candidate_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1"><X size={20}/></button>
        </div>
        <div className="p-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-bold">Interviewer</div>
            <div className="text-sm text-slate-900 font-medium flex items-center gap-2"><User size={14} className="text-indigo-600"/> {fb.hrName || fb.hr_name || candidate.created_by || 'N/A'}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-bold">Interview Date</div>
            <div className="text-sm text-slate-900 font-medium flex items-center gap-2"><Calendar size={14} className="text-indigo-600"/> {fb.date || candidate.interview_date || 'N/A'}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-bold">HR Feedback / Remarks</div>
            <div className="text-sm text-slate-700 italic leading-relaxed">"{fb.notes || fb.feedback || 'No feedback recorded'}"</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- AUDIT HISTORY MODAL ---
const AuditHistoryModal = ({ candidate, initialTab = 'full', onClose }) => {
  const [activeHistTab, setActiveHistTab] = useState(initialTab);
  if (!candidate) return null;

  const reassigns = candidate.reassign_history || candidate.reassignHistory || [];
  const reschedules = candidate.reschedule_history || candidate.rescheduleHistory || [];
  const activities = (candidate.activity_history || candidate.activityHistory || []).length > 0
    ? (candidate.activity_history || candidate.activityHistory)
    : [
        { date: candidate.created_at || 'N/A', action: 'Profile Created', details: 'Candidate added to pipeline' },
        { date: candidate.interview_date || 'N/A', action: 'Current Status', details: `${getStageFromStatus(candidate.status)}` }
      ];

  const stageColorMap = { Interview:'bg-blue-600', 'Round 2':'bg-indigo-600', 'Job Offered':'bg-orange-500', Training:'bg-yellow-500', Hired:'bg-emerald-600', Rejected:'bg-red-600' };
  const currentStage = getStageFromStatus(candidate.status);
  const stageBg = stageColorMap[currentStage] || 'bg-slate-600';

  const tabs = [
    { id: 'reassign', label: 'Reassignments', count: reassigns.length, color: 'orange' },
    { id: 'reschedule', label: 'Reschedules', count: reschedules.length, color: 'indigo' },
    { id: 'full', label: 'Full Track', count: activities.length + reassigns.length + reschedules.length, color: 'blue' }
  ];

  const tabColors = { orange: 'bg-orange-100 text-orange-700 border-orange-300', indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300', blue: 'bg-blue-100 text-blue-700 border-blue-300' };

  // Build full chronological timeline
  const fullTimeline = [
    ...activities.map(a => ({ type: 'activity', ...a, sortDate: parseFormattedDate(a.date) || new Date(0) })),
    ...reassigns.map(r => ({ type: 'reassign', date: r.date, fromHr: r.fromHr || r.from_hr, toHr: r.toHr || r.to_hr, reason: r.reason, sortDate: parseFormattedDate(r.date) || new Date(0) })),
    ...reschedules.map(r => ({ type: 'reschedule', date: r.date, from: r.from, to: r.to, reason: r.reason, sortDate: parseFormattedDate(r.date) || new Date(0) }))
  ].sort((a, b) => a.sortDate - b.sortDate);

  const TimelineItem = ({ item }) => {
    if (item.type === 'activity') return (
      <div className="relative pl-7">
        <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-500 shadow-sm"></div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black text-blue-700 uppercase tracking-wider flex items-center gap-1"><History size={10}/>{item.action}</span>
            <span className="text-[11px] text-slate-500">{item.date}</span>
          </div>
          <p className="text-xs text-slate-700">{item.details}</p>
        </div>
      </div>
    );
    if (item.type === 'reassign') return (
      <div className="relative pl-7">
        <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-orange-500 shadow-sm"></div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-orange-700 uppercase tracking-wider flex items-center gap-1"><RefreshCw size={10}/> Reassigned</span>
            <span className="text-[11px] text-slate-500">{item.date}</span>
          </div>
          <div className="flex items-center gap-2 text-sm mb-2 bg-white rounded-lg p-2 border border-orange-200">
            <span className="text-slate-500 font-medium">{item.fromHr}</span>
            <ArrowRightLeft size={14} className="text-orange-400 shrink-0"/>
            <span className="text-emerald-700 font-bold">{item.toHr}</span>
          </div>
          <div className="text-xs text-slate-600 italic bg-white rounded-lg px-3 py-2 border border-orange-100">"{item.reason}"</div>
        </div>
      </div>
    );
    if (item.type === 'reschedule') return (
      <div className="relative pl-7">
        <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-indigo-500 shadow-sm"></div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1"><Calendar size={10}/> Rescheduled</span>
            <span className="text-[11px] text-slate-500">{item.date}</span>
          </div>
          <div className="flex items-center gap-2 text-xs mb-2">
            <span className="bg-white border border-indigo-200 px-2 py-1 rounded font-semibold text-slate-700">{item.from}</span>
            <span className="text-indigo-400">→</span>
            <span className="bg-indigo-600 text-white px-2 py-1 rounded font-bold">{item.to}</span>
          </div>
          <div className="text-xs text-slate-600 italic bg-white rounded-lg px-3 py-2 border border-indigo-100">"{item.reason}"</div>
        </div>
      </div>
    );
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-lg font-black shadow-md">
              {(candidate.candidate_name || '?').charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">{candidate.candidate_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[11px] font-bold text-white px-2 py-0.5 rounded-full ${stageBg}`}>{currentStage}</span>
                <span className="text-xs text-slate-500">#{candidate.mobile_number}</span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-600">{candidate.created_by}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-lg transition-colors"><X size={20}/></button>
        </div>

        {/* Summary Badges */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Summary:</span>
          <span className="bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><RefreshCw size={10}/> {reassigns.length} Reassignment{reassigns.length !== 1 ? 's' : ''}</span>
          <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><Calendar size={10}/> {reschedules.length} Reschedule{reschedules.length !== 1 ? 's' : ''}</span>
          <span className="bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><History size={10}/> {activities.length} Events</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveHistTab(t.id)}
              className={`py-3 px-1 mr-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeHistTab === t.id ? 'border-current' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              style={activeHistTab === t.id ? {borderColor: t.color === 'orange' ? '#f97316' : t.color === 'indigo' ? '#6366f1' : '#3b82f6', color: t.color === 'orange' ? '#c2410c' : t.color === 'indigo' ? '#4338ca' : '#1d4ed8'} : {}}>
              {t.label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${tabColors[t.color] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">

          {/* REASSIGN TAB */}
          {activeHistTab === 'reassign' && (
            <div className="space-y-4">
              {reassigns.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <RefreshCw size={36} className="mx-auto mb-3 opacity-30"/>
                  <p className="font-medium">No reassignments recorded</p>
                </div>
              ) : reassigns.map((log, i) => (
                <div key={i} className="bg-white border border-orange-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-orange-50 px-4 py-2.5 flex items-center justify-between border-b border-orange-100">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={14} className="text-orange-600"/>
                      <span className="text-xs font-black text-orange-700 uppercase tracking-wider">Reassignment #{i+1}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">{log.date}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 mb-3 border border-slate-200">
                      <div className="text-center flex-1">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Previous Owner</div>
                        <div className="text-sm font-bold text-slate-700">{log.fromHr || log.from_hr}</div>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <ArrowRightLeft size={18} className="text-orange-500"/>
                        <span className="text-[10px] text-slate-400">Transferred</span>
                      </div>
                      <div className="text-center flex-1">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">New Owner</div>
                        <div className="text-sm font-black text-emerald-700">{log.toHr || log.to_hr}</div>
                      </div>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
                      <div className="text-[10px] text-orange-600 font-black uppercase tracking-wider mb-1">Reason for Transfer</div>
                      <p className="text-sm text-slate-700 italic">"{log.reason}"</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* RESCHEDULE TAB */}
          {activeHistTab === 'reschedule' && (
            <div className="space-y-4">
              {reschedules.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar size={36} className="mx-auto mb-3 opacity-30"/>
                  <p className="font-medium">No reschedules recorded</p>
                </div>
              ) : reschedules.map((log, i) => (
                <div key={i} className="bg-white border border-indigo-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-indigo-50 px-4 py-2.5 flex items-center justify-between border-b border-indigo-100">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-indigo-600"/>
                      <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">Reschedule #{i+1}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">Changed on: {log.date}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-center gap-4 bg-slate-50 rounded-xl p-4 mb-3 border border-slate-200">
                      <div className="text-center">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Original Date</div>
                        <div className="bg-white border border-slate-300 px-4 py-2 rounded-lg text-sm font-bold text-slate-700">{log.from}</div>
                      </div>
                      <div className="text-indigo-400 text-xl">→</div>
                      <div className="text-center">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">New Date</div>
                        <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md">{log.to}</div>
                      </div>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
                      <div className="text-[10px] text-indigo-600 font-black uppercase tracking-wider mb-1">Reason for Reschedule</div>
                      <p className="text-sm text-slate-700 italic">"{log.reason}"</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FULL TRACK TAB */}
          {activeHistTab === 'full' && (
            <div>
              {fullTimeline.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History size={36} className="mx-auto mb-3 opacity-30"/>
                  <p className="font-medium">No history available</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-2.5 space-y-4 py-1">
                  {fullTimeline.map((item, i) => <TimelineItem key={i} item={item}/>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition-colors">Close</button>
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
        <div className="absolute z-[99999] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
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
const CreateInterviewModal = ({ onClose, onInterviewCreated, jobOpeningOptions, interviewTypeOptions, statusOptions, statusOptionsWithSubs = [], sourcePortalOptions = [], existingInterviews = [], cooldownDays = 7 }) => {
  // Get current date and time in IST — uses toLocaleDateString('en-CA') which reliably
  // produces YYYY-MM-DD in the given timezone, avoiding the toLocaleString→new Date()
  // round-trip bug that shifts the date during IST midnight transition (00:00–05:30 IST).
  const getCurrentDateTime = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    const timeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }).slice(0, 5); // HH:MM
    return `${dateStr}T${timeStr}`;
  };

  // Build an explicit IST datetime string so backend parsing keeps the same calendar date.
  // CRITICAL: We always use noon IST (12:00) so UTC equivalent is 06:30 of the SAME day.
  // This avoids the midnight-window bug where early IST times (00:00–05:30) convert to
  // the PREVIOUS day in UTC, which breaks display when the Z suffix is missing from response.
  // The actual interview time is stored separately in the `interview_time` field.
  const buildISTDateTimeOffset = (dateYmd) => {
    if (!dateYmd) return '';
    // Noon IST = 06:30 UTC — always on the same calendar day in both IST and UTC
    return `${dateYmd}T12:00:00+05:30`;
  };

  // Grouped qualification catalog (matching HTML design)
  const qualCatalog = [
    { level: 'School Level', entries: ['10th Pass', '12th Pass'] },
    { level: 'Diploma Level', entries: ['ITI', 'Polytechnic Diploma', 'Diploma in Engineering', 'Diploma in Pharmacy (D.Pharm)', 'Diploma in Computer Applications', 'Diploma in Hotel Management', 'Diploma in Fashion Designing', 'Diploma in Nursing', 'Diploma in Agriculture', 'Diploma in Architecture', 'Diploma in Education (D.Ed)', 'Diploma in Physiotherapy', 'Diploma in Lab Technology'] },
    { level: "Bachelor's Degree", entries: ['BA', 'BA (Hons)', 'B.Com', 'B.Com (Hons)', 'B.Sc', 'B.Sc (Hons)', 'BBA', 'BCA', 'BMS', 'BSW', 'BFA', 'BJMC', 'BHM', 'BTTM', 'B.Des', 'B.Voc', 'B.Lib', 'B.Tech', 'BE', 'B.Arch', 'B.Plan', 'MBBS', 'BDS', 'BAMS', 'BHMS', 'BUMS', 'BPT', 'B.Pharm', 'B.Sc Nursing', 'BVSc', 'LLB (3 Year)', 'BA LLB', 'BBA LLB', 'B.Com LLB', 'B.Ed', 'B.El.Ed', 'CA', 'CS', 'CMA'] },
    { level: "Master's Degree", entries: ['MA', 'M.Com', 'M.Sc', 'MBA', 'PGDM', 'MCA', 'M.Tech', 'ME', 'M.Pharm', 'MS', 'LLM', 'M.Ed', 'MSW', 'M.Des', 'M.Lib', 'M.Plan'] },
    { level: 'Doctorate Level', entries: ['PhD', 'MPhil', 'D.Litt', 'DM', 'MCh'] }
  ];

  // Flat list for backward compat
  const qualificationOptions = qualCatalog.flatMap(g => g.entries);

  // Extended formData to match HTML structure
  const [formData, setFormData] = useState({
    candidate_name: '',
    mobile_number: '',
    alternate_number: '',
    gender: 'Male',
    qualification: '',
    qualificationLevel: '',
    qualification_status: '',
    job_opening: '',
    marital_status: 'Single',
    age: '',
    city: '',
    state: '',
    experience_type: 'fresher',
    total_experience: '',
    yearsExpNum: 0,
    monthsExpNum: 0,
    numCompanies: '',
    companies: [],
    documents: { salarySlip: false, bankStatement: false, expLetter: false },
    old_salary: '',
    offer_salary: '',
    living_arrangement: 'With Family',
    primary_earning_member: '',
    type_of_business: '',
    banking_experience: 'No',
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

  // Two-step form state
  const [formStep, setFormStep] = useState(1);
  const [createdInterviewId, setCreatedInterviewId] = useState(null);
  const [createdInterviewData, setCreatedInterviewData] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Drawer UI state
  const [qualSearch, setQualSearch] = useState('');
  const [qualOpen, setQualOpen] = useState(false);
  const qualRef = useRef(null);

  // Inline duplicate check state (matching HTML design)
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const [canReassign, setCanReassign] = useState(false);
  const [reassignReason, setReassignReason] = useState('');
  const [showDuplicateDetails, setShowDuplicateDetails] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Available users for reassignment
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

  // Click-outside for qualification dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (qualRef.current && !qualRef.current.contains(e.target)) setQualOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handlers for company/experience/documents
  const handleCompanyChange = (i, f, v) => {
    const nc = [...formData.companies];
    if (!nc[i]) nc[i] = { name: '', duration: '', salary: '' };
    nc[i][f] = v;
    setFormData(prev => ({ ...prev, companies: nc }));
  };

  const handleNumCompaniesChange = (e) => {
    const count = parseInt(e.target.value, 10) || 0;
    setFormData(prev => ({ ...prev, numCompanies: e.target.value, companies: Array.from({ length: count }, () => ({ name: '', duration: '', salary: '' })) }));
  };

  const handleDocChange = (doc) => {
    setFormData(prev => ({ ...prev, documents: { ...prev.documents, [doc]: !prev.documents[doc] } }));
  };

  const selectQualification = (entry, level) => {
    setFormData(prev => ({ ...prev, qualification: entry, qualificationLevel: level }));
    setQualSearch(entry);
    setQualOpen(false);
    if (errors.qualification) setErrors(prev => ({ ...prev, qualification: '' }));
  };

  // Inline phone duplicate check (matching HTML handlePhoneCheck)
  const handlePhoneCheck = async (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({ ...prev, mobile_number: val }));
    if (errors.mobile_number) setErrors(prev => ({ ...prev, mobile_number: '' }));

    if (val.length >= 10) {
      setCheckingDuplicate(true);
      try {
        const response = await API.interviews.checkDuplicatePhone(val);
        if (response.success && response.data && response.data.length > 0) {
          const match = response.data[0];
          setDuplicateMatch(match);
          const lastUpdate = match.updated_at || match.created_at;
          const d = lastUpdate ? (new Date() - new Date(lastUpdate)) / (1000 * 60 * 60 * 24) : 999;
          const stage = getStageFromStatus(match.status);
          setCanReassign(!(stage === 'Interview' && d < cooldownDays));
        } else {
          setDuplicateMatch(null);
        }
      } catch (error) {
        console.warn('Duplicate check failed:', error);
        setDuplicateMatch(null);
      } finally {
        setCheckingDuplicate(false);
      }
    } else {
      setDuplicateMatch(null);
    }
  };

  // Handle reassign of duplicate interview to current user
  const handleReassign = async () => {
    if (!duplicateMatch || !reassignReason.trim()) return;
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userId = userData.user_id || localStorage.getItem('userId') || '';
    if (!userId) { alert('Please login first'); return; }
    
    setLoading(true);
    try {
      const response = await API.interviews.requestReassignment(
        duplicateMatch._id || duplicateMatch.id,
        userId,
        reassignReason.trim()
      );
      if (response.success) {
        alert('Reassignment request submitted successfully. Awaiting admin approval.');
        onClose();
      } else {
        alert(response.message || 'Failed to submit reassignment request');
      }
    } catch (error) {
      alert('Failed to submit reassignment request');
    } finally {
      setLoading(false);
    }
  };

  const filteredQualGroups = qualCatalog.map(group => ({
    ...group,
    entries: group.entries.filter(e => e.toLowerCase().includes((qualSearch || '').toLowerCase()))
  })).filter(g => g.entries.length > 0);

  const expLabel = formData.experience_type === 'experienced'
    ? `${formData.yearsExpNum} yr${formData.yearsExpNum !== 1 ? 's' : ''} ${formData.monthsExpNum} mo`
    : 'Fresher';

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
      'interview_type', 'status', 'qualification', 'qualification_status', 'marital_status',
      'living_arrangement', 'primary_earning_member', 'type_of_business',
      'banking_experience', 'source_portal', 'age', 'interview_date', 
      'interview_time', 'date_time', 'job_opening'
    ];

    // Convert to uppercase if it's a text field (names, addresses, etc.)
    const processedValue = excludeFromUppercase.includes(name) || typeof value !== 'string'
      ? value
      : value.toUpperCase();

    setFormData(prev => {
      const updated = { ...prev, [name]: processedValue };
      // Keep date_time in sync with interview_date + interview_time
      if (name === 'interview_date' || name === 'interview_time') {
        const d = name === 'interview_date' ? processedValue : prev.interview_date;
        const t = name === 'interview_time' ? processedValue : prev.interview_time;
        if (d && t) updated.date_time = `${d}T${t}`;
      }
      return updated;
    });
    
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

      const selectedInterviewDate = formData.interview_date;
      const selectedInterviewTime = formData.interview_time || '10:00';
      const interviewDateTimeIST = buildISTDateTimeOffset(selectedInterviewDate);

      // Create complete interview data matching backend expectations
      const interviewData = {
        // Required fields
        candidate_name: formData.candidate_name,
        mobile_number: formData.mobile_number,
        gender: formData.gender,
        job_opening: formData.job_opening || '',
        interview_type: formData.interview_type || (interviewTypeOptions.length > 0 ? interviewTypeOptions[0] : 'Walk-In'),
        
        // Optional contact fields
        alternate_number: formData.alternate_number || '',
        
        // Location fields - backend requires at least 1 character
        city: formData.city?.trim() || 'Not Specified',
        state: formData.state?.trim() || 'Not Specified',
        
        // Professional fields
        qualification: formData.qualification || '',
        qualification_status: formData.qualification_status || '',
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
        
        // Interview scheduling — send explicit IST offset to preserve exact selected date
        interview_date: interviewDateTimeIST,
        interview_time: selectedInterviewTime,
        date_time: `${selectedInterviewDate}T${selectedInterviewTime}`,
        
        // Source and status
        source_portal: formData.source_portal || '',
        status: 'new_interview',
        
        // System fields — use explicit IST timestamp (+05:30) for consistent local state
        created_by: userName,
        user_id: userId,
        created_at: (() => { const n = new Date(); return n.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) + 'T' + n.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + '+05:30'; })(),
        updated_at: (() => { const n = new Date(); return n.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) + 'T' + n.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + '+05:30'; })()
      };

      // Remove null values for optional numeric fields to avoid backend issues
      if (interviewData.old_salary === null) delete interviewData.old_salary;
      if (interviewData.offer_salary === null) delete interviewData.offer_salary;
      if (interviewData.monthly_salary_offered === null) delete interviewData.monthly_salary_offered;
      
      // Duplicate was already checked inline on phone input — proceed with creation
      await createInterviewDirectly(interviewData);
      
    } catch (error) {
      alert(`Failed to create interview: ${error.message}`);
      setLoading(false);
    }
  };

  const createInterviewDirectly = async (interviewData) => {
    try {
      const newInterview = await API.interviews.createInterview(interviewData);
      const iid = newInterview._id || newInterview.id || (newInterview.data && (newInterview.data._id || newInterview.data.id));
      setCreatedInterviewId(iid);
      setCreatedInterviewData(newInterview);
      setFormStep(2);
      // Load any existing attachments (shouldn't be any, but just in case)
      if (iid) {
        try {
          const attRes = await API.interviews.getAttachments(iid);
          if (attRes.success) setAttachments(attRes.data || []);
        } catch (_) {}
      }
    } catch (error) {
      alert('Error creating interview: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Attachment handlers for step 2
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !createdInterviewId) return;
    setUploading(true);
    try {
      const res = await API.interviews.uploadAttachment(createdInterviewId, file, file.name);
      if (res.success) {
        const attRes = await API.interviews.getAttachments(createdInterviewId);
        if (attRes.success) setAttachments(attRes.data || []);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attId) => {
    if (!createdInterviewId) return;
    try {
      await API.interviews.deleteAttachment(createdInterviewId, attId);
      setAttachments(prev => prev.filter(a => a.id !== attId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleFinish = async () => {
    await onInterviewCreated(createdInterviewData);
    onClose();
  };

  const drawerInputCls = "w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none transition-all";
  const canSubmit = formData.mobile_number.length >= 10 && formData.interview_date && formData.candidate_name.trim();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl flex flex-col shadow-2xl max-h-[90vh]"
        style={{ animation: 'scaleIn 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-indigo-900 rounded-t-2xl flex justify-between items-center shrink-0">
          <div>
            <h2 className="font-black text-white text-lg flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
              {formStep === 1 ? 'Add Candidate' : 'Attachments'}
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {formStep === 1 ? 'Step 1 of 2 — Candidate details' : 'Step 2 of 2 — Upload documents'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicator dots */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${formStep === 1 ? 'bg-white' : 'bg-white/40'}`}></div>
              <div className={`w-2 h-2 rounded-full ${formStep === 2 ? 'bg-white' : 'bg-white/40'}`}></div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-50 space-y-4">

        {formStep === 1 && (<>
          {/* ── Phone Check ── */}
          <div className="bg-white border-2 border-indigo-200 rounded-2xl p-4">
            <label className="block text-xs font-black text-indigo-600 uppercase tracking-wider mb-2">
              📱 Phone Number <span className="text-red-400">*</span>
            </label>
            <input
              name="mobile_number"
              value={formData.mobile_number}
              onChange={handlePhoneCheck}
              className="w-full bg-indigo-50 border border-indigo-200 focus:bg-white focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-900 text-base font-bold outline-none transition-all tracking-widest"
              placeholder="Enter 10-digit mobile"
              maxLength="10"
              inputMode="numeric"
            />
            {formData.mobile_number.length > 0 && formData.mobile_number.length < 10 && (
              <p className="text-xs text-amber-600 mt-1 font-medium">Enter full 10-digit number</p>
            )}
            {errors.mobile_number && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.mobile_number}</p>
            )}
          </div>

          {/* ── Inline Duplicate Match Card (matching HTML design) ── */}
          {checkingDuplicate && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
              <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-xs text-slate-500">Checking for duplicates...</p>
            </div>
          )}
          {duplicateMatch && (() => {
            const stageMeta = { Interview:{bg:'bg-blue-600'}, 'Round 2':{bg:'bg-indigo-600'}, 'Job Offered':{bg:'bg-orange-500'}, Training:{bg:'bg-yellow-500'}, Hired:{bg:'bg-emerald-600'}, Rejected:{bg:'bg-red-600'} };
            const matchStage = getStageFromStatus(duplicateMatch.status);
            const sm = stageMeta[matchStage] || {bg:'bg-slate-600'};
            const activities = duplicateMatch.activity_history || duplicateMatch.activityHistory || [];
            const ownerName = duplicateMatch.created_by || duplicateMatch.hr || 'N/A';
            const createdDate = duplicateMatch.created_at ? new Date(duplicateMatch.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'N/A';
            const updatedDate = duplicateMatch.updated_at ? new Date(duplicateMatch.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'N/A';
            const reassignCount = duplicateMatch.reassign_count || duplicateMatch.reassignCount || 0;
            const rescheduleCount = duplicateMatch.reschedule_count || duplicateMatch.rescheduleCount || 0;
            return (
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-xl font-black">{(duplicateMatch.candidate_name || 'U').charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-black text-white">{duplicateMatch.candidate_name || 'Unknown'}</h3>
                        <span className={`text-[11px] font-black text-white px-2.5 py-1 rounded-full ${sm.bg}`}>{matchStage}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-slate-400">📱 {duplicateMatch.mobile_number}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-slate-400">{duplicateMatch.job_opening || duplicateMatch.role || 'N/A'}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-slate-400">{duplicateMatch.experience_type || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-800/90 px-5 py-3 grid grid-cols-3 gap-4 text-xs">
                  <div><div className="text-slate-500 uppercase text-[10px] font-bold mb-0.5">Owner</div><div className="text-white font-bold">{ownerName}</div></div>
                  <div><div className="text-slate-500 uppercase text-[10px] font-bold mb-0.5">Created</div><div className="text-white font-medium">{createdDate}</div></div>
                  <div><div className="text-slate-500 uppercase text-[10px] font-bold mb-0.5">Last Updated</div><div className="text-white font-medium">{updatedDate}</div></div>
                </div>
                {matchStage === 'Rejected' && duplicateMatch.status && (
                  <div className="bg-red-50 border-b border-red-200 px-5 py-3 flex items-center gap-3">
                    <XCircle size={16} className="text-red-500 shrink-0"/>
                    <div><div className="text-[10px] font-black text-red-600 uppercase tracking-wider">Rejection Reason</div><div className="text-sm font-semibold text-red-800">{duplicateMatch.status}</div></div>
                  </div>
                )}
                <div className="bg-white border-b border-slate-200 px-5 py-3 flex gap-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-600"><RefreshCw size={12}/> {reassignCount} Reassign{reassignCount !== 1 ? 's' : ''}</div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600"><Calendar size={12}/> {rescheduleCount} Reschedule{rescheduleCount !== 1 ? 's' : ''}</div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600"><History size={12}/> {activities.length} Activity</div>
                </div>
                <div className="bg-white px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Activity History</div>
                    {activities.length > 3 && <button onClick={() => setShowDuplicateDetails(!showDuplicateDetails)} className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">{showDuplicateDetails ? <><ChevronDown size={12}/> Less</> : <><ChevronRight size={12}/> +{activities.length - 3} more</>}</button>}
                  </div>
                  {activities.length === 0 && <div className="text-xs text-slate-400 italic py-2">No activity logged.</div>}
                  <div className="space-y-2">{(showDuplicateDetails ? activities : activities.slice(-3)).map((log, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between gap-2"><span className="font-bold text-slate-700">{log.action}</span><span className="text-slate-400 text-[10px] shrink-0">{log.date || (log.timestamp ? new Date(log.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')}</span></div>
                        <div className="text-slate-500 mt-0.5">{log.details || log.description || ''}</div>
                      </div>
                    </div>
                  ))}</div>
                </div>
                <div className="px-5 py-5 bg-slate-50 border-t border-slate-200">
                  {canReassign ? (
                    <div>
                      <div className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Re-assign to Me <span className="text-red-500">*</span></div>
                      <textarea value={reassignReason} onChange={e => setReassignReason(e.target.value)} placeholder="Enter mandatory audit reason..." className="w-full h-20 bg-white border border-slate-300 rounded-xl p-3 text-sm text-slate-900 outline-none mb-3 focus:border-blue-500 resize-none" />
                      <button disabled={!reassignReason.trim() || loading} onClick={handleReassign} className={`w-full py-3 rounded-xl font-black text-sm transition-all ${reassignReason.trim() && !loading ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                        {loading ? 'Submitting...' : 'Transfer Lead to Me'}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-4">
                      <Lock size={22} className="text-red-500 mt-0.5 shrink-0"/>
                      <div><div className="text-sm font-black text-red-700">Lead is Locked</div><div className="text-xs text-red-600/80 mt-1 leading-relaxed"><b>{ownerName}</b> recently updated this lead. {cooldownDays}-day cooldown active.</div></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Main form (shown after phone entered, hidden when duplicate found) ── */}
          {!duplicateMatch && formData.mobile_number.length >= 10 && (
            <form id="create-interview-drawer" onSubmit={handleSubmit} className="space-y-4">

              {/* ── Basic Info ── */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-slate-50 flex items-center gap-2">
                  <span className="text-base">👤</span>
                  <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">Basic Info</span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Candidate Name <span className="text-red-400">*</span></label>
                    <input name="candidate_name" value={formData.candidate_name} onChange={handleInputChange}
                      className={errors.candidate_name ? drawerInputCls + ' border-red-400' : drawerInputCls}
                      placeholder="Full name" />
                    {errors.candidate_name && <p className="text-xs text-red-500 mt-1">{errors.candidate_name}</p>}
                  </div>
                  {/* Interview Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Interview Date <span className="text-red-400">*</span></label>
                    <input type="date" name="interview_date" value={formData.interview_date} onChange={handleInputChange}
                      className={errors.date_time ? drawerInputCls + ' border-red-400' : drawerInputCls} />
                    {errors.date_time && <p className="text-xs text-red-500 mt-1">{errors.date_time}</p>}
                  </div>
                  {/* Alternate Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Alt. Phone</label>
                    <input name="alternate_number" value={formData.alternate_number} onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData(prev => ({ ...prev, alternate_number: val }));
                    }}
                      className={errors.alternate_number ? drawerInputCls + ' border-red-400' : drawerInputCls}
                      placeholder="Optional" maxLength="10" inputMode="numeric" />
                    {errors.alternate_number && <p className="text-xs text-red-500 mt-1">{errors.alternate_number}</p>}
                  </div>
                  {/* Source */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Source</label>
                    <SearchableSelect
                      name="source_portal"
                      value={formData.source_portal}
                      onChange={handleInputChange}
                      options={sourcePortalOptions}
                      placeholder="Select source..."
                    />
                  </div>
                  {/* Age */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Age</label>
                    <input type="number" name="age" value={formData.age} onChange={handleInputChange}
                      className={drawerInputCls} placeholder="e.g. 24" min="18" max="65" />
                  </div>
                  {/* City */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">City</label>
                    <input name="city" value={formData.city} onChange={handleInputChange}
                      className={drawerInputCls} placeholder="Current city" />
                  </div>
                  {/* Gender toggle */}
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Gender <span className="text-red-400">*</span></label>
                    <div className="flex gap-2">
                      {['Male', 'Female'].map(g => (
                        <label key={g} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 cursor-pointer transition-all font-bold text-sm ${formData.gender === g ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                          <input type="radio" name="gender" value={g} checked={formData.gender === g} onChange={handleInputChange} className="hidden" />
                          {g === 'Male' ? '👨' : '👩'} {g}
                        </label>
                      ))}
                    </div>
                    {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
                  </div>
                </div>
              </div>

              {/* ── Education & Background ── */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-slate-50 flex items-center gap-2">
                  <span className="text-base">🎓</span>
                  <span className="text-xs font-black text-purple-700 uppercase tracking-wider">Education & Background</span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  {/* Marital Status */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Marital Status</label>
                    <select name="marital_status" value={formData.marital_status} onChange={handleInputChange} className={drawerInputCls}>
                      <option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
                    </select>
                  </div>
                  {/* Living Arrangement */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Living Arrangement</label>
                    <select name="living_arrangement" value={formData.living_arrangement} onChange={handleInputChange} className={drawerInputCls}>
                      <option>With Family</option><option>PG/Hostel</option><option>Rented Alone</option><option>Shared Apartment</option><option>Own House</option>
                    </select>
                  </div>
                  {/* Qualification — searchable grouped */}
                  <div className="col-span-2 grid grid-cols-[1fr_auto] gap-3 items-start">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Highest Qualification <span className="text-red-400">*</span></label>
                      <div className="relative" ref={qualRef}>
                        <input
                          value={qualSearch !== '' ? qualSearch : formData.qualification}
                          onChange={e => { const val = e.target.value; setQualSearch(val); setQualOpen(true); setFormData(prev => ({ ...prev, qualification: val, qualificationLevel: '' })); if (errors.qualification && val) setErrors(prev => ({ ...prev, qualification: '' })); }}
                          onFocus={() => { setQualSearch(''); setQualOpen(true); }}
                          placeholder="Type to search e.g. MBA, BA, ITI..."
                          className={errors.qualification ? drawerInputCls + ' border-red-400' : drawerInputCls}
                        />
                        {formData.qualificationLevel && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full pointer-events-none">{formData.qualificationLevel}</div>
                        )}
                        {qualOpen && filteredQualGroups.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto">
                            {filteredQualGroups.map(group => (
                              <div key={group.level}>
                                <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100 sticky top-0">{group.level}</div>
                                {group.entries.map(entry => (
                                  <button type="button" key={entry} onClick={() => selectQualification(entry, group.level)}
                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                    {entry}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {errors.qualification && <p className="text-xs text-red-500 mt-1">{errors.qualification}</p>}
                    </div>
                    <div className="w-36">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                      <select name="qualification_status" value={formData.qualification_status || ''} onChange={handleInputChange} className={drawerInputCls}>
                        <option value="">Select...</option>
                        <option value="Pursuing">Pursuing</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>
                  {/* Banking experience toggle */}
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Banking Experience?</label>
                    <div className="flex gap-2">
                      {['Yes', 'No'].map(opt => (
                        <label key={opt} className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border-2 cursor-pointer transition-all font-bold text-sm ${formData.banking_experience === opt ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                          <input type="radio" name="banking_experience" value={opt} checked={formData.banking_experience === opt} onChange={handleInputChange} className="hidden" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Professional Details ── */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 flex items-center gap-2">
                  <span className="text-base">💼</span>
                  <span className="text-xs font-black text-blue-700 uppercase tracking-wider">Professional Details</span>
                </div>
                <div className="p-4 space-y-3">
                  {/* Role */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Role</label>
                    <SearchableSelect
                      name="job_opening"
                      value={formData.job_opening}
                      onChange={handleInputChange}
                      options={jobOpeningOptions}
                      placeholder="Select role..."
                    />
                  </div>
                  {/* Work Experience toggle */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Work Experience</label>
                    <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-xl mb-2">
                      {['fresher', 'experienced'].map(type => (
                        <button type="button" key={type} onClick={() => setFormData(prev => ({ ...prev, experience_type: type }))}
                          className={`flex-1 py-2 text-xs font-black rounded-lg transition-all capitalize ${formData.experience_type === type ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formData.experience_type === 'experienced' && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                          Experience Duration — <span className="text-indigo-700 font-black">{expLabel}</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Years</label>
                            <select value={formData.yearsExpNum} onChange={e => setFormData(prev => ({ ...prev, yearsExpNum: parseInt(e.target.value) || 0 }))} className={drawerInputCls}>
                              {Array.from({ length: 31 }, (_, i) => <option key={i} value={i}>{i} yr{i !== 1 ? 's' : ''}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Months</label>
                            <select value={formData.monthsExpNum} onChange={e => setFormData(prev => ({ ...prev, monthsExpNum: parseInt(e.target.value) || 0 }))} className={drawerInputCls}>
                              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i} mo</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">No. of Companies Worked</label>
                        <input type="number" min="1" value={formData.numCompanies} onChange={handleNumCompaniesChange} className={drawerInputCls} placeholder="e.g. 2" />
                      </div>
                      {formData.companies.map((comp, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                          <div className="text-xs font-black text-slate-500 uppercase tracking-wider">Company #{idx + 1}</div>
                          <div className="grid grid-cols-3 gap-2">
                            <input value={comp.name || ''} onChange={e => handleCompanyChange(idx, 'name', e.target.value)} placeholder="Company Name" className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 w-full" />
                            <input value={comp.duration || ''} onChange={e => handleCompanyChange(idx, 'duration', e.target.value)} placeholder="Duration" className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 w-full" />
                            <input value={comp.salary || ''} onChange={e => handleCompanyChange(idx, 'salary', e.target.value)} placeholder="Last CTC" className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 w-full" />
                          </div>
                        </div>
                      ))}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Proof of Experience (Check all available)</label>
                        <div className="flex gap-3 flex-wrap">
                          {[['salarySlip', '💰 Salary Slip'], ['bankStatement', '🏦 Bank Statement'], ['expLetter', '📄 Exp. Letter']].map(([doc, lbl]) => (
                            <label key={doc} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all text-xs font-bold ${formData.documents[doc] ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                              <input type="checkbox" checked={formData.documents[doc]} onChange={() => handleDocChange(doc)} className="hidden" />
                              {lbl}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Salary Information ── */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-slate-50 flex items-center gap-2">
                  <span className="text-base">💵</span>
                  <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">Salary Information</span>
                </div>
                <div className="p-4 grid grid-cols-1 gap-3">
                  {[
                    { label: 'Last Salary (Monthly CTC)', name: 'old_salary' },
                    { label: 'Salary Expectation (Monthly CTC)', name: 'offer_salary' },
                    { label: 'Final Offered Salary (fill after offer)', name: 'monthly_salary_offered' }
                  ].map(({ label, name }) => (
                    <div key={name}>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold pointer-events-none">₹</span>
                        <input
                          type="number"
                          name={name}
                          value={formData[name]}
                          onChange={handleInputChange}
                          className={drawerInputCls + ' pl-7'}
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </form>
          )}
        </>)}

        {/* ── Step 2: Attachments ── */}
        {formStep === 2 && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg">✓</div>
              <div>
                <div className="text-sm font-black text-emerald-800">Candidate Saved Successfully</div>
                <div className="text-xs text-emerald-600 mt-0.5">Now upload any supporting documents</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-slate-50 flex items-center gap-2">
                <span className="text-base">📎</span>
                <span className="text-xs font-black text-amber-700 uppercase tracking-wider">Attachments</span>
                <span className="ml-auto text-[10px] font-bold text-slate-400">{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-slate-500">Upload offer letters, previous company documents, or any other relevant files. You can add multiple files one by one.</p>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Uploading...</>
                  ) : (
                    <><Upload size={16}/> Choose File to Upload</>
                  )}
                </button>

                {/* Attachment list */}
                {attachments.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {attachments.map((att, idx) => (
                      <div key={att.id} className="group flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 hover:border-slate-300 transition-all">
                        <span className="text-xs font-black text-slate-400 w-5">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-700 truncate">{att.original_name || att.file_name}</div>
                          <div className="text-[10px] text-slate-400">
                            {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : ''}
                            {att.uploaded_at ? ` • ${new Date(att.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}` : ''}
                          </div>
                        </div>
                        <a
                          href={API.interviews.getAttachmentDownloadUrl(createdInterviewId, att.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-500 hover:text-indigo-700 p-1"
                          title="Download"
                        >
                          <Download size={14}/>
                        </a>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        </div>

        {/* ── Footer ── */}
        {formStep === 1 && !duplicateMatch && formData.mobile_number.length >= 10 && (
          <div className="p-4 border-t border-slate-200 bg-white rounded-b-2xl shrink-0">
            <button
              type="submit"
              form="create-interview-drawer"
              disabled={loading || !canSubmit}
              className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${(canSubmit && !loading) ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-600/25' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  Saving Candidate...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                  Save &amp; Continue →
                </>
              )}
            </button>
          </div>
        )}
        {formStep === 2 && (
          <div className="p-4 border-t border-slate-200 bg-white rounded-b-2xl shrink-0">
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/25"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewPanel;
