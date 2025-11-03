import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Search, Filter, CheckSquare, Plus, Eye, Edit, Trash2, User, Building, CreditCard, FileText, UserCheck, ChevronRight, Settings, X, Square, Users, CheckCircle, AlertTriangle, XCircle, Edit2, ListTodo, Calendar, Copy, Clock, DollarSign } from 'lucide-react';
import { message } from 'antd';
import { 
    AboutSection,
    HowToProcessSection,
    ImportantQuestionsSection,
    LoginFormSection,
    ObligationSection,
    Attachments,
    TaskComponent,
    LeadActivity,
    CopyLeadSection,
    RemarkSection,
    FileSentToLoginSection,
    ReassignmentPanel,
    RequestReassignmentButton,
    LazySection
} from './LazyLeadSections';
import { canApproveLeadReassignment } from '../utils/permissions';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// Status card configuration for LeadCRM
const statusCardConfig = [
    {
        key: "Not a lead",
        label: "NOT A LEAD",
        icon: XCircle,
        gradient: "from-gray-500 to-gray-400",
        shadowColor: "shadow-gray-500/25",
    },
    {
        key: "Active Leads",
        label: "ACTIVE LEADS",
        icon: Users,
        gradient: "from-blue-500 to-cyan-400",
        shadowColor: "shadow-blue-500/25",
    },
    {
        key: "File sent to login",
        label: "FILE SENT TO LOGIN",
        icon: FileText,
        gradient: "from-green-500 to-green-400",
        shadowColor: "shadow-indigo-500/25",
    },
    {
        key: "Lost By mistake",
        label: "LOST BY MISTAKE",
        icon: AlertTriangle,
        gradient: "from-orange-500 to-amber-400",
        shadowColor: "shadow-orange-500/25",
    },
    {
        key: "Lost login",
        label: "LOST LEAD",
        icon: XCircle,
        gradient: "from-red-500 to-pink-400",
        shadowColor: "shadow-red-500/25",
    },
];

const COLUMN_SELECT_OPTIONS = {
    status: [
        "Not a lead",
        "Active Leads",
        "Disbursed",
        "Lost By Mistake",
        "Lost Lead",
        "Call Not Picked",
        "Fresh Lead",
        "Converted",
        "Rejected",
        "Follow Up",
        "Interested",
        "Not Interested",
        "Callback",
        "Eligible",
        "Document Pending",
        "Proposal Sent",
        "Proposal Approved",
        "Proposal Rejected",
        "Proposal Under Review",
        "Completed",
        "Cancelled",
        "On Hold",
        "Verification Pending",
        "Verification Completed",
        "Verification Failed",
        "Application Submitted",
        "Application Approved",
        "Application Rejected",
        "Application Under Review"
    ]
};

const LeadCRM = memo(function LeadCRM({ user, selectedLoanType: initialLoanType, department = "leads" }) {
    const [loanTypes, setLoanTypes] = useState([]);
    // Get the selected loan type from localStorage (set by Sidebar) or from props
    const [selectedLoanType, setSelectedLoanType] = useState(() => {
        // ONLY use the Lead CRM specific loan type ID, never the shared one
        return initialLoanType || localStorage.getItem('leadCrmLoanTypeId') || 'all';
    });
    const [leads, setLeads] = useState([]);
    const [filteredLeads, setFilteredLeads] = useState([]);
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedSubStatus, setSelectedSubStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [importantQuestions, setImportantQuestions] = useState([]);
    const [questionResponses, setQuestionResponses] = useState({});
    const [bankOptions, setBankOptions] = useState(["HDFC", "ICICI", "SBI", "Axis"]); // Default banks, will be fetched from backend

    // Status dropdown state - moved here to be available for useEffect
    const [showStatusDropdown, setShowStatusDropdown] = useState(null); // Track which row's dropdown is open
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, maxHeight: 350 });
    const [statusSearchTerm, setStatusSearchTerm] = useState('');  // Search term for status dropdown

    // State for hierarchical dropdown navigation
    const [selectedMainStatus, setSelectedMainStatus] = useState(null); // Track which main status is selected in dropdown
    const [showMainStatuses, setShowMainStatuses] = useState(true); // Toggle between main statuses and sub-statuses view
    const [clickedStatusOption, setClickedStatusOption] = useState(null); // Track which status option is currently clicked/selected

    // Permission state
    const [permissions, setPermissions] = useState({});
    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [userRoleId, setUserRoleId] = useState(null);

    const userId = localStorage.getItem('userId');

    // Permission helper functions - Enhanced to support multiple permission formats
    const hasLeadsPermission = (permission) => {

        // If permissions is null/undefined, return false
        if (!permissions) {
            return false;
        }

        // SPECIAL CASE: Always return true for 'show' if permission loading is still in progress
        // This prevents flashing error messages while permissions are being loaded
        if (permission === 'show' && permissionsLoading) {
            return true;
        }

        // For backward compatibility: handle the case where permission may be 'view'
        // and map it to the more specific permissions
        if (permission === 'view') {
            return hasLeadsPermission('own') ||
                hasLeadsPermission('view_other') ||
                hasLeadsPermission('all') ||
                hasLeadsPermission('junior') ||
                hasLeadsPermission('show');
        }

        // Check for super admin permissions first (all formats)
        if (
            permissions['Global'] === '*' ||
            permissions['global'] === '*' ||
            (permissions['pages'] === '*' && permissions['actions'] === '*') ||
            permissions['*'] === '*'
        ) {
            return true;
        }

        // Check for permissions array with objects (new permission format)
        if (Array.isArray(permissions)) {

            for (const perm of permissions) {
                // Skip invalid permission entries
                if (!perm || !perm.page) continue;

                // Check if this is a leads permission entry
                if (perm.page === 'Leads' || perm.page === 'leads') {

                    // Check if actions is a wildcard
                    if (perm.actions === '*') {
                        return true;
                    }

                    // Check if actions is an array containing the permission or show (special case)
                    if (Array.isArray(perm.actions)) {
                        // Handle 'show' permission - if requesting 'show' or if they have show + any view permission
                        if (permission === 'show' && perm.actions.includes('show')) {
                            return true;
                        }

                        // Check for wildcard in actions array
                        if (perm.actions.includes('*')) {
                            return true;
                        }

                        // Check for specific permission
                        if (perm.actions.includes(permission)) {
                            return true;
                        }

                        // Special case - if asking for a view permission and they have any view permission
                        if ((permission === 'own' || permission === 'view_other' ||
                            permission === 'all' || permission === 'junior') &&
                            (perm.actions.includes('own') || perm.actions.includes('view_other') ||
                                perm.actions.includes('all') || perm.actions.includes('junior'))) {
                            return true;
                        }
                    }

                    // Check if actions is a string matching the permission
                    if (typeof perm.actions === 'string' && perm.actions === permission) {
                        return true;
                    }
                }

                // Check for global permission
                if ((perm.page === '*' || perm.page === 'any' || perm.page === 'Global') &&
                    (perm.actions === '*' ||
                        (Array.isArray(perm.actions) &&
                            (perm.actions.includes('*') || perm.actions.includes(permission))))) {
                    return true;
                }
            }
        }

        // Check legacy formats
        // Check both capitalized and lowercase versions
        const leadsUpper = permissions['Leads'];
        const leadsLower = permissions['leads'];

        // Check if permissions are wildcard first
        if (leadsUpper === '*' || leadsLower === '*') {
            return true;
        }

        // Check if the permissions are arrays before calling includes()
        const hasPermInUpper = Array.isArray(leadsUpper) &&
            (leadsUpper.includes(permission) || leadsUpper.includes('*'));
        const hasPermInLower = Array.isArray(leadsLower) &&
            (leadsLower.includes(permission) || leadsLower.includes('*'));

        // Handle object format permissions (used in newer permission structure)
        const hasPermInUpperObj = typeof leadsUpper === 'object' &&
            !Array.isArray(leadsUpper) &&
            (leadsUpper?.[permission] === true || leadsUpper?.['*'] === true);
        const hasPermInLowerObj = typeof leadsLower === 'object' &&
            !Array.isArray(leadsLower) &&
            (leadsLower?.[permission] === true || leadsLower?.['*'] === true);

        const hasPermission = hasPermInUpper || hasPermInLower || hasPermInUpperObj || hasPermInLowerObj;
        return hasPermission;
    };

    const canCreateLead = () => hasLeadsPermission('create');
    const canShowLeads = () => hasLeadsPermission('show');
    const canAssignLeads = () => hasLeadsPermission('assign');
    const canViewOwnLeads = () => hasLeadsPermission('own');
    const canViewOtherLeads = () => hasLeadsPermission('view_other');
    const canViewAllLeads = () => hasLeadsPermission('all');
    const canViewJuniorLeads = () => hasLeadsPermission('junior');

    // Check if user is Super Admin with specific role ID or Super Admin permissions
    const isSuperAdmin = () => {
        // First check if we have userRoleId from permissions API
        if (userRoleId === "685292be8d7cdc3a71c4829b") {
            return true;
        }
        
        // Check for Super Admin permissions (page: "*" and actions: "*")
        if (Array.isArray(permissions)) {
            const hasSuperAdminPermissions = permissions.some(perm => 
                perm.page === "*" && (perm.actions === "*" || 
                (Array.isArray(perm.actions) && perm.actions.includes("*")))
            );
            if (hasSuperAdminPermissions) {
                return true;
            }
        }
        
        // Check for super admin permissions in object format
        if (permissions && typeof permissions === 'object') {
            if (permissions['*'] === '*' || 
                permissions['Global'] === '*' || 
                permissions['global'] === '*' ||
                (permissions['pages'] === '*' && permissions['actions'] === '*')) {
                return true;
            }
        }
        
        // Fallback: check userData from localStorage (set during login)
        try {
            const storedUserData = localStorage.getItem('userData');
            if (storedUserData) {
                const userData = JSON.parse(storedUserData);
                
                // Check role ID
                if (userData.role?._id === "685292be8d7cdc3a71c4829b" || 
                    userData.role?.id === "685292be8d7cdc3a71c4829b") {
                    return true;
                }
                
                // Check permissions in userData
                if (userData.permissions && Array.isArray(userData.permissions)) {
                    const hasSuperAdminPermissions = userData.permissions.some(perm => 
                        perm.page === "*" && (perm.actions === "*" || 
                        (Array.isArray(perm.actions) && perm.actions.includes("*")))
                    );
                    if (hasSuperAdminPermissions) {
                        return true;
                    }
                }
                
                // Check permissions in object format in userData
                if (userData.permissions && typeof userData.permissions === 'object') {
                    if (userData.permissions['*'] === '*' || 
                        userData.permissions['Global'] === '*' || 
                        userData.permissions['global'] === '*' ||
                        (userData.permissions['pages'] === '*' && userData.permissions['actions'] === '*')) {
                        return true;
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing userData from localStorage:', error);
        }
        
        return false;
    };

    // Load user permissions
    const loadPermissions = async () => {
        try {
            // Don't try to load permissions if userId is not available
            if (!userId) {
                throw new Error('User ID is required to load permissions');
            }

            // First try to get permissions and role ID from localStorage
            const storedPermissions = localStorage.getItem('userPermissions');
            const storedRoleId = localStorage.getItem('userRoleId');
            
            // Also check for role ID in userData (from login process)
            let roleIdFromUserData = null;
            try {
                const storedUserData = localStorage.getItem('userData');
                if (storedUserData) {
                    const userData = JSON.parse(storedUserData);
                    roleIdFromUserData = userData.role?._id || userData.role?.id;
                }
            } catch (error) {
                console.error('Error parsing userData for role ID:', error);
            }
            
            if (storedPermissions && (storedRoleId || roleIdFromUserData)) {
                try {
                    const parsedPermissions = JSON.parse(storedPermissions);
                    setPermissions(parsedPermissions);
                    // Use stored role ID or fallback to userData role ID
                    const effectiveRoleId = storedRoleId || roleIdFromUserData;
                    if (effectiveRoleId) {
                        setUserRoleId(effectiveRoleId);
                        // Store role ID for future use if it came from userData
                        if (!storedRoleId && roleIdFromUserData) {
                            localStorage.setItem('userRoleId', roleIdFromUserData);
                        }
                    }
                    setPermissionsLoading(false);
                    return parsedPermissions;
                } catch (parseError) {
                    // Clear corrupt data
                    localStorage.removeItem('userPermissions');
                    localStorage.removeItem('userRoleId');
                }
            }

            // Fallback to API if localStorage is empty or parsing failed
            const response = await fetch(`${API_BASE_URL}/users/permissions/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch permissions: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Extract role ID from response
            let roleId = null;
            if (data.role && data.role._id) {
                roleId = data.role._id;
            } else if (data.role_id) {
                roleId = data.role_id;
            }

            // Handle different permission formats
            let formattedPermissions;

            // Handle array format (new format directly returned by backend)
            if (Array.isArray(data)) {
                formattedPermissions = data;
            }
            // Handle permissions property containing array
            else if (Array.isArray(data.permissions)) {
                formattedPermissions = data.permissions;
            }
            // Handle permissions property containing object
            else if (data.permissions && typeof data.permissions === 'object') {
                formattedPermissions = data.permissions;
            }
            // Handle role permissions from direct response
            else if (data.role && data.role.permissions) {
                formattedPermissions = data.role.permissions;
            }
            // Message from backend with no permissions
            else if (data.message && !data.permissions) {
                // Create empty permissions object to avoid errors
                formattedPermissions = [];
                message.warning(`Permission issue: ${data.message}`);
            }
            // Fallback - use raw data
            else {
                formattedPermissions = data;
            }

            // Store in localStorage for future use
            localStorage.setItem('userPermissions', JSON.stringify(formattedPermissions));
            if (roleId) {
                localStorage.setItem('userRoleId', roleId);
                setUserRoleId(roleId);
            }

            setPermissions(formattedPermissions);
            return formattedPermissions;
        } catch (error) {
            message.error(`Failed to load permissions: ${error.message}`);
            return null;
        } finally {
            setPermissionsLoading(false);
        }
    };

    useEffect(() => {
        loadPermissions()
            .then(() => {
            })
            .catch(err => {
                message.error('Failed to load user permissions');
            });
    }, [userId]);

    // Check if user has any leads permissions and show error if not
    useEffect(() => {
        if (!permissionsLoading) {

            // Check if user has any leads viewing permission
            const hasAnyViewPermission =
                canViewOwnLeads() ||
                canViewOtherLeads() ||
                canViewAllLeads() ||
                canViewJuniorLeads() ||
                hasLeadsPermission('show');

            if (!hasAnyViewPermission) {
                message.error('You do not have permission to view leads');
                setError('You do not have permission to view leads');
            } else {
                // Clear error if previously set
                if (error === 'You do not have permission to view leads') {
                    setError('');
                }
            }
        }
    }, [permissions, permissionsLoading]);

    // ULTRA-FAST LOADING: Critical path initialization for 0.1-second target
    useEffect(() => {
        const startTime = performance.now();

        // IMMEDIATE: Start loading essential data in parallel (no permission checks initially)
        const initializeEssentials = async () => {
            try {
                // Start essential loads in parallel immediately
                const essentialPromises = [
                    loadLeads(), // Priority 1: Load leads immediately
                    loadLoanTypes(), // Priority 2: Load loan types
                    loadStatusesAndSubStatuses() // Priority 3: Load statuses with sub-statuses
                ];

                // Wait for critical data (leads) - don't wait for everything
                await essentialPromises[0]; // Only wait for leads

                const loadTime = performance.now() - startTime;

                // Continue loading other essentials in background
                Promise.all(essentialPromises.slice(1)).then(() => {
                    const totalTime = performance.now() - startTime;
                });

            } catch (error) {
            }
        };

        // Start immediately without waiting for permissions
        initializeEssentials();
    }, []); // Empty dependency array - run once on mount

    // ⚡ PERFORMANCE: Memoized loan type change handler
    const handleLeadCrmLoanTypeChange = useCallback((event) => {
        const { loanTypeId, loanTypeName } = event.detail;
        setSelectedLoanType(loanTypeId);

        // Store in Lead CRM specific localStorage key
        localStorage.setItem('leadCrmLoanTypeId', loanTypeId);
        if (loanTypeName) {
            localStorage.setItem('leadCrmLoanTypeName', loanTypeName);
        }
    }, []);

    // Listen for loan type changes from sidebar - ONLY FOR LEAD CRM
    useEffect(() => {
        // ONLY listen for Lead CRM specific event
        window.addEventListener('leadCrmLoanTypeChanged', handleLeadCrmLoanTypeChange);

        // Check if there's a saved loan type specifically for Lead CRM
        const savedLoanType = localStorage.getItem('leadCrmLoanTypeId');

        if (savedLoanType) {
            setSelectedLoanType(savedLoanType);
        }

        return () => {
            window.removeEventListener('leadCrmLoanTypeChanged', handleLeadCrmLoanTypeChange);
        };
    }, [handleLeadCrmLoanTypeChange]);

    // Handle dropdown outside click and scroll events
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if click is outside the dropdown
            // Only close if it's an actual outside click, not a click on the dropdown content or internal scroll
            if (showStatusDropdown !== null && 
                !event.target.closest('.status-dropdown-container') &&
                !event.target.closest('.status-dropdown-menu')) {
                handleCloseStatusDropdown();
            }
        };

        // Only handle document level scrolling, not internal dropdown scrolling
        const handleScroll = (event) => {
            // Only close dropdown when scrolling the main document, not when scrolling the dropdown content
            if (showStatusDropdown !== null && 
                !event.target.closest('.status-dropdown-menu') && 
                !event.target.closest('.status-dropdown-container')) {
                handleCloseStatusDropdown();
            }
        };

        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && showStatusDropdown !== null) {
                handleCloseStatusDropdown();
            }
        };

        // Add event listeners
        document.addEventListener('mousedown', handleClickOutside);
        // Use passive: true for better performance
        document.addEventListener('scroll', handleScroll, { capture: false, passive: true });
        document.addEventListener('keydown', handleEscapeKey);

        // Cleanup function
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('scroll', handleScroll, { capture: false, passive: true });
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [showStatusDropdown]);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedLead, setSelectedLead] = useState(null);
    const [showLeadDetails, setShowLeadDetails] = useState(false);

    // New state for filter drawer
    const [showFilters, setShowFilters] = useState(false);

    // Additional filter states
    const [selectedTeam, setSelectedTeam] = useState('all');
    const [selectedCampaign, setSelectedCampaign] = useState('all');
    const [selectedCompanyCategory, setSelectedCompanyCategory] = useState('all');
    const [selectedDateRange, setSelectedDateRange] = useState('all');
    const [salaryRange, setSalaryRange] = useState({ min: '', max: '' });
    const [loanAmountRange, setLoanAmountRange] = useState({ min: '', max: '' });

    // New states for PLOD features
    const [editRow, setEditRow] = useState(null);
    const [editedLeads, setEditedLeads] = useState([]);
    const [checkboxVisible, setCheckboxVisible] = useState(false);
    const [checkedRows, setCheckedRows] = useState([]);
    const [activeTab, setActiveTab] = useState(0);
    const [openSections, setOpenSections] = useState([]); // Changed to array to allow multiple sections open
    const rowRefs = useRef({});

    // Filter popup states
    const [showFilterPopup, setShowFilterPopup] = useState(false);
    const [selectedFilterCategory, setSelectedFilterCategory] = useState('leadDate');
    // Get current month date range
    const getCurrentMonthRange = () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        return {
            from: firstDay.toISOString().split('T')[0], // YYYY-MM-DD format
            to: lastDay.toISOString().split('T')[0]
        };
    };

    const currentMonth = getCurrentMonthRange();

    const [filterOptions, setFilterOptions] = useState({
        leadStatus: '',
        dateFrom: '',
        dateTo: '',
        leadDateFrom: '', // Remove default current month filter
        leadDateTo: '',   // Remove default current month filter
        teamName: [],  // Changed to array for multi-select
        campaignName: '',
        createdBy: [],  // Changed to array for multi-select
        noActivityFrom: '',
        noActivityTo: '',
        leadParentStatus: [],  // Changed to array for multi-select
        leadAllStatus: [],  // Changed to array for multi-select
        assignedTL: [],  // Changed to array for multi-select
        noActivity: false,  // Lead Activity filter - no activity checkbox
        noActivityDate: '', // Lead Activity filter - date picker
        selectedStatuses: [] // Empty array means show all statuses
    });

    // Sidebar state for dynamic card width
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Bulk selection states
    const [selectedRows, setSelectedRows] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [showCheckboxes, setShowCheckboxes] = useState(false);

    // Additional states for no activity filter
    const [leadsWithNoActivity, setLeadsWithNoActivity] = useState([]);
    const [loadingNoActivityFilter, setLoadingNoActivityFilter] = useState(false);
    const [showCopyLeadModal, setShowCopyLeadModal] = useState(false);
    const [showFileSentToLoginModal, setShowFileSentToLoginModal] = useState(false);

    // Search states for filter options
    const [createdBySearch, setCreatedBySearch] = useState('');
    const [statusSearch, setStatusSearch] = useState('');
    const [teamNameSearch, setTeamNameSearch] = useState('');
    const [assignedTLSearch, setAssignedTLSearch] = useState('');

    // Loading states
    const [loadingLeads, setLoadingLeads] = useState(false);
    const [loadingStatuses, setLoadingStatuses] = useState(false);
    const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    // Infinite scroll pagination for performance optimization
    const [displayedItemsCount, setDisplayedItemsCount] = useState(50); // Start with 50 items
    const [itemsPerLoad] = useState(50); // Load 50 more items at a time
    const [hasMoreItems, setHasMoreItems] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Refs to prevent multiple loading
    const statusesLoadedRef = useRef(false);

    // API-based status and sub-status data
    const [allStatuses, setAllStatuses] = useState([]);
    const [allSubStatuses, setAllSubStatuses] = useState([]);
    const [statusHierarchy, setStatusHierarchy] = useState({}); // Maps main status to its sub-statuses
    const [subStatusToMainStatus, setSubStatusToMainStatus] = useState({}); // Maps sub-status to main status

    // Data for dropdowns
    const [teams, setTeams] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [statusCounts, setStatusCounts] = useState({
        "Not a lead": 0,
        "Active Leads": 0,
        "File sent to login": 0,
        "Lost By mistake": 0,
        "Lost login": 0,
    });

    // Sub-status states
    const [subStatuses, setSubStatuses] = useState([]);
    const [statusToSubStatusMap, setStatusToSubStatusMap] = useState({});
    const [searchableSubStatuses, setSearchableSubStatuses] = useState([]);
    const [showStatusChangePopup, setShowStatusChangePopup] = useState(false);
    const [statusChangeInfo, setStatusChangeInfo] = useState({ customLeadId: '', newStatus: '' });

    // Obligation dirty state tracking
    const [hasUnsavedObligationChanges, setHasUnsavedObligationChanges] = useState(false);
    const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
    const [pendingTabNavigation, setPendingTabNavigation] = useState(null);
    const [pendingSectionNavigation, setPendingSectionNavigation] = useState(null);

    // API configuration
    const apiBaseUrl = '/api';
    // const userId = user?._id || localStorage.getItem('userId');

    // Handle browser navigation (back button) when there are unsaved obligation changes
    // Note: Removed beforeunload event to allow page reload/close without alerts
    useEffect(() => {
        const handlePopState = (e) => {
            if (hasUnsavedObligationChanges) {
                e.preventDefault();
                const shouldLeave = window.confirm('You have unsaved changes in the obligation section. Are you sure you want to leave?');
                if (!shouldLeave) {
                    // Push the current state back to prevent navigation
                    window.history.pushState(null, '', window.location.href);
                    return;
                }
                // If user confirms, reset the unsaved changes flag
                setHasUnsavedObligationChanges(false);
            }
        };

        // Add event listener only for back/forward navigation
        window.addEventListener('popstate', handlePopState);

        // Cleanup function
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [hasUnsavedObligationChanges]);

    // Sub-status to main status mapping
    // Status mapping - will be populated by API instead of hardcoded values
    const subStatusToMainStatusMap = {
        // This will be populated dynamically from API
        // Keeping empty object to avoid breaking existing code that references it
    };
    
    // Remove hardcoded status initialization - now using API-based statuses only

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showStatusDropdown !== null &&
                !event.target.closest('.status-dropdown-container') &&
                !event.target.closest('.status-dropdown-button') &&
                !event.target.closest('.status-dropdown-menu')) {
                setShowStatusDropdown(null);
                setStatusSearchTerm('');
            }
        };

        const handleScroll = (event) => {
            if (showStatusDropdown !== null) {
                // Check if scrolling within dropdown - don't close
                if (event.target.closest('.status-dropdown-menu')) {
                    return;
                }
                // Close dropdown for other scroll events
                setShowStatusDropdown(null);
                setStatusSearchTerm('');
            }
        };

        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && showStatusDropdown !== null) {
                setShowStatusDropdown(null);
                setStatusSearchTerm('');
            }
        };

        if (showStatusDropdown !== null) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
            document.addEventListener('keydown', handleEscapeKey);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [showStatusDropdown]);

    // Update select all checkbox based on selected rows
    useEffect(() => {
        if (selectedRows.length === filteredLeads.length && filteredLeads.length > 0) {
            setSelectAll(true);
        } else {
            setSelectAll(false);
        }
    }, [selectedRows, filteredLeads]);

    // Helper function to get parent status for status cards
    const getParentStatusForStatusCard = (status, subStatus = null) => {
        // Priority mapping for status cards
        const statusToParentMap = {
            // Not A Lead statuses
            "Not A Lead": "Not a lead",
            "Not a Lead": "Not a lead",
            "Duplicate": "Not a lead",
            "Wrong Number": "Not a lead", 
            "Spam": "Not a lead",
            "Invalid Lead": "Not a lead",
            
            // Active Leads statuses
            "Active Leads": "Active Leads",
            "Active Lead": "Active Leads",
            "Fresh Lead": "Active Leads",
            "Contacted": "Active Leads",
            "Interested": "Active Leads",
            "Follow Up": "Active Leads",
            "Callback": "Active Leads",
            "Eligible": "Active Leads",
            "Document Pending": "Active Leads",
            "Proposal Sent": "Active Leads",
            "Verification Pending": "Active Leads",
            "Application Submitted": "Active Leads",
            "Completed": "Active Leads",
            "FILE COMPLETED": "Active Leads",
            "Verification Completed": "Active Leads",
            "Pending Assignment": "Active Leads",
            
            // File sent to login statuses
            "File sent to login": "File sent to login",
            "File Sent to Login": "File sent to login",
            "LOGIN FILE SENT": "File sent to login",
            "File Sent": "File sent to login",
            "Sent to Login": "File sent to login",
            "Login Submitted": "File sent to login",
            "Disbursed": "File sent to login",
            "Converted": "File sent to login",
            "Active Login": "File sent to login",  // Fixed: Login statuses should map to File sent to login
            "Approved": "File sent to login",      // Bank approval status
            "Loan Approved": "File sent to login",
            "Sanctioned": "File sent to login",   // Bank sanction status
            "Login Approved": "File sent to login",
            "Login Done": "File sent to login",
            "Login Completed": "File sent to login",
            
            // Lost By Mistake statuses
            "Lost By Mistake": "Lost By mistake",
            "Lost by Mistake": "Lost By mistake",
            "Technical Error": "Lost By mistake",
            "System Error": "Lost By mistake",
            "Accidental Reject": "Lost By mistake",
            
            // Lost Lead statuses  
            "Lost Lead": "Lost login",
            "Lost Leads": "Lost login",
            "Not Interested": "Lost login",
            "Rejected": "Lost login",
            "Call Not Picked": "Lost login",
            "No Response": "Lost login",
            "Cancelled": "Lost login",
            "On Hold": "Lost login",
            "Verification Failed": "Lost login",
            "Application Rejected": "Lost login",
            "Proposal Rejected": "Lost login"
        };
        
        // Check sub-status first if provided
        if (subStatus && statusToParentMap[subStatus]) {
            return statusToParentMap[subStatus];
        }
        
        // Then check main status
        if (status && statusToParentMap[status]) {
            return statusToParentMap[status];
        }
        
        // Default fallback based on common patterns
        const statusLower = (status || '').toLowerCase();
        if (statusLower.includes('not') && statusLower.includes('lead')) {
            return "Not a lead";
        } else if (statusLower.includes('lost') && statusLower.includes('mistake')) {
            return "Lost By mistake";
        } else if (statusLower.includes('lost') || statusLower.includes('rejected') || statusLower.includes('not interested')) {
            return "Lost login";
        } else {
            // Default to Active Leads for unknown statuses
            return "Active Leads";
        }
    };

    // Helper functions for unsaved changes management
    const handleTabNavigation = (newActiveTab) => {
        if (hasUnsavedObligationChanges) {
            setPendingTabNavigation(newActiveTab);
            setShowUnsavedChangesModal(true);
            // Don't prevent navigation, just show the popup
        } else {
            setActiveTab(newActiveTab);
        }
    };

    const handleSectionNavigation = (sectionIndex) => {
        if (hasUnsavedObligationChanges) {
            setPendingSectionNavigation(sectionIndex);
            setShowUnsavedChangesModal(true);
            // Don't prevent navigation, just show the popup
        } else {
            // Handle section navigation normally
            setOpenSections(prev => 
                prev.includes(sectionIndex) 
                    ? prev.filter(s => s !== sectionIndex)
                    : [...prev, sectionIndex]
            );
        }
    };

    const confirmDiscardChanges = () => {
        setHasUnsavedObligationChanges(false);
        
        // Proceed with pending navigation
        if (pendingTabNavigation !== null) {
            // Handle special case for back to table navigation
            if (pendingTabNavigation === 'back_to_table') {
                setSelectedLead(null);
            } else {
                setActiveTab(pendingTabNavigation);
                // Auto-open About section (index 0) only when switching to LEAD DETAILS tab (index 0)
                setOpenSections(pendingTabNavigation === 0 ? [0] : []);
            }
            setPendingTabNavigation(null);
        }
        
        if (pendingSectionNavigation !== null) {
            setOpenSections(prev => 
                prev.includes(pendingSectionNavigation) 
                    ? prev.filter(s => s !== pendingSectionNavigation)
                    : [...prev, pendingSectionNavigation]
            );
            setPendingSectionNavigation(null);
        }
        
        setShowUnsavedChangesModal(false);
    };

    const cancelNavigation = () => {
        setPendingTabNavigation(null);
        setPendingSectionNavigation(null);
        setShowUnsavedChangesModal(false);
    };

    const markObligationSaved = () => {
        setHasUnsavedObligationChanges(false);
    };

    // Helper functions
    async function handleSelectedLeadFieldChange(field, value, skipSuccessMessage = false) {

        // Update local state immediately for responsive UI
        setSelectedLead(prev => {
            const updated = { ...prev };

            // Handle nested dynamic_fields structure for co_applicant_form
            if (field === "co_applicant_form") {
                if (!updated.dynamic_fields) {
                    updated.dynamic_fields = {};
                }
                updated.dynamic_fields.co_applicant_form = value;
                // Also set it at the root level for backward compatibility
                updated.coApplicantForm = value;
            } else if (field === "applicant_form") {
                if (!updated.dynamic_fields) {
                    updated.dynamic_fields = {};
                }
                updated.dynamic_fields.applicant_form = value;
                // Also set it at the root level for backward compatibility
                updated.loginForm = value;
            } else if (field === "dynamic_fields") {
                // Handle entire dynamic_fields update (like from ObligationSection)
                updated.dynamic_fields = {
                    ...updated.dynamic_fields,
                    ...value
                };
            } else {
                // For other fields, set directly
                updated[field] = value;

                // Handle special field mappings to ensure data consistency
                if (field === 'customerName') {
                    // Split customer name into first_name and last_name
                    const nameParts = value.split(' ');
                    updated.first_name = nameParts[0] || '';
                    updated.last_name = nameParts.slice(1).join(' ') || '';
                    updated.name = value; // Also set the combined name
                } else if (field === 'mobileNumber') {
                    updated.mobile_number = value;
                    updated.phone = value;
                } else if (field === 'pinCode') {
                    updated.pincode = value;
                    if (!updated.dynamic_fields) updated.dynamic_fields = {};
                    if (!updated.dynamic_fields.address) updated.dynamic_fields.address = {};
                    updated.dynamic_fields.address.pincode = value;
                } else if (field === 'city') {
                    if (!updated.dynamic_fields) updated.dynamic_fields = {};
                    if (!updated.dynamic_fields.address) updated.dynamic_fields.address = {};
                    updated.dynamic_fields.address.city = value;
                } else if (field === 'alternateNumber') {
                    updated.alternative_phone = value;
                } else if (field === 'dataCode') {
                    updated.data_code = value;
                } else if (field === 'productName') {
                    updated.loan_type = value;
                    updated.loan_type_name = value;
                }
            }

            return updated;
        });

        // Update editedLeads array more efficiently - only update when viewing lead details
        setEditedLeads(leads =>
            leads.map(l =>
                l._id === selectedLead._id ?
                    {
                        ...l,
                        [field]: value,
                        // Handle nested structure for dynamic_fields
                        ...(field === "co_applicant_form" && {
                            dynamic_fields: {
                                ...l.dynamic_fields,
                                co_applicant_form: value
                            },
                            coApplicantForm: value
                        }),
                        ...(field === "applicant_form" && {
                            dynamic_fields: {
                                ...l.dynamic_fields,
                                applicant_form: value
                            },
                            loginForm: value
                        }),
                        ...(field === "dynamic_fields" && {
                            dynamic_fields: {
                                ...l.dynamic_fields,
                                ...value
                            }
                        }),
                        // Handle special field mappings for leads array too
                        ...(field === 'customerName' && {
                            first_name: value.split(' ')[0] || '',
                            last_name: value.split(' ').slice(1).join(' ') || '',
                            name: value
                        }),
                        ...(field === 'mobileNumber' && {
                            mobile_number: value,
                            phone: value
                        }),
                        ...(field === 'pinCode' && {
                            pincode: value,
                            dynamic_fields: {
                                ...l.dynamic_fields,
                                address: {
                                    ...l.dynamic_fields?.address,
                                    pincode: value
                                }
                            }
                        }),
                        ...(field === 'city' && {
                            dynamic_fields: {
                                ...l.dynamic_fields,
                                address: {
                                    ...l.dynamic_fields?.address,
                                    city: value
                                }
                            }
                        }),
                        ...(field === 'alternateNumber' && {
                            alternative_phone: value
                        }),
                        ...(field === 'dataCode' && {
                            data_code: value
                        }),
                        ...(field === 'productName' && {
                            loan_type: value,
                            loan_type_name: value
                        })
                    } : l
            )
        );

        // Also update the main leads array to ensure data consistency across the app
        setLeads(leads =>
            leads.map(l =>
                l._id === selectedLead._id ?
                    {
                        ...l,
                        [field]: value,
                        // Apply the same field mappings to main leads array
                        ...(field === 'customerName' && {
                            first_name: value.split(' ')[0] || '',
                            last_name: value.split(' ').slice(1).join(' ') || '',
                            name: value
                        }),
                        ...(field === 'mobileNumber' && {
                            mobile_number: value,
                            phone: value
                        }),
                        ...(field === 'pinCode' && {
                            pincode: value,
                            dynamic_fields: {
                                ...l.dynamic_fields,
                                address: {
                                    ...l.dynamic_fields?.address,
                                    pincode: value
                                }
                            }
                        }),
                        ...(field === 'city' && {
                            dynamic_fields: {
                                ...l.dynamic_fields,
                                address: {
                                    ...l.dynamic_fields?.address,
                                    city: value
                                }
                            }
                        }),
                        ...(field === 'alternateNumber' && {
                            alternative_phone: value
                        }),
                        ...(field === 'dataCode' && {
                            data_code: value
                        }),
                        ...(field === 'productName' && {
                            loan_type: value,
                            loan_type_name: value
                        })
                    } : l
            )
        );

        // Auto-save to API
        try {
            const userId = localStorage.getItem('userId');
            const apiUrl = `/api/leads/${selectedLead._id}?user_id=${userId}`;

            // Prepare the update data based on field type
            let updateData = {};

            if (field === "co_applicant_form" || field === "applicant_form") {
                updateData = {
                    dynamic_fields: {
                        ...selectedLead.dynamic_fields,
                        [field]: value
                    }
                };
            } else if (field === "dynamic_fields") {
                // Handle entire dynamic_fields update (like from ObligationSection)
                updateData = {
                    dynamic_fields: {
                        ...selectedLead.dynamic_fields,
                        ...value
                    }
                };
            } else {
                // Map fields to appropriate API fields
                const apiFieldMap = {
                    customerName: 'name',
                    mobileNumber: 'mobile_number',
                    pinCode: 'pincode',
                    alternateNumber: 'alternative_phone',
                    dataCode: 'data_code',
                    productName: 'loan_type'
                };

                const apiField = apiFieldMap[field] || field;
                updateData = { [apiField]: value };

                // For certain fields, also update related fields
                if (field === 'customerName') {
                    const nameParts = value.split(' ');
                    updateData.first_name = nameParts[0] || '';
                    updateData.last_name = nameParts.slice(1).join(' ') || '';
                } else if (field === 'productName') {
                    updateData.loan_type_name = value;
                } else if (field === 'mobileNumber') {
                    updateData.phone = value;
                } else if (field === 'pinCode' || field === 'city') {
                    // For address fields, update the dynamic_fields structure
                    updateData = {
                        [apiField]: value,
                        dynamic_fields: {
                            ...selectedLead.dynamic_fields,
                            address: {
                                ...selectedLead.dynamic_fields?.address,
                                [field === 'pinCode' ? 'pincode' : 'city']: value
                            }
                        }
                    };
                }
            }


            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const responseData = await response.json();

            // Show success feedback with field name and new value
            const getFieldDisplayName = (fieldName) => {
                const fieldNameMap = {
                    'applicant_form': 'Applicant Form',
                    'co_applicant_form': 'Co-Applicant Form',
                    'important_questions': 'Important Questions',
                    'how_to_process': 'How to Process',
                    'about_section': 'About Section',
                    'obligations': 'Obligations',
                    'operations': 'Operations',
                    'first_name': 'First Name',
                    'last_name': 'Last Name',
                    'mobile_number': 'Mobile Number',
                    'email': 'Email',
                    'city': 'City',
                    'pincode': 'Pincode',
                    'company_name': 'Company Name',
                    'salary': 'Salary',
                    'loan_type': 'Loan Type',
                    'status': 'Status',
                    'sub_status': 'Sub Status',
                    'customerName': 'Customer Name',
                    'mobileNumber': 'Mobile Number',
                    'alternateNumber': 'Alternate Number',
                    'dataCode': 'Data Code',
                    'campaignName': 'Campaign Name',
                    'productName': 'Product Name',
                    'pinCode': 'Pin Code',
                    'processingBank': 'Processing Bank',
                    'totalObligation': 'Total Obligation',
                    'totalBtPos': 'Total BT Position',
                    'cibilScore': 'CIBIL Score',
                    'partnerSalary': 'Partner Salary',
                    'yearlyBonus': 'Yearly Bonus',
                    'companyName': 'Company Name',
                    'companyType': 'Company Type',
                    'companyCategory': 'Company Category',
                    'loanRequired': 'Loan Required',
                    'dynamic_fields': 'Lead Details'
                };
                return fieldNameMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            };

            const getFieldValue = (fieldName, leadData, originalValue) => {
                // For dynamic_fields updates, show a summary of what was updated
                if (fieldName === 'dynamic_fields' && typeof originalValue === 'object' && originalValue !== null) {
                    const updatedFields = Object.keys(originalValue).filter(key => {
                        const val = originalValue[key];
                        // Skip empty or null values
                        return val !== null && val !== undefined && val !== '';
                    });

                    if (updatedFields.length === 1) {
                        const singleField = updatedFields[0];
                        const fieldDisplayNames = {
                            'financial_details': 'Financial Details',
                            'personal_details': 'Personal Details',
                            'check_eligibility': 'Check Eligibility',
                            'eligibility_details': 'Eligibility Details',
                            'obligations': 'Obligations',
                            'processing_bank': 'Processing Bank',
                            'processingBank': 'Processing Bank',
                            'totalObligation': 'Total Obligation',
                            'totalBtPos': 'Total BT Position',
                            'cibilScore': 'CIBIL Score',
                            'salary': 'Salary',
                            'partnerSalary': 'Partner Salary',
                            'yearlyBonus': 'Yearly Bonus',
                            'companyName': 'Company Name',
                            'companyType': 'Company Type',
                            'companyCategory': 'Company Category',
                            'loanRequired': 'Loan Required'
                        };
                        return fieldDisplayNames[singleField] || singleField.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    } else if (updatedFields.length > 1) {
                        return `${updatedFields.length} fields updated`;
                    }
                    return 'Updated';
                }

                // For specific field updates, show the actual new value
                if (originalValue !== undefined && originalValue !== null) {
                    // Handle different value types
                    if (typeof originalValue === 'object' && originalValue !== null) {
                        // For object values (like forms), just show "Updated"
                        return 'Updated';
                    }
                    if (typeof originalValue === 'string' && originalValue.length > 50) {
                        return originalValue.substring(0, 50) + '...';
                    }
                    if (typeof originalValue === 'number') {
                        return originalValue.toLocaleString();
                    }
                    return originalValue || 'Updated';
                }

                // Fallback to checking response data
                if (!leadData) return 'Updated';

                const value = leadData.dynamic_fields?.[fieldName] || leadData[fieldName];
                if (typeof value === 'object' && value !== null) {
                    return 'Updated';
                }
                if (typeof value === 'string' && value.length > 50) {
                    return value.substring(0, 50) + '...';
                }
                return value || 'Updated';
            };

            const displayName = getFieldDisplayName(field);
            const fieldValue = getFieldValue(field, responseData, value);

            // Only show success message if not skipped (to avoid double messages from sections)
            if (!skipSuccessMessage) {
                message.success(`${displayName}: ${fieldValue}`);
            }

            // No need to fetch latest data - local state is already updated
            // This prevents unnecessary re-renders of the entire page

        } catch (error) {
            message.error(`Failed to save ${field}: ${error.message}`);

            // Revert the change on error
            setSelectedLead(prev => {
                const reverted = { ...prev };
                if (field === "co_applicant_form") {
                    if (reverted.dynamic_fields) {
                        delete reverted.dynamic_fields.co_applicant_form;
                    }
                    delete reverted.coApplicantForm;
                } else if (field === "applicant_form") {
                    if (reverted.dynamic_fields) {
                        delete reverted.dynamic_fields.applicant_form;
                    }
                    delete reverted.loginForm;
                } else {
                    delete reverted[field];
                }
                return reverted;
            });
        }
    }

    // Create adapter functions for proper data synchronization
    const createAboutSectionHandler = (lead) => async (updatedLeadObject) => {

        // Find what fields have changed by comparing with current lead
        const changes = {};
        Object.keys(updatedLeadObject).forEach(key => {
            if (updatedLeadObject[key] !== lead[key]) {
                changes[key] = updatedLeadObject[key];
            }
        });


        // Apply each change through the proper handler (skip success messages since AboutSection shows its own)
        for (const [field, value] of Object.entries(changes)) {
            await handleSelectedLeadFieldChange(field, value, true);
        }

        return true; // Indicate success
    };

    const createHowToProcessHandler = (lead) => async (updatedLeadObject) => {

        // For process section, update the entire process object (skip success message)
        if (updatedLeadObject.process) {
            await handleSelectedLeadFieldChange('process', updatedLeadObject.process, true);
        }

        // Handle individual field updates (skip success messages)
        const processFields = ['bank_name', 'product_need', 'required_amount', 'required_tenure', 'salary', 'company_category'];
        for (const field of processFields) {
            if (updatedLeadObject[field] !== undefined && updatedLeadObject[field] !== lead[field]) {
                await handleSelectedLeadFieldChange(field, updatedLeadObject[field], true);
            }
        }

        return true;
    };

    // Define detail sections inside the component so handleSelectedLeadFieldChange is accessible
    const detailSections = [
        {
            label: "LEAD DETAILS",
            icon: <span className="mr-1">🏠</span>,
            getContent: (lead, handleFieldChange) => [
                {
                    label: "About",
                    content: <LazySection height="300px">
                        <AboutSection 
                            key={`about-${lead._id}`}
                            lead={lead} 
                            onSave={createAboutSectionHandler(lead)} 
                        />
                    </LazySection>
                },
                {
                    label: "How to Process",
                    content: <LazySection height="250px">
                        <HowToProcessSection 
                            key={`howtoprocess-${lead._id}-${JSON.stringify(lead.process)}`}
                            process={lead.process} 
                            onSave={createHowToProcessHandler(lead)} 
                            lead={lead} 
                        />
                    </LazySection>
                },
                {
                    label: "APPLICANT FORM",
                    content: (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-[#03B0F5]">Primary Applicant</h3>
                                <button
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold text-lg"
                                    onClick={() => {
                                        const coApplicantData = {
                                            first_name: '',
                                            last_name: '',
                                            mobile_number: '',
                                            email: '',
                                            date_of_birth: '',
                                            address: '',
                                            city: '',
                                            state: '',
                                            pincode: '',
                                            pan_number: '',
                                            aadhar_number: '',
                                            initialized: true
                                        };
                                        handleFieldChange("co_applicant_form", coApplicantData);
                                    }}
                                >
                                    + Add Co-Applicant
                                </button>
                            </div>
                            <LoginFormSection
                                data={lead.dynamic_fields?.applicant_form || lead.loginForm || {}}
                                onSave={updated => handleFieldChange("applicant_form", updated)}
                                bankOptions={bankOptions}
                                mobileNumber={lead.mobile_number}
                                bankName={lead.salaryAccountBank || lead.bank_name}
                                isReadOnlyMobile={true}
                                leadId={lead._id}
                                leadCustomerName={`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.customerName || lead.name || ''}
                                leadData={lead}
                            />
                            {(lead.dynamic_fields?.co_applicant_form || lead.coApplicantForm) && (
                                <div className="mt-8 pt-6 border-t-2 border-cyan-400">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-[#03B0F5]">Co-Applicant</h3>
                                        <button
                                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-bold text-lg"
                                            onClick={() => handleFieldChange("co_applicant_form", null)}
                                        >
                                            Remove Co-Applicant
                                        </button>
                                    </div>
                                    <LoginFormSection
                                        data={lead.dynamic_fields?.co_applicant_form || lead.coApplicantForm || {}}
                                        onSave={updated => handleFieldChange("co_applicant_form", updated)}
                                        bankOptions={bankOptions}
                                        mobileNumber=""
                                        bankName=""
                                        isCoApplicant={true}
                                        leadId={lead._id}
                                        leadCustomerName={`${`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.customerName || lead.name || ''} - Co-Applicant`}
                                        leadData={lead}
                                    />
                                </div>
                            )}
                        </div>
                    ),
                },
                {
                    label: "Important Questions",
                    content: (
                        <LazySection height="400px">
                            <ImportantQuestionsSection
                                key={`questions-${lead._id}-${lead.important_questions_validated}`}
                                leadData={lead}
                                onUpdate={updated => {
                                    handleFieldChange("importantquestion", updated);
                                    if (updated.question_responses) {
                                        handleFieldChange("question_responses", updated.question_responses);
                                    }
                                    // Check if all mandatory questions are answered and update validation flag
                                    if (updated.important_questions_validated !== undefined) {
                                        handleFieldChange("important_questions_validated", updated.important_questions_validated);
                                    }
                                    setQuestionResponses(updated.question_responses || updated.importantquestion || {});
                                }}
                                currentUserRole={{
                                    permissions: [],
                                    _id: localStorage.getItem('userId'),
                                department: localStorage.getItem('userDepartment') || 'sales'
                            }}
                            />
                        </LazySection>
                    )
                },
            ],
        },
        {
            label: "OBLIGATION",
            getContent: (leadData, handleChangeFunc) => [
                {
                    content: (
                        <div className="bg-black">
                            <LazySection height="500px">
                                <ObligationSection
                                leadData={leadData}
                                handleChangeFunc={(field, value) => {
                                    // Mark as having unsaved changes when obligation data is modified
                                    setHasUnsavedObligationChanges(true);
                                    // Skip success message since ObligationSection shows its own
                                    handleChangeFunc(field, value, true);
                                }}
                                onDataUpdate={async () => {
                                    // Mark as saved when data is successfully updated
                                    markObligationSaved();
                                    // Refresh leads data after obligation data is saved
                                    const currentSelectedLeadId = selectedLead?._id;
                                    
                                    // Refresh the leads list
                                    await loadLeads();
                                    
                                    // If we had a selected lead, update it with the fresh data from the list
                                    if (currentSelectedLeadId) {
                                        // Wait for the leads to be updated, then find the updated lead
                                        setTimeout(() => {
                                            setLeads(currentLeads => {
                                                const updatedLead = currentLeads.find(lead => lead._id === currentSelectedLeadId);
                                                if (updatedLead) {
                                                    setSelectedLead(updatedLead);
                                                    
                                                    // Also update editedLeads
                                                    setEditedLeads(currentEditedLeads => 
                                                        currentEditedLeads.map(lead => 
                                                            lead._id === currentSelectedLeadId ? updatedLead : lead
                                                        )
                                                    );
                                                }
                                                return currentLeads;
                                            });
                                        }, 100); // Small delay to ensure state updates are processed
                                    }
                                }}
                                onUnsavedChangesUpdate={(hasChanges, showModalFunc) => {
                                    setHasUnsavedObligationChanges(hasChanges);
                                    if (hasChanges) {
                                        // Store the show modal function for later use
                                        window.obligationShowUnsavedModal = showModalFunc;
                                    }
                                }}
                            />
                            </LazySection>
                        </div>
                    )
                }
            ]
        },
        {
            label: "REMARK",
            getContent: (leadData, handleChangeFunc) => [
                {
                    content: (
                        <div className="p-6 bg-white rounded-xl shadow-2xl text-[1rem] text-gray-100 border-l-4 border-cyan-500/60">
                            <RemarkSection leadData={leadData} />
                        </div>
                    ),
                },
            ],
        },
        {
            label: "TASK",
            getContent: (lead) => [
                {
                    label: "TASK",
                    content: (
                        <div className="p-4 bg-gradient-to-r from-[#1b2736] to-[#23243a] rounded-xl shadow text-[1rem] text-[#03b0f5] border-l-4 border-cyan-400/40">
                            <div className="font-bold text-cyan-400 mb-2">
                                <LazySection height="300px">
                                    <TaskComponent leadData={lead} />
                                </LazySection>
                            </div>
                        </div>
                    ),
                },
            ],
        },
        {
            label: "ATTACHEMENT",
            getContent: (lead) => [
                {
                    content: (
                        <div className="p-4 bg-white rounded-xl shadow text-[1rem] text-[#03b0f5] border-l-4 border-cyan-400/40">
                            <LazySection height="350px">
                                <Attachments leadId={lead._id} userId={typeof lead.created_by === 'object' ? lead.created_by?.user_id || lead.created_by?.id || lead.created_by?._id : lead.created_by} />
                            </LazySection>
                        </div>
                    ),
                },
            ],
        },
        {
            label: "LEADS ACTIVITY",
            getContent: (lead) => [
                {
                    label: "LEADS ACTIVITY",
                    content: (
                        <div className="p-4 bg-white rounded-xl shadow text-[1rem] text-[#03b0f5] border-l-4 border-cyan-400/40">
                            <div className="font-bold text-cyan-400 mb-2">
                                <LazySection height="400px">
                                    <LeadActivity
                                        leadId={String(lead._id)}
                                        userId={String(lead.assigned_to)}
                                    />
                                </LazySection>
                            </div>
                        </div>
                    ),
                },
            ],
        },
    ];

    // Map lead status to status card categories
    const mapLeadStatusToCategory = (status) => {
        const statusLower = status?.toLowerCase() || '';
        if (statusLower.includes('not a lead')) return 'not_a_lead';
        if (statusLower.includes('active login') || statusLower.includes('active leads') || statusLower.includes('interested') ||
            statusLower.includes('fresh') || statusLower.includes('completed') || statusLower === 'completed')
            return 'active_leads';
        if (statusLower.includes('lost by mistake')) return 'lost_by_mistake';
        if (statusLower.includes('lost') || statusLower.includes('rejected') || statusLower.includes('not interested')) return 'lost_lead';
        return 'active_leads'; // Default
    };

    // ⚡ PERFORMANCE: Memoized status counts calculation
    const memoizedStatusCounts = useMemo(() => {
        const counts = {
            "Not a lead": 0,
            "Active Leads": 0,
            "File sent to login": 0,
            "Lost By mistake": 0,
            "Lost login": 0,
        };

        // Ensure leads is an array before processing
        if (Array.isArray(leads)) {
            let filteredLeads = leads;

            // Apply loan type filter if specified
            if (selectedLoanType && selectedLoanType !== 'all') {
                filteredLeads = leads.filter(lead => {
                    // Check for exact match on loan_type_id first (most reliable)
                    if (lead.loan_type_id === selectedLoanType) {
                        return true;
                    }

                    // Check for exact match on name fields
                    if (lead.loan_type === selectedLoanType || lead.loan_type_name === selectedLoanType) {
                        return true;
                    }

                    // For PL & OD (ID: 68595a524cec3069a38501e6)
                    if (selectedLoanType === "68595a524cec3069a38501e6" &&
                        (lead.loan_type === "PL & OD" || lead.loan_type_name === "PL & OD")) {
                        return true;
                    }

                    // For Home Loan (ID: 68595a524cec3069a38501e5)
                    if (selectedLoanType === "68595a524cec3069a38501e5" &&
                        (lead.loan_type === "Home Loan" || lead.loan_type_name === "Home Loan")) {
                        return true;
                    }

                    return false;
                });
            }

            filteredLeads.forEach(lead => {
                const statusValue = typeof lead.status === 'object' ? (lead.status?.name || 'Unknown') : (lead.status || 'Unknown');
                
                if (counts.hasOwnProperty(statusValue)) {
                    counts[statusValue]++;
                } else {
                    // For unknown statuses, increment Active Leads as default
                    counts["Active Leads"]++;
                }
            });
        }

        return counts;
    }, [leads, selectedLoanType]);

    // ⚡ PERFORMANCE: Memoized filtered leads computation
    const filteredLeadsData = useMemo(() => {
        // Ensure leads is always an array before spreading
        let filtered = Array.isArray(leads) ? [...leads] : [];

        // Apply search filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(lead =>
                (typeof lead.name === 'string' && lead.name.toLowerCase().includes(searchLower)) ||
                (typeof lead.first_name === 'string' && lead.first_name.toLowerCase().includes(searchLower)) ||
                (typeof lead.last_name === 'string' && lead.last_name.toLowerCase().includes(searchLower)) ||
                (lead.mobile_number !== undefined && lead.mobile_number !== null && lead.mobile_number.toString().includes(searchLower)) ||
                (lead.phone !== undefined && lead.phone !== null && lead.phone.toString().includes(searchLower)) ||
                (typeof lead.email === 'string' && lead.email.toLowerCase().includes(searchLower)) ||
                (typeof lead.campaign_name === 'string' && lead.campaign_name.toLowerCase().includes(searchLower)) ||
                ((typeof lead.department_name === 'string' && lead.department_name.toLowerCase().includes(searchLower)) || 
                (typeof lead.department_name === 'object' && lead.department_name?.name && lead.department_name.name.toLowerCase().includes(searchLower))) ||
                (typeof lead.department_name === 'string' && lead.department_name.toLowerCase().includes(searchLower)) ||
                ((typeof lead.created_by === 'string' && lead.created_by.toLowerCase().includes(searchLower)) || 
                (typeof lead.created_by === 'object' && lead.created_by?.name && lead.created_by.name.toLowerCase().includes(searchLower))) ||
                (typeof lead.created_by_name === 'string' && lead.created_by_name.toLowerCase().includes(searchLower)) ||
                ((typeof lead.status === 'string' && lead.status.toLowerCase().includes(searchLower)) || 
                (typeof lead.status === 'object' && lead.status.name && lead.status.name.toLowerCase().includes(searchLower))) ||
                ((typeof lead.sub_status === 'string' && lead.sub_status.toLowerCase().includes(searchLower)) || 
                (typeof lead.sub_status === 'object' && lead.sub_status?.name && lead.sub_status.name.toLowerCase().includes(searchLower))) ||
                (typeof lead.custom_lead_id === 'string' && lead.custom_lead_id.toLowerCase().includes(searchLower))
            );
        }

        // Apply filter options
        // Status filter - unified selectedStatuses filter (empty means show all)
        if (filterOptions.selectedStatuses && filterOptions.selectedStatuses.length > 0) {
            filtered = filtered.filter(lead => {
                const statusValue = typeof lead.status === 'object' ? (lead.status.name || 'Unknown') : (lead.status || 'Unknown');
                return filterOptions.selectedStatuses.includes(statusValue);
            });
        }
        // If selectedStatuses is empty, show all statuses (no filtering)
        
        // Legacy status filters for backward compatibility
        if (filterOptions.leadAllStatus && filterOptions.leadAllStatus.length > 0) {
            filtered = filtered.filter(lead => {
                const statusValue = typeof lead.status === 'object' ? (lead.status.name || 'Unknown') : (lead.status || 'Unknown');
                return filterOptions.leadAllStatus.includes(statusValue);
            });
        }

        if (filterOptions.teamName && filterOptions.teamName.length > 0) {
            filtered = filtered.filter(lead => {
                const teamName = typeof lead.department_name === 'object' ? lead.department_name?.name : lead.department_name;
                return filterOptions.teamName.includes(teamName);
            });
        }

        if (filterOptions.assignedTL && filterOptions.assignedTL.length > 0) {
            filtered = filtered.filter(lead => {
                const tlName = typeof lead.assigned_tl === 'object' ? lead.assigned_tl?.name : lead.assigned_tl;
                return filterOptions.assignedTL.includes(tlName);
            });
        }

        if (filterOptions.createdBy && filterOptions.createdBy.length > 0) {
            filtered = filtered.filter(lead => {
                const createdByName = typeof lead.created_by === 'object' ? lead.created_by?.name : lead.created_by;
                return filterOptions.createdBy.includes(createdByName);
            });
        }

        if (filterOptions.loanTypeFilter && filterOptions.loanTypeFilter.length > 0) {
            filtered = filtered.filter(lead => {
                return filterOptions.loanTypeFilter.includes(lead.loan_type_name);
            });
        }

        // Handle date range filters
        if (filterOptions.dateRange && filterOptions.dateRange.length === 2) {
            const [startDate, endDate] = filterOptions.dateRange;
            filtered = filtered.filter(lead => {
                const createdDate = moment(lead.created_at);
                return createdDate.isBetween(startDate, endDate, 'day', '[]');
            });
        }

        // Sort by date (most recent first) for better UX
        filtered.sort((a, b) => {
            const aDate = new Date(a.created_at || a.date_created || 0);
            const bDate = new Date(b.created_at || b.date_created || 0);
            return bDate - aDate;
        });

        return filtered;
    }, [leads, searchTerm, filterOptions, selectedLoanType, leadsWithNoActivity]);

    // Update filtered leads and status counts with infinite scroll
    useEffect(() => {
        // Check if there are more items to load
        setHasMoreItems(filteredLeadsData.length > displayedItemsCount);
        
        // Get displayed results for performance (infinite scroll)
        const displayedLeads = filteredLeadsData.slice(0, displayedItemsCount);
        
        setFilteredLeads(displayedLeads);
        setEditedLeads(displayedLeads);
        
        // Use memoized status counts
        setStatusCounts(memoizedStatusCounts);
    }, [filteredLeadsData, displayedItemsCount, memoizedStatusCounts]);

    // Get unique teams and creators dynamically from the data
    // ⚡ PERFORMANCE: Memoized unique data computations
    const uniqueTeams = useMemo(() => {
        return Array.isArray(leads) ? [...new Set(leads.map(lead => {
            const teamName = lead.department_name || lead.team_name;
            return typeof teamName === 'object' ? teamName?.name : teamName;
        }).filter(Boolean))].sort() : [];
    }, [leads]);

    const uniqueCreators = useMemo(() => {
        return Array.isArray(leads) ? [...new Set(leads.map(lead => {
            // Prioritize created_by_name over created_by for better display
            const creator = lead.created_by_name || (typeof lead.created_by === 'object' ? lead.created_by?.name : lead.created_by);
            return creator;
        }).filter(Boolean))].sort() : [];
    }, [leads]);

    const uniqueAssignedTL = useMemo(() => {
        return Array.isArray(leads) ? [...new Set(leads.map(lead => {
            const assignedTl = lead.assigned_tl;
            return typeof assignedTl === 'object' ? assignedTl?.name : assignedTl;
        }).filter(Boolean))].sort() : [];
    }, [leads]);

    const uniqueCampaigns = useMemo(() => {
        return Array.isArray(leads) ? [...new Set(leads.map(lead => lead.campaign_name).filter(Boolean))].sort() : [];
    }, [leads]);

    // ⚡ PERFORMANCE: Memoized filtered data for search functionality
    const filteredCreators = useMemo(() => {
        return uniqueCreators.filter(creator => 
            creator.toLowerCase().includes(createdBySearch.toLowerCase())
        );
    }, [uniqueCreators, createdBySearch]);

    const filteredTeams = useMemo(() => {
        return uniqueTeams.filter(team => 
            team.toLowerCase().includes(teamNameSearch.toLowerCase())
        );
    }, [uniqueTeams, teamNameSearch]);

    const getFilteredAssignedTL = () => {
        const tls = getUniqueAssignedTL();
        return tls.filter(tl => 
            tl.toLowerCase().includes(assignedTLSearch.toLowerCase())
        );
    };

    const getFilteredStatuses = () => {
        if (!statusSearch.trim()) return statusHierarchy;
        
        const filtered = {};
        Object.entries(statusHierarchy).forEach(([parentStatus, subStatuses]) => {
            const parentMatches = parentStatus.toLowerCase().includes(statusSearch.toLowerCase());
            const matchingSubStatuses = subStatuses ? subStatuses.filter(subStatus => {
                const statusName = typeof subStatus === 'object' ? subStatus.name : subStatus;
                return statusName && statusName.toLowerCase().includes(statusSearch.toLowerCase());
            }) : [];
            
            if (parentMatches || matchingSubStatuses.length > 0) {
                filtered[parentStatus] = parentMatches ? subStatuses : matchingSubStatuses;
            }
        });
        
        return filtered;
    };

    // Clear search terms
    const clearFilterSearchTerms = () => {
        setCreatedBySearch('');
        setStatusSearch('');
        setTeamNameSearch('');
        setAssignedTLSearch('');
    };

    // Count active filters
    const getActiveFilterCount = () => {
        let count = 0;
        // Count lead date filters - if either from or to date is provided
        if (filterOptions.leadDateFrom || filterOptions.leadDateTo) count++;
        
        // Count lead age filters - if either min or max age is provided
        if (filterOptions.leadAgeFrom || filterOptions.leadAgeTo) count++;
        
        // Handle array filter options - only count if array exists and has items
        if (Array.isArray(filterOptions.teamName) && filterOptions.teamName.length > 0) count++;
        if (Array.isArray(filterOptions.createdBy) && filterOptions.createdBy.length > 0) count++;
        if (Array.isArray(filterOptions.leadParentStatus) && filterOptions.leadParentStatus.length > 0) count++;
        if (Array.isArray(filterOptions.leadAllStatus) && filterOptions.leadAllStatus.length > 0) count++;
        if (Array.isArray(filterOptions.assignedTL) && filterOptions.assignedTL.length > 0) count++;
        if (Array.isArray(filterOptions.selectedStatuses) && filterOptions.selectedStatuses.length > 0) count++;
        
        // Handle single value filter options
        if (filterOptions.leadStatus && filterOptions.leadStatus !== '') count++;
        if (filterOptions.campaignName && filterOptions.campaignName !== '') count++;
        
        // Also check date filters if using the old format
        if (filterOptions.dateFrom || filterOptions.dateTo) count++;
        
        // Only count no activity filters if both from and to dates are provided
        if (filterOptions.noActivityFrom && filterOptions.noActivityTo) count++;
        
        return count;
    };

    // Get filter count for specific category
    const getFilterCategoryCount = (category) => {
        switch (category) {
            case 'leadDate':
                // Count if either from or to date is provided
                return (filterOptions.leadDateFrom || filterOptions.leadDateTo) ? 1 : 0;
            case 'leadAge':
                // Count if either min or max age is provided
                return (filterOptions.leadAgeFrom || filterOptions.leadAgeTo) ? 1 : 0;
            case 'createdBy':
                // Only count if array exists and has actual selected values
                return filterOptions.createdBy && Array.isArray(filterOptions.createdBy) && filterOptions.createdBy.length > 0 ? 
                    filterOptions.createdBy.length : 0;
            case 'status':
                // Count selected statuses in the unified status filter
                return filterOptions.selectedStatuses && Array.isArray(filterOptions.selectedStatuses) && 
                    filterOptions.selectedStatuses.length > 0 ? filterOptions.selectedStatuses.length : 0;
            case 'teamName':
                // Only count if array exists and has actual selected values
                return filterOptions.teamName && Array.isArray(filterOptions.teamName) && 
                    filterOptions.teamName.length > 0 ? filterOptions.teamName.length : 0;
            case 'assignedTL':
                // Only count if array exists and has actual selected values
                return filterOptions.assignedTL && Array.isArray(filterOptions.assignedTL) && 
                    filterOptions.assignedTL.length > 0 ? filterOptions.assignedTL.length : 0;
            case 'leadActivity':
                // Count if no activity checkbox is checked or date is provided
                let count = 0;
                if (filterOptions.noActivity) count++;
                if (filterOptions.noActivityDate) count++;
                return count;
            default:
                return 0;
        }
    };

    // Function to load more items for infinite scroll
    const loadMoreItems = () => {
        setIsLoadingMore(true);
        // Simulate loading delay for better UX
        setTimeout(() => {
            setDisplayedItemsCount(prev => prev + itemsPerLoad);
            setIsLoadingMore(false);
        }, 300);
    };

    // Reset displayed items count when filters change
    useEffect(() => {
        setDisplayedItemsCount(50); // Reset to initial count
    }, [searchTerm, filterOptions, selectedLoanType]);

    // Scroll to load more functionality
    useEffect(() => {
        const handleScroll = () => {
            // Check if user has scrolled near the bottom of the page
            const threshold = 500; // Load more when 500px from bottom
            const distanceFromBottom = document.documentElement.scrollHeight - 
                                      (window.innerHeight + window.scrollY);
            
            if (distanceFromBottom < threshold && hasMoreItems && !isLoadingMore) {
                loadMoreItems();
            }
        };

        // Debounce scroll event for better performance
        let timeoutId;
        const debouncedHandleScroll = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(handleScroll, 100);
        };

        window.addEventListener('scroll', debouncedHandleScroll);
        return () => {
            window.removeEventListener('scroll', debouncedHandleScroll);
            clearTimeout(timeoutId);
        };
    }, [hasMoreItems, isLoadingMore]);

    // Load leads function - OPTIMIZED for speed
    // ⚡ PERFORMANCE: Memoized loadLeads function
    const loadLeads = useCallback(async () => {
        const startTime = performance.now();
        
        // ⚡ IMMEDIATE CHECKS: Minimal validation for speed
        if (!userId) {
            setError('User authentication required');
            return;
        }

        setLoadingLeads(true);
        // Don't set isLoading to keep interface responsive
        setError('');

        try {
            // 🚀 MINIMAL API CALL: Fastest possible request
            const response = await fetch(`${apiBaseUrl}/leads?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const leadsArray = data.items || data || [];

            // ⚡ MINIMAL PROCESSING: Only essential transformations
            const processedLeads = leadsArray.map(lead => ({
                ...lead,
                // 🔥 ESSENTIAL ONLY: Basic display fields
                name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown',
                mobile_number: lead.mobile_number || lead.phone,
                status: typeof lead.status === 'object' ? lead.status?.name : lead.status,
                sub_status: typeof lead.sub_status === 'object' ? lead.sub_status?.name : lead.sub_status,
                loan_type_name: lead.loan_type_name || 'Unknown'
            }));

            setLeads(processedLeads);

            // 🎯 IMMEDIATE UI UPDATE: Show leads instantly
            setFilteredLeads(processedLeads);
            setLoadingLeads(false);
            setIsLoading(false);

            const loadTime = performance.now() - startTime;

        } catch (error) {
            setError(error.message);
            setIsLoading(false);
            setLoadingLeads(false);
        }
    }, [userId, setError, setLoadingLeads, setIsLoading, setLeads, setFilteredLeads]); // Include dependencies

    // Load loan types with caching
    const loadLoanTypes = async () => {
        setLoadingLoanTypes(true);
        try {
            // Check cache first (5 minute cache)
            const cacheKey = 'leadcrm_loan_types';
            const cacheTimeKey = 'leadcrm_loan_types_time';
            const cachedData = localStorage.getItem(cacheKey);
            const cacheTime = localStorage.getItem(cacheTimeKey);
            
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            
            if (cachedData && cacheTime && parseInt(cacheTime) > fiveMinutesAgo) {
                const data = JSON.parse(cachedData);
                setLoanTypes(data);
                return;
            }
            
            const response = await fetch(`${apiBaseUrl}/loan-types?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();

                // Process loan types to ensure consistent format
                const loanTypesData = data.items || data.loan_types || data || [];

                const processedLoanTypes = [
                    { _id: 'all', name: 'All Leads', description: 'Show all leads' },
                    ...loanTypesData
                ];
                
                setLoanTypes(processedLoanTypes);
                
                // Cache the result
                localStorage.setItem(cacheKey, JSON.stringify(processedLoanTypes));
                localStorage.setItem(cacheTimeKey, Date.now().toString());

                // Store a mapping of loan type names to IDs for easier filtering
                const mapping = {};
                loanTypesData.forEach(lt => {
                    if (lt._id && lt.name) {
                        mapping[lt.name.toLowerCase()] = lt._id;

                        // Handle special case for PL & ODD
                        if (lt._id === 'personal' || lt.name.includes('Personal')) {
                            mapping['pl & odd'] = lt._id;
                        }
                    }
                });

                // Store mapping in component state for reference during filtering
                window.loanTypeNameToId = mapping;
            }
        } catch (error) {

            // Fallback loan types
            setLoanTypes([
                { _id: 'all', name: 'All Leads', description: 'Show all leads' },
                { _id: 'personal', name: 'Personal Loan', description: 'Personal loans' },
                { _id: 'home', name: 'Home Loan', description: 'Home loans' },
            ]);

            // Store a fallback mapping
            window.loanTypeNameToId = {
                'personal loan': 'personal',
                'pl & odd': 'personal',
                'home loan': 'home'
            };
        } finally {
            setLoadingLoanTypes(false);
        }
    };

    // Load statuses from API
    const loadStatuses = async () => {
        setLoadingStatuses(true);
        try {
            // Use the same admin API endpoint as StatusManagementTab
            const response = await fetch(`${apiBaseUrl}/leads/admin/statuses?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });


            if (response.ok) {
                const statusesData = await response.json();

                // Process the data based on response structure (same as StatusManagementTab)
                let processedStatuses = [];
                if (Array.isArray(statusesData)) {
                    processedStatuses = statusesData;
                } else if (statusesData && Array.isArray(statusesData.statuses)) {
                    processedStatuses = statusesData.statuses;
                } else if (statusesData && Array.isArray(statusesData.data)) {
                    processedStatuses = statusesData.data;
                } else {
                    processedStatuses = [];
                }


                // Filter statuses for the current department
                const departmentStatuses = processedStatuses.filter(status => {
                    // Handle both old format (status.department) and new format (department_ids)
                    if (status.department) {
                        return status.department === department;
                    }
                    
                    // Check if status has department_ids field
                    if (status.department_ids) {
                        // If department_ids is an array, check if department is in it
                        if (Array.isArray(status.department_ids)) {
                            return status.department_ids.includes(department);
                        }
                        // If department_ids is a string, compare directly
                        return status.department_ids === department;
                    }
                    
                    // If department_ids is null/undefined, include the status (assume it's for all departments)
                    return true;
                });

                // Extract status names for backward compatibility with existing filter logic
                const statusNames = departmentStatuses.map(status => status.name);
                setAllStatuses(statusNames);
                
            } else {
                // Fallback to hardcoded statuses
                setAllStatuses(COLUMN_SELECT_OPTIONS.status);
            }
        } catch (error) {
            // Fallback to hardcoded statuses
            setAllStatuses(COLUMN_SELECT_OPTIONS.status);
        } finally {
            setLoadingStatuses(false);
        }
    };

    // Load statuses and sub-statuses from API and create mappings
    const loadStatusesAndSubStatuses = async () => {
        setLoadingStatuses(true);
        try {
            // Use the same admin API endpoint as StatusManagementTab
            const response = await fetch(`${apiBaseUrl}/leads/admin/statuses?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const statusesData = await response.json();

                // Process the data based on response structure (same as StatusManagementTab)
                let processedStatuses = [];
                if (Array.isArray(statusesData)) {
                    processedStatuses = statusesData;
                } else if (statusesData && Array.isArray(statusesData.statuses)) {
                    processedStatuses = statusesData.statuses;
                } else if (statusesData && Array.isArray(statusesData.data)) {
                    processedStatuses = statusesData.data;
                } else {
                    processedStatuses = [];
                }

                // Filter statuses for the current department
                const departmentStatuses = processedStatuses.filter(status => {
                    // Handle both old format (status.department) and new format (department_ids)
                    if (status.department) {
                        return status.department === department;
                    }
                    
                    // Check if status has department_ids field
                    if (status.department_ids) {
                        // If department_ids is an array, check if department is in it
                        if (Array.isArray(status.department_ids)) {
                            return status.department_ids.includes(department);
                        }
                        // If department_ids is a string, compare directly
                        return status.department_ids === department;
                    }
                    
                    // If department_ids is null/undefined, include the status (assume it's for all departments)
                    return true;
                });


                // Extract main statuses and all sub-statuses
                const mainStatusesArray = [];
                const allSubStatusesArray = [];
                const subToMainMap = {};
                const statusHierarchyMap = {};

                departmentStatuses.forEach((status, index) => {
                    
                    // Extract the main status name
                    const statusName = status.name;
                    mainStatusesArray.push(statusName);
                    
                    // Extract sub-statuses list
                    const subStatusesList = status.sub_statuses || [];
                    
                    // Build hierarchy: main_status -> [sub_statuses] with proper names
                    const subStatusNames = subStatusesList.map(subStatus => 
                        typeof subStatus === 'object' ? 
                            (subStatus.name || subStatus.status_name || subStatus) : subStatus
                    );
                    statusHierarchyMap[statusName] = subStatusNames;

                    // Build sub-status to main status mapping
                    subStatusesList.forEach(subStatus => {
                        // Extract sub-status name if it's an object
                        const subStatusName = typeof subStatus === 'object' ? 
                            (subStatus.name || subStatus.status_name || subStatus) : subStatus;
                        
                        allSubStatusesArray.push(subStatusName);
                        subToMainMap[subStatusName] = statusName;
                    });
                });


                // Set the state with our extracted data
                setAllStatuses(mainStatusesArray);
                setAllSubStatuses(allSubStatusesArray);
                setSubStatusToMainStatus(subToMainMap);
                setStatusHierarchy(statusHierarchyMap);

            } else {
                // Fallback to hardcoded mapping
                setAllStatuses(COLUMN_SELECT_OPTIONS.status);
                setAllSubStatuses(Object.keys(subStatusToMainStatusMap));
                setSubStatusToMainStatus(subStatusToMainStatusMap);

                // Create hierarchy from hardcoded mapping
                const hierarchyMap = {};
                Object.entries(subStatusToMainStatusMap).forEach(([subStatus, mainStatus]) => {
                    if (!hierarchyMap[mainStatus]) {
                        hierarchyMap[mainStatus] = [];
                    }
                    hierarchyMap[mainStatus].push(subStatus);
                });
                
                setStatusHierarchy(hierarchyMap);
            }
        } catch (error) {
            // Fallback to hardcoded mapping
            setAllStatuses(COLUMN_SELECT_OPTIONS.status);
            setAllSubStatuses(Object.keys(subStatusToMainStatusMap));
            setSubStatusToMainStatus(subStatusToMainStatusMap);

            // Create hierarchy from hardcoded mapping
            const hierarchyMap = {};
            Object.entries(subStatusToMainStatusMap).forEach(([subStatus, mainStatus]) => {
                if (!hierarchyMap[mainStatus]) {
                    hierarchyMap[mainStatus] = [];
                }
                hierarchyMap[mainStatus].push(subStatus);
            });
            setStatusHierarchy(hierarchyMap);
        } finally {
            setLoadingStatuses(false);
        }
    };

    // Update lead status based on sub-status selection
    const updateLeadStatus = async (leadId, subStatus) => {
        try {
            // Handle if subStatus is an object with name property
            const subStatusValue = typeof subStatus === 'object' ? subStatus.name : subStatus;
            
            // Find the main status for this sub-status using the API-loaded mapping
            const mainStatus = subStatusToMainStatus[subStatusValue];
            if (!mainStatus) {
                message.error('Invalid sub-status selected');
                return;
            }
            
            // Handle if mainStatus is an object with name property
            const mainStatusValue = typeof mainStatus === 'object' ? mainStatus.name : mainStatus;
            

            const response = await fetch(`${apiBaseUrl}/leads/${leadId}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: mainStatusValue,
                    sub_status: subStatusValue
                })
            });

            if (response.ok) {
                // Show status change popup with custom_lead_id
                const updatedLead = leads.find(lead => lead._id === leadId);
                if (updatedLead) {
                    setStatusChangeInfo({
                        customLeadId: updatedLead.custom_lead_id || updatedLead._id,
                        newStatus: subStatusValue
                    });
                    setShowStatusChangePopup(true);
                }

                // Reload leads to reflect the change
                await loadLeads();
                message.success(`Status: ${subStatus}`);
            } else {
            }
        } catch (error) {
        }
    };

    // Bulk select handlers
    const handleRowSelect = (leadId) => {
        setSelectedRows((prev) =>
            prev.includes(leadId)
                ? prev.filter((id) => id !== leadId)
                : [...prev, leadId]
        );
    };

    const handleSelectAll = () => {
        if (allRowsChecked) {
            setCheckedRows([]);
        } else {
            setCheckedRows(filteredLeads.map((_, idx) => idx));
        }
    };

    // Update select all checkbox based on selected rows
    useEffect(() => {
        if (selectedRows.length === filteredLeads.length && filteredLeads.length > 0) {
            setSelectAll(true);
        } else {
            setSelectAll(false);
        }
    }, [selectedRows, filteredLeads]);

    const handleCancelSelection = () => {
        setSelectedRows([]);
        setSelectAll(false);
        setShowCheckboxes(false);
        setCheckboxVisible(false);
        setCheckedRows([]);
    };

    const handleDeleteSelected = async () => {
        const rowsToDelete = checkboxVisible ? checkedRows : selectedRows;
        const leadsToDelete = checkboxVisible ?
            rowsToDelete.map(idx => filteredLeads[idx]._id) :
            rowsToDelete;

        if (leadsToDelete.length === 0) return;

        if (!window.confirm(`Are you sure you want to delete ${leadsToDelete.length} selected lead(s)?`)) {
            return;
        }

        for (const leadId of leadsToDelete) {
            try {
                await fetch(`${apiBaseUrl}/leads/${leadId}?user_id=${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('token')}`
                    }
                });
            } catch (error) {
            }
        }

        handleCancelSelection();
        loadLeads();
    };

    // Copy lead function - similar to LoginCRM
    const handleCopyLead = async () => {
        if (!selectedLead) {
            message.error('No lead selected to copy');
            return;
        }

        try {
            const userId = localStorage.getItem('userId');
            const apiUrl = `/api/leads/copy?user_id=${userId}`;
            
            // For the copy API, we'll send the lead ID and specify what to copy
            const copyData = {
                lead_id: selectedLead._id,
                copy_options: {
                    keep_custom_lead_id: true,
                    copy_activities: true,
                    copy_attachments: true,
                    copy_tasks: true,
                    copy_remarks: true,
                    copy_obligations: true
                },
                // Set status to "ACTIVE LEAD" for the copied lead
                override_values: {
                    status: "Active Leads",
                    sub_status: "Fresh Lead"  // Set as fresh lead
                }
            };
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(copyData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Get the newly created lead ID from the response
            const responseData = await response.json();
            const newLeadId = responseData.lead_id || responseData._id || responseData.id;
            
            if (newLeadId) {
                try {
                    // Make a second API call to ensure the status is set to "Active Leads"
                    const statusUpdateUrl = `/api/leads/${newLeadId}?user_id=${userId}`;
                    const statusUpdateResponse = await fetch(statusUpdateUrl, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({
                            status: "Active Leads",
                            sub_status: "Fresh Lead"
                        })
                    });
                    
                    if (!statusUpdateResponse.ok) {
                    }
                } catch (statusError) {
                    // Don't fail the whole operation if just the status update fails
                }
            }
            
            message.success('Lead copied successfully! The new lead has been created with "Active Leads" status.');
            
            // Refresh leads after copying
            loadLeads();
            
        } catch (error) {
            message.error(`Failed to copy lead: ${error.message}`);
        }
    };

    // PLOD-style handlers
    const handleShowCheckboxes = () => {
        setCheckboxVisible(true);
        setCheckedRows([]);
        setEditRow(null);
    };

    const handleCheckboxChange = (rowIdx) => {
        const newCheckedRows = checkedRows.includes(rowIdx)
            ? checkedRows.filter((idx) => idx !== rowIdx)
            : [...checkedRows, rowIdx];
        setCheckedRows(newCheckedRows);
    };

    const handleSelectChange = (rowIdx, colKey, value) => {
        const updated = [...editedLeads];
        updated[rowIdx] = { ...updated[rowIdx], [colKey]: value };
        setEditedLeads(updated);
    };

    // Handle status dropdown click
    const handleStatusDropdownClick = (rowIdx, event) => {
        event.stopPropagation(); // Prevent row click from opening lead details

        // If clicking the same dropdown, close it
        if (showStatusDropdown === rowIdx) {
            handleCloseStatusDropdown();
            return;
        }

        // Calculate dropdown position relative to viewport (fixed positioning)
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        const dropdownWidth = 280;
        
        // Calculate dynamic dropdown height based on content
        // Header height (~70px) + search input + navigation if needed
        let headerHeight = 80;
        
        // Count total options to determine content height
        let totalOptions = 0;
        if (department === "leads") {
            // For leads department, count main statuses or sub-statuses
            if (showMainStatuses || !selectedMainStatus) {
                totalOptions = Object.keys(statusHierarchy).length;
            } else if (selectedMainStatus && statusHierarchy[selectedMainStatus]) {
                totalOptions = statusHierarchy[selectedMainStatus].length;
            }
        } else {
            // For other departments, count available status options
            totalOptions = statusOptions.length;
        }
        
        // Each option is approximately 40px height
        const optionHeight = 40;
        const calculatedContentHeight = totalOptions * optionHeight;
        
        // Total dropdown height = header + content (max 300px for content to allow scrolling)
        const maxContentHeight = 300;
        const actualContentHeight = Math.min(calculatedContentHeight, maxContentHeight);
        const dynamicDropdownHeight = headerHeight + actualContentHeight;
        
        // Default position: below the button
        let top = rect.bottom + 5;
        let left = Math.max(10, rect.left);
        let maxHeight = Math.min(dynamicDropdownHeight, window.innerHeight - rect.bottom - 50);

        // Check if there's enough space below
        const spaceBelow = window.innerHeight - rect.bottom - 20;
        const spaceAbove = rect.top - 20;
        
        // If not enough space below, position above
        if (spaceBelow < Math.min(250, dynamicDropdownHeight) && spaceAbove >= 200) {
            maxHeight = Math.min(dynamicDropdownHeight, spaceAbove);
            // Position the dropdown so its bottom edge is just above the button (with 5px gap)
            top = rect.top - 5; // This will be the bottom of the dropdown
            // Since CSS top positions the top edge, we subtract the actual height
            top = top - maxHeight;
        }

        // Ensure dropdown doesn't go off-screen horizontally
        if (left + dropdownWidth > window.innerWidth) {
            left = window.innerWidth - dropdownWidth - 20;
        }

        // Ensure dropdown doesn't go above the screen
        if (top < 10) {
            const adjustment = 10 - top;
            top = 10;
            maxHeight = Math.max(200, maxHeight - adjustment);
        }

        const position = {
            top: top,
            left: left,
            maxHeight: Math.max(200, maxHeight) // Minimum usable height
        };

        setDropdownPosition(position);
        setShowStatusDropdown(rowIdx);
        
        // Reset hierarchical navigation state
        setSelectedMainStatus(null);
        setShowMainStatuses(true);
        setStatusSearchTerm(''); // Reset search term when opening dropdown
    };

    // Handle status change from dropdown - supports hierarchical navigation and sub-status selection
    const handleStatusChange = async (rowIdx, selectedItem, isMainStatus = false) => {
        const lead = filteredLeads[rowIdx];

        // Handle if selectedItem is an object with name property
        const selectedValue = typeof selectedItem === 'object' ? selectedItem.name : selectedItem;
        

        // If this is a main status click in leads department, navigate to sub-statuses
        if (department === "leads" && isMainStatus) {
            handleMainStatusClick(selectedValue);
            // Reset clicked status option when navigating to sub-statuses
            setTimeout(() => setClickedStatusOption(null), 200);
            return; // Don't update the lead yet, just navigate
        }

        // For leads department, this should be a sub-status selection
        if (department === "leads" && !isMainStatus) {
            // Check if this is actually a main status being selected directly (which shouldn't happen)
            // BUT allow it if user searched for it specifically
            if (statusHierarchy[selectedValue] && statusHierarchy[selectedValue].length > 0 && !statusSearchTerm) {
                message.warning(`"${selectedValue}" is a category. Please select a specific sub-status.`);
                return;
            }
            
            // Find the main status for this sub-status using the mapping
            // Use hardcoded mapping first, then fallback to state mapping
            let mainStatus = subStatusToMainStatusMap[selectedValue] || subStatusToMainStatus[selectedValue];
            
            // Fallback for common variations of "Not a lead" status
            if (!mainStatus && (selectedValue.toLowerCase().includes('not') && selectedValue.toLowerCase().includes('lead'))) {
                mainStatus = 'Not a lead';
            }
            
            
            if (!mainStatus) {
                // If no main status mapping exists, treat this as a direct status selection
                await updateDirectLeadStatus(lead._id, selectedValue, null);
                return;
            } else {
                // Extract main status name if it's an object
                const mainStatusName = typeof mainStatus === 'object' ? mainStatus.name : mainStatus;
                
                try {
                    // Determine the parent status for status cards
                    const parentStatus = getParentStatusForStatusCard(mainStatusName, selectedValue);
                    
                    // Check if this status should automatically set file_sent_to_login to true
                    const loginStatuses = [
                        'File sent to login', 'File Sent to Login', 'LOGIN FILE SENT', 'File Sent',
                        'Sent to Login', 'Login Submitted', 'Disbursed', 'Converted', 'Active Login',
                        'Approved', 'Loan Approved', 'Sanctioned', 'Login Approved', 'Login Done', 'Login Completed'
                    ];
                    
                    const shouldSetFileSentToLogin = loginStatuses.some(status => 
                        status.toLowerCase() === mainStatusName.toLowerCase() || 
                        status.toLowerCase() === selectedValue.toLowerCase()
                    );
                    
                    // Update lead status via API - include both main status and sub-status
                    const updatePayload = {
                        status: mainStatusName,
                        sub_status: selectedValue,
                        parent_status: parentStatus
                    };
                    
                    // Automatically set file_sent_to_login if this is a login-related status
                    if (shouldSetFileSentToLogin) {
                        updatePayload.file_sent_to_login = true;
                    }
                    
                    const response = await fetch(`${apiBaseUrl}/leads/${lead._id}?user_id=${userId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify(updatePayload)
                    });

                    if (response.ok) {
                        
                        // Update local state immediately for instant UI feedback
                        const updatedLeads = [...filteredLeads];
                        updatedLeads[rowIdx] = { 
                            ...updatedLeads[rowIdx], 
                            status: mainStatusName,
                            sub_status: selectedValue,
                            parent_status: parentStatus,
                            ...(shouldSetFileSentToLogin && { file_sent_to_login: true })
                        };
                        
                        setFilteredLeads(updatedLeads);

                        // Also update main leads state
                        const allLeadsUpdated = leads.map(l =>
                            l._id === lead._id ? { 
                                ...l, 
                                status: mainStatusName, 
                                sub_status: selectedValue,
                                parent_status: parentStatus,
                                ...(shouldSetFileSentToLogin && { file_sent_to_login: true })
                            } : l
                        );
                        setLeads(allLeadsUpdated);
                        
                        // Update editedLeads for consistency
                        setEditedLeads(allLeadsUpdated);
                        
                        // Immediately update status counts to reflect the change
                        // Status counts will update automatically via memoized statusCounts
                        
                        message.success(`Status updated to ${selectedValue} (Main: ${mainStatusName})`);
                        
                        // Close the dropdown and reset state
                        handleCloseStatusDropdown();
                        
                        // NO NEED TO RELOAD - we already updated the UI immediately
                        
                        return;
                    } else {
                        const errorData = await response.json();
                        throw new Error(`API Error: ${response.status}`);
                    }
                } catch (error) {
                    message.error('Failed to update status. Please try again.');
                    // Close dropdown even on error to reset visual state
                    handleCloseStatusDropdown();
                }
            }
        }
        
        // Final check: prevent main status from being selected directly for leads department
        // ONLY if we're in main status view AND user didn't search for it specifically
        if (department === "leads" && 
            statusHierarchy[selectedValue] && 
            statusHierarchy[selectedValue].length > 0 && 
            showMainStatuses && 
            !statusSearchTerm) {
            message.warning(`"${selectedValue}" is a category. Please navigate to it first and select a specific sub-status.`);
            handleCloseStatusDropdown();
            return;
        }
        
        
        // Fallback to simple status update for non-leads departments or direct status updates
        await updateDirectLeadStatus(lead._id, selectedValue, null);
    };

    // Helper function for direct status updates (without sub-status)
    const updateDirectLeadStatus = async (leadId, statusValue, subStatusValue = null) => {

        try {
            // Determine the parent status for status cards
            const parentStatus = getParentStatusForStatusCard(statusValue, subStatusValue);
            
            // Check if this status should automatically set file_sent_to_login to true
            const loginStatuses = [
                'File sent to login', 'File Sent to Login', 'LOGIN FILE SENT', 'File Sent',
                'Sent to Login', 'Login Submitted', 'Disbursed', 'Converted', 'Active Login',
                'Approved', 'Loan Approved', 'Sanctioned', 'Login Approved', 'Login Done', 'Login Completed'
            ];
            
            const shouldSetFileSentToLogin = loginStatuses.some(status => 
                status.toLowerCase() === statusValue.toLowerCase() || 
                (subStatusValue && status.toLowerCase() === subStatusValue.toLowerCase())
            );
            
            const updateData = { 
                status: statusValue,
                parent_status: parentStatus
            };
            
            if (subStatusValue) {
                updateData.sub_status = subStatusValue;
            }
            
            // Automatically set file_sent_to_login if this is a login-related status
            if (shouldSetFileSentToLogin) {
                updateData.file_sent_to_login = true;
            }

            // Update lead status via API
            const response = await fetch(`${apiBaseUrl}/leads/${leadId}?user_id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                // Update local state immediately for instant UI feedback
                const updatedLeads = [...filteredLeads];
                const leadIndex = updatedLeads.findIndex(l => l._id === leadId);
                if (leadIndex !== -1) {
                    updatedLeads[leadIndex] = { 
                        ...updatedLeads[leadIndex], 
                        status: statusValue,
                        parent_status: parentStatus,
                        ...(subStatusValue && { sub_status: subStatusValue }),
                        ...(shouldSetFileSentToLogin && { file_sent_to_login: true })
                    };
                    setFilteredLeads(updatedLeads);
                }

                // Also update main leads state
                const allLeadsUpdated = leads.map(l =>
                    l._id === leadId ? { 
                        ...l, 
                        status: statusValue,
                        parent_status: parentStatus,
                        ...(subStatusValue && { sub_status: subStatusValue }),
                        ...(shouldSetFileSentToLogin && { file_sent_to_login: true })
                    } : l
                );
                setLeads(allLeadsUpdated);
                
                // Update editedLeads for consistency
                setEditedLeads(allLeadsUpdated);

                // Immediately update status counts to reflect the change
                // Status counts will update automatically via memoized statusCounts

                // Close dropdown after selection
                handleCloseStatusDropdown();
                
                message.success('Status updated successfully');
                
                // NO NEED TO RELOAD - UI is already updated immediately
            } else {
                throw new Error('Failed to update status');
            }
        } catch (error) {
            message.error('Failed to update status');
            // Close dropdown even on error to reset visual state
            handleCloseStatusDropdown();
        }
    };

    // Helper function to check if a status is a sub-status
    const isSubStatus = (statusName) => {
        return subStatusToMainStatus && subStatusToMainStatus[statusName] !== undefined;
    };

    // Get filtered status options for dropdown - enhanced for hierarchical navigation and direct search
    const getFilteredStatusOptions = () => {
        
        // When department is "leads", show hierarchical status navigation
        if (department === "leads") {
            // If there's a search term, prioritize showing direct matches from all sub-statuses
            if (statusSearchTerm) {
                
                // Collect all sub-statuses from all main statuses
                const allSubStatuses = [];
                Object.entries(statusHierarchy).forEach(([mainStatus, subStatuses]) => {
                    subStatuses.forEach(subStatus => {
                        allSubStatuses.push(subStatus);
                    });
                });
                
                
                // Filter sub-statuses that match the search term (prioritize exact matches)
                const exactMatches = allSubStatuses.filter(status => {
                    const statusName = typeof status === 'object' ? status.name : status;
                    const isExactMatch = statusName.toLowerCase() === statusSearchTerm.toLowerCase();
                    return isExactMatch;
                });
                
                const partialMatches = allSubStatuses.filter(status => {
                    const statusName = typeof status === 'object' ? status.name : status;
                    const isPartialMatch = statusName.toLowerCase().includes(statusSearchTerm.toLowerCase()) && 
                                         statusName.toLowerCase() !== statusSearchTerm.toLowerCase();
                    return isPartialMatch;
                });
                
                // Combine exact matches first, then partial matches
                const directSubStatusMatches = [...exactMatches, ...partialMatches];
                
                
                // If we have direct sub-status matches, return them
                if (directSubStatusMatches.length > 0) {
                    return directSubStatusMatches;
                }
                
                // If no direct sub-status matches, fall back to searching main statuses
            }
            
            // If showing main statuses (initial view) or no direct sub-status matches found
            if (showMainStatuses || statusSearchTerm) {
                const mainStatusOptions = Object.keys(statusHierarchy);
                
                if (!statusSearchTerm) {
                    return mainStatusOptions;
                }
                
                // Enhanced search - search both main statuses and their sub-statuses
                const filtered = mainStatusOptions.filter(status => {
                    const statusName = typeof status === 'object' ? status.name : status;
                    const mainStatusMatch = statusName.toLowerCase().includes(statusSearchTerm.toLowerCase());
                    
                    // Also search in sub-statuses of this main status
                    const subStatuses = statusHierarchy[statusName] || [];
                    const subStatusMatch = subStatuses.some(subStatus => {
                        const subStatusName = typeof subStatus === 'object' ? subStatus.name : subStatus;
                        return subStatusName.toLowerCase().includes(statusSearchTerm.toLowerCase());
                    });
                    
                    const isMatch = mainStatusMatch || subStatusMatch;
                    return isMatch;
                });
                
                return filtered;
            } 
            // If showing sub-statuses for selected main status (without search)
            else if (selectedMainStatus && !showMainStatuses) {
                const subStatusOptions = statusHierarchy[selectedMainStatus] || [];
                return subStatusOptions;
            }
        }
        
        // Fallback to main statuses or default list for other departments
        const statusOptions = allStatuses.length > 0 
            ? allStatuses 
            : ["Active Login", "Approve", "Disbursed", "Rejected", "Customer Not Responding", "Customer Cancelled", "Lost by Mistake", "Lost Login"];
        
        
        if (!statusSearchTerm) {
            return statusOptions;
        }
        
        const filtered = statusOptions.filter(status => {
            const statusName = typeof status === 'object' ? status.name : status;
            const isMatch = statusName.toLowerCase().includes(statusSearchTerm.toLowerCase());
            return isMatch;
        });
        
        return filtered;
    };
    
    // Helper function to handle main status click (navigate to sub-statuses)
    const handleMainStatusClick = (mainStatus) => {
        
        setSelectedMainStatus(mainStatus);
        setShowMainStatuses(false);
        setStatusSearchTerm(''); // Clear search when navigating
        
        
        // Add a delay to see the state change in the next render
        setTimeout(() => {
        }, 100);
    };

    // Helper function to go back to main statuses view
    const handleBackToMainStatuses = () => {
        setSelectedMainStatus(null);
        setShowMainStatuses(true);
        setStatusSearchTerm(''); // Clear search when navigating
    };

    // Helper function to reset dropdown state when closing
    const handleCloseStatusDropdown = () => {
        setShowStatusDropdown(null);
        setSelectedMainStatus(null);
        setShowMainStatuses(true);
        setStatusSearchTerm('');
        setClickedStatusOption(null); // Reset clicked status option
    };

    // Get main status for a sub-status to provide context in the dropdown
    const getMainStatusForSubStatus = (subStatus) => {
        const mainStatus = subStatusToMainStatus[subStatus] || '';
        // Handle case where mainStatus could be an object with name property
        if (mainStatus && typeof mainStatus === 'object' && mainStatus.name) {
            return mainStatus.name;
        }
        return mainStatus;
    };

    const handleRowBlur = () => {
        setTimeout(() => {
            // Stay in selection mode
        }, 100);
    };

    const allRowsChecked = checkedRows.length === filteredLeads.length && filteredLeads.length > 0;

    const handleRowClick = (rowIdx) => {
        // Reset obligation changes state when selecting a new lead
        setHasUnsavedObligationChanges(false);
        setSelectedLead(filteredLeads[rowIdx]);
        setActiveTab(0);
        setOpenSections([0]); // Auto-open the About section (index 0) when opening a lead
    };

    const handleBackToTable = () => {
        // Check for unsaved obligation changes before navigating back
        if (hasUnsavedObligationChanges) {
            // Show the unsaved changes modal instead of navigating immediately
            setShowUnsavedChangesModal(true);
            // Store the action to be performed after user decision
            setPendingTabNavigation('back_to_table');
            return; // Don't navigate yet, wait for user decision
        }
        
        // If no unsaved changes, proceed with normal navigation
        setHasUnsavedObligationChanges(false);
        setSelectedLead(null);
    };

    // Define table columns - matching the full table layout
    const columns = [
        { key: "index", label: "#", className: "text-left whitespace-nowrap" },
        { key: "created_at", label: "LEAD DATE & AGE", className: "text-left whitespace-nowrap" },
        { key: "created_by", label: "CREATED BY", className: "text-left whitespace-nowrap" },
        { key: "department_name", label: "TEAM NAME", className: "text-left whitespace-nowrap" },
        { key: "name", label: "CUSTOMER NAME", className: "text-left whitespace-nowrap" },
        { key: "status", label: "STATUS", className: "text-left whitespace-nowrap" },
        { key: "eligibility_details.totalIncome", label: "TOTAL INCOME", className: "text-left whitespace-nowrap" },
        { key: "eligibility", label: "LOAN ELIGIBILITY", className: "text-left whitespace-nowrap" },
        { key: "financial_details.cibil_score", label: "CIBIL SCORE", className: "text-left whitespace-nowrap" },

        { key: "city", label: "CITY", className: "text-left whitespace-nowrap" },
        { key: "company_name", label: "COMPANY NAME", className: "text-left whitespace-nowrap" },
        { key: "company_category", label: "COMPANY CATEGORY", className: "text-left whitespace-nowrap" },
    ];

    // Format currency with enhanced handling of different input formats
    const formatCurrency = (amount) => {
        if (amount === null || amount === undefined) return '-';
        if (amount === "N/A" || amount === "n/a" || amount === "NA") return "N/A";
        
        try {
            // Handle objects (prevent React rendering errors)
            if (typeof amount === 'object') {
                // Check common properties for financial amounts
                const checkProps = [
                    'totalIncome', 'amount', 'eligibility_amount', 'eligible_amount', 
                    'loan_amount', 'eligibility', 'value', 'income', 'salary'
                ];
                
                for (const prop of checkProps) {
                    if (amount[prop] !== undefined) {
                        return formatCurrency(amount[prop]);
                    }
                }
                
                // Otherwise convert to string to avoid React errors
                return '-';
            }
            
            // If it's already a formatted string with commas and ₹ symbol, return as is
            if (typeof amount === 'string' && amount.includes(',') && amount.includes('₹')) {
                return amount;
            }
            
            // If it's a string, try to parse it
            let numericAmount = amount;
            if (typeof amount === 'string') {
                // Remove any non-numeric characters except decimal point
                numericAmount = amount.replace(/[^\d.-]/g, '');
                numericAmount = parseFloat(numericAmount);
            }
            
            // If parsing failed or resulted in NaN, return dash
            if (isNaN(numericAmount)) {
                return '-';
            }
            
            // Format as Indian currency
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }).format(numericAmount);
        } catch (error) {
            return amount; // Return original on error
        }
    };

    // Format date in DD Month YYYY format
    const formatDate = (date) => {
        if (!date) return '-';
        const dateObj = new Date(date);
        const day = dateObj.getDate().toString().padStart(2, '0');
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const month = monthNames[dateObj.getMonth()];
        const year = dateObj.getFullYear();
        return `${day} ${month} ${year}`;
    };

    // Calculate days old from current date
    const calculateDaysOld = (date) => {
        if (!date) return 0;
        const currentDate = new Date();
        const leadDate = new Date(date);
        const timeDifference = currentDate.getTime() - leadDate.getTime();
        const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24));
        return daysDifference;
    };

    // Format date with days old
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

    const [showReassignmentPanel, setShowReassignmentPanel] = useState(false);

    // Handle lead actions from reassignment panel
    const handleLeadAction = (action, leadId) => {
        if (action === 'reassign_approved' || action === 'reassign_rejected') {
            // Refresh leads after reassignment action
            fetchLeads();
        }
    };

    // Load important questions from backend API with caching
    const fetchImportantQuestions = async () => {
        setLoadingQuestions(true);
        try {
            // Check cache first (10 minute cache)
            const cacheKey = 'leadcrm_important_questions';
            const cacheTimeKey = 'leadcrm_important_questions_time';
            const cachedData = localStorage.getItem(cacheKey);
            const cacheTime = localStorage.getItem(cacheTimeKey);
            
            const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
            
            if (cachedData && cacheTime && parseInt(cacheTime) > tenMinutesAgo) {
                const data = JSON.parse(cachedData);
                setImportantQuestions(data.questions || []);
                return;
            }
            
            const userId = localStorage.getItem('userId');
            const response = await fetch(`${apiBaseUrl}/lead-login/important-questions?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setImportantQuestions(data.questions || []);
                
                // Cache the result
                localStorage.setItem(cacheKey, JSON.stringify(data));
                localStorage.setItem(cacheTimeKey, Date.now().toString());
            }
        } catch (error) {
        } finally {
            setLoadingQuestions(false);
        }
    };

    // Handle validation of important questions
    const handleValidateQuestions = async (leadId, responses) => {
        try {
            const userId = localStorage.getItem('userId');
            const userName = localStorage.getItem('userName') || 'Unknown User';

            // Create activity data for logging question validation
            const activityData = {
                activity_type: 'question_validation',
                description: 'Important questions validated',
                created_by: userName,
                user_id: userId,
                created_at: new Date().toISOString(),
                details: {
                    questions_validated: Object.keys(responses).length,
                    question_ids: Object.keys(responses)
                }
            };

            // Add activity to responses data
            const dataWithActivity = {
                responses: responses,
                activity: activityData
            };

            // Send validation request
            const response = await fetch(`${apiBaseUrl}/lead-login/validate-questions/${leadId}?user_id=${userId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataWithActivity)
            });

            if (response.ok) {
                message.success('Questions validated successfully');

                // Update the lead with the validated responses
                const updatedLead = { ...selectedLead };
                if (!updatedLead.question_responses) {
                    updatedLead.question_responses = {};
                }

                // Update question_responses and importantquestion fields
                updatedLead.question_responses = { ...responses };
                updatedLead.importantquestion = { ...responses };
                updatedLead.important_questions_validated = true;

                // Update selected lead state
                setSelectedLead(updatedLead);

                // Update leads list
                setLeads(leads =>
                    leads.map(lead =>
                        lead._id === leadId ? updatedLead : lead
                    )
                );
            } else {
                message.error('Failed to validate questions');
            }
        } catch (error) {
            message.error('Error validating questions');
        }
    };

    // Fetch bank options from backend
    const fetchBankOptions = async () => {
        try {
            const response = await fetch(`${apiBaseUrl}/settings/bank-names?user_id=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                // Extract bank names from the BankNameInDB objects
                const bankNames = data.filter(bank => bank.is_active).map(bank => bank.name);
                setBankOptions(bankNames.length > 0 ? bankNames : ["HDFC", "ICICI", "SBI", "Axis"]);
            } else {
                const errorText = await response.text();
            }
        } catch (error) {
            // Keep default banks if fetch fails
        }
    };

    // --- SELECTED LEAD PAGE ---
    if (selectedLead) {
        const activeTabSection = detailSections[activeTab];
        const sectionData = activeTabSection.getContent(
            selectedLead,
            handleSelectedLeadFieldChange
        );

        return (
            <div className="min-h-screen bg-black text-white text-base">
                {/* Header */}
                <div className="flex items-center gap-3 px-2 sm:px-4 lg:px-6 py-6 bg-[#0c1019] border-b-4 border-cyan-400/70 shadow-lg w-full">
                    <button
                        onClick={handleBackToTable}
                        className="text-cyan-300 mr-2 px-2 py-1 text-xl font-bold rounded hover:bg-cyan-900/20 transition"
                        aria-label="Back"
                    >
                        {"←"}
                    </button>
                    <User className="text-cyan-300 w-8 h-6 sm:w-10 sm:h-8 drop-shadow" />
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-cyan-300 tracking-wide drop-shadow">
                            {selectedLead.name || 'Lead Details'}
                        </h1>
                        {selectedLead?.file_sent_to_login && (
                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                Sent to Login
                            </span>
                        )}
                    </div>
                    <div className="flex-1"></div>
                    <div className="flex flex-wrap gap-2">
                        {/* Show Copy Button regardless of department */}
                        {!selectedLead?.file_sent_to_login && 
                         (typeof selectedLead?.sub_status === 'string' ? selectedLead.sub_status : selectedLead?.sub_status?.name) === "FILE COMPLETED" &&
                         selectedLead?.important_questions_validated ? (
                            <button
                                onClick={() => setShowCopyLeadModal(true)}
                                className="bg-gradient-to-b from-cyan-400 to-blue-700 px-3 sm:px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-sm sm:text-base flex items-center"
                            >
                                <Copy className="mr-2 h-4 w-4" /> COPY THIS LEAD
                            </button>
                        ) : null}
                        {!selectedLead?.file_sent_to_login ? (
                            (typeof selectedLead?.sub_status === 'string' ? selectedLead.sub_status : selectedLead?.sub_status?.name) === "FILE COMPLETED" &&
                            selectedLead?.important_questions_validated ? (
                                <button
                                    onClick={() => setShowFileSentToLoginModal(true)}
                                    className="bg-gradient-to-b from-cyan-400 to-blue-700 px-3 sm:px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-sm sm:text-base"
                                >
                                    <span className="hidden sm:inline">FILE SENT TO LOGIN</span>
                                    <span className="sm:hidden">SEND TO LOGIN</span>
                                </button>
                            ) : null
                        ) : (
                            <button
                                disabled
                                className="bg-gradient-to-b from-green-400 to-green-700 px-3 sm:px-5 py-1.5 rounded-lg text-white font-bold shadow-lg uppercase tracking-wide transition text-sm sm:text-base opacity-70 cursor-not-allowed flex items-center"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                <span className="hidden sm:inline">ALREADY SENT</span>
                                <span className="sm:hidden">SENT</span>
                            </button>
                        )}
                        {selectedLead?.file_sent_to_login && (
                            <div className="flex items-center gap-1 bg-green-500/20 border border-green-500 text-green-400 px-3 py-1 rounded-full text-sm">
                                <span>Sent on {selectedLead?.login_department_sent_date ?
                                    new Date(selectedLead.login_department_sent_date).toLocaleDateString() :
                                    'unknown date'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* FileSentToLogin Modal */}
                {showFileSentToLoginModal && selectedLead && (
                    <FileSentToLoginSection
                        lead={selectedLead}
                        onClose={() => {
                            setShowFileSentToLoginModal(false);
                            // Refresh leads after sending to login
                            loadLeads();
                        }}
                        onUpdate={(updatedLead) => {
                            // Update the selected lead with the file_sent_to_login flag
                            setSelectedLead(updatedLead);

                            // Update the lead in the leads list
                            setLeads(leads =>
                                leads.map(lead =>
                                    lead._id === updatedLead._id ? { ...lead, file_sent_to_login: true } : lead
                                )
                            );
                        }}
                    />
                )}

                {/* CopyLead Modal */}
                {showCopyLeadModal && selectedLead && (
                    <CopyLeadSection
                        leadData={selectedLead}
                        onClose={() => {
                            setShowCopyLeadModal(false);
                            // Refresh leads after copying to show the new copy
                            loadLeads();
                        }}
                    />
                )}

                {/* Tabs */}
                <div className="flex flex-wrap items-center gap-2 px-2 sm:px-4 lg:px-7 py-3 bg-black border-b border-[#232c3a] w-full overflow-x-auto">
                    {detailSections.map((tab, idx) => (
                        <button
                            key={tab.label}
                            className={`
                                flex items-center px-3 sm:px-4 lg:px-6 py-2 sm:py-3 rounded-3xl font-extrabold border shadow-md text-sm sm:text-base lg:text-[1.05rem] transition whitespace-nowrap
                                ${idx === activeTab
                                    ? "bg-[#03B0F5] via-blue-700 to-cyan-500 text-white border-cyan-400 shadow-lg scale-105"
                                    : "bg-white text-[#03B0F5] border-[#2D3C56] hover:bg-cyan-400/10 hover:text-cyan-400"
                                }
                                focus:outline-none
                            `}
                            style={{
                                boxShadow: idx === activeTab ? "0 4px 16px 0 #1cb5e080" : undefined,
                                cursor: "pointer",
                                letterSpacing: "0.01em"
                            }}
                            onClick={() => {
                                handleTabNavigation(idx);
                                // Auto-open About section (index 0) only when switching to LEAD DETAILS tab (index 0)
                                if (!hasUnsavedObligationChanges || idx === activeTab) {
                                    setOpenSections(idx === 0 ? [0] : []);
                                }
                            }}
                        >
                            {tab.icon || null}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Section Content */}
                <div className="px-2 sm:px-4 lg:px-6 py-6 w-full">
                    <div className="p-2 sm:p-4 bg-white shadow-2xl w-full">
                        {sectionData.map((section, idx) => (
                            <div key={idx} className="mb-6 w-full">
                                {section.label && (
                                    <>
                                        {activeTab === 0 ? (
                                            // Collapsible dropdown for LEAD DETAILS tab only
                                            <button
                                                className="w-full px-2 sm:px-5 py-3 font-extrabold text-base sm:text-lg lg:text-[1.05rem] text-[#03B0F5] bg-gray-200 hover:bg-gray-300 border-2 border-gray-400 rounded-lg flex items-center justify-between transition-colors duration-200 shadow-md"
                                                onClick={() => {
                                                    // Use helper function to check for unsaved changes
                                                    handleSectionNavigation(idx);
                                                }}
                                            >
                                                <span>{section.label}</span>
                                                <svg
                                                    className={`w-5 h-5 transform transition-transform duration-200 ${openSections.includes(idx) ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        ) : (
                                            // Static header for other tabs
                                            <div className="px-2 sm:px-5 py-2 font-extrabold text-base sm:text-lg lg:text-[1.05rem] text-[#03B0F5]">
                                                {section.label}
                                            </div>
                                        )}
                                    </>
                                )}
                                {activeTab === 0 ? (
                                    // Conditional rendering for LEAD DETAILS tab only
                                    openSections.includes(idx) && (
                                        <div className="rounded-xl border-4 border-cyan-400/90 shadow-xl bg-white w-full mt-2 hover:border-cyan-400 transition-all duration-200 ring-1 ring-cyan-200">
                                            {section.content}
                                        </div>
                                    )
                                ) : (
                                    // Always show content for other tabs
                                    <div className="rounded-xl border-4 border-cyan-400/90 shadow-xl bg-white w-full hover:border-cyan-400 transition-all duration-200 ring-1 ring-cyan-200">
                                        {section.content}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Unsaved Changes Modal */}
                {showUnsavedChangesModal && (
                    <div className="fixed inset-0 bg-transparent bg-opacity-75 flex items-center justify-center z-50">
                        <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-w-md w-full mx-4">
                            <div className="p-6">
                                <div className="flex items-center mb-4">
                                    <svg 
                                        className="w-8 h-8 text-yellow-500 mr-3" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
                                        />
                                    </svg>
                                    <h3 className="text-lg font-bold text-white">Unsaved Changes</h3>
                                </div>
                                
                                <p className="text-gray-300 mb-6">
                                    Please Save the Changes??
                                </p>
                                
                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={cancelNavigation}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={confirmDiscardChanges}
                                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                    >
                                        Don't Save?
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- TABLE PAGE ---

    // Show loading while checking permissions
    if (permissionsLoading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                    <p>Loading permissions...</p>
                </div>
            </div>
        );
    }

    // Check if user has leads permission
    if (error && error.includes('permission')) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center bg-red-900/30 border border-red-500 p-8 rounded-lg max-w-lg">
                    <div className="flex items-center justify-center mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-4 text-red-400">Permission Denied</h2>
                    <p className="text-gray-300 mb-6">Your user role does not have permission to view leads.</p>

                    <div className="bg-black/50 p-4 rounded-md text-left mb-6">
                        <h3 className="font-bold mb-2 text-white">Required Permissions:</h3>
                        <ul className="list-disc pl-5 text-gray-300 space-y-1">
                            <li>show</li>
                            <li>own</li>
                            <li>view_other</li>
                            <li>all</li>
                            <li>junior</li>
                        </ul>
                    </div>

                    <p className="text-gray-400 text-sm">Please contact your administrator to update your role permissions.</p>
                </div>
            </div>
        );
    }

    // Show other errors
    if (error && !error.includes('permission')) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center bg-gray-900/50 border border-gray-700 p-8 rounded-lg max-w-lg">
                    <div className="flex items-center justify-center mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-4">Error</h2>
                    <p className="text-gray-300 mb-6">{error}</p>

                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                        Refresh Page
                    </button>
                </div>
            </div>
        );
    }

    // Show loading state only for critical errors, not permissions
    if (permissionsLoading && !userId) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-8"></div>
                    <h2 className="text-2xl font-bold mb-4">Loading</h2>
                    <p className="text-gray-400">Initializing...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans overflow-y-scroll max-h-screen">
            <div className="relative z-10 px-6 py-8 space-y-10 bg-black">
                {/* Error Banner */}
                {error && (
                    <div className="bg-red-600 text-white p-4 mb-6 rounded-xl shadow-lg flex items-center justify-between">
                        <div className="flex items-center">
                            <XCircle className="w-6 h-6 mr-2" />
                            <p className="font-bold">{error}</p>

                            {/* Retry button - only show for permission errors */}
                            {error.includes('permission') && (
                                <button
                                    onClick={() => {
                                        // Clear permission cache and retry
                                        localStorage.removeItem('userPermissions');
                                        localStorage.removeItem('userRoleId');
                                        setError('');
                                        setPermissions({});
                                        setPermissionsLoading(true);

                                        // Reload permissions and leads
                                        loadPermissions()
                                            .then(perms => {
                                                if (perms && hasLeadsPermission('show')) {
                                                    loadLeads();
                                                }
                                            });
                                    }}
                                    className="ml-4 px-4 py-2 bg-white text-red-600 rounded hover:bg-gray-200 transition"
                                >
                                    Retry
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setError('')}
                            className="text-white hover:text-red-200"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Loading Indicator */}
                {permissionsLoading && (
                    <div className="bg-blue-600 text-white p-4 mb-6 rounded-xl shadow-lg flex items-center">
                        <div className="animate-spin mr-2 h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>
                        <p className="font-bold">Loading permissions...</p>
                    </div>
                )}

                {/* Status Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 gap-6 mb-8">
                    {statusCardConfig.map(({ key, label, icon: Icon, gradient, shadowColor }, index) => (
                        <div key={index} className={`p-4 rounded-xl bg-gradient-to-r ${gradient} shadow-lg ${shadowColor || 'shadow-lg'} flex-1`}>
                            <div className="flex justify-between items-center">
                                <Icon className="w-6 h-6 text-white" />
                                {loadingLeads ? (
                                    <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>
                                ) : (
                                    <span className="text-xl font-bold text-white">{statusCounts[key] || 0}</span>
                                )}
                            </div>
                            <p className="mt-4 text-md text-white font-medium uppercase tracking-wide">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Sections Loading Indicator */}
                {loadingLeads && (
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-3 mb-6 rounded-xl shadow-lg flex items-center">
                        <div className="animate-spin mr-3 h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                        <p className="font-medium">Loading leads and preparing sections...</p>
                    </div>
                )}

                {/* Table Section */}
                <div className="overflow-auto rounded-xl">
                    {/* Unified Controls Row - Select, Filter, Search and Results Indicator */}
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            {/* Select Button - Only show for Super Admin */}
                            {isSuperAdmin() && !checkboxVisible ? (
                                <button
                                    className="bg-[#03B0F5] text-white px-5 py-3 rounded-lg font-bold shadow hover:bg-[#0280b5] transition text-base"
                                    onClick={handleShowCheckboxes}
                                >
                                    {checkedRows.length > 0
                                        ? `Select (${checkedRows.length})`
                                        : "Select"}
                                </button>
                            ) : isSuperAdmin() && checkboxVisible ? (
                                <div className="flex items-center gap-6 bg-gray-900 rounded-lg p-3">
                                    <label className="flex items-center cursor-pointer text-[#03B0F5] font-bold">
                                        <input
                                            type="checkbox"
                                            className="accent-blue-500 mr-2"
                                            checked={allRowsChecked}
                                            onChange={handleSelectAll}
                                            style={{ width: 18, height: 18 }}
                                        />
                                        Select All
                                    </label>
                                    <span className="text-white font-semibold">
                                        {checkedRows.length} row{checkedRows.length !== 1 ? "s" : ""} selected
                                    </span>
                                    <button
                                        className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                                        onClick={handleDeleteSelected}
                                        disabled={checkedRows.length === 0}
                                    >
                                        Delete ({checkedRows.length})
                                    </button>
                                    <button
                                        className="px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                                        onClick={handleCancelSelection}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : null}

                            {/* Search Results Indicator */}
                            {(searchTerm || getActiveFilterCount() > 0) && (
                                <div className="text-base text-gray-300 bg-[#1b2230] px-4 py-3 rounded-lg border border-gray-600">
                                    {filteredLeads.length} of {editedLeads.length} leads
                                    {searchTerm && (
                                        <span className="ml-2">
                                            matching "<span className="text-cyan-400 font-semibold">{searchTerm}</span>"
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Secondary Data Loading Indicator */}
                            {(loadingLoanTypes || loadingQuestions) && (
                                <div className="flex items-center gap-2 text-gray-400 text-sm">
                                    <div className="animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
                                    <span>Loading filters...</span>
                                </div>
                            )}
                            
                            {/* Filter Button */}
                            <button
                                className={`px-5 py-3 rounded-lg font-bold shadow transition relative flex items-center gap-3 text-base ${getActiveFilterCount() > 0
                                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                                    : 'bg-gray-600 text-white hover:bg-gray-700'
                                    }`}
                                onClick={() => setShowFilterPopup(true)}
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

                            {/* Search Box */}
                            <div className="relative w-[320px]">
                                <input
                                    type="text"
                                    placeholder="Search leads..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full py-3 pl-10 pr-4 bg-[#1b2230] text-gray-300 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-base placeholder-gray-500 transition-all duration-200"
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

                    <div className="w-full transition-all duration-300 bg-black" style={{ marginLeft: 0 }}>
                        <div className="overflow-x-auto bg-black rounded-lg">
                            <table className="min-w-[1600px] w-full bg-black">
                                <thead className="bg-white">
                                    <tr>
                                        {isSuperAdmin() && checkboxVisible && (
                                            <th className="bg-white py-3 px-4 text-blue-600 font-bold">
                                                <input
                                                    type="checkbox"
                                                    className="accent-blue-500"
                                                    checked={allRowsChecked}
                                                    onChange={handleSelectAll}
                                                />
                                            </th>
                                        )}
                                        {columns.map((col, idx) => (
                                            <th
                                                key={idx}
                                                className={`bg-white px-4 py-1 text-md font-extrabold text-[#03b0f5] uppercase tracking-wider ${idx === 0 && !(isSuperAdmin() && checkboxVisible) ? "" : ""
                                                    } ${idx === columns.length - 1 && !(isSuperAdmin() && checkboxVisible)
                                                        ? ""
                                                        : ""
                                                    } ${col.className || ""}`}
                                            >
                                                {col.key === "created_by" ? (
                                                    <div className="flex items-left justify-left  gap-2">

                                                        <span>{col.label}</span>
                                                    </div>
                                                ) : (
                                                    col.label
                                                )}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-black">
                                    {loadingLeads ? (
                                        <tr>
                                            <td
                                                colSpan={(isSuperAdmin() && checkboxVisible) ? columns.length + 1 : columns.length}
                                                className="py-20 text-center text-gray-400 text-lg bg-black"
                                            >
                                                <div className="flex items-center justify-center gap-3">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                                    <span className="text-xl font-semibold">Loading Leads...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredLeads.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={(isSuperAdmin() && checkboxVisible) ? columns.length + 1 : columns.length}
                                                className="py-20 text-center text-gray-400 text-lg bg-black"
                                            >
                                                {searchTerm || getActiveFilterCount() > 0
                                                    ? "No leads match your search or filter criteria."
                                                    : "No leads available."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLeads.map((lead, rowIdx) => {
                                            // Check if this is the first "sent to login" lead to add visual separator
                                            const isFirstSentToLogin = rowIdx > 0 &&
                                                lead.file_sent_to_login &&
                                                !filteredLeads[rowIdx - 1].file_sent_to_login;

                                            return (
                                                <React.Fragment key={rowIdx}>

                                                    <tr
                                                        ref={el => (rowRefs.current[rowIdx] = el)}
                                                        className={`
                                                        border-b border-gray-800 hover:bg-gray-900/50 transition
                                                        ${lead.file_sent_to_login ? 'bg-gray-900/30' : 'bg-black'}
                                                        ${checkedRows.includes(rowIdx) ? "bg-blue-900/20" : ""}
                                                    `}
                                                        onClick={() => !(isSuperAdmin() && checkboxVisible) && handleRowClick(rowIdx)}
                                                        style={{ cursor: (isSuperAdmin() && checkboxVisible) ? "default" : "pointer" }}
                                                    >
                                                        {isSuperAdmin() && checkboxVisible && (
                                                            <td className="py-2 px-4 whitespace-nowrap">
                                                                <input
                                                                    type="checkbox"
                                                                    className="accent-blue-500"
                                                                    checked={checkedRows.includes(rowIdx)}
                                                                    onChange={() => handleCheckboxChange(rowIdx)}
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="text-sm font-semibold py-2 px-4 whitespace-nowrap text-white">{rowIdx + 1}</td>
                                                        <td className="text-sm font-semibold py-2 px-4 whitespace-nowrap text-white">{formatDateWithAge(lead.created_at)}</td>
                                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                            <div className="flex items-center gap-3">
                                              
                                                <span className='text-sm text-wrap'>{typeof lead.created_by_name === 'object' ? lead.created_by_name?.name || "-" : lead.created_by_name || "-"}</span>
                                            </div>
                                        </td>
                                        <td className="text-sm font-semibold py-2 px-4 whitespace-nowrap text-white">{typeof lead.department_name === 'object' ? lead.department_name?.name || "-" : lead.department_name || "-"}</td>
                                                        <td className="text-sm font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                            <div className="flex items-center gap-3">
                                                                
                                                                <span className='text-wrap'>{lead.name || "-"}</span>
                                                            </div>
                                                        </td>
                                                        <td
                                                            className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white relative"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {lead.file_sent_to_login ? (
                                                                <div className="flex items-center justify-center">
                                                                    <span className="bg-green-500 text-white text-sm px-3 py-2 rounded-full font-bold flex items-center">
                                                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                                                        </svg>
                                                                        Login
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <div className="relative status-dropdown-container">
                                                                    <button
                                                                        className="bg-gray-800 text-white py-2 px-3 rounded-md border border-gray-600 hover:bg-gray-700 transition-colors w-full min-w-[150px] flex justify-between items-center status-dropdown-button"
                                                                        onClick={(e) => handleStatusDropdownClick(rowIdx, e)}
                                                                    >
                                                                        <div className="font-medium text-white truncate w-full text-sm text-left">
                                                                            {(() => {
                                                                                if (lead.sub_status) {
                                                                                    return (
                                                                                        <div>
                                                                                            <div>{typeof lead.sub_status === 'object' ? (lead.sub_status.name || 'Unknown Sub-Status') : (lead.sub_status || 'Unknown Sub-Status')}</div>
                                                                                            <div className="text-xs text-gray-400">
                                                                                                {typeof lead.status === 'object' ? (lead.status.name || 'Unknown Status') : (lead.status || 'Unknown Status')}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                } else {
                                                                                    return (typeof lead.status === 'object' ? (lead.status.name || 'Select Status') : (lead.status || 'Select Status'));
                                                                                }
                                                                            })()}
                                                                        </div>
                                                                        <svg
                                                                            className={`w-5 h-5 transition-transform ${showStatusDropdown === rowIdx ? 'rotate-180' : ''}`}
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            viewBox="0 0 24 24"
                                                                        >
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            )}
                                                            
                                                            {showStatusDropdown === rowIdx && (
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
                                                                        overflowY: 'hidden' // Hide outer scrollbar
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        e.nativeEvent.stopImmediatePropagation();
                                                                    }}
                                                                    onScroll={(e) => {
                                                                        e.stopPropagation();
                                                                        e.nativeEvent.stopImmediatePropagation();
                                                                    }}
                                                                    onWheel={(e) => {
                                                                        e.stopPropagation();
                                                                        e.nativeEvent.stopImmediatePropagation();
                                                                    }}
                                                                    >
                                                                        {/* Header with navigation */}
                                                                        <div className="p-3 border-b border-gray-200 bg-white sticky top-0 z-10 rounded-t-lg">
                                                                            {/* Navigation header for leads department */}
                                                                            {department === "leads" && !showMainStatuses && selectedMainStatus && (
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
                                                                                        {selectedMainStatus}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            
                                                                            {/* Search input */}
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
                                                                                        department === "leads" 
                                                                                            ? (showMainStatuses ? "Search statuses and sub-statuses..." : "Search sub-statuses...") 
                                                                                            : "Search status options..."
                                                                                    }
                                                                                    value={statusSearchTerm}
                                                                                    onChange={(e) => {
                                                                                        setStatusSearchTerm(e.target.value);
                                                                                    }}
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
                                                                            onScroll={(e) => e.stopPropagation()}>
                                                                            {getFilteredStatusOptions().length > 0 ? (
                                                                                getFilteredStatusOptions().map((status, statusIndex) => {
                                                                                    const statusName = typeof status === 'object' ? status.name : status;
                                                                                    
                                                                                    // Enhanced logic to detect if we're showing sub-statuses from direct search
                                                                                    const isMainStatusView = department === "leads" && showMainStatuses && !statusSearchTerm;
                                                                                    const isSubStatusView = department === "leads" && (!showMainStatuses || statusSearchTerm);
                                                                                    const isDirectSearchResult = statusSearchTerm && department === "leads";
                                                                                    
                                                                                    // Check if this status is a main status (has sub-statuses in hierarchy)
                                                                                    const isActualMainStatus = statusHierarchy[statusName] && statusHierarchy[statusName].length > 0;
                                                                                    
                                                                                    // Check if current status matches lead's status
                                                                                    const isCurrentStatus = (
                                                                                        (typeof lead.sub_status === 'object' ? (lead.sub_status?.name || 'Unknown') === statusName : lead.sub_status === statusName) || 
                                                                                        (typeof lead.status === 'object' ? (lead.status?.name || 'Unknown') === statusName : lead.status === statusName)
                                                                                    );
                                                                                    
                                                                                    // Determine if this should be treated as a main status click
                                                                                    // Only treat as main status if: 1) We're in main status view, 2) No search term, 3) This is actually a main status with sub-statuses
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
                                                                                                    handleStatusChange(rowIdx, status, shouldTreatAsMainStatus);
                                                                                                    // Clear the clicked status option after processing
                                                                                                    setTimeout(() => {
                                                                                                        setClickedStatusOption(null);
                                                                                                    }, 100);
                                                                                                }, 150); // Slightly longer delay to show the click feedback
                                                                                            }}
                                                                                            // Prevent mousedown from triggering document click events
                                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                                        >
                                                                                            <div className="flex items-center justify-between">
                                                                                                <div className="text-sm font-medium text-left select-none">
                                                                                                    {statusName}
                                                                                                    {(isSubStatusView || isDirectSearchResult) && getMainStatusForSubStatus(statusName) && (
                                                                                                        <div className="text-xs text-gray-500 mt-1">
                                                                                                            Main Status: {getMainStatusForSubStatus(statusName)}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                                {/* Show arrow for main statuses in leads department (only when not searching) */}
                                                                                                {shouldTreatAsMainStatus && (
                                                                                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                                                                    </svg>
                                                                                                )}
                                                                                            </div>
                                                                                            {/* Show sub-status count for main statuses */}
                                                                                            {shouldTreatAsMainStatus && statusHierarchy[statusName] && statusHierarchy[statusName].length > 0 && (
                                                                                                <div className="text-xs text-gray-500 mt-1">
                                                                                                    {statusHierarchy[statusName].length} sub-status{statusHierarchy[statusName].length !== 1 ? 'es' : ''}
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
                                                                                            <div className="mb-2">
                                                                                                {department === "leads" && !showMainStatuses 
                                                                                                    ? 'No sub-statuses available' 
                                                                                                    : 'No statuses available'
                                                                                                }
                                                                                            </div>
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
                                                        {(() => {
                                                            // Try to format totalIncome from any available source
                                                            let income = lead.totalIncome || 
                                                                lead.eligibility_details?.totalIncome || 
                                                                lead.eligibility?.totalIncome ||
                                                                lead.dynamic_fields?.eligibility_details?.totalIncome || 
                                                                lead.dynamic_fields?.obligation_data?.eligibility?.totalIncome ||
                                                                lead.obligation_data?.eligibility?.totalIncome ||
                                                                lead.dynamic_fields?.financial_details?.monthly_income ||
                                                                lead.salary;
                                                            
                                                            // Check if income is an object (this is causing the error)
                                                            if (income && typeof income === 'object') {
                                                                // If it has a totalIncome property, use that
                                                                if (income.totalIncome !== undefined) {
                                                                    income = income.totalIncome;
                                                                } else {
                                                                    // Otherwise convert the object to a string for safety
                                                                    income = JSON.stringify(income);
                                                                }
                                                            }
                                                            
                                                            // If we have a value, format it properly
                                                            if (income) {
                                                                // Remove commas if the value is already formatted
                                                                if (typeof income === 'string' && income.includes(',')) {
                                                                    return income; // Already formatted
                                                                }
                                                                return formatCurrency(income);
                                                            }
                                                            return "-";
                                                        })()}
                                                    </td>
                                                    <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                        {(() => {
                                                            // Try to find eligibility amount from multiple possible paths
                                                            const findEligibilityValue = () => {
                                                                // Direct properties on lead object
                                                                if (lead.eligibility !== undefined && typeof lead.eligibility !== 'object') return lead.eligibility;
                                                                if (lead.loan_eligibility !== undefined && typeof lead.loan_eligibility !== 'object') return lead.loan_eligibility;
                                                                if (lead.eligibility_amount !== undefined && typeof lead.eligibility_amount !== 'object') return lead.eligibility_amount;
                                                                if (lead.loan_amount !== undefined && typeof lead.loan_amount !== 'object') return lead.loan_amount;
                                                                if (lead.eligible_amount !== undefined && typeof lead.eligible_amount !== 'object') return lead.eligible_amount;
                                                                
                                                                // Check in dynamic fields
                                                                const df = lead.dynamic_fields || {};
                                                                if (df.eligibility_details?.eligible_amount !== undefined) return df.eligibility_details.eligible_amount;
                                                                if (df.eligibility?.amount !== undefined) return df.eligibility.amount;
                                                                if (df.eligibility_amount !== undefined) return df.eligibility_amount;
                                                                if (df.loan_eligibility !== undefined) return df.loan_eligibility;
                                                                if (df.loan_amount !== undefined) return df.loan_amount;
                                                                
                                                                // Check in obligation data
                                                                const od = lead.obligation_data || {};
                                                                if (od.eligibility?.amount !== undefined) return od.eligibility.amount;
                                                                if (od.eligible_amount !== undefined) return od.eligible_amount;
                                                                if (od.eligibility_amount !== undefined) return od.eligibility_amount;
                                                                if (od.loan_amount !== undefined) return od.loan_amount;
                                                                
                                                                // Check for nested structures in obligation section
                                                                if (od.financial_details?.eligibility !== undefined) return od.financial_details.eligibility;
                                                                if (od.financial_details?.loan_amount !== undefined) return od.financial_details.loan_amount;
                                                                if (od.financial?.eligibility !== undefined) return od.financial.eligibility;
                                                                if (od.financial?.loan_eligibility !== undefined) return od.financial.loan_eligibility;
                                                                if (od.financial?.eligible_amount !== undefined) return od.financial.eligible_amount;
                                                                
                                                                // Check for eligibility object directly
                                                                if (typeof lead.eligibility === 'object' && lead.eligibility !== null) {
                                                                    const e = lead.eligibility;
                                                                    if (e.amount !== undefined) return e.amount;
                                                                    if (e.eligibility_amount !== undefined) return e.eligibility_amount;
                                                                    if (e.loan_amount !== undefined) return e.loan_amount;
                                                                    if (e.eligible_amount !== undefined) return e.eligible_amount;
                                                                    if (e.eligibility !== undefined) return e.eligibility;
                                                                    if (e.value !== undefined) return e.value;
                                                                }
                                                                
                                                                // Check for financials or other common sections
                                                                if (lead.financials?.eligibility !== undefined) return lead.financials.eligibility;
                                                                if (lead.financials?.eligible_amount !== undefined) return lead.financials.eligible_amount;
                                                                if (lead.financials?.loan_eligibility !== undefined) return lead.financials.loan_eligibility;
                                                                
                                                                // Try to extract from loan_details if it exists
                                                                if (lead.loan_details?.eligibility !== undefined) return lead.loan_details.eligibility;
                                                                if (lead.loan_details?.eligible_amount !== undefined) return lead.loan_details.eligible_amount;
                                                                
                                                                // Return a placeholder value when no eligibility data is found
                                                                return "N/A";
                                                            };
                                                            
                                                            const eligibilityValue = findEligibilityValue();
                                                            if (!eligibilityValue && eligibilityValue !== 0) {
                                                                return "N/A"; // Display N/A when no eligibility data is found
                                                            }
                                                            
                                                            // If it's a number or string, format directly
                                                            if (typeof eligibilityValue === 'number' || 
                                                                (typeof eligibilityValue === 'string' && !eligibilityValue.includes('{'))) {
                                                                return formatCurrency(eligibilityValue);
                                                            }
                                                            
                                                            // If it's an object, try to find a numeric property
                                                            if (typeof eligibilityValue === 'object') {
                                                                // Look for common eligibility amount properties
                                                                const amount = eligibilityValue.amount || 
                                                                              eligibilityValue.eligibility_amount || 
                                                                              eligibilityValue.loan_amount || 
                                                                              eligibilityValue.eligible_amount ||
                                                                              eligibilityValue.eligibility;
                                                                              
                                                                if (amount !== undefined) {
                                                                    return formatCurrency(amount);
                                                                }
                                                                
                                                                // Try one more level deep for complex objects
                                                                for (const key in eligibilityValue) {
                                                                    if (typeof eligibilityValue[key] === 'number') {
                                                                        return formatCurrency(eligibilityValue[key]);
                                                                    }
                                                                }
                                                                
                                                                // If we can't find a suitable property, show dash
                                                                return "-";
                                                            }
                                                            
                                                            return "-";
                                                        })()}
                                                    </td>
                                                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">
                                                        {(() => {
                                                            // Try multiple paths for cibil_score
                                                            const cibilScore = lead.financial_details?.cibil_score || 
                                                                lead.dynamic_fields?.financial_details?.cibil_score ||
                                                                lead.obligation_data?.cibil_score ||
                                                                lead.obligation_data?.financial_details?.cibil_score ||
                                                                lead.dynamic_fields?.obligation_data?.cibil_score;
                                                            
                                                            // If it's an object, try to extract cibil_score property
                                                            if (cibilScore && typeof cibilScore === 'object') {
                                                                return cibilScore.cibil_score || cibilScore.score || "-";
                                                            }
                                                            
                                                            return cibilScore || "-";
                                                        })()}
                                                    </td>
                                                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">{typeof lead.city === 'object' ? lead.city?.name || "-" : lead.city || "-"}</td>
                                                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">{typeof lead.company_name === 'object' ? lead.company_name?.name || "-" : (lead.company_name) || "-"}</td>
                                                        <td className="text-md font-semibold py-2 px-4 whitespace-nowrap text-white">{
                                                            (() => {
                                                                // Show ONLY dynamic_fields.check_eligibility.company_category
                                                                const checkEligibilityCategory = lead.dynamic_fields?.check_eligibility?.company_category;
                                                                if (checkEligibilityCategory) {
                                                                    return typeof checkEligibilityCategory === 'object' ? 
                                                                        checkEligibilityCategory?.name || checkEligibilityCategory : 
                                                                        checkEligibilityCategory;
                                                                }
                                                                
                                                                return "-";
                                                            })()
                                                        }</td>
                                                    </tr>
                                                </React.Fragment>   
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Popup */}
            {showFilterPopup && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
                    <div className="bg-[#1b2230] border border-gray-600 rounded-lg p-6 w-[700px] max-w-[90vw] h-[550px] flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold text-white">Filter Leads</h2>
                            <button
                                onClick={() => {
                                    setShowFilterPopup(false);
                                    clearFilterSearchTerms();
                                }}
                                className="text-gray-400 hover:text-white text-2xl font-bold transition-colors duration-200"
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
                                            setSelectedFilterCategory('leadDate');
                                            clearFilterSearchTerms();
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'leadDate'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4" />
                                                <span className="text-sm">Lead Date</span>
                                            </div>
                                            {getFilterCategoryCount('leadDate') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('leadDate')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedFilterCategory('leadAge');
                                            clearFilterSearchTerms();
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'leadAge'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4" />
                                                Lead Age
                                            </div>
                                            {getFilterCategoryCount('leadAge') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('leadAge')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedFilterCategory('createdBy');
                                            clearFilterSearchTerms();
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'createdBy'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                Created By
                                            </div>
                                            {getFilterCategoryCount('createdBy') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('createdBy')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedFilterCategory('status');
                                            clearFilterSearchTerms();
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'status'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" />
                                                Status
                                            </div>
                                            {getFilterCategoryCount('status') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('status')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedFilterCategory('teamName');
                                            clearFilterSearchTerms();
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'teamName'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                Team Name
                                            </div>
                                            {getFilterCategoryCount('teamName') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('teamName')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedFilterCategory('assignedTL');
                                            clearFilterSearchTerms();
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'assignedTL'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                Assigned TL
                                            </div>
                                            {getFilterCategoryCount('assignedTL') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('assignedTL')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedFilterCategory('leadActivity');
                                            clearFilterSearchTerms();
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedFilterCategory === 'leadActivity'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-[#2a3441]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4" />
                                                Lead Activity
                                            </div>
                                            {getFilterCategoryCount('leadActivity') > 0 && (
                                                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                    {getFilterCategoryCount('leadActivity')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Right side - Selected Category Options */}
                            <div className="col-span-2 overflow-y-auto">
                                <div className="h-full">
                                    {/* Lead Date Filter */}
                                    {selectedFilterCategory === 'leadDate' && (
                                        <div>
                                            <h3 className="text-base font-medium text-gray-300 mb-4">Lead Date Range</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">From Date</label>
                                                    <input
                                                        type="date"
                                                        value={filterOptions.leadDateFrom}
                                                        onChange={(e) => setFilterOptions({ ...filterOptions, leadDateFrom: e.target.value })}
                                                        className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">To Date</label>
                                                    <input
                                                        type="date"
                                                        value={filterOptions.leadDateTo}
                                                        onChange={(e) => setFilterOptions({ ...filterOptions, leadDateTo: e.target.value })}
                                                        className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setFilterOptions({ ...filterOptions, leadDateFrom: '', leadDateTo: '' })}
                                                className="mt-4 text-xs text-blue-400 hover:text-blue-300"
                                            >
                                                Clear Date Range
                                            </button>
                                        </div>
                                    )}

                                    {/* Lead Age Filter */}
                                    {selectedFilterCategory === 'leadAge' && (
                                        <div>
                                            <h3 className="text-base font-medium text-gray-300 mb-4">Lead Age Range (Days)</h3>
                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">From Age (Days)</label>
                                                    <input
                                                        type="number"
                                                        value={filterOptions.leadAgeFrom}
                                                        onChange={(e) => setFilterOptions({ ...filterOptions, leadAgeFrom: e.target.value })}
                                                        className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">To Age (Days)</label>
                                                    <input
                                                        type="number"
                                                        value={filterOptions.leadAgeTo}
                                                        onChange={(e) => setFilterOptions({ ...filterOptions, leadAgeTo: e.target.value })}
                                                        className="w-full bg-[#2a3441] border border-gray-600 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                                                        placeholder="365"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setFilterOptions({ ...filterOptions, leadAgeFrom: '', leadAgeTo: '' })}
                                                className="text-xs text-blue-400 hover:text-blue-300"
                                            >
                                                Clear Age Range
                                            </button>
                                        </div>
                                    )}

                                    {/* Created By Filter */}
                                    {selectedFilterCategory === 'createdBy' && (
                                        <div>
                                            <h3 className="text-base font-medium text-gray-300 mb-4">Created By</h3>
                                            
                                            {/* Search bar */}
                                            <div className="mb-4">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search creators..."
                                                        value={createdBySearch}
                                                        onChange={(e) => setCreatedBySearch(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm placeholder-gray-500 transition-all duration-200"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                                {filteredCreators.map((creator) => (
                                                    <label key={creator} className="flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            name="createdBy"
                                                            value={creator}
                                                            checked={filterOptions.createdBy?.includes(creator) || false}
                                                            onChange={(e) => {
                                                                const currentValues = filterOptions.createdBy || [];
                                                                let newValues;
                                                                if (e.target.checked) {
                                                                    newValues = [...currentValues, e.target.value];
                                                                } else {
                                                                    newValues = currentValues.filter(val => val !== e.target.value);
                                                                }
                                                                setFilterOptions({ ...filterOptions, createdBy: newValues });
                                                            }}
                                                            className="accent-blue-500 mr-2"
                                                        />
                                                        <span className="text-gray-300">{creator}</span>
                                                    </label>
                                                ))}
                                                {filteredCreators.length === 0 && createdBySearch && (
                                                    <div className="text-gray-500 text-sm py-2">No creators found matching "{createdBySearch}"</div>
                                                )}
                                                <label className="flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        name="clearCreatedBy"
                                                        checked={!filterOptions.createdBy || filterOptions.createdBy.length === 0}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFilterOptions({ ...filterOptions, createdBy: [] });
                                                            }
                                                        }}
                                                        className="accent-blue-500 mr-2"
                                                    />
                                                    <span className="text-gray-300">All Creators</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Status Filter */}
                                    {selectedFilterCategory === 'status' && (
                                        <div>
                                            <h3 className="text-base font-medium text-gray-300 mb-4">Status</h3>
                                            
                                            {/* Search bar */}
                                            <div className="mb-4">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search statuses..."
                                                        value={statusSearch}
                                                        onChange={(e) => setStatusSearch(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm placeholder-gray-500 transition-all duration-200"
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* Clear All / Select All buttons */}
                                            <div className="flex gap-2 mb-4">
                                                <button
                                                    onClick={() => {
                                                        setFilterOptions({
                                                            ...filterOptions,
                                                            selectedStatuses: []
                                                        });
                                                        setTimeout(() => {
                                                            setDisplayedItemsCount(50); // Reset to initial count
                                                        }, 0);
                                                    }}
                                                    className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                                                >
                                                    Clear All
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        // Get all available statuses
                                                        const allAvailableStatuses = [];
                                                        Object.entries(getFilteredStatuses()).forEach(([mainStatus, subStatuses]) => {
                                                            allAvailableStatuses.push(mainStatus);
                                                            if (Array.isArray(subStatuses)) {
                                                                subStatuses.forEach(subStatus => {
                                                                    const statusName = typeof subStatus === 'object' ? subStatus.name : subStatus;
                                                                    if (statusName && statusName !== mainStatus) {
                                                                        allAvailableStatuses.push(statusName);
                                                                    }
                                                                });
                                                            }
                                                        });
                                                        
                                                        setFilterOptions({
                                                            ...filterOptions,
                                                            selectedStatuses: [...new Set(allAvailableStatuses)]
                                                        });
                                                        setTimeout(() => {
                                                            setDisplayedItemsCount(50); // Reset to initial count
                                                        }, 0);
                                                    }}
                                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                                >
                                                    Select All Visible
                                                </button>
                                            </div>
                                            
                                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                                {/* Status info message */}
                                                {(!filterOptions.selectedStatuses || filterOptions.selectedStatuses.length === 0) && (
                                                    <div className="mb-3 p-2 bg-green-900/20 border border-green-700/30 rounded text-green-300 text-sm">
                                                        ✓ Showing all statuses (no filter applied)
                                                    </div>
                                                )}
                                                {filterOptions.selectedStatuses && filterOptions.selectedStatuses.length > 0 && (
                                                    <div className="mb-3 p-2 bg-blue-900/20 border border-blue-700/30 rounded text-blue-300 text-sm">
                                                        📋 Filtering by {filterOptions.selectedStatuses.length} selected status(es)
                                                    </div>
                                                )}
                                                
                                                {Object.keys(getFilteredStatuses()).length > 0 ? (
                                                    Object.keys(getFilteredStatuses()).map(parentStatus => (
                                                        <div key={parentStatus} className="mb-4">
                                                            {/* Parent Status */}
                                                            <label className="flex items-center cursor-pointer font-medium text-blue-300 mb-2">
                                                                <input
                                                                    type="checkbox"
                                                                    className="accent-blue-500 mr-2"
                                                                    checked={filterOptions.selectedStatuses?.includes(parentStatus) || false}
                                                                    onChange={(e) => {
                                                                        const currentSelected = filterOptions.selectedStatuses || [];
                                                                        const newSelected = e.target.checked
                                                                            ? [...currentSelected, parentStatus]
                                                                            : currentSelected.filter(s => s !== parentStatus);
                                                                        const newFilterOptions = {
                                                                            ...filterOptions,
                                                                            selectedStatuses: newSelected
                                                                        };
                                                                        setFilterOptions(newFilterOptions);
                                                                        
                                                                        // Apply filter immediately
                                                                        setTimeout(() => {
                                                                            setDisplayedItemsCount(50); // Reset to initial count
                                                                        }, 0);
                                                                    }}
                                                                />
                                                                <span className="text-blue-300">{parentStatus}</span>
                                                            </label>
                                                            
                                                            {/* Sub-statuses */}
                                                            {getFilteredStatuses()[parentStatus] && getFilteredStatuses()[parentStatus].length > 0 && (
                                                                <div className="ml-6 space-y-1">
                                                                    {getFilteredStatuses()[parentStatus].map(subStatus => {
                                                                        const statusName = typeof subStatus === 'object' ? subStatus.name : subStatus;
                                                                        return statusName && statusName !== parentStatus ? (
                                                                            <label key={statusName} className="flex items-center cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="accent-blue-500 mr-2"
                                                                                    checked={filterOptions.selectedStatuses?.includes(statusName) || false}
                                                                                    onChange={(e) => {
                                                                                        const currentSelected = filterOptions.selectedStatuses || [];
                                                                                        const newSelected = e.target.checked
                                                                                            ? [...currentSelected, statusName]
                                                                                            : currentSelected.filter(s => s !== statusName);
                                                                                        const newFilterOptions = {
                                                                                            ...filterOptions,
                                                                                            selectedStatuses: newSelected
                                                                                        };
                                                                                        setFilterOptions(newFilterOptions);
                                                                                        
                                                                                        // Apply filter immediately
                                                                                        setTimeout(() => {
                                                                                            setDisplayedItemsCount(50); // Reset to initial count
                                                                                        }, 0);
                                                                                    }}
                                                                                />
                                                                                <span className="text-gray-300 text-sm">{statusName}</span>
                                                                            </label>
                                                                        ) : null;
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : statusSearch ? (
                                                    <div className="text-gray-500 text-sm py-4 text-center">
                                                        No statuses found matching "{statusSearch}"
                                                    </div>
                                                ) : (
                                                    // Fallback while API data loads
                                                    <div className="text-center py-4">
                                                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                                        <span className="text-gray-400 text-sm">Loading status options...</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Team Name Filter */}
                                    {selectedFilterCategory === 'teamName' && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-300 mb-3">Team Name</h3>
                                            
                                            {/* Search bar */}
                                            <div className="mb-4">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search teams..."
                                                        value={teamNameSearch}
                                                        onChange={(e) => setTeamNameSearch(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm placeholder-gray-500 transition-all duration-200"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                {filteredTeams.map((team) => (
                                                    <label key={team} className="flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            name="teamName"
                                                            value={team}
                                                            checked={filterOptions.teamName?.includes(team) || false}
                                                            onChange={(e) => {
                                                                const currentValues = filterOptions.teamName || [];
                                                                let newValues;
                                                                if (e.target.checked) {
                                                                    newValues = [...currentValues, e.target.value];
                                                                } else {
                                                                    newValues = currentValues.filter(val => val !== e.target.value);
                                                                }
                                                                setFilterOptions({ ...filterOptions, teamName: newValues });
                                                            }}
                                                            className="accent-blue-500 mr-2"
                                                        />
                                                        <span className="text-gray-300">{team}</span>
                                                    </label>
                                                ))}
                                                {filteredTeams.length === 0 && teamNameSearch && (
                                                    <div className="text-gray-500 text-sm py-2">No teams found matching "{teamNameSearch}"</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Assigned TL Filter */}
                                    {selectedFilterCategory === 'assignedTL' && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-300 mb-3">Assigned TL</h3>
                                            
                                            {/* Search bar */}
                                            <div className="mb-4">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search team leaders..."
                                                        value={assignedTLSearch}
                                                        onChange={(e) => setAssignedTLSearch(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm placeholder-gray-500 transition-all duration-200"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                {getFilteredAssignedTL().map((tl) => (
                                                    <label key={tl} className="flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            name="assignedTL"
                                                            value={tl}
                                                            checked={filterOptions.assignedTL?.includes(tl) || false}
                                                            onChange={(e) => {
                                                                const currentValues = filterOptions.assignedTL || [];
                                                                let newValues;
                                                                if (e.target.checked) {
                                                                    newValues = [...currentValues, e.target.value];
                                                                } else {
                                                                    newValues = currentValues.filter(val => val !== e.target.value);
                                                                }
                                                                setFilterOptions({ ...filterOptions, assignedTL: newValues });
                                                            }}
                                                            className="accent-blue-500 mr-2"
                                                        />
                                                        <span className="text-gray-300">{tl}</span>
                                                    </label>
                                                ))}
                                                {getFilteredAssignedTL().length === 0 && assignedTLSearch && (
                                                    <div className="text-gray-500 text-sm py-2">No team leaders found matching "{assignedTLSearch}"</div>
                                                )}
                                                <label className="flex items-center cursor-pointer mt-4">
                                                    <input
                                                        type="checkbox"
                                                        name="clearAssignedTL"
                                                        checked={!filterOptions.assignedTL || filterOptions.assignedTL.length === 0}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFilterOptions({ ...filterOptions, assignedTL: [] });
                                                            }
                                                        }}
                                                        className="accent-blue-500 mr-2"
                                                    />
                                                    <span className="text-gray-300">All TLs</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Lead Activity Filter */}
                                    {selectedFilterCategory === 'leadActivity' && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-300 mb-3">Lead Activity</h3>
                                            <div className="space-y-4">
                                                {/* No Activity Checkbox */}
                                                <label className="flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        name="noActivity"
                                                        checked={filterOptions.noActivity || false}
                                                        onChange={(e) => {
                                                            setFilterOptions({ 
                                                                ...filterOptions, 
                                                                noActivity: e.target.checked,
                                                                // Clear date if no activity is unchecked
                                                                noActivityDate: e.target.checked ? filterOptions.noActivityDate : ''
                                                            });
                                                        }}
                                                        className="accent-blue-500 mr-2"
                                                    />
                                                    <span className="text-gray-300">No Activity</span>
                                                </label>

                                                {/* Date picker - only show when No Activity is checked */}
                                                {filterOptions.noActivity && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                                            Activity Date
                                                        </label>
                                                        <input
                                                            type="date"
                                                            value={filterOptions.noActivityDate || ''}
                                                            onChange={(e) => setFilterOptions({ 
                                                                ...filterOptions, 
                                                                noActivityDate: e.target.value 
                                                            })}
                                                            className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex justify-between mt-6 pt-4 border-t border-gray-600">
                            <button
                                onClick={() => {
                                    const currentMonth = getCurrentMonthRange();
                                    setFilterOptions({
                                        leadDateFrom: currentMonth.from, // Reset to current month start
                                        leadDateTo: currentMonth.to,     // Reset to current month end
                                        leadAgeFrom: '',
                                        leadAgeTo: '',
                                        createdBy: [],
                                        leadParentStatus: [],
                                        leadAllStatus: [],
                                        teamName: [],
    return null;
});

export default LeadCRM;
