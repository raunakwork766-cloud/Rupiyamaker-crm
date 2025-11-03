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
    return <div>Test</div>;
});
export default LeadCRM;
